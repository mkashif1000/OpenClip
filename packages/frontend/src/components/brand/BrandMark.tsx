/**
 * OpenClip brand mark — a stylized play-glyph inside a rounded film frame.
 * Two-tone: frame uses `currentColor` so it adopts the parent text color,
 * the play cutout takes the surface color so it reads as a notch.
 *
 * Sized via className like a Lucide icon. Defaults to a 1-em square so it
 * matches `font-size` when used inline.
 */
export function BrandMark({
  className = 'w-5 h-5',
  cutoutColor = '#08080a',
}: {
  className?: string;
  cutoutColor?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Frame */}
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      {/* Play triangle */}
      <path
        d="M10.2 8.4 L16.4 11.7 a0.35 0.35 0 0 1 0 0.6 L10.2 15.6 a0.35 0.35 0 0 1 -0.55 -0.3 V8.7 a0.35 0.35 0 0 1 0.55 -0.3 Z"
        fill={cutoutColor}
      />
    </svg>
  );
}
