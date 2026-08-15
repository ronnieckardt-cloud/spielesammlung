/** Eigenes Symbol statt Emoji — ein Funken-Stern, passend zu "Star Dash". */
export function PlatzhalterIcon({ className }: { className?: string }) {
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
      <path d="M12 3c0 4.2-1.1 7.2-4.2 9C10.9 13.8 12 16.8 12 21c0-4.2 1.1-7.2 4.2-9-3.1-1.8-4.2-4.8-4.2-9z" />
      <path d="M4.5 16.5c0 1.6-.5 2.7-1.6 3.4.9.5 1.4 1.4 1.6 2.6" />
    </svg>
  );
}
