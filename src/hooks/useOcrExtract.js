/**
 * useOcrExtract
 * Uploads an image/PDF, then uses InvokeLLM vision to extract
 * { amount, date, vendor } and returns them for form pre-fill.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useOcrExtract() {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null); // { amount, date, vendor }

  const extractFromFile = async (file) => {
    setOcrLoading(true);
    setOcrResult(null);
    // 1. Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // 2. Run OCR via LLM vision
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an OCR assistant. Extract the following fields from this receipt or invoice image:
- total_amount: The final total amount as a number (no currency symbol). Look for "Total", "Grand Total", "Amount Due", "المبلغ الإجمالي" etc.
- date: The transaction/invoice date in YYYY-MM-DD format. If only month/year, use the 1st of that month.
- vendor: The business/vendor name as a short string (max 40 chars).

If a field cannot be found, return null for it. Return ONLY the JSON object, no explanation.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          total_amount: { type: 'number' },
          date: { type: 'string' },
          vendor: { type: 'string' },
        },
      },
    });

    setOcrResult(result);
    setOcrLoading(false);
    return { file_url, ocr: result };
  };

  return { extractFromFile, ocrLoading, ocrResult };
}