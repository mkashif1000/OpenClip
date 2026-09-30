import type { TitleStyle } from '@/types';
import { NumberControl as Num, EditorColor as Color, ControlGroup as Group } from './EditorControls';

export function TitleAdvancedControls({ style: s, onChange: change }: { style: TitleStyle; onChange: (patch: Partial<TitleStyle>) => void }) {
  return <>
    <Group title="Position & spacing">
      <Num label="Title horizontal position" value={s.position_x ?? 50} min={0} max={100} unit="%" onChange={(v) => change({ position_x: v })} />
      <select aria-label="Title alignment" value={s.text_align ?? 'center'} onChange={(e) => change({ text_align: e.target.value as TitleStyle['text_align'] })} className="w-full p-2.5 rounded-lg bg-[#232326] border border-white/10 text-xs"><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option></select>
      <Num label="Title letter spacing" value={s.letter_spacing ?? 0} min={-2} max={12} step={0.5} unit="px" onChange={(v) => change({ letter_spacing: v })} />
      <Num label="Title line spacing" value={s.line_height ?? 1.3} min={0.8} max={2} step={0.05} unit="×" onChange={(v) => change({ line_height: v })} />
      <Num label="Title rotation" value={s.rotation ?? 0} min={-30} max={30} unit="°" onChange={(v) => change({ rotation: v })} />
    </Group>
    <Group title="Outline & shadow">
      <Num label="Title outline thickness" value={s.outline_width ?? 0} min={0} max={16} step={0.5} unit="px" onChange={(v) => change({ outline_width: v })} />
      <div className="grid grid-cols-2 gap-3"><Color label="Title outline color" value={s.outline_color ?? '#000000'} onChange={(v) => change({ outline_color: v })} /><Color label="Title shadow color" value={s.shadow_color ?? '#000000'} onChange={(v) => change({ shadow_color: v })} /></div>
      <Num label="Title blur / glow" value={s.shadow_blur ?? (s.bg_opacity <= 0.001 ? Math.max(4, (s.font_size ?? 32) * 0.12) : 0)} min={0} max={40} unit="px" onChange={(v) => change({ shadow_blur: v })} />
      <Num label="Title shadow horizontal" value={s.shadow_x ?? 0} min={-20} max={20} unit="px" onChange={(v) => change({ shadow_x: v })} />
      <Num label="Title shadow vertical" value={s.shadow_y ?? (s.bg_opacity <= 0.001 ? 2 : 0)} min={-20} max={20} unit="px" onChange={(v) => change({ shadow_y: v })} />
    </Group>
  </>;
}
