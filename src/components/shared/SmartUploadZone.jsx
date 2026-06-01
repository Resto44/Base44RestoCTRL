/**
 * SmartUploadZone
 * Drop-in image upload with client-side compression + async OCR extraction.
 * Props:
 *   fileUrl      — current uploaded URL (controlled)
 *   onResult     — ({ file_url, ocr }) called after upload + OCR
 *   onViewImage  — called when user clicks the thumbnail to zoom
 *   label        — placeholder label text
 *   compact      — boolean, smaller layout
 */
import React, { useRef, useState } from 'react';
import { Camera, Loader2, CheckCircle2, ScanLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function compressImage(file, maxPx = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxPx && height <= maxPx) { resolve(file); return; }
      const ratio = Math.min(maxPx / width, maxPx / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

async function runOcr(file_url) {
  return base44.integrations.Core.InvokeLLM({
    prompt: `You are an OCR assistant for Arabic/English banking receipts and network transfer proofs.
Extract these fields from the image:
- amount: final transferred amount as a number (no currency symbol). Look for "المبلغ", "Total", "Amount", "المجموع".
- date: transaction date in YYYY-MM-DD format. Look for "التاريخ", "Date", "تاريخ العملية".
- invoice_number: transaction/reference ID or invoice number as a string. Look for "رقم العملية", "Reference", "Ref", "Transaction ID".
- branch: branch name or sender name if visible.
- notes: any extra relevant info (bank name, payment channel, account last 4 digits etc).

Return null for missing fields. Return ONLY valid JSON.`,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        date: { type: 'string' },
        invoice_number: { type: 'string' },
        branch: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  });
}

export default function SmartUploadZone({ fileUrl, onResult, onViewImage, label = 'Photo / file', compact = false }) {
  const inputRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | scanning | done | error

  const handleFile = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = '';

    setPhase('uploading');
    // 1. Compress
    const file = await compressImage(raw);

    // 2. Upload
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // 3. OCR async (non-blocking for UX, but we await before calling onResult)
    setPhase('scanning');
    let ocr = null;
    try {
      ocr = await runOcr(file_url);
    } catch (_) { /* OCR failure is non-fatal */ }

    setPhase('done');
    onResult({ file_url, ocr });
  };

  const stateLabel = {
    idle: label,
    uploading: 'Uploading…',
    scanning: 'Reading receipt…',
    done: '✓ Attached',
    error: 'Upload failed',
  }[phase];

  const isLoading = phase === 'uploading' || phase === 'scanning';

  if (fileUrl && phase === 'done') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onViewImage}
          className="flex items-center gap-2 border rounded-lg px-3 py-2 text-xs bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Receipt attached (tap to view)
        </button>
        <button
          type="button"
          onClick={() => { setPhase('idle'); onResult({ file_url: '', ocr: null }); }}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <label
      className={`flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg transition-colors
        ${isLoading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-muted/40'}
        ${compact ? 'p-2' : 'p-3'}`}
    >
      {isLoading
        ? (phase === 'scanning'
            ? <ScanLine className="w-4 h-4 text-primary animate-pulse" />
            : <Loader2 className="w-4 h-4 text-primary animate-spin" />)
        : <Camera className="w-4 h-4 text-muted-foreground" />}
      <span className="text-xs text-muted-foreground">{stateLabel}</span>
      {phase === 'scanning' && <span className="text-xs text-primary font-medium ml-auto">OCR…</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        disabled={isLoading}
      />
    </label>
  );
}