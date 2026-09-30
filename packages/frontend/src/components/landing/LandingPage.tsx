import { useRef, useState, type RefObject } from 'react';
import {
  ArrowRight,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  LockKeyhole,
  Pause,
  Play,
  Scissors,
  Upload,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { useHeroOrbit } from './useHeroOrbit';
import { WorkflowSection } from './workflow/WorkflowSection';
import { LandingToolkit } from './LandingToolkit';

interface Props {
  onOpenWorkspace: () => void;
}

type HeroSlide = {
  id: string;
  label: string;
  duration: string;
  score: string;
  quote: string;
  highlight: string;
  footer: string;
  accent: string;
};

const heroSlides: HeroSlide[] = [
  { id: 'mindset', label: 'THE MINDSET SHIFT', duration: '00:28', score: '98', quote: 'The mindset shift that changed', highlight: 'everything for me.', footer: 'Bold captions', accent: '#eeeeee' },
  { id: 'system', label: 'BUILD A SYSTEM', duration: '00:31', score: '95', quote: 'You do not need more time,', highlight: 'you need a system.', footer: 'Karaoke pop', accent: '#d4d4d4' },
  { id: 'compounds', label: 'THE LONG GAME', duration: '00:24', score: '92', quote: 'Good content compounds', highlight: 'over time.', footer: 'Marker highlight', accent: '#c4c4c4' },
  { id: 'everything', label: 'THE BIG IDEA', duration: '00:42', score: '99', quote: 'This changes', highlight: 'everything.', footer: 'Bold captions', accent: '#ffffff' },
  { id: 'habits', label: 'SMALL HABITS', duration: '00:37', score: '94', quote: 'Small habits create', highlight: 'massive results.', footer: 'Word by word', accent: '#dddddd' },
  { id: 'better', label: 'A BETTER WAY', duration: '00:19', score: '91', quote: 'Here is a better way', highlight: 'to think about it.', footer: 'Minimal clean', accent: '#bfbfbf' },
  { id: 'needle', label: 'FOCUS', duration: '00:33', score: '89', quote: 'Focus on what actually', highlight: 'moves the needle.', footer: 'Outline pop', accent: '#cecece' },
];

function HeroClipCard({
  slide,
  isActive,
  cardRef,
  onSelect,
}: {
  slide: HeroSlide;
  isActive: boolean;
  cardRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      aria-label={`Select ${slide.label.toLowerCase()} sample clip${isActive ? ', selected' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      aria-hidden={!isActive || undefined}
      tabIndex={isActive ? 0 : -1}
      data-active={isActive}
      className="group hero-clip-card absolute left-1/2 overflow-hidden rounded-[18px] border bg-[#111111] text-left"
    >
      <div className="relative h-full overflow-hidden rounded-[17px] bg-[#151515]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(ellipse at 70% 24%, ${slide.accent}24, transparent 65%), linear-gradient(145deg, #2b2b2b 0%, #191919 44%, #0a0a0a 100%)`,
          }}
        />
        <div aria-hidden className="hero-placeholder-grid absolute inset-0 opacity-45" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent" />

        <div className="relative flex items-center justify-between px-3 pt-3 text-[9px] font-mono font-semibold tracking-wide text-white/70">
          <span className="rounded-md border border-white/15 bg-black/35 px-1.5 py-1">{slide.duration}</span>
          <span className="rounded-md border border-white/10 bg-black/25 px-1.5 py-1">9:16 · SAMPLE</span>
        </div>

        <div className="absolute inset-x-0 top-[24%] flex flex-col items-center gap-3 text-white/40">
          <span className="flex h-16 w-14 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[.025] transition-transform duration-500 group-hover:scale-110">
            <Film className="h-6 w-6" strokeWidth={1.2} />
          </span>
          <span className="text-[9px] uppercase tracking-[.16em]">Your video here</span>
        </div>

        <div className="absolute inset-x-5 bottom-[82px]">
          <p className={`hero-sample-caption leading-[1.08] tracking-[-.035em] text-white ${slide.id === 'everything' ? 'text-center font-black uppercase' : 'font-semibold'}`}>
            {slide.quote}{' '}
            <span className="text-white/70">{slide.highlight}</span>
          </p>
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="hero-waveform mb-2 flex h-4 items-end gap-[2px]" aria-hidden>
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} className="hero-wave-bar" style={{ height: `${25 + ((index * 17) % 68)}%`, backgroundColor: '#d4d4d4', animationDelay: `${index * 45}ms` }} />
              ))}
            </div>
            <span className="block truncate text-[9px] font-medium text-white/55">{slide.footer}</span>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-semibold text-white/80">Demo</span>
        </div>
      </div>
    </button>
  );
}

type HeroSectionProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onOpenWorkspace: () => void;
  onUpload: () => void;
  onFileSelected: (file: File) => void;
  activeUploadLabel: string;
};

