/** Eigenes Symbol statt Emoji — zwei Kacheln, die zu einer größeren werden. */
export function MergeUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2.5" y="13" width="8" height="8" rx="2" fill="#38bdf8" />
      <rect x="13.5" y="13" width="8" height="8" rx="2" fill="#4ade80" />
      <rect x="7" y="2.5" width="10" height="8.4" rx="2.2" fill="#facc15" />
      <path
        d="M12 11.6v1.2M9.5 12.6l2.5 1.6 2.5-1.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
