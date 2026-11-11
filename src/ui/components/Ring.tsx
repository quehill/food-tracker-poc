import type { ReactNode } from 'react';

export interface RingSegment {
  /** Fraction of the full circle, 0–1. */
  value: number;
  /** Any CSS color, typically a custom property like `var(--protein)`. */
  color: string;
}

export interface RingTrack {
  thickness: number;
  segments: RingSegment[];
  /** Fraction of the circle left empty between adjacent segments. */
  gap?: number;
  /** Segments start where the previous one ended; otherwise all start at 12 o'clock. */
  stacked?: boolean;
  roundCaps?: boolean;
}

interface RingProps {
  size: number;
  /** Concentric tracks, outermost first. */
  tracks: RingTrack[];
  /** Space between tracks. */
  spacing?: number;
  /** Accessible description of what the ring shows. */
  label: string;
  children?: ReactNode;
}

/** SVG ring/donut chart with one or more concentric tracks. `children` is centered over it. */
export function Ring({ size, tracks, spacing = 3, label, children }: RingProps) {
  const c = size / 2;
  let outer = c;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <g transform={`rotate(-90 ${c} ${c})`} fill="none">
          {tracks.map((track, t) => {
            const r = outer - track.thickness / 2;
            outer -= track.thickness + spacing;
            const circumference = 2 * Math.PI * r;
            const visible = track.segments.filter((s) => s.value > 0);
            const gapLen = visible.length > 1 ? (track.gap ?? 0) * circumference : 0;
            const stacked = track.stacked ?? true;
            let start = 0;
            return (
              <g key={t} strokeWidth={track.thickness}>
                <circle cx={c} cy={c} r={r} className="ring-track" />
                {visible.map((s, i) => {
                  const len = Math.max(0, Math.min(s.value, 1) * circumference - gapLen);
                  const offset = stacked ? start : 0;
                  if (stacked) start += Math.min(s.value, 1) * circumference;
                  return (
                    <circle
                      key={i}
                      className="ring-segment"
                      cx={c}
                      cy={c}
                      r={r}
                      stroke={s.color}
                      strokeLinecap={track.roundCaps && len > 0 ? 'round' : 'butt'}
                      strokeDasharray={`${len} ${circumference}`}
                      strokeDashoffset={-offset}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  );
}
