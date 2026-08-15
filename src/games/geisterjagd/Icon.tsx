/** Eigenes Symbol statt Emoji — dieselbe Geister-Silhouette wie im Spiel (figuren.tsx). */
export function GeisterjagdIcon({ className }: { className?: string }) {
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
      <path d="M5 20.5V11a7 7 0 0114 0v9.5l-2.2-1.8L14.5 21l-2-1.8-2 1.8-2.3-1.8L5 20.5z" />
      <circle cx="9.3" cy="11.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="11.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
