import React, { useRef, useEffect, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Simple camera-based QR scanner using jsQR via CDN
// Falls back to manual entry if camera unavailable
export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [jsQRLoaded, setJsQRLoaded] = useState(false);

  // Load jsQR dynamically
  useEffect(() => {
    if (window.jsQR) { setJsQRLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => setJsQRLoaded(true);
    s.onerror = () => setError('QR library failed to load. Use manual entry.');
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!jsQRLoaded) return;
    startCamera();
    return () => stopCamera();
  }, [jsQRLoaded]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanLoop();
      }
    } catch {
      setError('Camera not available. Enter QR code manually.');
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !window.jsQR) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        stopCamera();
        onScan(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="w-4 h-4" /> Scan Employee QR Code
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} className="p-1 rounded hover:bg-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!error && (
        <div className="relative w-full max-w-sm aspect-square bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {/* Scanning frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/70 rounded-xl">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
            </div>
          </div>
          {scanning && (
            <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80 animate-pulse">
              Scanning…
            </div>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <div className="w-full text-center text-xs text-muted-foreground">— or enter code manually —</div>
      <div className="flex gap-2 w-full max-w-sm">
        <input
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          placeholder="Employee QR code"
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && manualCode) { stopCamera(); onScan(manualCode); } }}
        />
        <Button size="sm" onClick={() => { if (manualCode) { stopCamera(); onScan(manualCode); } }}>
          Submit
        </Button>
      </div>
    </div>
  );
}