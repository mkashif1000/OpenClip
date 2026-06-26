import { useStyleStore } from '@/stores/styleStore';
import { ColorInput } from './ColorInput';
import { FONT_OPTIONS } from '@/data/fonts';
import type { TitleStyle } from '@/types';

interface TitleStylePanelProps {
  value?: TitleStyle;
  onChange?: (update: Partial<TitleStyle>) => void;
}

export function TitleStylePanel({ value, onChange }: TitleStylePanelProps = {}) {
  const globalStore = useStyleStore();
  const t = value ?? globalStore.styles.title;
  const setTitleStyle = onChange ?? globalStore.setTitleStyle;
  const positionY = t.position_y ?? 5;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text">Title Overlay Style</h3>

      {/* Font family */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Font</label>
        <select
          value={t.font_name ?? 'Inter'}
          onChange={(e) => setTitleStyle({ font_name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Font size + max chars */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">Font Size</label>
          <input
            type="number"
            value={t.font_size ?? ''}
            onChange={(e) => setTitleStyle({ font_size: e.target.value ? Number(e.target.value) : null })}
            placeholder="Auto (32)"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Max Chars/Line</label>
          <input
            type="number"
            value={t.max_chars_per_line ?? ''}
            onChange={(e) => setTitleStyle({ max_chars_per_line: e.target.value ? Number(e.target.value) : null })}
            placeholder="Auto (25)"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Vertical Position slider */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Vertical Position: {positionY}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={positionY}
          onChange={(e) => setTitleStyle({ position_y: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[9px] text-text-dim mt-0.5">
          <span>Top</span>
          <span>Middle</span>
          <span>Bottom</span>
        </div>
      </div>

      {/* Padding */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Padding: {t.padding}px</label>
        <input
          type="range"
          min={5}
          max={40}
          value={t.padding}
          onChange={(e) => setTitleStyle({ padding: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      {/* Corner Radius */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Corner Radius: {t.border_radius ?? 6}px</label>
        <input
          type="range"
          min={0}
          max={40}
          value={t.border_radius ?? 6}
          onChange={(e) => setTitleStyle({ border_radius: Number(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[9px] text-text-dim mt-0.5">
          <span>Square</span>
          <span>Rounded</span>
        </div>
      </div>

      {/* Colors */}
      <ColorInput label="Text Color" value={t.font_color} onChange={(v) => setTitleStyle({ font_color: v })} />
      <ColorInput label="Highlight Color (key words)" value={t.highlight_color ?? '#FFD23F'} onChange={(v) => setTitleStyle({ highlight_color: v })} />
      <ColorInput label="Accent Color (2nd key word)" value={t.accent_color ?? '#FF4D4D'} onChange={(v) => setTitleStyle({ accent_color: v })} />
      <ColorInput label="Background Color" value={t.bg_color} onChange={(v) => setTitleStyle({ bg_color: v })} />

      {/* Background opacity */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Background Opacity: {Math.round(t.bg_opacity * 100)}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(t.bg_opacity * 100)}
          onChange={(e) => setTitleStyle({ bg_opacity: Number(e.target.value) / 100 })}
          className="w-full accent-accent"
        />
      </div>
    </div>
  );
}
