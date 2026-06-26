import { useState, useEffect } from 'react';
import { X, Play, Dot } from 'lucide-react';
import { PIPEditor, DEFAULT_CONTENT_BOX, DEFAULT_SPEAKER_BOX, DEFAULT_SPLIT_RATIO } from '@/components/pip/PIPEditor';
import { SubtitleStylePanel } from '@/components/styles/SubtitleStylePanel';
import { TitleStylePanel } from '@/components/styles/TitleStylePanel';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { useStyleStore } from '@/stores/styleStore';
import { useProjectStore } from '@/stores/projectStore';

import type { PIPConfig, ClipData, SubtitleStyle, TitleStyle } from '@/types';

interface RePIPModalProps {
  clip: ClipData;
  onClose: () => void;
  onApply: (clipId: string, override: {
    pip?: {
      contentBox: PIPConfig['contentBox'];
      speakerBox: PIPConfig['speakerBox'];
      splitRatio: number;
      pipStartSec?: number;
      pipEndSec?: number;
    };
    subtitle?: Partial<SubtitleStyle>;
    title?: Partial<TitleStyle>;
  }) => void;
}

type Tab = 'pip' | 'subtitle' | 'title';

export function RePIPModal({ clip, onClose, onApply }: RePIPModalProps) {
  const globalStyles = useStyleStore((s) => s.styles);

  const [activeTab, setActiveTab] = useState<Tab>('pip');
  const [pipEnabled, setPipEnabled] = useState(true);
  const [pipConfig, setPipConfig] = useState<PIPConfig>({
    contentBox: DEFAULT_CONTENT_BOX,
    speakerBox: DEFAULT_SPEAKER_BOX,
    splitRatio: DEFAULT_SPLIT_RATIO,
  });
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(Math.round(clip.duration));

  // Local copies of subtitle/title styles (seeded from global styles)
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(globalStyles.subtitle);
  const [titleStyle, setTitleStyle] = useState<TitleStyle>(globalStyles.title);
  const [subtitleOverridden, setSubtitleOverridden] = useState(false);
  const [titleOverridden, setTitleOverridden] = useState(false);

  // Segment URL for live preview
  const [segmentUrl, setSegmentUrl] = useState<string | null>(null);

  useEffect(() => {
    const project = useProjectStore.getState().currentProject;
    if (!project?.video_file?.path) return;
    
    let cancelled = false;
    (async () => {
      try {
        const { opfsGetBlobUrl } = await import('@/services/opfs');
        const url = await opfsGetBlobUrl(project.video_file!.path);
        if (!cancelled) setSegmentUrl(url);
      } catch (err) {
        console.error('Failed to get video url:', err);
      }
    })();
    
    return () => { cancelled = true; };
  }, [clip.clip_id]);

  const updateSubtitle = (update: Partial<SubtitleStyle>) => {
    setSubtitleStyle((prev) => ({ ...prev, ...update }));
    setSubtitleOverridden(true);
  };

  const updateTitle = (update: Partial<TitleStyle>) => {
    setTitleStyle((prev) => ({ ...prev, ...update }));
    setTitleOverridden(true);
  };

  const handleApply = () => {
    onApply(clip.clip_id, {
      ...(pipEnabled ? {
        pip: {
          contentBox: pipConfig.contentBox,
          speakerBox: pipConfig.speakerBox,
          splitRatio: pipConfig.splitRatio,
          ...(mode === 'partial' ? { pipStartSec: startSec, pipEndSec: endSec } : {}),
        },
      } : {}),
      ...(subtitleOverridden ? { subtitle: subtitleStyle } : {}),
      ...(titleOverridden ? { title: titleStyle } : {}),
    });
    onClose();
  };

  const isVertical = globalStyles.export.format !== 'horizontal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text">Customize Clip & Re-render</h2>
            <p className="text-xs text-text-muted truncate max-w-md">{clip.title || 'Untitled'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: controls left, preview right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-5 overflow-hidden">
          {/* Left: tabs + controls */}
          <div className="lg:col-span-3 flex flex-col min-h-0">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-border shrink-0">
              {(['pip', 'subtitle', 'title'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  {tab === 'pip' ? 'PIP Layout' : tab === 'subtitle' ? 'Subtitles' : 'Title'}
                  {((tab === 'subtitle' && subtitleOverridden) || (tab === 'title' && titleOverridden)) && (
                    <Dot className="inline w-3 h-3 ml-0.5 text-accent" />
                  )}
                </button>
              ))}
            </div>

            {/* Controls — one tab visible at a time */}
            <div className="overflow-y-auto flex-1 pr-2">
              {activeTab === 'pip' && (
                <div className="space-y-4">
                  <PIPEditor
                    enabled={pipEnabled}
                    onEnabledChange={setPipEnabled}
                    config={pipConfig}
                    onConfigChange={setPipConfig}
                    clipId={clip.clip_id}
                  />

                  {pipEnabled && (
                    <div className="space-y-3 p-4 rounded-lg bg-panel border border-border">
                      <label className="text-xs font-semibold text-text">PIP Range</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMode('full')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mode === 'full' ? 'bg-accent text-white' : 'bg-input border border-border text-text-muted hover:text-text'
                          }`}
                        >
                          Full Clip
                        </button>
                        <button
                          onClick={() => setMode('partial')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mode === 'partial' ? 'bg-accent text-white' : 'bg-input border border-border text-text-muted hover:text-text'
                          }`}
                        >
                          Partial
                        </button>
                      </div>

                      {mode === 'partial' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-text-muted mb-1">PIP Start (s)</label>
                            <input
                              type="number" min={0} max={clip.duration}
                              value={startSec}
                              onChange={(e) => setStartSec(Math.max(0, Number(e.target.value)))}
                              className="w-full px-2 py-1 rounded bg-input border border-border text-text text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-text-muted mb-1">PIP End (s)</label>
                            <input
                              type="number" min={0} max={clip.duration}
                              value={endSec}
                              onChange={(e) => setEndSec(Math.min(clip.duration, Number(e.target.value)))}
                              className="w-full px-2 py-1 rounded bg-input border border-border text-text text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                          <p className="col-span-2 text-[10px] text-text-dim">
                            Normal: 0–{startSec}s → PIP: {startSec}–{endSec}s → Normal: {endSec}–{Math.round(clip.duration)}s
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'subtitle' && (
                <SubtitleStylePanel
                  value={subtitleStyle}
                  onChange={updateSubtitle}
                  exportFormat={globalStyles.export.format}
                />
              )}

              {activeTab === 'title' && (
                <TitleStylePanel
                  value={titleStyle}
                  onChange={updateTitle}
                />
              )}
            </div>
          </div>

          {/* Right: live preview */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div className="text-xs font-semibold text-text mb-2">Live Preview</div>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              {segmentUrl ? (
                <div className="w-full max-w-[240px] rounded-lg overflow-hidden border border-border">
                  <RemotionPreview
                    clip={clip}
                    videoSegmentUrl={segmentUrl}
                    width={720}
                    height={1280}
                    controls
                    autoPlay={false}
                    loop
                    // Apply overrides to preview
                    {...({
                      overrideSubtitle: subtitleOverridden ? subtitleStyle : undefined,
                      overrideTitle: titleOverridden ? titleStyle : undefined,
                      overridePip: pipEnabled ? {
                        contentBox: pipConfig.contentBox,
                        speakerBox: pipConfig.speakerBox,
                        splitRatio: pipConfig.splitRatio,
                        pipStartSec: mode === 'partial' ? startSec : undefined,
                        pipEndSec: mode === 'partial' ? endSec : undefined,
                      } : undefined,
                    } as any)}
                  />
                </div>
              ) : (
                <div className="w-full aspect-[9/16] max-w-[240px] bg-panel rounded-lg border border-border flex items-center justify-center">
                  <p className="text-xs text-text-dim">Loading segment...</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-dim mt-2 text-center">
              {isVertical ? '9:16 vertical preview' : '16:9 horizontal preview'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-text-dim">
              {pipEnabled && <span className="mr-3">PIP: {mode === 'partial' ? `${startSec}s–${endSec}s` : 'full clip'}</span>}
              {subtitleOverridden && <span className="mr-3 text-accent">Subtitle overridden</span>}
              {titleOverridden && <span className="text-accent">Title overridden</span>}
            </div>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Apply & Re-render
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
