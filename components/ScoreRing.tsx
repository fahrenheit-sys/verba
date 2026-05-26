import type { Mode } from '../lib/constants'

interface ScoreRingProps {
  value: number
  label: string
  mode: Mode
}

export default function ScoreRing({ value, label, mode }: ScoreRingProps) {
  const r = 28
  const circ = 2 * Math.PI * r
  const progress = (value / 10) * circ
  const color = mode === 'boardroom' ? '#4a9eff' : '#ff6b9d'
  const textColor = value >= 7 ? '#00d4aa' : value >= 5 ? '#ffd93d' : '#ff6060'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="35" cy="35" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${progress} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
          style={{ transition: 'stroke-dasharray 1s ease', opacity: 0.85 }}
        />
        <text x="35" y="35" textAnchor="middle" dominantBaseline="central"
          style={{ fill: textColor, fontSize: '14px', fontFamily: 'monospace', fontWeight: 700 }}>
          {value}
        </text>
      </svg>
      <span style={{
        fontSize: 10, letterSpacing: '0.12em',
        color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const,
        textAlign: 'center' as const,
      }}>
        {label}
      </span>
    </div>
  )
}
