/** Eigenes Symbol statt Emoji — ein Reagenzglas mit Füllstand-Linie. */
export function FarbsortiererIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.5 2.5h5" />
      <path d="M10.2 3v9.5l-3.9 8a2.7 2.7 0 002.4 3.9h6.6a2.7 2.7 0 002.4-3.9l-3.9-8V3" />
      <path d="M7.5 15.5h9" />
    </svg>
  );
}
