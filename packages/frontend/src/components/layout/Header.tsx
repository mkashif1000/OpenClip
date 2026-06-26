import { Settings, FolderOpen, ChevronDown, Activity, Upload, Film, Copy, Play } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/cn';
import type { TabId } from '@/types';

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'style', label: 'Templates', icon: Copy },
  { id: 'process', label: 'Process', icon: Play },
  { id: 'edit', label: 'Edit', icon: Film },
];

export function Header() {
  const project = useProjectStore((s) => s.currentProject);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <header className="h-[72px] bg-[#121212]/80 backdrop-blur-xl border border-white/5 flex items-center justify-between px-4 rounded-2xl shrink-0 shadow-lg relative z-20">
      {/* ─── Brand ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 select-none">
        <div className="relative">
          {/* Soft glow halo behind the mark for depth */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-[12px] blur-md opacity-60 -z-10"
            style={{
              background:
                'radial-gradient(closest-side, rgba(255,255,255,0.30), transparent 70%)',
            }}
          />
          <div className="w-10 h-10 rounded-[12px] bg-white flex items-center justify-center shadow-soft ring-1 ring-white/40">
            <BrandMark className="w-[20px] h-[20px]" />
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[17px] font-bold tracking-tight text-white leading-none mb-1">
            OpenClip
          </span>
          <span className="text-[9px] uppercase tracking-[0.1em] text-text-muted font-bold leading-none mt-0.5">
            v1.0 • LOCAL AI
          </span>
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center p-1.5 bg-[#080808]/80 rounded-2xl border border-white/[0.03] shadow-inner">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-2 text-[13px] font-medium transition-all rounded-xl",
                isActive 
                  ? "text-white bg-white/[0.08]" 
                  : "text-text-muted hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Icon className="w-[15px] h-[15px]" />
              {label}
              {isActive && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-white rounded-t-full shadow-[0_-2px_12px_2px_rgba(255,255,255,0.7)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Right cluster: project pill + settings ────────────────────── */}
      <div className="flex items-center gap-3">
        {project && (
          <div className="flex items-center gap-3 bg-[#080808]/80 border border-white/[0.03] rounded-[14px] pl-2 pr-3 py-1.5 cursor-pointer hover:bg-white/[0.04] transition-colors">
            <div className="p-1.5 rounded-[10px] bg-white/[0.06]">
              <FolderOpen className="w-[15px] h-[15px] text-text-muted" />
            </div>
            <div className="flex flex-col pr-2 min-w-[80px]">
              <span className="text-[8px] text-text-muted font-bold tracking-[0.1em] uppercase leading-none mb-0.5">
                Active Project
              </span>
              <span className="text-[13px] text-white font-medium leading-none truncate max-w-[120px]">
                {project.name}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-text-muted" />
          </div>
        )}
        <button
          onClick={openSettings}
          className="p-3 bg-[#080808]/80 border border-white/[0.03] rounded-[14px] hover:bg-white/[0.04] transition-colors"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-[18px] h-[18px] text-text-muted" />
        </button>
      </div>
    </header>
  );
}
