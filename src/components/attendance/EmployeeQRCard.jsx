import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Renders a QR code for a single employee using qrcode.js CDN
export default function EmployeeQRCard({ employee }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!employee?.qr_code) return;
    const renderQR = () => {
      if (!window.QRCode || !canvasRef.current) return;
      canvasRef.current.innerHTML = '';
      new window.QRCode(canvasRef.current, {
        text: employee.qr_code,
        width: 160,
        height: 160,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    };
    if (window.QRCode) { renderQR(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    s.onload = renderQR;
    document.head.appendChild(s);
  }, [employee?.qr_code]);

  if (!employee) return null;

  return (
    <Card className="w-full max-w-[200px] text-center">
      <CardContent className="pt-4 pb-3 px-3 flex flex-col items-center gap-2">
        <div ref={canvasRef} className="flex items-center justify-center" />
        <div className="text-xs font-semibold text-foreground truncate w-full text-center">
          {employee.full_name}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          {employee.qr_code?.slice(0, 14)}…
        </div>
      </CardContent>
    </Card>
  );
}