function HeroSection({
  inputRef,
  isUploading,
  onOpenWorkspace,
  onUpload,
  onFileSelected,
  activeUploadLabel,
}: HeroSectionProps) {
  const { carouselRef, stageRef, cardRefs, activeIndex: activeSlide, isPlaying, isPaused, selectIndex, step, pause, toggle } = useHeroOrbit(heroSlides.length, 3);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipedRef = useRef(false);
  const selectedSlide = heroSlides[activeSlide];
  const goToNext = () => step(1);
  const goToPrevious = () => step(-1);

  return (
    <section aria-labelledby="hero-heading" className="openclip-hero relative isolate mx-auto max-w-[1680px] px-4 pb-12 pt-9 sm:px-8 sm:pb-16 sm:pt-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,.055), transparent 62%)' }} />

      <div className="hero-copy relative z-10 mx-auto max-w-4xl text-center">
        <div className="hero-copy-enter mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.045] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.13em] text-text-muted shadow-soft sm:text-[10px]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_#ffffff80]" />
          Short-form, without the busywork
        </div>
        <h1 id="hero-heading" className="hero-copy-enter text-[clamp(2.35rem,5.2vw,4.7rem)] font-extrabold leading-[1.04] tracking-[-.055em] text-white" style={{ animationDelay: '70ms' }}>
          Turn long videos<span className="hero-heading-break"> </span>into <span className="hero-heading-gradient">clips people watch.</span>
        </h1>
        <p className="hero-copy-enter mx-auto mt-5 max-w-[660px] text-sm leading-6 text-text-muted sm:text-base sm:leading-7" style={{ animationDelay: '140ms' }}>
          OpenClip finds the moments worth sharing, adds captions and clean layouts, then renders everything locally in your browser.
        </p>
        <div className="hero-copy-enter mx-auto mt-5 flex max-w-sm flex-col justify-center gap-3 sm:max-w-none sm:flex-row" style={{ animationDelay: '210ms' }}>
          <input ref={inputRef} type="file" accept="video/*,.mkv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onFileSelected(file); }} />
          <button type="button" onClick={onUpload} disabled={isUploading} className="group flex items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black shadow-glow hover:-translate-y-0.5 hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70">
            <Upload className="h-4 w-4" /> {activeUploadLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button type="button" onClick={onOpenWorkspace} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/[.09]">
            Explore the workspace <ChevronRight className="h-4 w-4 text-text-muted" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-text-dim">
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-white/70" /> No sign-up</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-white/70" /> No upload queue</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-white/70" /> Free to use</span>
        </div>
      </div>

      <div
        ref={carouselRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Sample clip styles"
        tabIndex={-1}
        data-playing={isPlaying}
        className="hero-carousel relative -mx-4 sm:-mx-8"
        onFocusCapture={(event) => {
          if (!(event.target as HTMLElement).closest('[data-rotation-control]')) pause();
        }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && (event.target as HTMLElement).closest('.hero-clip-card')) {
            carouselRef.current?.focus({ preventScroll: true });
          }
          if (event.key === 'ArrowLeft') { event.preventDefault(); goToPrevious(); }
          if (event.key === 'ArrowRight') { event.preventDefault(); goToNext(); }
          if (event.key === 'Home') { event.preventDefault(); selectIndex(0); }
          if (event.key === 'End') { event.preventDefault(); selectIndex(heroSlides.length - 1); }
        }}
      >
        <div aria-hidden className="hero-carousel-glow pointer-events-none absolute inset-0" />
        <div
          ref={stageRef}
          className="hero-carousel-stage relative select-none"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            swipeRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            swipedRef.current = false;
          }}
          onPointerMove={(event) => {
            const start = swipeRef.current;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.2) {
              event.currentTarget.setPointerCapture(event.pointerId);
              swipedRef.current = true;
            }
          }}
          onPointerUp={(event) => {
            const start = swipeRef.current;
            swipeRef.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.2) {
              swipedRef.current = true;
              if (dx < 0) goToNext(); else goToPrevious();
            }
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { swipeRef.current = null; swipedRef.current = false; }}
          onClickCapture={(event) => {
            if (swipedRef.current) { event.preventDefault(); event.stopPropagation(); swipedRef.current = false; }
          }}
        >
          {heroSlides.map((slide, index) => (
            <HeroClipCard key={slide.id} slide={slide} isActive={index === activeSlide} cardRef={(node) => { cardRefs.current[index] = node; }} onSelect={() => selectIndex(index)} />
          ))}
        </div>

        <div className="relative z-40 mx-auto flex w-fit max-w-full items-center gap-1 rounded-full border border-white/10 bg-[#121212]/90 px-1.5 shadow-soft sm:gap-2 sm:px-2">
          <button type="button" data-rotation-control onClick={toggle} className="hero-carousel-control" aria-label={isPaused ? 'Resume carousel' : 'Pause carousel'} title={isPaused ? 'Resume rotation' : 'Pause rotation'}>
            {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
          <span aria-hidden className="mr-1 h-4 w-px bg-white/10" />
          <button type="button" onClick={goToPrevious} aria-label="Previous clip preview" className="hero-carousel-control"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex items-center" aria-label="Choose a sample clip">
            {heroSlides.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => selectIndex(index)} aria-label={`Show ${slide.label.toLowerCase()} preview`} aria-current={activeSlide === index ? 'true' : undefined} className="hero-carousel-dot flex h-11 w-5 items-center justify-center sm:w-6">
                <span className={`block h-1.5 rounded-full transition-[width,background-color] ${activeSlide === index ? 'w-4 bg-white shadow-[0_0_10px_#ffffff60]' : 'w-1.5 bg-white/25'}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={goToNext} aria-label="Next clip preview" className="hero-carousel-control"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="relative mx-auto mt-3 max-w-[280px] text-center">
          <p aria-live={isPlaying ? 'off' : 'polite'} aria-atomic="true" className="text-[10px] tracking-wide text-white/50">
            <span className="font-mono">{String(activeSlide + 1).padStart(2, '0')} / 07</span>
            <span className="mx-2 text-white/20">·</span>{selectedSlide.label}
          </p>
          <p className="mt-1 text-[9px] tracking-wide text-white/35">{isPaused ? 'Rotation paused' : 'Continuous rotation'} · Drag to explore</p>
          <span className="sr-only">Placeholder previews. Use the arrow buttons, left and right keys, or swipe to browse.</span>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-6xl gap-5 sm:mt-10 md:grid-cols-3 md:gap-0">
        {[
          { icon: Scissors, title: 'Find the best moments', text: 'AI spots the sections worth sharing.' },
          { icon: Captions, title: 'Edit without the busywork', text: 'Add captions, layouts, and polish.' },
          { icon: LockKeyhole, title: 'Your media stays local', text: 'Processing happens in your browser.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="group flex items-center gap-4 px-3 md:border-r md:border-white/10 md:px-5 md:last:border-r-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[.04] text-white/75 transition-[transform,border-color] group-hover:-translate-y-1 group-hover:border-white/40"><Icon className="h-5 w-5" strokeWidth={1.5} /></span>
            <span className="min-w-0"><span className="block text-xs font-bold text-white">{title}</span><span className="mt-1 block text-xs leading-5 text-text-muted">{text}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPage({ onOpenWorkspace }: Props) {
  const { createProject, setFile } = useProjectStore();
  const setClips = useClipStore((s) => s.setClips);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleVideo = async (file: File) => {
    if (!file.type.startsWith('video/') && !/\.(mp4|mkv|mov|avi|webm)$/i.test(file.name)) {
      alert('Please choose a video file (MP4, MKV, MOV, AVI, or WEBM).');
      return;
    }

    try {
      setIsUploading(true);
      const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 32) || 'My Video Project';
      await createProject(name);
      setClips([]);
      await setFile('video', file);
      onOpenWorkspace();
    } catch (error) {
      console.error('Direct video upload failed:', error);
      alert('Could not store the video locally. Please check available disk space.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-text selection:bg-white/20 overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-80" style={{ background: 'radial-gradient(900px 480px at 50% -8%, rgba(255,255,255,.09), transparent 72%), radial-gradient(700px 420px at 90% 42%, rgba(255,255,255,.035), transparent 70%)' }} />

      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between rounded-2xl border border-white/[0.08] bg-[#121214]/90 px-3 shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur-xl sm:px-4">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="shrink-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#121214]" aria-label="OpenClip home">
            <BrandLogo />
          </button>
          <nav className="hidden items-center gap-1 rounded-xl border border-white/[0.04] bg-[#08080a]/70 p-1 md:flex">
            <a href="#workflow" className="rounded-lg px-4 py-2 text-xs font-medium text-text-muted hover:bg-white/[0.07] hover:text-white">How it works</a>
            <a href="#features" className="rounded-lg px-4 py-2 text-xs font-medium text-text-muted hover:bg-white/[0.07] hover:text-white">Features</a>
            <a href="#privacy" className="rounded-lg px-4 py-2 text-xs font-medium text-text-muted hover:bg-white/[0.07] hover:text-white">Privacy first</a>
          </nav>
          <button onClick={onOpenWorkspace} disabled={isUploading} className="group flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-bold text-black shadow-glow hover:bg-accent-hover disabled:opacity-60 sm:px-4 sm:text-xs">
            Open workspace <span className="hidden h-5 w-5 items-center justify-center rounded-full bg-black/10 sm:flex"><ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        </div>
      </header>

      <main>
        <HeroSection
          inputRef={inputRef}
          isUploading={isUploading}
          onOpenWorkspace={onOpenWorkspace}
          onUpload={() => inputRef.current?.click()}
          onFileSelected={handleVideo}
          activeUploadLabel={isUploading ? 'Importing locally...' : 'Start with a video'}
        />

        <WorkflowSection onOpenWorkspace={onOpenWorkspace} />
        <LandingToolkit onOpenWorkspace={onOpenWorkspace} />
      </main>

      <footer className="border-t border-white/[.07] px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-[11px] text-text-dim sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="self-start rounded-2xl border border-white/[.08] bg-[#111113] px-4 py-3 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="OpenClip home">
            <BrandLogo />
          </button>
          <span>Made for creators, podcasters, and editors.</span>
        </div>
      </footer>
    </div>
  );
}
