import { useId, useState, type FormEvent } from 'react';
import {
  AudioLines, Check, ExternalLink, Eye, EyeOff, Film, HardDrive,
  Image, Info, ShieldAlert, TriangleAlert, type LucideIcon,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import './settings-connections.css';

const REFERRAL_URL = 'https://assemblyai.cello.so/WD1pBz3juBB';

interface ProviderKeyCardProps {
  name: 'AssemblyAI' | 'Pexels' | 'Pixabay';
  icon: LucideIcon;
  description: string;
  dashboardUrl: string;
  savedKey: string;
  onSave: (key: string) => void;
  onRemove: () => void;
}

function ProviderKeyCard({
  name, icon: Icon, description, dashboardUrl, savedKey, onSave, onRemove,
}: ProviderKeyCardProps) {
  const id = useId();
  const [draft, setDraft] = useState(savedKey);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const canSave = Boolean(draft.trim()) && draft.trim() !== savedKey;

  function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    onSave(draft);
    setDraft(draft.trim());
    setRevealed(false);
    setFeedback(`${name} key saved. Connection not verified.`);
  }

  function removeKey() {
    onRemove();
    setDraft('');
    setRevealed(false);
    setFeedback(`${name} key removed from this browser.`);
  }

  return (
    <form className="settings-provider-card" aria-labelledby={`${id}-title`} onSubmit={saveKey}>
      <div className="settings-provider-header">
        <div className="settings-provider-identity">
          <span className="settings-provider-icon"><Icon size={18} aria-hidden="true" /></span>
          <h3 id={`${id}-title`} className="settings-provider-title">{name}</h3>
        </div>
        <span
          className={`settings-provider-status${savedKey ? ' settings-provider-status-saved' : ''}`}
          aria-label={`${name}: ${savedKey ? 'Key saved, not verified' : 'Not configured'}`}
        >
          {savedKey && <Check size={12} aria-hidden="true" />}
          {savedKey ? 'Key saved' : 'Not configured'}
        </span>
      </div>
      <p className="settings-provider-description" id={`${id}-description`}>{description}</p>
      <div className="settings-provider-field">
        <label className="settings-provider-label" htmlFor={`${id}-key`}>{name} API key</label>
        <div
          className="settings-provider-input-group"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setRevealed(false);
          }}
        >
          <input
            id={`${id}-key`}
            className="settings-provider-input"
            type={revealed ? 'text' : 'password'}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setFeedback(''); }}
            placeholder="Paste your API key"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={`${id}-description`}
          />
          <button
            className="settings-provider-reveal"
            type="button"
            aria-label={`${revealed ? 'Hide' : 'Show'} ${name} key`}
            aria-controls={`${id}-key`}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="settings-provider-actions">
        <div className="settings-provider-key-actions">
          <button
            className="settings-provider-save"
            type="submit"
            disabled={!canSave}
            aria-label={`Save ${name} key`}
          >
            Save key
          </button>
          <button
            className="settings-provider-remove"
            type="button"
            disabled={!savedKey}
            onClick={removeKey}
            aria-label={`Remove ${name} key`}
          >
            Remove key
          </button>
        </div>
        <a className="settings-provider-link" href={dashboardUrl} target="_blank" rel="noopener noreferrer">
          Get {name} key <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
      <p className="settings-provider-feedback" role="status" aria-live="polite" aria-atomic="true" aria-label={`${name} key update`}>
        {feedback}
      </p>
      {name === 'AssemblyAI' && (
        <div className="settings-provider-offer">
          <a className="settings-provider-link" href={REFERRAL_URL} target="_blank" rel="noopener noreferrer">
            View AssemblyAI sign-up offer <ExternalLink size={12} aria-hidden="true" />
          </a>
          <span>Referral link. Provider terms and eligibility apply.</span>
        </div>
      )}
    </form>
  );
}

export function SettingsConnections({ section }: { section: 'transcription' | 'footage' }) {
  const {
    assemblyaiKey, setAssemblyaiKey, clearAssemblyaiKey,
    pexelsKey, setPexelsKey, pixabayKey, setPixabayKey,
  } = useSettingsStore();

  return (
    <div className="settings-connections-content">
      <header className="settings-connections-heading">
        <h2>{section === 'transcription' ? 'Transcription' : 'Stock footage'}</h2>
        <p>
          {section === 'transcription'
            ? 'Add optional cloud transcription for your projects.'
            : 'Add either provider to find stock video for your clips.'}
        </p>
      </header>
      {section === 'transcription' ? (
        <>
          <ProviderKeyCard
            name="AssemblyAI"
            icon={AudioLines}
            description="Transcribe with AssemblyAI in the cloud. Audio is sent to AssemblyAI when you use this provider."
            dashboardUrl="https://www.assemblyai.com/dashboard/api-keys"
            savedKey={assemblyaiKey}
            onSave={setAssemblyaiKey}
            onRemove={clearAssemblyaiKey}
          />
          <div className="settings-connections-note">
            <Info size={16} aria-hidden="true" />
            <p><strong>No key needed for local options.</strong> Use on-device Whisper or import an SRT subtitle file instead.</p>
          </div>
        </>
      ) : (
        <div className="settings-connections-cards">
          <ProviderKeyCard
            name="Pexels"
            icon={Film}
            description="Search Pexels stock videos for optional B-roll."
            dashboardUrl="https://www.pexels.com/api/new/"
            savedKey={pexelsKey}
            onSave={setPexelsKey}
            onRemove={() => setPexelsKey('')}
          />
          <ProviderKeyCard
            name="Pixabay"
            icon={Image}
            description="Search Pixabay stock videos for optional B-roll."
            dashboardUrl="https://pixabay.com/api/docs/"
            savedKey={pixabayKey}
            onSave={setPixabayKey}
            onRemove={() => setPixabayKey('')}
          />
        </div>
      )}
      <p className="settings-connections-footnote">
        Saved keys are not verified connections. See Privacy for storage and security details.
      </p>
    </div>
  );
}

export function SettingsPrivacy() {
  return (
    <div className="settings-privacy-content">
      <header className="settings-privacy-heading">
        <h2>Privacy &amp; storage</h2>
        <p>Where your keys are kept and what optional integrations send.</p>
      </header>
      <section className="settings-privacy-card">
        <div className="settings-privacy-card-heading">
          <HardDrive size={18} aria-hidden="true" />
          <h3>Stored in this browser</h3>
        </div>
        <p>
          API keys are stored <strong>unencrypted in localStorage</strong> for this site&apos;s origin
          and browser profile. They are not included in project files or backups.
        </p>
      </section>
      <section className="settings-privacy-card">
        <div className="settings-privacy-card-heading">
          <ShieldAlert size={18} aria-hidden="true" />
          <h3>Use a trusted environment</h3>
        </div>
        <p>
          People using this browser profile, and scripts running on this origin, can access saved keys.
          A public deployment does not automatically share your keys with every visitor.
        </p>
        <div className="settings-privacy-warning">
          <TriangleAlert size={17} aria-hidden="true" />
          <p>
            Only use trusted deployments and browser profiles. Avoid shared devices. If a key is
            exposed, remove it here and revoke it with its provider.
          </p>
        </div>
      </section>
      <section className="settings-privacy-card">
        <div className="settings-privacy-card-heading">
          <AudioLines size={18} aria-hidden="true" />
          <h3>What integrations send</h3>
        </div>
        <p>
          Optional AssemblyAI transcription sends audio to AssemblyAI. Pexels and Pixabay use their
          provider keys and search queries to retrieve footage; these integrations do not back up your project.
        </p>
      </section>
    </div>
  );
}
