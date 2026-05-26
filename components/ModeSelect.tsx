import { useState } from 'react'
import { MODE_CONFIG, type Mode } from '../lib/constants'

interface ModeSelectProps {
  onSelect: (mode: Mode) => void
}

export default function ModeSelect({ onSelect }: ModeSelectProps) {
  const [hovered, setHovered] = useState<Mode | null>(null)

  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={s.logoMark}>◈</div>
        <h1 style={s.title}>VERBA</h1>
        <p style={s.subtitle}>Communication Training Platform</p>
      </div>

      <div style={s.grid}>
        {(Object.entries(MODE_CONFIG) as [Mode, typeof MODE_CONFIG[Mode]][]).map(([id, cfg]) => (
          <button
            key={id}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(id)}
            style={{
              ...s.card,
              borderColor: hovered === id ? cfg.accent : 'rgba(255,255,255,0.07)',
              background: hovered === id
                ? `linear-gradient(135deg, ${cfg.accent}11 0%, transparent 100%)`
                : 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ fontSize: 22, color: cfg.accent, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: cfg.accent, opacity: 0.75, marginBottom: 8 }}>{cfg.tag}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2, marginBottom: 8 }}>{cfg.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6, flex: 1 }}>{cfg.desc}</div>
            <div style={{ fontSize: 11, color: cfg.accent, marginTop: 16, letterSpacing: '0.05em' }}>Begin session →</div>
          </button>
        ))}
      </div>

      <p style={s.footer}>Real-time voice · Deepgram STT · ElevenLabs TTS · Claude AI</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100dvh',
    background: '#080c12',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 0 env(safe-area-inset-bottom)',
  },
  header: {
    padding: '56px 24px 36px',
    textAlign: 'center',
  },
  logoMark: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.12)',
    letterSpacing: '0.3em',
    marginBottom: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: 300,
    letterSpacing: '0.5em',
    color: 'rgba(255,255,255,0.9)',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: 10,
    letterSpacing: '0.22em',
    color: 'rgba(255,255,255,0.18)',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    padding: '0 16px',
    flex: 1,
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '22px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 220,
  },
  footer: {
    textAlign: 'center',
    fontSize: 9,
    color: 'rgba(255,255,255,0.12)',
    letterSpacing: '0.15em',
    padding: '20px 0 28px',
  },
}
