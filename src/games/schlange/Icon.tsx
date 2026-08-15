/** Eigenes Symbol statt Emoji — grüne Schlange mit Auge und rotem Apfel. */
export function SchlangeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 17.5h6.5a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h5"
        fill="none"
        stroke="#4ade80"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.4" cy="5.5" r="2.5" fill="#22c55e" />
      <circle cx="14.3" cy="4.9" r="0.8" fill="#0b0f14" />
      <circle cx="18.5" cy="16" r="3.1" fill="#f43f5e" />
      <path d="M18.5 13.2v-1.6" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
