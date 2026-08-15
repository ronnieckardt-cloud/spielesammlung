/** Eigenes Symbol statt Emoji — Reagenzglas mit bunten Farbschichten. */
export function FarbsortiererIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <clipPath id="fs-glas">
          <path d="M10.2 3v9.3l-3.9 8a2.7 2.7 0 002.4 3.9h6.6a2.7 2.7 0 002.4-3.9l-3.9-8V3z" />
        </clipPath>
      </defs>
      <g clipPath="url(#fs-glas)">
        <rect x="4" y="18" width="16" height="6" fill="#fb923c" />
        <rect x="4" y="14.5" width="16" height="4" fill="#facc15" />
        <rect x="4" y="11" width="16" height="4" fill="#2dd4bf" />
      </g>
      <path
        d="M9.5 2.5h5M10.2 3v9.3l-3.9 8a2.7 2.7 0 002.4 3.9h6.6a2.7 2.7 0 002.4-3.9l-3.9-8V3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
