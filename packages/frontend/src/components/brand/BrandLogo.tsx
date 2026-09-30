import { BrandMark } from './BrandMark';
import { cn } from '@/lib/cn';

/** Shared lockup for landing and workspace navigation; the parent owns the link. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-3 whitespace-nowrap text-left select-none', className)}>
      <BrandMark className="h-9 w-9 shrink-0 rounded-[11px] shadow-soft ring-1 ring-white/30 sm:h-10 sm:w-10 sm:rounded-xl" />
      <span className="flex flex-col">
        <span className="text-base font-bold leading-none tracking-tight text-white sm:text-[17px]">OpenClip</span>
        <span className="mt-1.5 text-[8px] font-bold uppercase leading-none tracking-[.14em] text-text-dim sm:text-[9px]">Local AI editor</span>
      </span>
    </span>
  );
}
