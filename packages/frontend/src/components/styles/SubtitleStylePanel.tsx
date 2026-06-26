import { useStyleStore } from '@/stores/styleStore';
import { ColorInput } from './ColorInput';
import { CAPTION_PRESETS, type CaptionPreset } from '@/types';
import { cn } from '@/lib/cn';
import { FONT_OPTIONS } from '@/data/fonts';
import type { SubtitleStyle } from '@/types';

interface SubtitleStylePanelProps {
  value?: SubtitleStyle;
  onChange?: (update: Partial<SubtitleStyle>) => void;
  exportFormat?: string;
}

export function SubtitleStylePanel({ value, onChange, exportFormat }: SubtitleStylePanelProps = {}) {
  const globalStore = useStyleStore();
  const sub = value ?? globalStore.styles.subtitle;
  const setSubtitleStyle = onChange ?? globalStore.setSubtitleStyle;
  const format = exportFormat ?? globalStore.styles.export.format;
  const isVertical = format !== 'horizontal';
  const effectiveSize = sub.font_size ?? (isVertical ? 62 : 36);
  const effectiveMargin = sub.margin_v ?? (isVertical ? 120 : 60);

  const activePreset = sub.preset ?? 'karaoke';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text">Subtitle Style</h3>

      {/* Caption look presets — applied identically in preview and export */}
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Caption Style</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(CAPTION_PRESETS) as Array<[CaptionPreset, { label: string; description: string }]>).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setSubtitleStyle({ preset: key })}
              className={cn(
                'p-2 rounded-lg border text-left transition-all',
                activePreset === key
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface hover:border-accent/30'
              )}
            >
              <p className={cn('text-xs font-medium', activePreset === key ? 'text-accent' : 'text-text')}>{p.label}</p>
              <p className="text-[10px] text-text-muted">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Font</label>
        <select
          value={sub.font_name}
          onChange={(e) => setSubtitleStyle({ font_name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Font size slider */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Font Size: {effectiveSize}px</label>
        <input
          type="range"
          min={20}
          max={100}
          value={effectiveSize}
          onChange={(e) => setSubtitleStyle({ font_size: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      {/* Colors */}
      <ColorInput label="Text Color" value={sub.primary_color} onChange={(v) => setSubtitleStyle({ primary_color: v })} />
      <ColorInput label="Active Word Color" value={sub.highlight_color} onChange={(v) => setSubtitleStyle({ highlight_color: v })} />
      <ColorInput label="Outline Color" value={sub.outline_color} onChange={(v) => setSubtitleStyle({ outline_color: v })} />

      {/* Outline width */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Outline Width: {sub.outline_width}px</label>
        <input
          type="range"
          min={0}
          max={10}
          value={sub.outline_width}
          onChange={(e) => setSubtitleStyle({ outline_width: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Position (from bottom): {effectiveMargin}px</label>
        <input
          type="range"
          min={20}
          max={500}
          value={effectiveMargin}
          onChange={(e) => setSubtitleStyle({ margin_v: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>
    </div>
  );
}
