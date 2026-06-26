import { Upload, Film, Palette, Play } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/cn';
import type { TabId } from '@/types';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'style', label: 'Templates', icon: Palette },
  { id: 'process', label: 'Process', icon: Play },
  { id: 'edit', label: 'Edit', icon: Film },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <div className="flex items-stretch gap-1 border-b border-border glass-subtle px-3 relative z-10">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'group flex items-center gap-2 px-4 py-2.5 text-sm font-medium relative',
              isActive
                ? 'text-text'
                : 'text-text-dim hover:text-text-muted'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4 transition-transform duration-300',
                isActive ? 'scale-110' : 'group-hover:scale-105',
              )}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            {label}
            {isActive && (
              <span
                aria-hidden
                className="absolute -bottom-px left-3 right-3 h-px rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
                  boxShadow: '0 0 12px rgba(255,255,255,0.45)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
