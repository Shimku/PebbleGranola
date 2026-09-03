"use client";

import { useId } from "react";

export function RingMark({ size = 28 }: { size?: number }) {
  const steel = `ring-steel-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={steel} x1="7" y1="3" x2="25" y2="27">
          <stop offset="0%" stopColor="#f3f4f6" />
          <stop offset="32%" stopColor="#c8ccd1" />
          <stop offset="58%" stopColor="#8a8e94" />
          <stop offset="100%" stopColor="#dde0e4" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="14.7"
        r="10.35"
        stroke={`url(#${steel})`}
        strokeWidth="5.6"
      />
      <circle
        cx="16"
        cy="14.7"
        r="7.55"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="0.7"
      />
      <circle cx="16" cy="14.7" r="6.05" fill="#f7f7f2" />
      <circle cx="16" cy="14.7" r="3.05" fill="#5b6f00" />
      <rect
        x="13.2"
        y="23.55"
        width="5.6"
        height="4.15"
        rx="1.9"
        fill="#fa4a36"
      />
    </svg>
  );
}
