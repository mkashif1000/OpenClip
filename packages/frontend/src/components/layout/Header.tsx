import { Settings, FolderOpen, ChevronDown, Upload, Film, Copy, Play } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { WorkspaceModeSwitch } from './WorkspaceModeSwitch';
import { cn } from '@/lib/cn';
import type { TabId } from '@/types';

const tabs: { id: TabId; label: string; icon: any }[] = [
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
  const setLandingPage = useUIStore((s) => s.setLandingPage);

  return (
    <header className="mx-auto max-w-7xl min-h-[68px] lg:h-[68px] bg-[#121212]/80 backdrop-blur-xl border border-white/5 grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3 sm:px-4 lg:py-0 rounded-2xl shrink-0 shadow-lg relative z-20">
      {/* ─── Brand ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setLandingPage(true)}
        className="justify-self-start shrink-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#121212]"
        title="Return to Landing Page"
        aria-label="OpenClip home"
      >
        <BrandLogo />
      </button>

      {/* ─── Tabs ──────────────────────────────────────────────────────── */}
      <nav aria-label="Workspace" className="order-last col-span-2 lg:order-none lg:col-span-1 w-full lg:w-auto flex items-center justify-center p-1.5 bg-[#080808]/80 rounded-2xl border border-white/[0.03] shadow-inner">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex items-center gap-1.5 px-2 sm:px-4 py-2 text-[11px] sm:text-[13px] font-medium transition-all rounded-xl",
                isActive 
                  ? "text-white bg-white/[0.08]" 
                  : "text-text-muted hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Icon className="hidden sm:block w-[15px] h-[15px]" />
              {label}
              {isActive && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-white rounded-t-full shadow-[0_-2px_12px_2px_rgba(255,255,255,0.7)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── Right cluster: project + destination mode + settings ──────── */}
      <div className="flex min-w-0 items-center justify-self-end gap-1.5 sm:gap-2">
        {project && (
          <div className="hidden xl:flex items-center gap-3 bg-[#080808]/80 border border-white/[0.03] rounded-[14px] pl-2 pr-3 py-1.5 cursor-pointer hover:bg-white/[0.04] transition-colors">
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
        <WorkspaceModeSwitch />
        <button
          onClick={openSettings}
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-black/20 border border-white/[.07] rounded-xl hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-[18px] h-[18px] text-text-muted" />
        </button>
      </div>
    </header>
  );
}
