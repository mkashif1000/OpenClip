import { useState } from 'react';
import { Eye, Film, Loader2, Volume2 } from 'lucide-react';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { useClipStore } from '@/stores/clipStore';
import { useStyleStore } from '@/stores/styleStore';
import type { Project } from '@/types';
import { mergeQuickStyle, styleQuickClip, type QuickStyleChoice } from './quickStyle';
import { useMediaUrl } from './useMediaUrl';

export function QuickStylePreview({ project, choice }: { project: Project | null; choice: QuickStyleChoice | null }) {
  const clips = useClipStore((s) => s.clips);
  const currentStyles = useStyleStore((s) => s.styles);
  const [clipId, setClipId] = useState('');
  const sourceClip = clips.find((item) => item.clip_id === clipId) ?? clips[0];
  const clip = sourceClip && choice ? styleQuickClip(sourceClip, choice) : sourceClip;
  const styles = choice ? mergeQuickStyle(choice, currentStyles) : currentStyles;
  const video = useMediaUrl(project?.video_file?.path);
  const track = project?.music_tracks?.find((item) => item.selected);
  const music = useMediaUrl(track?.path);
  const logo = project?.logo_config;
  const logoMedia = useMediaUrl(logo?.file_id);
  const layout = choice?.layout ?? 'standard';
  const splitLayout = layout !== 'standard' && layout !== 'boxed' && !(layout === 'pip' && choice?.pipConfig) ? layout : undefined;

  return (
    <section aria-label="Live style preview" className="quick-panel min-w-0 p-4 sm:p-5 xl:sticky xl:top-28">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Eye aria-hidden="true" className="h-4 w-4 text-[#f5f5f5]" /> Live preview</h2>
        <span className="quick-chip shrink-0 text-[10px]">Your footage</span>
      </div>
      <div className="mt-4 min-h-[72px]">
        <p className="quick-kicker">Previewing</p>
        <p className="mt-1 line-clamp-2 break-words text-lg font-semibold leading-snug tracking-tight text-white" title={choice?.name}>{choice?.name ?? 'Choose a template'}</p>
      </div>
      <label className="mt-4 block min-w-0 text-xs font-medium text-text-muted">
        <span className="flex items-center justify-between gap-2">Preview clip <span className="text-[10px] font-normal tabular-nums text-text-dim">{clips.length} available</span></span>
        <select aria-label="Preview clip" value={sourceClip?.clip_id ?? ''} onChange={(event) => setClipId(event.target.value)} className="quick-input mt-2 min-h-11 w-full min-w-0 rounded-xl px-3 py-2.5 text-xs text-white">
          {clips.map((item) => <option key={item.clip_id} value={item.clip_id}>{item.index}. {item.title}</option>)}
        </select>
      </label>
      <div className="mt-4 rounded-2xl border border-white/[.06] bg-[#0d0d0d] p-2 sm:p-3 lg:p-2">
        <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_8px_32px_rgba(0,0,0,0.25)] sm:max-w-[300px] lg:max-w-none" style={{ aspectRatio: `${styles.export.width > 0 ? styles.export.width : 9} / ${styles.export.height > 0 ? styles.export.height : 16}` }} data-preview-layout={layout}>
        {video.url && clip ? (
          <RemotionPreview
            key={clip.clip_id}
            clip={clip}
            videoSegmentUrl={video.url}
            overrideSubtitle={styles.subtitle}
            overrideTitle={styles.title}
            width={styles.export.width}
            height={styles.export.height}
            boxed={layout === 'boxed'}
            boxWidthPct={styles.export.box_width}
            boxHeightPct={styles.export.box_height}
            boxYPct={styles.export.box_y}
            boxRadiusPx={styles.export.box_radius}
            splitLayout={splitLayout}
            regionCrops={choice?.regionCrops}
            splitRange={choice?.layoutRange}
            overridePip={layout === 'pip' ? choice?.pipConfig : undefined}
            musicSrc={music.url}
            musicVolume={track?.volume}
            logoSrc={logoMedia.url}
            logoX={logo?.x} logoY={logo?.y} logoSize={logo?.size} logoOpacity={logo?.opacity}
            autoPlay={false} controls loop
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-xs leading-5 text-text-muted">
            {video.error ? <p role="alert" className="text-error">{video.error}</p> : !clip ? <><Film aria-hidden="true" className="h-8 w-8 text-white/20" /><p className="font-medium text-white/75">Your preview goes here</p><p>Load clips to preview.</p></> : <><Loader2 aria-label="Loading video" className="h-6 w-6 animate-spin text-[#f5f5f5] motion-reduce:animate-none" /><p>Preparing your clip…</p></>}
          </div>
        )}
        </div>
      </div>
      {(music.error || logoMedia.error) && <p role="alert" className="mt-3 text-xs text-error">{music.error || logoMedia.error}</p>}
      <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-text-muted"><Volume2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-dim" /><p>Press play to hear the original audio{track ? ' with your selected background track' : ''}.</p></div>
      <div className="quick-divider my-4 border-t border-white/[.08]" />
      <p className="text-[11px] leading-5 text-text-muted">Template choices are previews until you apply them.</p>
      <p className="mt-2 text-[10px] leading-[1.7] text-text-dim">Auto-tracking, transcript cuts, and B-roll are finalized during export.</p>
    </section>
  );
}
