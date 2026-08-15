/** Eigenes Symbol statt Emoji — Sprechblase mit Fragezeichen. */
export function QuizIcon({ className }: { className?: string }) {
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
      <path d="M4 5.8A2.8 2.8 0 016.8 3h10.4A2.8 2.8 0 0120 5.8v6.4a2.8 2.8 0 01-2.8 2.8H10L5 19v-4h-.2A2.8 2.8 0 012 12.2" />
      <path d="M10 8.6c0-1.3 1-2.2 2.2-2.2 1.2 0 2.1.9 2.1 2 0 1.7-2.1 1.6-2.1 3.5" />
      <circle cx="12.1" cy="15" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}
