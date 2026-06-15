import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, QrCode, Barcode } from 'lucide-react';

export default function BarcodeGenerator({ product, onClose }) {
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);
  const [barcodeValue, setBarcodeValue] = useState(product?.barcode || product?.sku || product?.product_id || '');
  const [qrValue, setQrValue] = useState(product?.id || product?.barcode || '');
  const [barcodeError, setBarcodeError] = useState('');

  useEffect(() => {
    if (!barcodeRef.current || !barcodeValue) return;
    try {
      JsBarcode(barcodeRef.current, barcodeValue, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 10,
      });
      setBarcodeError('');
    } catch (e) {
      setBarcodeError('Invalid barcode value');
    }
  }, [barcodeValue]);

  useEffect(() => {
    if (!qrRef.current || !qrValue) return;
    QRCode.toCanvas(qrRef.current, qrValue, {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }, [qrValue]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const barcodeImg = barcodeRef.current?.toDataURL?.() || '';
    const qrImg = qrRef.current?.toDataURL?.() || '';
    printWindow.document.write(`
      <html><head><title>Barcode — ${product?.name || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        .label { border: 1px solid #ccc; padding: 12px; display: inline-block; margin: 8px; border-radius: 6px; }
        h3 { margin: 0 0 6px; font-size: 14px; }
        p { margin: 2px 0; font-size: 11px; color: #666; }
        img { max-width: 200px; }
      </style></head><body>
      <div class="label">
        <h3>${product?.name || 'Product'}</h3>
        ${product?.sku ? `<p>SKU: ${product.sku}</p>` : ''}
        ${barcodeImg ? `<img src="${barcodeImg}" alt="barcode" />` : ''}
        ${qrImg ? `<img src="${qrImg}" alt="qr" />` : ''}
      </div>
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleDownloadBarcode = () => {
    if (!barcodeRef.current) return;
    const link = document.createElement('a');
    link.download = `barcode-${barcodeValue}.png`;
    link.href = barcodeRef.current.toDataURL();
    link.click();
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const link = document.createElement('a');
    link.download = `qr-${qrValue}.png`;
    link.href = qrRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-semibold text-sm">{product?.name}</p>
        {product?.sku && <Badge variant="outline" className="text-xs mt-1">SKU: {product.sku}</Badge>}
      </div>

      <Tabs defaultValue="barcode">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="barcode" className="text-xs flex items-center gap-1">
            <Barcode className="w-3 h-3" /> Barcode
          </TabsTrigger>
          <TabsTrigger value="qr" className="text-xs flex items-center gap-1">
            <QrCode className="w-3 h-3" /> QR Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="barcode" className="space-y-3">
          <div>
            <Label className="text-xs">Barcode Value</Label>
            <Input
              value={barcodeValue}
              onChange={e => setBarcodeValue(e.target.value)}
              placeholder="Enter barcode number"
            />
            {barcodeError && <p className="text-xs text-destructive mt-1">{barcodeError}</p>}
          </div>
          {barcodeValue && !barcodeError && (
            <div className="flex justify-center bg-white p-3 rounded-lg border">
              <canvas ref={barcodeRef} />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={handleDownloadBarcode} disabled={!barcodeValue || !!barcodeError}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" className="flex-1" onClick={handlePrint} disabled={!barcodeValue || !!barcodeError}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="qr" className="space-y-3">
          <div>
            <Label className="text-xs">QR Code Value</Label>
            <Input
              value={qrValue}
              onChange={e => setQrValue(e.target.value)}
              placeholder="Enter QR content"
            />
          </div>
          {qrValue && (
            <div className="flex justify-center bg-white p-3 rounded-lg border">
              <canvas ref={qrRef} />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={handleDownloadQR} disabled={!qrValue}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" className="flex-1" onClick={handlePrint} disabled={!qrValue}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {onClose && (
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      )}
    </div>
  );
}
