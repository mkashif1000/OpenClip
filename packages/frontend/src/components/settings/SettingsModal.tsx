import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, Film, KeyRound, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsConnections, SettingsPrivacy } from './SettingsConnections';
import './settings-modal.css';

const SECTIONS = [
  { id: 'transcription', label: 'Transcription', icon: AudioLines },
  { id: 'footage', label: 'Stock footage', icon: Film },
  { id: 'privacy', label: 'Privacy & storage', icon: ShieldCheck },
] as const;

type Section = typeof SECTIONS[number]['id'];
const COMPACT_MEDIA = '(max-width: 640px)';

export function SettingsModal() {
  const settingsOpen = useSettingsStore((state) => state.settingsOpen);
  const closeSettings = useSettingsStore((state) => state.closeSettings);

  if (!settingsOpen) return null;

  // A fresh dialog also resets the active section and all unsaved provider drafts.
  return createPortal(<SettingsDialog onClose={closeSettings} />, document.body);
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const backdropPointerDown = useRef(false);
  const [activeSection, setActiveSection] = useState<Section>('transcription');
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_MEDIA).matches);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_MEDIA);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';

    // Native modality puts the portal in the top layer and makes the page inert.
    dialog.showModal();
    tabRefs.current[0]?.focus({ preventScroll: true });

    return () => {
      dialog.close();
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      body.style.paddingRight = previousPadding;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = SECTIONS.length - 1;
    else if (event.key === (compact ? 'ArrowRight' : 'ArrowDown')) nextIndex = (index + 1) % SECTIONS.length;
    else if (event.key === (compact ? 'ArrowLeft' : 'ArrowUp')) nextIndex = (index - 1 + SECTIONS.length) % SECTIONS.length;
    else return;

    event.preventDefault();
    setActiveSection(SECTIONS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;

    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]',
    )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled')
      && !element.closest('[hidden]') && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isBackdrop = (event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return false;
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };

  return (
    <dialog
      ref={dialogRef}
      className="settings-modal-dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={(event) => { if (!event.currentTarget.open) onClose(); }}
      onKeyDown={handleDialogKeyDown}
      onPointerDown={(event) => { backdropPointerDown.current = isBackdrop(event); }}
      onPointerCancel={() => { backdropPointerDown.current = false; }}
      onClick={(event) => {
        event.stopPropagation();
        if (backdropPointerDown.current && isBackdrop(event)) onClose();
        backdropPointerDown.current = false;
      }}
    >
      <header className="settings-modal-header">
        <div className="settings-modal-heading">
          <span className="settings-modal-icon"><SlidersHorizontal aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-title`} className="settings-modal-title">Settings</h2>
            <p id={`${id}-description`} className="settings-modal-description">
              Manage the services you use with OpenClip.
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="settings-modal-close" aria-label="Close settings">
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="settings-modal-layout">
        <aside className="settings-modal-sidebar">
          <p className="settings-modal-nav-label" aria-hidden="true">Configuration</p>
          <div
            className="settings-modal-tabs"
            role="tablist"
            aria-label="Settings sections"
            aria-orientation={compact ? 'horizontal' : 'vertical'}
          >
            {SECTIONS.map((section, index) => (
              <button
                key={section.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                id={`${id}-tab-${section.id}`}
                aria-selected={activeSection === section.id}
                aria-controls={`${id}-panel-${section.id}`}
                tabIndex={activeSection === section.id ? 0 : -1}
                className="settings-modal-tab"
                onClick={() => setActiveSection(section.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <section.icon aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="settings-modal-content">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              role="tabpanel"
              id={`${id}-panel-${section.id}`}
              aria-labelledby={`${id}-tab-${section.id}`}
              hidden={activeSection !== section.id}
              tabIndex={0}
              className="settings-modal-panel"
            >
              {section.id === 'privacy'
                ? <SettingsPrivacy />
                : <SettingsConnections section={section.id} />}
            </section>
          ))}
        </div>
      </div>

      <footer className="settings-modal-footer">
        <p className="settings-modal-save-note">
          <KeyRound aria-hidden="true" />
          <span>Keys are saved per provider.</span>
        </p>
        <button type="button" className="settings-modal-done" onClick={onClose}>Done</button>
      </footer>
    </dialog>
  );
}
