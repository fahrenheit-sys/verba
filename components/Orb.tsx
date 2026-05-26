import type { Mode } from '../lib/constants'

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface OrbProps {
  state: OrbState
  mode: Mode
}

export default function Orb({ state, mode }: OrbProps) {
  const isBoard = mode === 'boardroom'
  const accent = isBoard ? '#4a9eff' : '#ff6b9d'
  const gradStart = isBoard ? '#4a9eff' : '#ff6b9d'
  const gradEnd = isBoard ? '#001a33' : '#4a00e0'

  const ringAnim = (state === 'listening' || state === 'speaking')
    ? 'pulse-ring 1.2s ease-in-out infinite'
    : 'none'

  const innerAnim =
    state === 'thinking' ? 'breathe 1.5s ease-in-out infinite'
    : state === 'listening' ? 'mic-pulse 0.8s ease-in-out infinite'
    : state === 'speaking' ? 'speak-pulse 0.6s ease-in-out infinite'
    : 'none'

  return (
    <div style={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Rings */}
      {[110, 132, 156].map((size, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            border: `1px solid ${accent}`,
            opacity: (state === 'listening' || state === 'speaking') ? [0.5, 0.3, 0.15][i] : 0,
            animation: ringAnim,
            animationDelay: `${i * 0.2}s`,
            transition: 'opacity 0.4s ease',
          }}
        />
      ))}

      {/* Core */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${gradStart}, ${gradEnd})`,
          boxShadow: `0 0 ${state === 'idle' ? 20 : 40}px ${accent}${state === 'idle' ? '33' : '66'}`,
          animation: innerAnim,
          transition: 'box-shadow 0.4s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state === 'thinking' && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            animation: 'blink 0.8s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  )
}
