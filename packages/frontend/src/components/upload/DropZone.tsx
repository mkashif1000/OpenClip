import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Film, FileText, FileJson, AlertCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/cn';
import type { FileUpload } from '@/types';

const FILE_TYPE_MAP: Record<string, { type: string; icon: React.ElementType; label: string }> = {
  '.mp4': { type: 'video', icon: Film, label: 'Video' },
  '.mkv': { type: 'video', icon: Film, label: 'Video' },
  '.mov': { type: 'video', icon: Film, label: 'Video' },
  '.avi': { type: 'video', icon: Film, label: 'Video' },
  '.webm': { type: 'video', icon: Film, label: 'Video' },
  '.srt': { type: 'srt', icon: FileText, label: 'Subtitles' },
  '.json': { type: 'json', icon: FileJson, label: 'Clips JSON' },
};

export function DropZone() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { currentProjectId, setFile } = useProjectStore();

  const onDrop = useCallback(async (files: File[]) => {
    if (!currentProjectId) return;
    setUploading(true);
    setError(null);

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const config = FILE_TYPE_MAP[ext];
      if (!config) continue;

      setProgress(0);
      try {
        await setFile(config.type, file, (pct) => setProgress(pct));

        const fileData: FileUpload = {
          file_id: `${currentProjectId}_${config.type}_${Date.now()}`,
          filename: file.name,
          file_type: config.type as FileUpload['file_type'],
          size_bytes: file.size,
          path: '',
        };
        setUploadedFiles((prev) => [...prev.filter((f) => f.file_type !== config.type), fileData]);
      } catch (err: any) {
        console.error('Upload to OPFS failed:', err);
        setError(err?.message || 'Failed to store file');
      }
    }

    setUploading(false);
    setProgress(0);
  }, [currentProjectId, setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mkv', '.mov', '.avi', '.webm'],
      'application/x-subrip': ['.srt'],
      'application/json': ['.json'],
    },
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-accent bg-accent/5 scale-[1.02]'
            : 'border-border hover:border-accent/50 hover:bg-surface',
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('w-10 h-10 mx-auto mb-3', isDragActive ? 'text-accent' : 'text-text-dim')} />
        <p className="text-text font-medium">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-text-muted text-sm mt-1">
          Video (.mp4, .mkv, .mov) + Subtitles (.srt) + Clips (.json)
        </p>
        <p className="text-xs text-text-dim mt-2">
          Files are stored locally in your browser — no upload to any server
        </p>
        {uploading && (
          <div className="mt-4 max-w-xs mx-auto">
            <div className="h-1.5 bg-panel rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              {progress < 100 ? `Storing locally… ${Math.round(progress)}%` : 'Analysing video…'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((f) => {
            const ext = '.' + f.filename.split('.').pop()?.toLowerCase();
            const config = FILE_TYPE_MAP[ext] || { icon: FileText, label: 'File' };
            const Icon = config.icon;
            return (
              <div
                key={f.file_id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface border border-border"
              >
                <Icon className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{f.filename}</p>
                  <p className="text-xs text-text-muted">
                    {config.label} · {(f.size_bytes / (1024 * 1024)).toFixed(1)} MB
                    {f.duration ? ` · ${Math.round(f.duration)}s` : ''}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
