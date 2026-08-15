/** Eigenes Symbol statt Emoji — zweifarbiges Gehirn mit Blitz-Funke. */
export function GehirnjoggingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M11.3 4.2a2.7 2.7 0 00-4.8 1.6 2.9 2.9 0 00-1.7 4.8 3.3 3.3 0 001.1 5.9A2.8 2.8 0 008.6 20a2.7 2.7 0 002.7-2.7V4.2z"
        fill="#fecdd3"
      />
      <path
        d="M12.7 4.2a2.7 2.7 0 014.8 1.6 2.9 2.9 0 011.7 4.8 3.3 3.3 0 01-1.1 5.9A2.8 2.8 0 0115.4 20a2.7 2.7 0 01-2.7-2.7V4.2z"
        fill="#ffffff"
      />
      <path d="M12.7 4.2v13.1" stroke="#f59e0b" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      <path d="M13.2 9.6l-2.4 3.6h2l-1.4 3 3.6-4.2h-2.1z" fill="#f59e0b" />
    </svg>
  );
}
