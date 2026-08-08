/** Terrafeed wordmark + glyph. Original artwork, MIT licensed with the project. */
export function LogoGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="tfg" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#5ef2dc" />
          <stop offset="1" stopColor="#2a9bd8" />
        </linearGradient>
      </defs>
      <circle cx="128" cy="128" r="66" fill="none" stroke="url(#tfg)" strokeWidth="13" />
      <circle cx="128" cy="128" r="66" fill="url(#tfg)" opacity="0.12" />
      <g transform="rotate(-22 128 128)">
        <ellipse
          cx="128"
          cy="128"
          rx="96"
          ry="34"
          fill="none"
          stroke="url(#tfg)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray="26 20"
        />
      </g>
      <circle cx="196" cy="86" r="25" fill="#070b12" />
      <circle cx="196" cy="86" r="15" fill="#f5a531">
        <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <LogoGlyph />
      <span>
        terra<b>feed</b>
      </span>
    </div>
  );
}
