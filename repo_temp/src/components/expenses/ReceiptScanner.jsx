import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Upload, Loader2, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_MAP = {
  food: 'other', grocery: 'other', restaurant: 'other',
  electricity: 'utilities', water: 'utilities', internet: 'utilities', gas: 'utilities', telephone: 'utilities',
  rent: 'rent', lease: 'rent',
  salary: 'salaries', payroll: 'salaries',
  marketing: 'marketing', advertising: 'marketing',
  maintenance: 'maintenance', repair: 'maintenance', cleaning: 'maintenance',
};

function guessCategory(text) {
  const lower = (text || '').toLowerCase();
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'other';
}

export default function ReceiptScanner({ onExtracted, onClose }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this receipt image and extract: amount (number, no currency symbol), date (YYYY-MM-DD format), vendor/merchant name, and a brief description of what was purchased. If you cannot find a field, return null.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            date: { type: 'string' },
            vendor: { type: 'string' },
            description: { type: 'string' },
            category_hint: { type: 'string', description: 'One word describing the type of expense (rent, utilities, salaries, marketing, maintenance, or other)' },
          },
        },
      });
      const category = extracted.category_hint ? guessCategory(extracted.category_hint) : guessCategory(extracted.description);
      setResult({ ...extracted, category });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Camera className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium text-sm">Upload or take a photo of your receipt</p>
          <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Receipt" className="w-full max-h-48 object-contain bg-secondary/30" />
          {!result && !loading && (
            <button className="absolute top-2 right-2 bg-background/80 rounded-full p-1" onClick={() => { setPreview(null); setResult(null); }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {loading && (
        <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/20">
          <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium">Scanning receipt with AI...</p>
            <p className="text-xs text-muted-foreground">Extracting amount, date, and vendor</p>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-4 space-y-3 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Receipt scanned successfully</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {result.amount && <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{result.amount}</span></div>}
            {result.date && <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{result.date}</span></div>}
            {result.vendor && <div className="col-span-2"><span className="text-muted-foreground">Vendor:</span> <span className="font-semibold">{result.vendor}</span></div>}
            {result.description && <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-semibold">{result.description}</span></div>}
            <div><span className="text-muted-foreground">Category:</span> <span className="font-semibold capitalize">{result.category}</span></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={() => onExtracted(result)}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Pre-fill Form
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPreview(null); setResult(null); }}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>Cancel</Button>
    </div>
  );
}