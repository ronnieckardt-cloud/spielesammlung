/** Eigenes Symbol statt Emoji — ein schreibender Stift. */
export function WortspielIcon({ className }: { className?: string }) {
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
      <path d="M4 20l.9-4.4L15.4 5.1a1.9 1.9 0 012.7 0l1.2 1.2a1.9 1.9 0 010 2.7L8.8 19.5 4 20z" />
      <path d="M13.6 6.9l3 3" />
    </svg>
  );
}
