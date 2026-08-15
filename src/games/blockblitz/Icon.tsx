/** Eigenes Symbol statt Emoji — drei Blöcke, einer platzt gerade weg. */
export function BlockblitzIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" />
      <path d="M15.3 15.3l4.6 4.6M19.9 15.3l-4.6 4.6" />
    </svg>
  );
}
