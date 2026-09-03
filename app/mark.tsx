export function RingMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <circle cx="16" cy="15.2" r="10.2" stroke="#b8bbc0" strokeWidth="5" />
      <circle cx="16" cy="15.2" r="10.2" stroke="#eceef0" strokeWidth="1.4" />
      <circle cx="16" cy="15.2" r="6.1" fill="#f7f7f2" />
      <circle cx="16" cy="15.2" r="3.1" fill="#5b6f00" />
      <rect x="13.4" y="24.1" width="5.2" height="3.6" rx="1.6" fill="#fa4a36" />
    </svg>
  );
}
