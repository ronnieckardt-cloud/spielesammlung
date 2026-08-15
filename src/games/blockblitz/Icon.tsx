/** Eigenes Symbol statt Emoji — drei bunte Blöcke, einer platzt gerade weg. */
export function BlockblitzIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="#facc15" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="#2dd4bf" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="#f472b6" />
      <path
        d="M15.3 15.3l4.6 4.6M19.9 15.3l-4.6 4.6"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
