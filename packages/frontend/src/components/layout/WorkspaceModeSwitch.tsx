import { SlidersHorizontal } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

/** Always names the destination, never the mode the user is already in. */
export function WorkspaceModeSwitch() {
  const mode = useUIStore((s) => s.workspaceMode);
  const setMode = useUIStore((s) => s.setWorkspaceMode);
  const nextMode = mode === 'quick' ? 'advanced' : 'quick';
  const label = nextMode === 'quick' ? 'Quick' : 'Advanced';

  return (
    <button
      type="button"
      onClick={() => setMode(nextMode)}
      aria-label={`${label} mode`}
      title={`Switch to ${label} mode`}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[.07] bg-black/20 px-2 py-2 text-[11px] font-medium text-text-muted transition-colors hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:px-3 sm:text-xs"
    >
      <SlidersHorizontal className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
      <span>{label}<span className={nextMode === 'quick' ? '' : 'hidden sm:inline'}> mode</span></span>
    </button>
  );
}
