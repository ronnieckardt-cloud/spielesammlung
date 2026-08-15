/** Eigenes Symbol statt Emoji — bunt gestapelte Reihen, die unterste löst sich auf. */
export function ReihenfallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="3.2" width="16" height="3.8" rx="1" fill="#facc15" />
      <rect x="4" y="10.1" width="16" height="3.8" rx="1" fill="#38bdf8" />
      <rect x="4" y="17" width="16" height="3.8" rx="1" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
