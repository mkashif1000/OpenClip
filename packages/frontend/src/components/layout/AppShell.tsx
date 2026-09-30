import { useEffect, useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { RefreshCw, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { isChunkLoadError, reloadForUpdate } from '@/lib/chunkReload';

import { ImportTab } from '@/components/tabs/ImportTab';
import { EditTab } from '@/components/tabs/EditTab';
import { StyleTab } from '@/components/tabs/StyleTab';
import { ProcessTab } from '@/components/tabs/ProcessTab';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { LandingPage } from '@/components/landing/LandingPage';
import { QuickModeWorkspace } from '@/components/quick/QuickModeWorkspace';

export function AppShell() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const workspaceMode = useUIStore((s) => s.workspaceMode);
  const isLandingPage = useUIStore((s) => s.isLandingPage);
  const setLandingPage = useUIStore((s) => s.setLandingPage);
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

  // Small, discoverable keyboard layer for power users. It deliberately avoids
  // intercepting typing inside inputs and textareas.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        import('@/services/renderService').then(({ cancelRender }) => cancelRender()).catch(() => {});
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      const tabs = ['import', 'edit', 'style', 'process'] as const;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < tabs.length) {
        event.preventDefault();
        setActiveTab(tabs[index]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveTab]);

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

  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-[#070709] text-text relative">
        <LandingPage onOpenWorkspace={() => setLandingPage(false)} />
        <SettingsModal />
        {updateAvailable && <UpdateAvailableBanner onDismiss={() => setUpdateAvailable(false)} />}
      </div>
    );
  }

  if (workspaceMode === 'quick') {
    return <QuickModeWorkspace />;
  }

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
      <div className="px-3 pt-3 pb-2 sm:px-6 sm:pt-4">
        <Header />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden bg-surface rounded-tl-2xl border-t border-l border-border relative z-0">
          <div className="flex-1 overflow-auto">
            <div key={activeTab} className="animate-rise h-full">
              {activeTab === 'import' && <ImportTab />}
              {activeTab === 'edit' && <EditTab />}
              {activeTab === 'style' && <StyleTab />}
              {activeTab === 'process' && <ProcessTab />}
            </div>
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
