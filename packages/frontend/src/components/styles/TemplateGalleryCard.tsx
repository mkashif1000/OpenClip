import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PodcastTemplate } from '@/data/premadeTemplates';

/** Shared gallery presentation for the Advanced and Quick workspaces. */
export function TemplateGalleryCard({ template, onClick, selected, disabled, label, style }: {
  template: PodcastTemplate;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  style?: CSSProperties;
}) {
  const creator = template.category === 'creator';
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={selected}
      data-template-card={creator ? 'creator' : 'podcast'} title={creator ? template.blurb : undefined}
      className={cn('relative flex min-w-0 rounded-xl glass-subtle border p-3 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none',
        creator ? 'flex-col items-center gap-2 text-center' : 'items-center gap-3 text-left',
        selected ? 'border-white/60 bg-white/[.08]' : 'border-white/8 hover:border-white/20 hover:bg-white/4')}
      style={style}>
      <div className={cn('shrink-0 aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 relative', creator ? 'w-[64px]' : 'w-[78px]')}>
        <TemplateThumbnail template={template} />
      </div>
      <div className="min-w-0">
        <p className={cn('font-semibold text-text', creator ? 'text-[12px] leading-tight' : 'text-[13px] mb-0.5')}>{template.name}</p>
        {!creator && <p className="text-[11px] text-text-dim leading-snug">{template.blurb}</p>}
      </div>
      {selected && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black" aria-hidden="true"><Check size={11} strokeWidth={3} /></span>}
    </button>
  );
}

// ─── Compact tile thumbnail ──────────────────────────────────────────

/** Neutral "footage" fill that reads as a video frame but stays on-theme
 *  (monochrome zinc, soft top sheen) instead of a flat bluish gray block. */
const VIDEO_FILL: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 50% 32%, rgba(255,255,255,0.18), transparent 62%), ' +
    'linear-gradient(165deg, #52525b 0%, #27272a 55%, #18181b 100%)',
};
const CAP_SHADOW = '0 1px 1.5px rgba(0,0,0,0.95)';

export function TemplateThumbnail({ template }: { template: PodcastTemplate }) {
  // Clean Captions — full-bleed footage, bold karaoke caption near the bottom.
  if (template.id === 'pod_clean_captions') {
    return (
      <div className="absolute inset-0" style={VIDEO_FILL}>
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '12%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">THIS </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>CHANGES</span>
          <span className="text-[6px] font-extrabold text-white"> ALL</span>
        </div>
      </div>
    );
  }
  // Title + Captions — rounded title bar up top, karaoke caption at the bottom.
  if (template.id === 'pod_title_captions') {
    return (
      <div className="absolute inset-0" style={VIDEO_FILL}>
        <div
          className="absolute left-1 right-1 rounded-[3px] bg-black/75 px-1 py-[2px] text-center leading-[1.05]"
          style={{ top: '15%' }}
        >
          <span className="text-[5px] font-bold text-white">THE </span>
          <span className="text-[5px] font-bold" style={{ color: '#FFD23F' }}>TRUTH</span>
        </div>
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '12%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">WHY IT </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>MATTERS</span>
        </div>
      </div>
    );
  }
  // Two-Speaker Split — two stacked footage rows with a karaoke caption on the seam.
  if (template.id === 'pod_two_speaker_split') {
    return (
      <div className="absolute inset-0 bg-black">
        <div className="absolute left-0 right-0 top-0" style={{ height: '49.5%', ...VIDEO_FILL }} />
        <div className="absolute left-0 right-0 bottom-0" style={{ height: '49.5%', ...VIDEO_FILL }} />
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '42%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">THEY </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>AGREE</span>
        </div>
      </div>
    );
  }
  // Boxed Video — black backdrop, rounded inset video, multi-color title above,
  // caption below. Geometry mirrors the template defaults (88% × 45% @ 26%).
  if (template.id === 'pod_boxed_video') {
    return (
      <div className="absolute inset-0 bg-black">
        <div className="absolute left-0.5 right-0.5 text-center leading-[1.05]" style={{ top: '9%', textShadow: CAP_SHADOW }}>
          <span className="text-[5px] font-extrabold text-white">WHY IT </span>
          <span className="text-[5px] font-extrabold" style={{ color: '#FFD23F' }}>MATTERS</span>
        </div>
        <div
          className="absolute rounded-[4px] ring-1 ring-white/10"
          style={{ left: '6%', right: '6%', top: '26%', height: '45%', ...VIDEO_FILL }}
        />
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '10%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">IT </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFD23F' }}>FEELS</span>
        </div>
      </div>
    );
  }
  // Generic fallback (creator styles + future templates): footage fill with a
  // caption line rendered in the template's OWN font/colors/preset.
  const s = template.styles();
  const sub = s.subtitle;
  const pill = sub.preset === 'box';
  const bar = sub.preset === 'minimal';
  return (
    <div className="absolute inset-0" style={VIDEO_FILL}>
      <div
        className={cn('absolute inset-x-0.5 text-center leading-[1.1]', bar && 'mx-1 rounded-[2px] bg-black/60 py-px')}
        style={{ bottom: '14%', textShadow: bar ? 'none' : CAP_SHADOW, fontFamily: sub.font_name }}
      >
        <span className="text-[6px] font-extrabold" style={{ color: sub.primary_color }}>SO </span>
        <span
          className={cn('text-[6px] font-extrabold', pill && 'rounded-[2px] px-[2px]')}
          style={pill
            ? { color: '#fff', backgroundColor: sub.highlight_color, textShadow: 'none' }
            : { color: sub.highlight_color }}
        >
          GOOD
        </span>
      </div>
    </div>
  );
}

