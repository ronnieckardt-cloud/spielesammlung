/** Eigenes Symbol statt Emoji — bunter Stift beim Schreiben. */
export function WortspielIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 20l.9-4.4 3.5 3.5L4 20z" fill="#fde68a" />
      <path d="M4.9 15.6l9.5-9.5 3.5 3.5-9.5 9.5z" fill="#facc15" />
      <path
        d="M14.4 6.1l1.9-1.9a1.9 1.9 0 012.7 0l.8.8a1.9 1.9 0 010 2.7l-1.9 1.9z"
        fill="#ffffff"
      />
    </svg>
  );
}
