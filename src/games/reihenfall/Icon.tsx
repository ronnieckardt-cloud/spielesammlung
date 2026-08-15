/** Eigenes Symbol statt Emoji — gestapelte Reihen, die unterste löst sich auf. */
export function ReihenfallIcon({ className }: { className?: string }) {
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
      <rect x="4" y="3.5" width="16" height="3.6" rx="1" />
      <rect x="4" y="10.2" width="16" height="3.6" rx="1" />
      <rect x="4" y="16.9" width="16" height="3.6" rx="1" strokeDasharray="3.2 2.6" opacity="0.55" />
    </svg>
  );
}
