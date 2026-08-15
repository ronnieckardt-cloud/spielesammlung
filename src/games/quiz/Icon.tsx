/** Eigenes Symbol statt Emoji — Sprechblase mit Fragezeichen und Funken. */
export function QuizIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="11.6" rx="2.8" fill="#ffffff" />
      <path d="M10 14.6L5 19l2-4.4z" fill="#ffffff" />
      <path
        d="M9.6 8.4c0-1.3 1-2.2 2.3-2.2 1.2 0 2.2.9 2.2 2 0 1.7-2.2 1.6-2.2 3.5"
        fill="none"
        stroke="#16a34a"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11.9" cy="14.8" r="1.05" fill="#16a34a" />
      <path d="M20.5 3.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#facc15" />
    </svg>
  );
}
