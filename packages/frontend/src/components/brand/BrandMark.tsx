/**
 * OpenClip's rounded-square mark, matching the shared brand reference.
 * Explicit colors keep the white frame and dark center consistent on every
 * surface, regardless of the surrounding text color.
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
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="12" fill="#ffffff" />
      <rect x="12" y="12" width="16" height="16" rx="5" fill={cutoutColor} />
    </svg>
  );
}
