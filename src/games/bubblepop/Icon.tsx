/** Eigenes Symbol statt Emoji — drei bunte Kugeln, eine platzt gerade. */
export function BubblePopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="7" cy="8" r="4.2" fill="#38bdf8" />
      <circle cx="16" cy="7" r="3.4" fill="#facc15" />
      <circle cx="10" cy="16.5" r="3.8" fill="#4ade80" />
      <circle cx="5.6" cy="6.6" r="1.3" fill="#ffffff" opacity="0.5" />
      {/* Platzende Kugel: Ring plus wegspritzende Funken. */}
      <circle cx="18.5" cy="16" r="2.6" fill="none" stroke="#f43f5e" strokeWidth="1.6" />
      <path
        d="M22.4 12.6l-1.1 1.1M22.6 19.3l-1.3-1M14.6 12.4l1.2 1.2"
        stroke="#f43f5e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
