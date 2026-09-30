import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Captions,
  Check,
  FileVideo,
  LayoutTemplate,
  LockKeyhole,
  Monitor,
  Pause,
  Play,
  Scissors,
} from 'lucide-react';
import './landing-toolkit.css';

type CaptionLook = 'Karaoke' | 'Pop' | 'Minimal';
type LayoutLook = 'Vertical' | 'Split' | 'PIP';

const MOTION_PREFERENCE = '(prefers-reduced-motion: reduce)';

function usePreviewVisibility() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Keep the content available in browsers without intersection observation.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      setSeen(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { threshold: 0.05 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, visible, seen };
}

function Wave({ count = 42 }: { count?: number }) {
  return (
    <span className="toolkit-wave" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          style={{
            '--bar-height': `${18 + Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.31)) * 80}%`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

function CaptionDemo() {
  const [look, setLook] = useState<CaptionLook>('Karaoke');
  const { ref, visible } = usePreviewVisibility();

  return (
    <article ref={ref} className="toolkit-card toolkit-captions toolkit-reveal" data-in-view={visible}>
      <div className="toolkit-card-heading">
        <span className="toolkit-card-icon"><Captions size={19} aria-hidden="true" /></span>
        <span>01 / CAPTIONS</span>
        <span className="toolkit-sample-label">STYLE PREVIEW</span>
      </div>
      <div
        id="toolkit-caption-preview"
        className="toolkit-caption-stage"
        role="img"
        aria-label={`${look} caption style preview: Make every word count.`}
        data-caption-look={look.toLowerCase()}
      >
        <div className="toolkit-caption-orbit" aria-hidden="true" />
        <span className="toolkit-frame-corner toolkit-frame-corner--tl" aria-hidden="true" />
        <span className="toolkit-frame-corner toolkit-frame-corner--br" aria-hidden="true" />
        <span className="toolkit-stage-label" aria-hidden="true"><span /> THE CREATIVE SERIES</span>
        <div className="toolkit-caption-text" aria-hidden="true">
          {['Make every', 'word count.'].map((line, lineIndex) => (
            <div key={line}>
              {line.split(' ').map((word, wordIndex) => (
                <span
                  className="toolkit-caption-word"
                  key={word}
                  style={{ '--word': lineIndex * 2 + wordIndex } as CSSProperties}
                >
                  {word}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="toolkit-caption-track" aria-hidden="true">
          <Play size={10} fill="currentColor" />
          <Wave count={36} />
          <span>00:04</span>
        </div>
      </div>
      <div className="toolkit-card-copy">
        <h3>Captions that move.</h3>
        <p>Give every word the right emphasis. Find a look that feels like you.</p>
      </div>
      <div className="toolkit-options" role="group" aria-label="Caption style preview">
        {(['Karaoke', 'Pop', 'Minimal'] as const).map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={look === option}
            aria-controls="toolkit-caption-preview"
            onClick={() => setLook(option)}
          >
            {option}
          </button>
        ))}
        <span className="toolkit-hint">Try a style <ArrowUpRight size={13} aria-hidden="true" /></span>
      </div>
    </article>
  );
}

function LayoutDemo() {
  const [layout, setLayout] = useState<LayoutLook>('Split');
  const { ref, visible } = usePreviewVisibility();
  const layoutNote = layout === 'Vertical'
    ? 'All eyes on you'
    : layout === 'Split' ? 'Room for both voices' : 'Keep the context';

  return (
    <article ref={ref} className="toolkit-card toolkit-layouts toolkit-reveal" data-in-view={visible}>
      <div className="toolkit-card-heading">
        <span className="toolkit-card-icon"><LayoutTemplate size={19} aria-hidden="true" /></span>
        <span>02 / FRAMING</span>
        <span className="toolkit-sample-label">9:16</span>
      </div>
      <div
        id="toolkit-layout-preview"
        className="toolkit-layout-stage"
        data-layout-look={layout.toLowerCase()}
        role="img"
        aria-label={`${layout === 'PIP' ? 'Picture-in-picture' : layout} video layout preview`}
      >
        <div className="toolkit-layout-guide" aria-hidden="true"><i /><i /><i /></div>
        <div className="toolkit-phone" aria-hidden="true">
          <div className="toolkit-shot toolkit-shot--one"><span>HOST</span></div>
          <div className="toolkit-shot toolkit-shot--two"><span>GUEST</span></div>
          <span className="toolkit-phone-caption">Two perspectives.<br /><b>One good story.</b></span>
          <div className="toolkit-phone-notch" />
        </div>
        <span className="toolkit-layout-note" aria-hidden="true">
          <span className="toolkit-layout-line" />
          {layoutNote}
        </span>
      </div>
      <div className="toolkit-card-copy">
        <h3>One story. Every format.</h3>
        <p>Reframe the conversation. Keep the people and details that matter.</p>
      </div>
      <div className="toolkit-options" role="group" aria-label="Video layout preview">
        {(['Vertical', 'Split', 'PIP'] as const).map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={layout === option}
            aria-controls="toolkit-layout-preview"
            aria-label={option === 'PIP' ? 'PIP (picture-in-picture)' : undefined}
            onClick={() => setLayout(option)}
          >
            {option}
          </button>
        ))}
        <span className="toolkit-hint">Switch it up <ArrowUpRight size={13} aria-hidden="true" /></span>
      </div>
    </article>
  );
}

function EditDemo() {
  const [trimmed, setTrimmed] = useState(false);
  const { ref, visible } = usePreviewVisibility();

  return (
    <article
      ref={ref}
      className="toolkit-card toolkit-edit toolkit-reveal"
      data-in-view={visible}
      data-trimmed={trimmed}
    >
      <div className="toolkit-card-heading">
        <span className="toolkit-card-icon"><Scissors size={19} aria-hidden="true" /></span>
        <span>03 / THE FINAL CUT</span>
        <span className="toolkit-sample-label">INTERACTIVE DEMO</span>
      </div>
      <div
        id="toolkit-edit-preview"
        className="toolkit-edit-stage"
        role="img"
        aria-label={trimmed
          ? 'Edited transcript: Keep the good stuff. Filler word removed.'
          : 'Original transcript: Keep the, um, good stuff.'}
      >
        <div className="toolkit-transcript" aria-hidden="true">
          <span>Keep</span>
          <span>the</span>
          <span className="toolkit-filler"><span>um,</span></span>
          <span>good</span>
          <span>stuff.</span>
        </div>
        <div className="toolkit-timeline" aria-hidden="true">
          <div className="toolkit-ruler">
            <span>00:00</span><span>00:01</span><span>00:02</span><span>00:03</span>
          </div>
          <div className="toolkit-track">
            <div className="toolkit-audio toolkit-audio--first"><Wave count={16} /></div>
            <div className="toolkit-cut"><Scissors size={12} /></div>
            <div className="toolkit-audio toolkit-audio--last"><Wave count={22} /></div>
          </div>
          <span className="toolkit-playhead" />
        </div>
      </div>
      <div className="toolkit-edit-bottom">
        <div className="toolkit-card-copy">
          <h3>Keep the good stuff.</h3>
          <p>Trim pauses. Cut filler. Fine-tune the story.</p>
        </div>
        <button
          type="button"
          className="toolkit-cut-button"
          aria-pressed={trimmed}
          aria-controls="toolkit-edit-preview"
          onClick={() => setTrimmed(value => !value)}
        >
          {trimmed ? <Check size={15} aria-hidden="true" /> : <Scissors size={15} aria-hidden="true" />}
          {trimmed ? 'Undo cut' : 'Remove filler'}
        </button>
      </div>
      <p className="toolkit-edit-status" aria-live="polite" aria-atomic="true">
        {trimmed ? 'Filler removed. A tighter edit, in one click.' : 'Try removing “um” from this sample.'}
      </p>
    </article>
  );
}

function PrivacyCard() {
  const { ref, visible } = usePreviewVisibility();

  return (
    <section
      ref={ref}
      id="privacy"
      aria-labelledby="toolkit-privacy-heading"
      className="toolkit-card toolkit-privacy toolkit-reveal"
      data-in-view={visible}
    >
      <div className="toolkit-card-heading">
        <span className="toolkit-card-icon"><LockKeyhole size={18} aria-hidden="true" /></span>
        <span>YOUR WORK. YOUR DEVICE.</span>
      </div>
      <div className="toolkit-local-diagram" aria-hidden="true">
        <span className="toolkit-local-file toolkit-local-file--source">
          <FileVideo size={23} /><span>Source</span>
        </span>
        <span className="toolkit-local-connector" />
        <div className="toolkit-local-core">
          <Monitor size={38} strokeWidth={1.2} />
          <span className="toolkit-local-lock"><LockKeyhole size={10} /></span>
          <span>OpenClip</span>
        </div>
        <span className="toolkit-local-connector toolkit-local-connector--out" />
        <span className="toolkit-local-file"><Check size={23} /><span>Your clips</span></span>
      </div>
      <div className="toolkit-card-copy">
        <h2 id="toolkit-privacy-heading">Private by design.</h2>
        <p>Edit and render videos on your device. No account required.</p>
      </div>
      <div className="toolkit-privacy-footer">
        <span className="toolkit-local-badge"><i aria-hidden="true" /> LOCAL BY DEFAULT</span>
        <span>Cloud transcription and external AI are optional and send data to your chosen provider.</span>
      </div>
    </section>
  );
}

export function LandingToolkit({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  const { ref, visible, seen } = usePreviewVisibility();
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MOTION_PREFERENCE).matches
  ));
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    const preference = typeof window.matchMedia === 'function' ? window.matchMedia(MOTION_PREFERENCE) : null;
    const onMotion = () => setReduced(preference?.matches ?? false);
    const onVisibility = () => setHidden(document.hidden);

    onMotion();
    onVisibility();
    if (preference?.addEventListener) {
      preference.addEventListener('change', onMotion);
    } else {
      preference?.addListener(onMotion);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (preference?.removeEventListener) {
        preference.removeEventListener('change', onMotion);
      } else {
        preference?.removeListener(onMotion);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const running = visible && !paused && !reduced && !hidden;
  const motionLabel = reduced
    ? 'Preview animations disabled by reduced-motion preference'
    : paused ? 'Resume feature previews' : 'Pause feature previews';

  return (
    <section
      ref={ref}
      id="features"
      aria-labelledby="toolkit-heading"
      className="landing-toolkit"
      data-running={running}
      data-seen={seen}
    >
      <div className="toolkit-container">
        <div className="toolkit-eyebrow-row">
          <span className="toolkit-eyebrow"><i aria-hidden="true" /> BUILT FOR YOUR NEXT IDEA</span>
          <button
            type="button"
            className="toolkit-motion-toggle"
            onClick={() => setPaused(value => !value)}
            disabled={reduced}
            aria-label={motionLabel}
            aria-controls="toolkit-previews"
          >
            {paused || reduced ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            {reduced ? 'Reduced motion' : paused ? 'Previews paused' : 'Previews in motion'}
          </button>
        </div>
        <div className="toolkit-heading-row">
          <h2 id="toolkit-heading">Less busywork.<br /><span>More creative control.</span></h2>
          <div>
            <p>The details make the difference. Put the finishing touches on every clip, all in one place.</p>
            <button type="button" className="toolkit-cta" onClick={onOpenWorkspace}>
              See the tools <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div id="toolkit-previews" className="toolkit-grid">
          <CaptionDemo />
          <LayoutDemo />
          <EditDemo />
          <PrivacyCard />
        </div>
        <div className="toolkit-closing">
          <span><Check size={14} aria-hidden="true" /> One workspace. From first cut to final clip.</span>
          <button type="button" onClick={onOpenWorkspace}>
            Make something worth watching <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
