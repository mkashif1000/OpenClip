import { useEffect, useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Film, RefreshCw, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { isChunkLoadError, reloadForUpdate } from '@/lib/chunkReload';

import { ImportTab } from '@/components/tabs/ImportTab';
import { EditTab } from '@/components/tabs/EditTab';
import { StyleTab } from '@/components/tabs/StyleTab';
import { ProcessTab } from '@/components/tabs/ProcessTab';
import { SettingsModal } from '@/components/settings/SettingsModal';

export function AppShell() {
  const activeTab = useUIStore((s) => s.activeTab);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Ask the browser to mark OPFS as persistent so multi-GB videos don't get
  // evicted under disk pressure. Best-effort and idempotent — most browsers
  // grant it silently for installed-PWA / engaged sites; we don't gate on it.
  useEffect(() => {
    (async () => {
      try {
        const { opfsRequestPersistent } = await import('@/services/opfs');
        await opfsRequestPersistent();
      } catch { /* best-effort */ }
    })();
  }, []);

  // Stale-deploy detection. Vite emits `vite:preloadError` when a hashed
  // chunk URL referenced by index.html no longer exists on the CDN (which
  // happens after we redeploy and the user's tab was already open). We also
  // listen for any uncaught promise rejection that looks like a chunk error,
  // plus a custom event from our safeImport() helper.
  useEffect(() => {
    const onChunkProblem = () => setUpdateAvailable(true);
    const onPreloadError = (e: Event) => {
      e.preventDefault();
      setUpdateAvailable(true);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) {
        e.preventDefault();
        setUpdateAvailable(true);
      }
    };
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error) || isChunkLoadError({ message: e.message })) {
        setUpdateAvailable(true);
      }
    };
    window.addEventListener('vite:preloadError', onPreloadError as EventListener);
    window.addEventListener('app:chunk-reload-required', onChunkProblem);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('vite:preloadError', onPreloadError as EventListener);
      window.removeEventListener('app:chunk-reload-required', onChunkProblem);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#080808] relative overflow-hidden">
      {/* Ambient light bloom — purely cosmetic, fixed behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(800px 380px at 14% 8%, rgba(255,255,255,0.06), transparent 70%),' +
            'radial-gradient(700px 380px at 90% 95%, rgba(255,255,255,0.04), transparent 70%)',
        }}
      />
      <div className="px-4 pt-4 pb-2">
        <Header />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden bg-surface rounded-tl-2xl border-t border-l border-border relative z-0">
          <div className="flex-1 overflow-auto">
            {!projectId ? (
              <EmptyState />
            ) : (
              // h-full so children using `h-full` (EditTab) get a real height
              // to size against; otherwise the page scrolls instead of
              // clipping the timeline / preview inside the tab.
              <div key={activeTab} className="animate-rise h-full">
                {activeTab === 'import' && <ImportTab />}
                {activeTab === 'edit' && <EditTab />}
                {activeTab === 'style' && <StyleTab />}
                {activeTab === 'process' && <ProcessTab />}
              </div>
            )}
          </div>
        </div>
      </div>
      <SettingsModal />
      {updateAvailable && <UpdateAvailableBanner onDismiss={() => setUpdateAvailable(false)} />}
    </div>
  );
}

function UpdateAvailableBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-stretch gap-0 rounded-2xl glass-strong border border-white/15 shadow-pop max-w-md animate-rise"
    >
      <div className="flex items-center gap-3 pl-4 pr-2 py-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4 text-text" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text leading-tight">A newer version of OpenClip is live</p>
          <p className="text-[11px] text-text-muted leading-snug mt-0.5">
            Reload to pick up the latest build. Your projects + media stay safe in browser storage.
          </p>
        </div>
      </div>
      <button
        onClick={reloadForUpdate}
        className="px-4 py-3 bg-white text-black hover:bg-accent-hover text-sm font-medium border-l border-white/15"
      >
        Reload
      </button>
      <button
        onClick={onDismiss}
        className="p-2 text-text-muted hover:text-text border-l border-white/8"
        title="Dismiss"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function EmptyState() {
  const createProject = useProjectStore((s) => s.createProject);

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="text-center -mt-10 animate-rise-slow max-w-md">
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl glass flex items-center justify-center">
          <Film className="w-7 h-7 text-text/80" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold text-text mb-2 tracking-tight">No Project Selected</h2>
        <p className="text-text-muted mb-7 leading-relaxed">
          Create a new project to import a video and start generating clips.
        </p>
        <button
          onClick={() => createProject('My Project')}
          className="px-7 py-3 rounded-xl bg-white text-black font-medium hover:bg-accent-hover transition-colors"
        >
          Create Project
        </button>
      </div>
    </div>
  );
}
