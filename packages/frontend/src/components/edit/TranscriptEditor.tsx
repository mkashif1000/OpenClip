/**
 * Timestamped transcript editing. Seek is the default; cutting requires an
 * explicit mode change. Edits remain backed by the clip's saved cutRanges.
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import { Loader2, FileQuestion, Search, Scissors, MousePointer2, RotateCcw, X } from 'lucide-react';
import type { ClipData } from '@/types';
import type { WhisperWord } from '@/services/whisperService';
import { cn } from '@/lib/cn';

type Range = { start: number; end: number };

interface Props {
  clip: ClipData;
  words: WhisperWord[] | null;
  loading: boolean;
  playheadSec: number;
  onCutsChange: (cuts: Range[]) => void | Promise<void>;
  onSeek: (sec: number) => void;
}

const SENTENCE_GAP = 0.7;

export function TranscriptEditor({ clip, words, loading, playheadSec, onCutsChange, onSeek }: Props) {
  const cuts = clip.edits?.cutRanges ?? [];
  const [mode, setMode] = useState<'seek' | 'cut'>('seek');
  const [query, setQuery] = useState('');
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLButtonElement>(null);
  const pendingClickRef = useRef<number | null>(null);

  const sentences = useMemo(() => {
    if (!words?.length) return [];
    const inRange = words
      .filter((w) => w.t1 > clip.start_time && w.t0 < clip.end_time)
      .sort((a, b) => a.t0 - b.t0);
    const out: WhisperWord[][] = [];
    let cur: WhisperWord[] = [];
    for (const w of inRange) {
      const prev = cur[cur.length - 1];
      const gap = prev ? w.t0 - prev.t1 : 0;
      if (cur.length && (/[.!?]$/.test(prev!.text) || gap > SENTENCE_GAP)) {
        out.push(cur); cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [words, clip.start_time, clip.end_time]);

  const search = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const visibleSentences = useMemo(() => sentences.filter((sent) =>
    !search || sent.map((w) => w.text.trim()).join(' ').toLocaleLowerCase().includes(search),
  ), [sentences, search]);
  const searchTerms = search.split(' ').filter(Boolean);
  const activeWordStart = sentences.flat().find((w) => playheadSec >= w.t0 && playheadSec < w.t1)?.t0;

  // Scroll only this panel, not the surrounding editor or page. Searching
  // deliberately suspends following so results remain under the pointer.
  useEffect(() => {
    const container = containerRef.current;
    const word = activeWordRef.current;
    if (!container || !word || !followPlayhead || search) return;
    const bounds = container.getBoundingClientRect();
    const wordBounds = word.getBoundingClientRect();
    if (wordBounds.top < bounds.top + 12 || wordBounds.bottom > bounds.bottom - 12) {
      container.scrollTo({
        top: container.scrollTop + wordBounds.top - bounds.top - bounds.height / 2,
        behavior: 'smooth',
      });
    }
  }, [activeWordStart, followPlayhead, search]);

  useEffect(() => () => {
    if (pendingClickRef.current != null) window.clearTimeout(pendingClickRef.current);
  }, []);

  const isDisabled = (w: WhisperWord) =>
    cuts.some((r) => w.t0 < r.end - 0.001 && w.t1 > r.start + 0.001);

  const saveCuts = async (next: Range[]) => {
    // Guard synchronously as well as disabling controls: a second click may
    // arrive before React has painted the pending state.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onCutsChange(next);
      setConfirmReset(false);
    } catch {
      setSaveError('Could not save transcript cuts. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleRange = (range: Range, restore: boolean) => {
    if (range.end <= range.start) return;
    if (restore) {
      const next: Range[] = [];
      for (const r of cuts) {
        if (!(r.start < range.end && r.end > range.start)) { next.push(r); continue; }
        if (range.start > r.start + 0.001) next.push({ start: r.start, end: range.start });
        if (range.end < r.end - 0.001) next.push({ start: range.end, end: r.end });
      }
      void saveCuts(next);
    } else {
      const merged: Range[] = [];
      for (const cur of [...cuts, range].sort((a, b) => a.start - b.start)) {
        const last = merged[merged.length - 1];
        if (last && cur.start <= last.end + 0.05) last.end = Math.max(last.end, cur.end);
        else merged.push({ ...cur });
      }
      void saveCuts(merged);
    }
  };

  const toggleWords = (selection: WhisperWord[]) => {
    if (!selection.length) return;
    toggleRange({
      start: Math.max(selection[0].t0 - 0.04, clip.start_time),
      end: Math.min(selection[selection.length - 1].t1 + 0.04, clip.end_time),
    }, selection.every(isDisabled));
  };

  const handleWordClick = (w: WhisperWord) => {
    if (pendingClickRef.current != null) window.clearTimeout(pendingClickRef.current);
    pendingClickRef.current = window.setTimeout(() => {
      pendingClickRef.current = null;
      if (mode === 'seek') onSeek(w.t0);
      else toggleWords([w]);
    }, 220);
  };

  const cancelPendingWordClick = () => {
    if (pendingClickRef.current != null) window.clearTimeout(pendingClickRef.current);
    pendingClickRef.current = null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-48 text-text-muted gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Loading transcript…</span>
      </div>
    );
  }

  if (!words?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-48 text-center px-6 text-text-muted">
        <FileQuestion className="w-8 h-8 text-text-dim mb-3" strokeWidth={1.5} />
        <p className="text-sm text-text">No AI transcript yet</p>
        <p className="text-xs text-text-dim mt-1">Generate one in the Import tab to edit words.</p>
      </div>
    );
  }

  const removedSec = cuts.reduce((s, r) =>
    s + Math.max(0, Math.min(r.end, clip.end_time) - Math.max(r.start, clip.start_time)), 0);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div className="shrink-0 px-3 py-3 border-b border-white/8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">Transcript</h3>
          {removedSec > 0.05 && <span className="text-[10px] text-text-muted font-mono">−{removedSec.toFixed(1)}s cut</span>}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/20 p-1" role="group" aria-label="Transcript click mode">
          {(['seek', 'cut'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => { setMode(value); setConfirmReset(false); }}
              className={cn('min-h-9 rounded-md px-2 py-1.5 text-xs flex items-center justify-center gap-1.5',
                mode === value ? 'bg-white/15 text-text' : 'text-text-muted hover:bg-white/5')}
            >
              {value === 'seek' ? <MousePointer2 className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}
              {value === 'seek' ? 'Seek' : 'Cut / restore'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-text-muted leading-relaxed">
          {mode === 'seek' ? 'Click a word or timestamp to seek. Cuts stay unchanged.' : 'Click a word to cut or restore it. Cuts are removed from the export.'}
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-text-dim pointer-events-none" />
          <input
            type="search"
            aria-label="Search transcript words or sentences"
            placeholder="Find words or a sentence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-xs text-text focus:outline-none focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && <button type="button" aria-label="Clear transcript search" onClick={() => setQuery('')} className="absolute right-1 top-1 p-1.5 text-text-muted hover:text-text"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-muted">
          {search ? (
            <span role="status">{visibleSentences.length} matching {visibleSentences.length === 1 ? 'sentence' : 'sentences'}</span>
          ) : (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={followPlayhead} onChange={(e) => setFollowPlayhead(e.target.checked)} className="accent-white" />
              Follow playhead
            </label>
          )}
          {cuts.length > 0 && (
            <button type="button" disabled={saving} onClick={() => setConfirmReset(true)} className="flex items-center gap-1 py-1 hover:text-text disabled:opacity-40">
              <RotateCcw className="w-3 h-3" /> Reset cuts
            </button>
          )}
        </div>
        {confirmReset && (
          <div className="rounded-lg border border-white/15 bg-white/5 p-2.5 space-y-2" role="group" aria-label="Confirm resetting transcript cuts">
            <p className="text-xs text-text">Restore all cut words in this clip?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void saveCuts([])} className="min-h-8 rounded-md bg-white px-2.5 text-xs text-black disabled:opacity-40">Restore all</button>
              <button type="button" disabled={saving} onClick={() => setConfirmReset(false)} className="min-h-8 px-2.5 text-xs text-text-muted">Cancel</button>
            </div>
          </div>
        )}
        {saving && <p role="status" className="text-[11px] text-text-muted flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Saving cuts…</p>}
        {saveError && <p role="alert" className="text-[11px] text-error">{saveError}</p>}
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
        {!visibleSentences.length && <p className="text-xs text-text-muted py-3">{search ? 'No matching words or sentences.' : 'No transcript words in this clip’s time range.'}</p>}
        {visibleSentences.map((sent, si) => {
          const allDisabled = sent.every(isDisabled);
          return (
            <div key={`${sent[0].t0}-${si}`} className="leading-relaxed text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <button type="button" onClick={() => onSeek(sent[0].t0)} title="Seek to sentence start" className="rounded-md bg-white/5 border border-white/8 px-2 py-1 text-[10px] font-mono text-text-muted hover:text-text hover:bg-white/10">
                  {formatTimestamp(sent[0].t0 - clip.start_time)}
                </button>
                {mode === 'cut' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => { if (e.detail <= 1) toggleWords(sent); }}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-text-muted hover:bg-white/10 hover:text-text disabled:opacity-40"
                  >
                    {allDisabled ? 'Restore sentence' : 'Cut sentence'}
                  </button>
                )}
              </div>
              <p>
                {sent.map((w, wi) => {
                  const disabled = isDisabled(w);
                  const active = playheadSec >= w.t0 && playheadSec < w.t1;
                  const match = searchTerms.some((term) => w.text.toLocaleLowerCase().includes(term));
                  const action = mode === 'seek' ? 'Seek to' : disabled ? 'Restore' : 'Cut';
                  return (
                    <button
                      type="button"
                      key={wi}
                      ref={active ? activeWordRef : undefined}
                      disabled={mode === 'cut' && saving}
                      onClick={() => handleWordClick(w)}
                      onDoubleClick={cancelPendingWordClick}
                      title={`${action} “${w.text.trim()}” · source ${w.t0.toFixed(2)}s${disabled ? ' · cut' : ''}`}
                      aria-label={`${action} ${w.text.trim()}${disabled ? ' (cut)' : ''}`}
                      className={cn(
                        'inline max-w-full break-words px-0.5 py-0.5 mr-1 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60 disabled:cursor-wait',
                        disabled ? 'line-through text-text-dim hover:text-text-muted' : 'text-text hover:bg-white/10',
                        active && 'bg-white/15 ring-1 ring-white/25',
                        match && 'bg-amber-400/15 text-amber-200',
                      )}
                    >
                      {w.text.trim()}
                    </button>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTimestamp(sec: number) {
  const clamped = Math.max(0, sec);
  return `${Math.floor(clamped / 60)}:${Math.floor(clamped % 60).toString().padStart(2, '0')}`;
}
