export function RingMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <circle cx="16" cy="14.8" r="10.15" stroke="#5f6368" strokeWidth="6.1" />
      <circle
        cx="16"
        cy="14.8"
        r="10.15"
        stroke="#d8dce1"
        strokeWidth="1.35"
      />
      <circle cx="16" cy="14.8" r="5.65" fill="#f7f7f2" />
      <circle cx="16" cy="14.8" r="3.2" fill="#5b6f00" />
      <rect
        x="13.15"
        y="23.15"
        width="5.7"
        height="4.45"
        rx="2"
        fill="#fa4a36"
      />
    </svg>
  );
}
