import { Monitor, Smartphone } from 'lucide-react';
import { useStyleStore } from '@/stores/styleStore';
import { FORMAT_PRESETS } from '@/types';
import { cn } from '@/lib/cn';

export function ExportFormatPanel() {
  const { styles, setExportSettings } = useStyleStore();
  const current = styles.export;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text">Export Format</h3>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(FORMAT_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => setExportSettings({ format: key, width: preset.width, height: preset.height })}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              current.format === key
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:border-accent/30'
            )}
          >
            {preset.vertical ? (
              <Smartphone className={cn('w-5 h-5 shrink-0', current.format === key ? 'text-accent' : 'text-text-dim')} />
            ) : (
              <Monitor className={cn('w-5 h-5 shrink-0', current.format === key ? 'text-accent' : 'text-text-dim')} />
            )}
            <div>
              <p className={cn('text-sm font-medium', current.format === key ? 'text-accent' : 'text-text')}>
                {preset.label}
              </p>
              <p className="text-[10px] text-text-muted">
                {key === 'match_source' ? 'Same as your video (max 1080p)' : `${preset.width}x${preset.height}`}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">Quality (CRF): {current.crf}</label>
          <input
            type="range"
            min={15}
            max={35}
            value={current.crf}
            onChange={(e) => setExportSettings({ crf: Number(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[9px] text-text-dim">
            <span>High quality</span>
            <span>Smaller file</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Preset</label>
          <select
            value={current.preset}
            onChange={(e) => setExportSettings({ preset: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
          >
            <option value="ultrafast">Ultrafast</option>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow (better quality)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
