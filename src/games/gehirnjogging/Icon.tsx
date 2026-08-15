/** Eigenes Symbol statt Emoji — zwei Gehirnhälften. */
export function GehirnjoggingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.3 4.2a2.7 2.7 0 00-4.8 1.6 2.9 2.9 0 00-1.7 4.8 3.3 3.3 0 001.1 5.9A2.8 2.8 0 008.6 20a2.7 2.7 0 002.7-2.7V4.2z" />
      <path d="M12.7 4.2a2.7 2.7 0 014.8 1.6 2.9 2.9 0 011.7 4.8 3.3 3.3 0 01-1.1 5.9A2.8 2.8 0 0115.4 20a2.7 2.7 0 01-2.7-2.7V4.2z" />
    </svg>
  );
}
