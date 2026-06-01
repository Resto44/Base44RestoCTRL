import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

// Numeric PIN pad for kiosk/tablet mode — tap to enter 4-digit PIN
export default function KioskPINPad({ onSubmit, loading }) {
  const [pin, setPin] = useState('');

  const press = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => { onSubmit(next); setPin(''); }, 150);
    }
  };

  const del = () => setPin(p => p.slice(0, -1));

  return (
    <div className="flex flex-col items-center gap-4">
      {/* PIN dots */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              i < pin.length ? 'bg-primary border-primary scale-110' : 'border-muted-foreground/40'
            }`}
          />
        ))}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, idx) => {
          if (k === '') return <div key={idx} />;
          const isBack = k === '⌫';
          return (
            <button
              key={idx}
              onClick={() => isBack ? del() : press(String(k))}
              disabled={loading}
              className={`w-16 h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 shadow-sm
                ${isBack
                  ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                  : 'bg-card border border-border hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              {isBack ? <Delete className="w-5 h-5 mx-auto" /> : k}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm text-muted-foreground animate-pulse">Checking…</p>}
    </div>
  );
}