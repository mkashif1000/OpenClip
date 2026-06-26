/**
 * Per-clip transcript editor. Renders the whisper words that fall inside the
 * clip range, grouped into sentences for readability. Clicking a word toggles
 * its "disabled" state — disabled words/ranges are saved on the clip and the
 * renderer cuts them out of the final video via the existing silence-cuts
 * TimeMap (extraCutRanges).
 *
 * Words that overlap the user's existing cutRanges show as disabled. Toggling
 * adds or removes a tight range around the word's [t0, t1] from the clip's
 * edits.cutRanges. Adjacent disabled ranges merge so the saved data stays
 * compact.
 */

import { useMemo, useEffect, useRef } from 'react';
import { Loader2, FileQuestion } from 'lucide-react';
import type { ClipData } from '@/types';
import type { WhisperWord } from '@/services/whisperService';
import { cn } from '@/lib/cn';

type Range = { start: number; end: number };

interface Props {
  clip: ClipData;
  words: WhisperWord[] | null;
  loading: boolean;
  playheadSec: number;
  onCutsChange: (cuts: Range[]) => void;
  onSeek: (sec: number) => void;
}

const SENTENCE_GAP = 0.7;

export function TranscriptEditor({ clip, words, loading, playheadSec, onCutsChange, onSeek }: Props) {
  const cuts = clip.edits?.cutRanges ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLButtonElement>(null);

  // Group words inside this clip into sentences (using punctuation + gap).
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

  // Auto-scroll the active word into view as playhead moves.
  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playheadSec]);

  const isDisabled = (w: WhisperWord) =>
    cuts.some((r) => w.t0 < r.end - 0.001 && w.t1 > r.start + 0.001);

  const toggleWord = (w: WhisperWord) => {
    const PAD = 0.04;
    const range = { start: Math.max(w.t0 - PAD, clip.start_time), end: Math.min(w.t1 + PAD, clip.end_time) };
    const overlaps = (a: Range, b: Range) => a.start < b.end && a.end > b.start;
    // If toggling ON a word covered by a cut: split or shrink the cut.
    if (isDisabled(w)) {
      const next: Range[] = [];
      for (const r of cuts) {
        if (!overlaps(r, range)) { next.push(r); continue; }
        if (range.start > r.start + 0.001) next.push({ start: r.start, end: range.start });
        if (range.end < r.end - 0.001) next.push({ start: range.end, end: r.end });
      }
      onCutsChange(next);
      return;
    }
    // Otherwise add + merge.
    const merged: Range[] = [];
    let added = false;
    const r = range;
    const sorted = [...cuts, r].sort((a, b) => a.start - b.start);
    for (const cur of sorted) {
      const last = merged[merged.length - 1];
      if (last && cur.start <= last.end + 0.05) {
        last.end = Math.max(last.end, cur.end);
      } else {
        merged.push({ ...cur });
      }
    }
    if (!added) onCutsChange(merged);
  };

  const toggleSentence = (sent: WhisperWord[]) => {
    if (!sent.length) return;
    const allDisabled = sent.every(isDisabled);
    const range = {
      start: Math.max(sent[0].t0 - 0.04, clip.start_time),
      end: Math.min(sent[sent.length - 1].t1 + 0.04, clip.end_time),
    };
    if (allDisabled) {
      const next: Range[] = [];
      for (const r of cuts) {
        if (!(r.start < range.end && r.end > range.start)) { next.push(r); continue; }
        if (range.start > r.start + 0.001) next.push({ start: r.start, end: range.start });
        if (range.end < r.end - 0.001) next.push({ start: range.end, end: r.end });
      }
      onCutsChange(next);
    } else {
      const merged: Range[] = [];
      for (const cur of [...cuts, range].sort((a, b) => a.start - b.start)) {
        const last = merged[merged.length - 1];
        if (last && cur.start <= last.end + 0.05) last.end = Math.max(last.end, cur.end);
        else merged.push({ ...cur });
      }
      onCutsChange(merged);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Loading transcript…</span>
      </div>
    );
  }

  if (!words?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 text-text-muted">
        <FileQuestion className="w-8 h-8 text-text-dim mb-3" strokeWidth={1.5} />
        <p className="text-sm text-text">No AI transcript yet</p>
        <p className="text-xs text-text-dim mt-1">Generate one in the Import tab to edit words.</p>
      </div>
    );
  }

  // Stats
  const removedSec = cuts.reduce((s, r) => s + Math.max(0, r.end - r.start), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">
            Transcript
          </span>
        </div>
        {removedSec > 0.05 && (
          <span className="text-[10px] text-text-muted font-mono px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10">
            −{removedSec.toFixed(1)}s
          </span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {sentences.map((sent, si) => {
          const allDisabled = sent.every(isDisabled);
          return (
            <p key={si} className={cn('leading-relaxed text-sm transition-opacity', allDisabled && 'opacity-40')}>
              <button
                onClick={() => toggleSentence(sent)}
                title={allDisabled ? 'Re-enable sentence' : 'Disable sentence'}
                className="text-[9px] mr-2 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-text-dim hover:bg-white/10 hover:text-text uppercase tracking-wider align-middle"
              >
                {allDisabled ? 'on' : 'off'}
              </button>
              {sent.map((w, wi) => {
                const disabled = isDisabled(w);
                const active = playheadSec >= w.t0 - 0.05 && playheadSec < w.t1 + 0.05;
                return (
                  <button
                    key={wi}
                    ref={active ? activeWordRef : undefined}
                    onClick={() => toggleWord(w)}
                    onDoubleClick={() => onSeek(w.t0)}
                    title={`${w.t0.toFixed(2)}s — click to ${disabled ? 'enable' : 'disable'}, double-click to seek`}
                    className={cn(
                      'inline px-0.5 mr-[1px] rounded transition-colors',
                      disabled
                        ? 'line-through text-text-dim hover:text-text-muted'
                        : 'text-text hover:bg-white/10',
                      active && !disabled && 'bg-white/15',
                    )}
                  >
                    {w.text}
                  </button>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}
