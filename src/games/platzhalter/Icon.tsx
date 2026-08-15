/** Eigenes Symbol statt Emoji — großer Funken-Stern mit kleinem Begleitfunken. */
export function PlatzhalterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2c0 4.6-1.2 7.8-4.6 9.8C10.8 13.8 12 17 12 21.6c0-4.6 1.2-7.8 4.6-9.8C13.2 9.8 12 6.6 12 2z"
        fill="#ffffff"
      />
      <path
        d="M18.3 14.2c0 1.9-.6 3.2-2 4 1.4.8 2 2.1 2 4 0-1.9.6-3.2 2-4-1.4-.8-2-2.1-2-4z"
        fill="#facc15"
      />
    </svg>
  );
}
