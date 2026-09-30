import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// A constant angular speed, not a delay between slide transitions.
export const HERO_ORBIT_STEP_MS = 4800;
const wrap = (value: number, count: number) => ((value % count) + count) % count;

export function heroOrbitPose(index: number, phase: number, count: number, radiusX: number, radiusY: number) {
  const offset = wrap(index - phase + count / 2, count) - count / 2;
  const angle = offset * Math.PI / count;
  const depth = Math.max(0, Math.cos(angle));
  // Both ends are invisible before recycling to the opposite end of the arc.
  const edge = Math.min(1, Math.max(0, (count / 2 - Math.abs(offset)) / 0.42));
  return {
    x: Math.sin(angle) * radiusX,
    y: (Math.cos(angle) - 1) * radiusY,
    tilt: -angle * 180 / Math.PI * 0.13,
    scale: 0.78 + 0.22 * depth,
    opacity: (0.5 + 0.5 * depth) * edge,
    depth,
  };
}

export function useHeroOrbit(count: number, initialIndex: number) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const phaseRef = useRef(initialIndex);
  const dimensionsRef = useRef({ x: 600, y: 300 });
  const activeRef = useRef(initialIndex);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [isPaused, setIsPaused] = useState(reducedMotion);
  const [isVisible, setIsVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [target, setTarget] = useState<{ phase: number } | null>(null);
  const isPlaying = !isPaused && isVisible && pageVisible;

  // Transforms are painted directly: React only re-renders when the featured
  // card changes, rather than rendering every waveform/text node every frame.
  const paint = useCallback((phase: number) => {
    const { x, y } = dimensionsRef.current;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const pose = heroOrbitPose(index, phase, count, x, y);
      card.style.transform = `translate3d(calc(-50% + ${pose.x.toFixed(3)}px), calc(-50% + ${pose.y.toFixed(3)}px), 0) rotate(${pose.tilt.toFixed(3)}deg) scale(${pose.scale.toFixed(4)})`;
      card.style.opacity = pose.opacity.toFixed(4);
      card.style.zIndex = String(Math.round(pose.depth * 100));
      card.style.pointerEvents = pose.opacity < 0.08 ? 'none' : 'auto';
      card.style.borderColor = `rgba(212,212,212,${(0.12 + Math.pow(pose.depth, 8) * 0.46).toFixed(3)})`;
    });
    const nextActive = wrap(Math.round(phase), count);
    if (nextActive !== activeRef.current) {
      activeRef.current = nextActive;
      setActiveIndex(nextActive);
    }
  }, [count]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const card = cardRefs.current[0];
    if (!stage || !card) return;
    const measure = () => {
      const width = stage.clientWidth;
      dimensionsRef.current = {
        x: width < 768 ? Math.max(420, width * 0.8) : width * 0.44,
        y: Math.max(0, stage.clientHeight - card.offsetHeight - 44),
      };
      paint(phaseRef.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(card);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setIsPaused(true);
    };
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    preference.addEventListener('change', onPreferenceChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    if (carouselRef.current) observer.observe(carouselRef.current);
    return () => {
      preference.removeEventListener('change', onPreferenceChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!pageVisible || !isVisible || (!isPlaying && !target)) return;
    const from = phaseRef.current;
    if (!isPlaying && target && reducedMotion) {
      phaseRef.current = wrap(target.phase, count);
      paint(phaseRef.current);
      setTarget(null);
      return;
    }

    let frame = 0;
    let previousTime: number | null = null;
    let elapsed = 0;
    const tick = (time: number) => {
      // Ignore time spent suspended or blocked, so resuming never jumps.
      const delta = previousTime === null ? 0 : Math.min(time - previousTime, 64);
      previousTime = time;
      elapsed += delta;
      if (isPlaying) {
        phaseRef.current = wrap(phaseRef.current + delta / HERO_ORBIT_STEP_MS, count);
      } else if (target) {
        const progress = Math.min(1, elapsed / 600);
        const eased = progress * progress * (3 - 2 * progress);
        phaseRef.current = from + (target.phase - from) * eased;
        if (progress === 1) {
          phaseRef.current = wrap(target.phase, count);
          paint(phaseRef.current);
          setTarget(null);
          return;
        }
      }
      paint(phaseRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, isPlaying, isVisible, pageVisible, paint, reducedMotion, target]);

  const selectIndex = (index: number) => {
    const phase = phaseRef.current;
    const delta = wrap(index - phase + count / 2, count) - count / 2;
    setIsPaused(true);
    setTarget({ phase: phase + delta });
  };

  const step = (direction: number) => {
    const phase = target?.phase ?? phaseRef.current;
    setIsPaused(true);
    setTarget({ phase: Math.round(phase) + direction });
  };

  const pause = () => setIsPaused(true);
  const toggle = () => {
    setTarget(null);
    setIsPaused((paused) => !paused);
  };

  return { carouselRef, stageRef, cardRefs, activeIndex, isPlaying, isPaused, selectIndex, step, pause, toggle };
}
