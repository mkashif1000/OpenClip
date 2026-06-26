import { useState, useEffect } from 'react';
import { Save, Trash2, Download } from 'lucide-react';
import { useStyleStore } from '@/stores/styleStore';
import { dbGetTemplates, dbSaveTemplate, dbDeleteTemplate } from '@/services/db';
import type { Template } from '@/types';

export function TemplateSelector() {
  const { styles, setStyles } = useStyleStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newName, setNewName] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    dbGetTemplates().then(setTemplates).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!newName.trim()) return;
    const tmpl: Template = {
      template_id: crypto.randomUUID().slice(0, 8),
      name: newName,
      description: '',
      styles,
      layout: 'standard',
    };
    await dbSaveTemplate(tmpl);
    setTemplates((prev) => [...prev, tmpl]);
    setNewName('');
    setShowSave(false);
  };

  const handleLoad = (tmpl: Template) => {
    setStyles(tmpl.styles);
  };

  const handleDelete = async (id: string) => {
    await dbDeleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.template_id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Style Templates</h3>
        <button
          onClick={() => setShowSave(!showSave)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          <Save className="w-3 h-3" />
          Save Current
        </button>
      </div>

      {showSave && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-text-dim">No saved templates</p>
      ) : (
        <div className="space-y-1">
          {templates.map((tmpl) => (
            <div
              key={tmpl.template_id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-border"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-text">{tmpl.name}</span>
                {tmpl.layout === 'pip' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-green-500/20 text-green-400">PIP</span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleLoad(tmpl)}
                  className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-info transition-colors"
                  title="Load template"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(tmpl.template_id)}
                  className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-error transition-colors"
                  title="Delete template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
