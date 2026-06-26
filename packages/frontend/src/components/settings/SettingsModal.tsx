import { useState } from 'react';
import { X, Check, ExternalLink, KeyRound, Gift, ShieldCheck, AlertTriangle, Film } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

const REFERRAL_URL = 'https://assemblyai.cello.so/WD1pBz3juBB';

export function SettingsModal() {
  const {
    settingsOpen, closeSettings,
    assemblyaiKey, setAssemblyaiKey, clearAssemblyaiKey,
    pexelsKey, setPexelsKey, pixabayKey, setPixabayKey,
  } = useSettingsStore();
  const [draft, setDraft] = useState(assemblyaiKey);
  const [saved, setSaved] = useState(false);

  if (!settingsOpen) return null;

  const handleSave = () => {
    setAssemblyaiKey(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeSettings}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text">Settings</h2>
          <button onClick={closeSettings} className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* AssemblyAI transcription */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">AI Transcription (AssemblyAI)</h3>
              {assemblyaiKey && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-semibold">
                  <Check className="w-2.5 h-2.5" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Add your AssemblyAI API key once and it&apos;s reused for every project. With it, you can
              transcribe a long video in seconds (instead of waiting for the on-device model) — that
              unlocks word-accurate captions and automatic silence &amp; filler-word removal.
            </p>

            {/* Referral offer */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <Gift className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-xs text-text leading-relaxed">
                  New to AssemblyAI? Sign up with this link and get <span className="font-semibold text-accent">$100 in free credits</span> —
                  enough for up to <span className="font-semibold">~400 hours</span> of transcription.
                </p>
                <a
                  href={REFERRAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors"
                >
                  Get $100 free credits <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Paste your AssemblyAI API key"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-input border border-border text-text text-xs font-mono focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors shrink-0"
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <a
                  href="https://www.assemblyai.com/dashboard/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-accent"
                >
                  Where do I find my key? <ExternalLink className="w-2.5 h-2.5" />
                </a>
                {assemblyaiKey && (
                  <button
                    onClick={() => { clearAssemblyaiKey(); setDraft(''); }}
                    className="text-[10px] text-text-dim hover:text-error"
                  >
                    Remove key
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-[10px] text-text-dim leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />
              <span>
                Your key is stored only in this browser and sent only to AssemblyAI over HTTPS — it&apos;s
                never uploaded to us or saved in your project files. Transcription is optional; the
                on-device engine and manual SRT upload keep everything fully local.
              </span>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-200/90 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <span className="font-semibold text-amber-300">Personal use only.</span> Because OpenClip runs
                entirely in the browser with no backend, this key lives in your browser&apos;s local storage and
                is readable by anyone who can open this app on this device — and by anyone using the site if
                you enter it on a <span className="font-semibold">shared or public deployment</span>. Only enter
                your key on a deployment you alone control, and use &ldquo;Remove key&rdquo; on shared machines.
                A leaked key can be used to spend your AssemblyAI credits.
              </span>
            </div>
          </section>

          {/* B-roll footage */}
          <section className="space-y-3 pt-5 border-t border-border">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">B-roll Footage (Pexels &amp; Pixabay)</h3>
              {(pexelsKey || pixabayKey) && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-semibold">
                  <Check className="w-2.5 h-2.5" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Optional. Add a Pexels and/or Pixabay key to let OpenClip automatically overlay relevant
              stock video (B-roll) on your clips while you talk. Add either or both — more sources mean
              better matches.
            </p>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-success/5 border border-success/20">
              <Gift className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <p className="text-xs text-text leading-relaxed">
                Both are <span className="font-semibold text-success">100% free</span> — no credit card.
                Create a free account, then copy your API key from the page below.
              </p>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Pexels API key</label>
              <input
                type="password"
                value={pexelsKey}
                onChange={(e) => setPexelsKey(e.target.value)}
                placeholder="Paste your Pexels API key"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-xs font-mono focus:outline-none focus:border-accent"
              />
              <a
                href="https://www.pexels.com/api/new/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-text-muted hover:text-accent"
              >
                Get a free Pexels key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Pixabay API key</label>
              <input
                type="password"
                value={pixabayKey}
                onChange={(e) => setPixabayKey(e.target.value)}
                placeholder="Paste your Pixabay API key"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-xs font-mono focus:outline-none focus:border-accent"
              />
              <a
                href="https://pixabay.com/api/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-text-muted hover:text-accent"
              >
                Get a free Pixabay key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="flex items-start gap-2 text-[10px] text-text-dim leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />
              <span>
                These keys stay in your browser and are used only to search and download footage from
                Pexels/Pixabay. B-roll is optional and only runs when you enable it for a render.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
