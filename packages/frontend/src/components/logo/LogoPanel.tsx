import { useState, useRef, useEffect } from 'react';
import { Image, Upload, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { opfsWriteFile, opfsGetBlobUrl } from '@/services/opfs';
import type { LogoConfig } from '@/types';

interface LogoPanelProps {
  onLogoChange?: (config: LogoConfig | null) => void;
}

export function LogoPanel({ onLogoChange }: LogoPanelProps) {
  const project = useProjectStore((s) => s.currentProject);
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<LogoConfig | null>(project?.logo_config || null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (config?.file_id) {
      opfsGetBlobUrl(config.file_id)
        .then(url => setBlobUrl(url))
        .catch(err => console.error('Failed to load logo preview:', err));
    }
  }, [config?.file_id]);

  const saveConfig = async (newConfig: LogoConfig | null) => {
    setConfig(newConfig);
    onLogoChange?.(newConfig);
    await updateCurrentProject({ logo_config: newConfig });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?.project_id) return;
    setUploading(true);
    try {
      const opfsId = `${project.project_id}_logo`;
      await opfsWriteFile(opfsId, file);
      const url = await opfsGetBlobUrl(opfsId);
      setBlobUrl(url);

      const newConfig: LogoConfig = {
        file_id: opfsId,   // OPFS id used as file_id in client-side arch
        filename: file.name,
        x: config?.x ?? 50,
        y: config?.y ?? 85,
        size: config?.size ?? 15,
        opacity: config?.opacity ?? 1,
      };
      await saveConfig(newConfig);
    } catch (err) {
      console.error('Logo import failed:', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = () => {
    setBlobUrl(null);
    saveConfig(null);
  };

  const updateField = (field: keyof LogoConfig, value: number) => {
    if (!config) return;
    saveConfig({ ...config, [field]: value });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text flex items-center gap-2">
        <Image className="w-4 h-4" />
        Logo/Overlay
      </h3>

      {!config ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !project}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/20 glass-subtle text-text hover:bg-white/5 hover:border-white/40 text-sm font-medium transition-all w-full justify-center disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Importing...' : 'Import Logo Image'}
          </button>
          <p className="text-[10px] text-text-dim">Logo stored locally in browser (PNG, SVG, etc.)</p>
        </>
      ) : (
        <>
          {/* Logo preview + remove */}
          <div className="flex items-center gap-3 p-2 rounded-xl glass-subtle border border-white/5 shadow-soft">
            {blobUrl && (
              <img src={blobUrl} alt="Logo" className="w-10 h-10 object-contain rounded bg-black/20" />
            )}
            <span className="text-xs font-medium text-text truncate flex-1">{config.filename}</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-medium text-text-dim hover:text-white transition-colors shrink-0"
            >
              Change
            </button>
            <button
              onClick={handleRemove}
              className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-error transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {/* Position & size controls */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'X Position', field: 'x' as keyof LogoConfig, min: 0, max: 100, val: Math.round(config.x), suffix: '%' },
              { label: 'Y Position', field: 'y' as keyof LogoConfig, min: 0, max: 100, val: Math.round(config.y), suffix: '%' },
              { label: 'Size', field: 'size' as keyof LogoConfig, min: 3, max: 50, val: Math.round(config.size), suffix: '%' },
              { label: 'Opacity', field: 'opacity' as keyof LogoConfig, min: 0, max: 100, val: Math.round(config.opacity * 100), suffix: '%', scale: 100 },
            ].map(({ label, field, min, max, val, suffix, scale }) => (
              <div key={field}>
                <label className="text-[10px] text-text-dim block mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-1 w-20 shadow-inner">
                    <input
                      type="number" min={min} max={max}
                      value={val}
                      onChange={(e) => updateField(field, scale ? Number(e.target.value) / scale : Number(e.target.value))}
                      className="w-full bg-transparent text-text text-xs font-mono text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col border-l border-white/10 pl-1">
                      <button 
                        onClick={() => updateField(field, scale ? Math.min(max, val + 1) / scale : Math.min(max, val + 1))} 
                        className="hover:bg-white/10 rounded px-0.5 text-text-dim hover:text-white transition-colors"
                      >
                        <ChevronUp className="w-2.5 h-2.5" />
                      </button>
                      <button 
                        onClick={() => updateField(field, scale ? Math.max(min, val - 1) / scale : Math.max(min, val - 1))} 
                        className="hover:bg-white/10 rounded px-0.5 text-text-dim hover:text-white transition-colors"
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
