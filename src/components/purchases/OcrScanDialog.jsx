/**
 * OcrScanDialog — Phase 7
 * Upload a PDF or image, extract invoice data using LLM vision,
 * and pre-fill the purchase invoice form.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScanLine, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { base44 } from '@/api/base44Client';

export default function OcrScanDialog({ onResult, onClose, branch, createdBy }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | processing | done | error
  const [extracted, setExtracted] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleScan = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      // Upload file to get a URL
      let fileUrl = '';
      try {
        const path = `ocr/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
          fileUrl = publicUrl;
        }
      } catch {
        // If storage fails, use base64 fallback
        fileUrl = await fileToBase64(file);
      }

      setStatus('processing');

      // Use LLM vision to extract invoice data
      let extractedData = {};
      try {
        const prompt = `You are an invoice OCR system. Extract the following fields from this invoice image/PDF and return ONLY valid JSON with these exact keys:
{
  "invoice_number": "string or null",
  "supplier_name": "string or null",
  "date": "YYYY-MM-DD format or null",
  "due_date": "YYYY-MM-DD format or null",
  "total_amount": number or null,
  "currency": "3-letter code or null"
}
Return ONLY the JSON object, no other text.`;

        const result = await base44.integrations.Core.InvokeLLM({
          prompt,
          image_url: fileUrl,
          response_json_schema: {
            type: 'object',
            properties: {
              invoice_number: { type: 'string' },
              supplier_name: { type: 'string' },
              date: { type: 'string' },
              due_date: { type: 'string' },
              total_amount: { type: 'number' },
              currency: { type: 'string' },
            },
          },
        });

        if (typeof result === 'string') {
          extractedData = JSON.parse(result);
        } else if (result && typeof result === 'object') {
          extractedData = result;
        }
      } catch (llmErr) {
        console.warn('[OCR] LLM extraction failed, using empty data:', llmErr.message);
        extractedData = {};
      }

      // Log OCR attempt
      try {
        await base44.entities.OcrLog.create({
          branch: branch || '',
          file_url: fileUrl,
          extracted_data: extractedData,
          status: 'processed',
          created_by: createdBy,
        });
      } catch { /* non-critical */ }

      setExtracted(extractedData);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message || 'OCR processing failed');
      setStatus('error');
    }
  };

  const handleApply = () => {
    onResult(extracted || {});
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> Scan Invoice (OCR)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Upload Invoice (PDF or Image)</Label>
            <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">{file ? file.name : 'Click to upload PDF, JPG, PNG'}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} />
            </label>
          </div>

          {status === 'idle' && (
            <Button onClick={handleScan} disabled={!file} className="w-full gap-2">
              <ScanLine className="w-4 h-4" /> Extract Invoice Data
            </Button>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {status === 'uploading' ? 'Uploading file...' : 'Extracting data with AI...'}
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" />{errorMsg}
            </div>
          )}

          {status === 'done' && extracted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Data extracted successfully
              </div>
              <div className="rounded-lg border border-border p-3 space-y-2 text-xs">
                {Object.entries(extracted).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">Review the extracted data above. Click Apply to pre-fill the form.</div>
              <div className="flex gap-2">
                <Button onClick={handleApply} className="flex-1">Apply to Form</Button>
                <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}

          {status !== 'done' && status !== 'idle' && status !== 'processing' && status !== 'uploading' && (
            <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
