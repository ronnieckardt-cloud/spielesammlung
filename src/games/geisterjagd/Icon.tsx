/** Eigenes Symbol statt Emoji — Geist in Originalfarbe plus zwei Punkte zum Fressen. */
export function GeisterjagdIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="4" cy="20" r="1.3" fill="#facc15" />
      <circle cx="7.3" cy="20" r="1.3" fill="#facc15" />
      <path
        d="M9.5 20.5V11a6.5 6.5 0 0113 0v9.5l-2.1-1.7-2 1.7-1.9-1.7-1.9 1.7-2.1-1.7-2 1.7z"
        fill="#ffffff"
      />
      <circle cx="13.5" cy="11.2" r="1" fill="#312e81" />
      <circle cx="18.5" cy="11.2" r="1" fill="#312e81" />
    </svg>
  );
}
