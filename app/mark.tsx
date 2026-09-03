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

const PREP_TICKS = Array.from({ length: 30 }, (_, i) => {
  const a = ((i / 30) * 360 - 90) * (Math.PI / 180);
  const cx = 60;
  const cy = 56;
  const inner = 40.2;
  const outer = i % 5 === 0 ? 49.2 : 46.8;
  return {
    x1: +(cx + inner * Math.cos(a)).toFixed(2),
    y1: +(cy + inner * Math.sin(a)).toFixed(2),
    x2: +(cx + outer * Math.cos(a)).toFixed(2),
    y2: +(cy + outer * Math.sin(a)).toFixed(2),
    major: i % 5 === 0,
  };
});

export function TimerRing() {
  return (
    <div className="timer-ring">
      <svg viewBox="0 0 120 132" fill="none" aria-hidden>
        <circle cx="60" cy="56" r="44" stroke="#5c6066" strokeWidth="11" />
        <circle cx="60" cy="56" r="44" stroke="#d5d8dd" strokeWidth="1.4" />
        {PREP_TICKS.map((tick) => (
          <line
            key={`${tick.x1}-${tick.y1}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? "#f7f7f2" : "#9aa0a6"}
            strokeWidth={tick.major ? 1.6 : 1}
            strokeLinecap="round"
          />
        ))}
        <circle cx="60" cy="56" r="27" fill="#f7f7f2" />
        <circle cx="60" cy="56" r="16.5" fill="#5b6f00" />
        <rect x="54" y="98" width="12" height="11" rx="4" fill="#fa4a36" />
      </svg>
      <span className="timer-time">0:30</span>
    </div>
  );
}
