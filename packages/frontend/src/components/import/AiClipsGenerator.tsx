/**
 * "Get clips with AI — free, no API key" flow.
 *
 * 1. The user tweaks options (extra instructions, how many clips, titles y/n).
 * 2. Clicks "Copy Prompt" — the prompt (instructions + timestamped transcript)
 *    goes to the clipboard. Buttons open the famous free chatbots.
 * 3. The user pastes the prompt into a chatbot, copies the JSON reply, and
 *    pastes it back here. "Load Clips" sanitizes + parses it (tolerating code
 *    fences, prose, smart quotes, trailing commas) and loads the clips.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Copy, Check, Wand2, ExternalLink, Loader2, ClipboardPaste, AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useUIStore } from '@/stores/uiStore';
import { buildClipPrompt, CHATBOTS } from '@/lib/clipPrompt';
import { sanitizeAndParseClipsJson } from '@/lib/clipJsonParse';

export function AiClipsGenerator() {
  const project = useProjectStore((s) => s.currentProject);
  const loadClipsFromParsed = useClipStore((s) => s.loadClipsFromParsed);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const srtId = project?.srt_file?.path ?? null;

  const [transcript, setTranscript] = useState<string>('');
  const [words, setWords] = useState(0);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const [extra, setExtra] = useState('');
  const [numClips, setNumClips] = useState(8);
  const [wantTitles, setWantTitles] = useState(true);

  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Build the transcript once the SRT exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!srtId) { setTranscript(''); return; }
      setLoadingTranscript(true);
      try {
        const { buildTranscriptForPrompt } = await import('@/services/clipDetector');
        const { text, words: w } = await buildTranscriptForPrompt(srtId);
        if (!cancelled) { setTranscript(text); setWords(w); }
      } catch (err) {
        console.warn('Transcript build failed:', err);
        if (!cancelled) setTranscript('');
      } finally {
        if (!cancelled) setLoadingTranscript(false);
      }
    })();
    return () => { cancelled = true; };
  }, [srtId]);

  const prompt = useMemo(
    () => buildClipPrompt({ transcript, numClips, wantTitles, extra }),
    [transcript, numClips, wantTitles, extra],
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Fallback for older browsers / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = prompt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const loadClips = async () => {
    setError(null); setSuccess(null);
    const parsed = sanitizeAndParseClipsJson(pasted);
    if (parsed.ok) {
      setBusy(true);
      try {
        const count = await loadClipsFromParsed(parsed.data);
        if (count === 0) {
          setError('No usable clips found — check that each item has a start and end timestamp.');
        } else {
          setSuccess(`Loaded ${count} clip${count === 1 ? '' : 's'}.`);
        }
      } catch (err) {
        setError((err as Error)?.message || 'Could not load clips.');
      }
      setBusy(false);
    } else {
      setError(parsed.error ?? 'Could not read that as JSON.');
    }
  };

  if (!srtId) {
    return (
      <p className="text-xs text-text-dim">Generate or upload subtitles in Step 2 first — the AI needs the transcript.</p>
    );
  }

  const tooLong = words > 14000;

  return (
    <div className="w-full space-y-3">
      {/* ── Step 1 · Customize ─────────────────────────────────────── */}
      <Step n={1} title="Customize" subtitle="Tell the AI what you want.">
        <label className="block text-[11px] text-text-dim mb-1.5">Extra instructions (optional)</label>
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          placeholder="e.g. Prioritize clips about pricing. Always include the part where he mentions the lawsuit."
          className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-text text-sm focus:outline-none focus:border-white/30 resize-none placeholder:text-text-dim"
        />
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10">
            <span className="text-[11px] text-text-muted">Clips</span>
            <input
              type="number" min={1} max={50} value={numClips}
              onChange={(e) => setNumClips(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-12 bg-transparent text-text text-sm font-medium focus:outline-none text-center"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 cursor-pointer select-none">
            <input type="checkbox" className="switch" checked={wantTitles} onChange={(e) => setWantTitles(e.target.checked)} />
            <span className="text-[12px] text-text">Generate titles</span>
          </label>
        </div>
      </Step>

      {/* ── Step 2 · Get the JSON ──────────────────────────────────── */}
      <Step n={2} title="Run it in a free chatbot" subtitle="Copy the prompt, paste it into any of these.">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={copyPrompt}
            disabled={loadingTranscript || !transcript}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-semibold disabled:opacity-50 shadow-soft shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {loadingTranscript ? 'Preparing…' : copied ? 'Copied!' : 'Copy Prompt'}
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            {CHATBOTS.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-text-muted hover:text-text hover:bg-white/8 text-xs font-medium"
              >
                {b.name} <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            ))}
          </div>
        </div>
        {tooLong && (
          <p className="flex items-start gap-1.5 text-[11px] text-warning mt-2.5">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            Long transcript (~{words.toLocaleString()} words). Some free chatbots truncate — if results look thin, run it in two halves.
          </p>
        )}
      </Step>

      {/* ── Step 3 · Load ──────────────────────────────────────────── */}
      <Step n={3} title="Paste the reply" subtitle="Code fences or extra text are fine — they’re cleaned automatically.">
        <textarea
          value={pasted}
          onChange={(e) => { setPasted(e.target.value); setError(null); setSuccess(null); }}
          rows={4}
          placeholder="Paste the JSON the chatbot gave you here…"
          className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-text text-xs font-mono focus:outline-none focus:border-white/30 resize-y placeholder:text-text-dim placeholder:font-sans"
        />
        <div className="flex items-center gap-2 flex-wrap mt-2.5">
          <button
            onClick={loadClips}
            disabled={busy || !pasted.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-semibold disabled:opacity-50 shadow-soft"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
            {busy ? 'Loading…' : 'Load Clips'}
          </button>
          {success && (
            <button
              onClick={() => setActiveTab('edit')}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl glass-subtle border border-white/10 text-text hover:bg-white/8 text-sm font-medium"
            >
              <Wand2 className="w-3.5 h-3.5" /> Edit Clips
            </button>
          )}
          {success && (
            <span className="flex items-center gap-1 text-xs text-success font-medium">
              <Check className="w-3.5 h-3.5" /> {success}
            </span>
          )}
        </div>
        {error && (
          <p className="flex items-start gap-1.5 text-[11px] text-error mt-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
          </p>
        )}
      </Step>
    </div>
  );
}

/** A clean numbered step card used in the AI clips flow. */
function Step({
  n, title, subtitle, children,
}: { n: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-6 h-6 rounded-full bg-white text-black text-[12px] font-bold flex items-center justify-center shrink-0 shadow-soft">
          {n}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-text-dim leading-tight">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
