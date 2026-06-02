import React from 'react';
import { useNotifications } from '@/lib/NotificationContext';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { soundEngine } from '@/lib/soundEngine';

export default function SoundSettings() {
  const { soundMuted, setSoundMuted, soundVolume, setSoundVolume } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 h-8">
          {soundMuted ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" /> : <Volume2 className="w-3.5 h-3.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Alert Sounds</span>
          <Button
            size="sm"
            variant={soundMuted ? 'destructive' : 'outline'}
            onClick={() => setSoundMuted(!soundMuted)}
            className="h-7 text-xs gap-1"
          >
            {soundMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            {soundMuted ? 'Muted' : 'On'}
          </Button>
        </div>

        {!soundMuted && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Volume: {Math.round(soundVolume * 100)}%</p>
            <div className="flex items-center gap-2">
              <VolumeX className="w-3 h-3 text-muted-foreground" />
              <Slider
                value={[Math.round(soundVolume * 100)]}
                min={0} max={100} step={10}
                onValueChange={([v]) => setSoundVolume(v / 100)}
                className="flex-1"
              />
              <Volume2 className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        )}

        <div className="border-t pt-2">
          <p className="text-[10px] text-muted-foreground mb-1.5">Test sounds</p>
          <div className="flex gap-1.5">
            <button onClick={() => soundEngine.testSound('info')}
              className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
              Info
            </button>
            <button onClick={() => soundEngine.testSound('warning')}
              className="text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
              Warning
            </button>
            <button onClick={() => soundEngine.testSound('critical')}
              className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
              Critical
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}