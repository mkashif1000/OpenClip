import { useCallback, useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { AlertCircle, Check, ExternalLink, Film, HardDrive, Loader2, Upload, Youtube } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { OpfsQuotaError } from '@/services/opfs';
import { cn } from '@/lib/cn';
import './advanced-import-source.css';

const VIDEO_ACCEPT = '.mp4,.mkv,.mov,.avi,.webm';
const VIDEO_FORMATS = ['MP4', 'MOV', 'MKV', 'AVI', 'WEBM'];

type QuotaInfo = { tried: number; used: number; quota: number };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remaining}` : `${minutes}:${remaining}`;
}

function acceptsFile(file: File, accept: string): boolean {
  const filename = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return accept.split(',').some((value) => {
    const type = value.trim().toLowerCase();
    if (type.startsWith('.')) return filename.endsWith(type);
    if (type.endsWith('/*')) return mime.startsWith(type.slice(0, -1));
    return Boolean(type) && mime === type;
  });
}

// Each source owns one controller, shared by its drop target and file input.
// The ref locks synchronously, including while the caller's callback is pending.
function useFileImport(accept: string, fileType: string, onUploaded: (file: File) => Promise<void>) {
  const setFile = useProjectStore((state) => state.setFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

  const importFiles = useCallback(async (files: File[]) => {
    if (busyRef.current) return;
    setError(null);
    setQuotaInfo(null);
    if (files.length !== 1) {
      setError(files.length > 1
        ? `Choose one ${fileType === 'video' ? 'video' : 'file'} at a time. Nothing was imported.`
        : 'Choose a file from your device to import.');
      return;
    }
    const file = files[0];
    if (!acceptsFile(file, accept)) {
      setError(fileType === 'video'
        ? 'Choose an MP4, MOV, MKV, AVI, or WEBM video file.'
        : `Choose a ${accept.split(',').map((type) => type.trim()).join(' or ')} file.`);
      return;
    }

    busyRef.current = true;
    setUploading(true);
    setProgress(0);
    setFinishing(false);
    try {
      // setFile owns storage and metadata probing. Never write the file twice.
      await setFile(fileType, file, (pct) => {
        if (Number.isFinite(pct)) setProgress(Math.max(0, Math.min(100, Math.round(pct))));
      });
      setProgress(100);
      setFinishing(true);
      await onUploaded(file);
    } catch (reason) {
      console.error('File import failed:', reason);
      if (reason instanceof OpfsQuotaError) {
        setQuotaInfo({ tried: reason.tryingToWrite, used: reason.used, quota: reason.quota });
        setError('Browser storage is full.');
      } else {
        setError(reason instanceof Error && reason.message ? reason.message : 'File import failed. Try again.');
      }
    } finally {
      busyRef.current = false;
      setUploading(false);
      setFinishing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [accept, fileType, onUploaded, setFile]);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    // Reset even invalid selections so the same file can be picked again.
    event.currentTarget.value = '';
    if (files.length) void importFiles(files);
  };

  const chooseFile = () => {
    if (!busyRef.current) inputRef.current?.click();
  };

  return { inputRef, busyRef, uploading, progress, finishing, error, quotaInfo, importFiles, onInputChange, chooseFile };
}

type FileImportState = ReturnType<typeof useFileImport>;

function ImportFeedback({ state, fileType, id }: { state: FileImportState; fileType: string; id: string }) {
  const { uploading, progress, finishing, error, quotaInfo } = state;
  const progressLabel = finishing ? 'Finishing import…'
    : progress >= 100 ? `Preparing ${fileType}…` : 'Saving to browser storage';

  return (
    <div id={id} className="import-file-feedback">
      {uploading && (
        <div className="import-file-progress">
          <div className="import-file-progress-label" role="status">
            <span>{progressLabel}</span>
            <span className="import-file-progress-value">{progress}%</span>
          </div>
          <div
            className="import-file-progress-track"
            role="progressbar"
            aria-label={`${fileType} import progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`${progress}% — ${progressLabel}`}
          >
            <div className="import-file-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {error && (
        <div className="import-file-error" role="alert">
          <AlertCircle className="import-file-error-icon" aria-hidden="true" />
          <div className="import-file-error-copy">
            <p className="import-file-error-title">{error}</p>
            {quotaInfo && (
              <>
                <p>
                  You&apos;ve used <strong>{formatBytes(quotaInfo.used)}</strong>
                  {quotaInfo.quota > 0 && <> of <strong>{formatBytes(quotaInfo.quota)}</strong></>}.
                  {' '}This file needs <strong>{formatBytes(quotaInfo.tried)}</strong> more.
                </p>
                <p>Delete old projects from the left sidebar to free browser storage, then try again.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FileMetadata({ filename, sizeBytes, duration, showDuration = false }: {
  filename: string; sizeBytes: number; duration?: number; showDuration?: boolean;
}) {
  const extension = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : undefined;
  const time = formatDuration(duration);
  return (
    <div className="import-file-meta">
      {extension && <span className="import-file-format" title="File format">{extension}</span>}
      <span aria-label={`File size: ${formatBytes(sizeBytes)}`}>{formatBytes(sizeBytes)}</span>
      {(time || showDuration) && <span aria-label={time ? `Duration: ${time}` : undefined}>{time ?? 'Duration not detected'}</span>}
    </div>
  );
}

export function ImportFileChip({ filename, sizeBytes, duration }: {
  filename: string; sizeBytes: number; duration?: number;
}) {
  return (
    <div className="import-file-chip">
      <span className="import-file-chip-icon"><Check aria-hidden="true" /></span>
      <div className="import-file-chip-copy">
        <p className="import-file-name" title={filename}>{filename}</p>
        <FileMetadata filename={filename} sizeBytes={sizeBytes} duration={duration} />
      </div>
    </div>
  );
}

export function ImportFileButton({ accept, fileType, label, onUploaded, variant = 'primary' }: {
  accept: string; fileType: string; label: string;
  onUploaded: (file: File) => Promise<void>;
  variant?: 'primary' | 'ghost';
}) {
  const state = useFileImport(accept, fileType, onUploaded);
  const feedbackId = useId();
  return (
    <div className="import-file-control" aria-busy={state.uploading}>
      <input ref={state.inputRef} type="file" accept={accept} onChange={state.onInputChange} hidden disabled={state.uploading} aria-label={label} />
      <button
        type="button"
        onClick={state.chooseFile}
        disabled={state.uploading}
        aria-describedby={state.uploading || state.error ? feedbackId : undefined}
        className={cn('import-file-button', variant === 'ghost' ? 'import-file-button-ghost' : 'import-file-button-primary')}
      >
        {state.uploading ? <Loader2 className="import-file-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />}
        <span>{label}</span>
      </button>
      <ImportFeedback state={state} fileType={fileType} id={feedbackId} />
    </div>
  );
}

export function AdvancedVideoSection({ done, active, file, onUpload }: {
  done: boolean; active: boolean;
  file?: { filename: string; size_bytes: number; duration?: number } | null;
  onUpload: (file: File) => Promise<void>;
}) {
  const state = useFileImport(VIDEO_ACCEPT, 'video', onUpload);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const titleId = useId();
  const hintId = useId();
  const feedbackId = useId();
  const inactive = !active && !done;
  const disabled = state.uploading || inactive;

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    if (!state.busyRef.current && !inactive) setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = state.busyRef.current || inactive ? 'none' : 'copy';
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (!inactive) void state.importFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <section
      className={cn('import-source-card', done && 'import-source-card-ready', dragging && 'import-source-card-dragging', inactive && 'import-source-card-inactive')}
      aria-labelledby={titleId}
      aria-busy={state.uploading}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="import-source-header">
        <div className="import-source-heading">
          <p className="import-source-eyebrow"><span>01</span> Source video</p>
          <h3 id={titleId} className="import-source-title">{done ? 'Your video is ready' : 'Start with the full recording'}</h3>
          {!done && <p className="import-source-description">One source. All the moments worth sharing.</p>}
        </div>
        <span className="import-source-badge">
          {done ? <Check aria-hidden="true" /> : <HardDrive aria-hidden="true" />}
          {done ? 'Imported' : 'Local import'}
        </span>
      </div>

      {done ? (
        <div className="import-source-ready">
          {file && (
            <div className="import-source-file">
              <span className="import-source-file-icon"><Film aria-hidden="true" /></span>
              <div className="import-source-file-copy">
                <p className="import-file-name" title={file.filename}>{file.filename}</p>
                <FileMetadata filename={file.filename} sizeBytes={file.size_bytes} duration={file.duration} showDuration />
              </div>
            </div>
          )}
          <div className="import-source-replace">
            <button
              type="button"
              className="import-file-button import-file-button-ghost"
              onClick={state.chooseFile}
              disabled={disabled}
              aria-describedby={`${hintId}${state.uploading || state.error ? ` ${feedbackId}` : ''}`}
            >
              {state.uploading ? <Loader2 className="import-file-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              Replace Video
            </button>
            <p id={hintId} className="import-source-replace-hint">
              {dragging ? 'Drop one video to replace this source.' : 'Or drop a new video onto this card.'}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="import-source-dropzone"
          onClick={state.chooseFile}
          disabled={disabled}
          aria-label="Choose video"
          aria-describedby={`${hintId}${state.uploading || state.error ? ` ${feedbackId}` : ''}`}
        >
          <span className="import-source-art" aria-hidden="true">
            <span className="import-source-art-back" />
            <span className="import-source-art-front">
              {state.uploading ? <Loader2 className="import-file-spinner" /> : <Film />}
              <span className="import-source-art-line" />
            </span>
          </span>
          <span className="import-source-drop-title">
            {state.uploading ? 'Bringing in your recording…' : dragging ? 'Drop to import your video' : 'Drop your video here'}
          </span>
          <span id={hintId} className="import-source-drop-hint">
            {state.uploading ? 'Keep this tab open while your video is prepared.' : 'Drag a file from your device, or browse to find it.'}
          </span>
          <span className="import-source-browse">
            <Upload aria-hidden="true" /> {state.uploading ? 'Importing video…' : 'Choose video'}
          </span>
          <span className="import-source-formats" aria-label="Supported video formats">
            {VIDEO_FORMATS.map((format) => <span className="import-source-format" key={format}>{format}</span>)}
          </span>
        </button>
      )}

      <input ref={state.inputRef} type="file" accept={VIDEO_ACCEPT} onChange={state.onInputChange} hidden disabled={disabled} aria-label={done ? 'Replace Video' : 'Choose video'} />
      <ImportFeedback state={state} fileType="video" id={feedbackId} />

      <div className="import-source-footer">
        <p className="import-source-local"><HardDrive aria-hidden="true" /><span>{done ? 'Stored in this browser. Your original stays untouched.' : 'Saved in this browser. No server upload.'}</span></p>
        <a className="import-source-help" href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noopener noreferrer">
          <Youtube aria-hidden="true" />
          <span>YouTube? Use <span className="import-source-help-name">yt-dlp</span></span>
          <ExternalLink aria-hidden="true" />
          <span className="import-file-sr-only"> (opens in a new tab; download, then import)</span>
        </a>
      </div>
    </section>
  );
}
