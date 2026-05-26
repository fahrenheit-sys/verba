import { useState, useEffect } from 'react'
import ScoreRing from './ScoreRing'
import { SCORE_LABELS, MODE_CONFIG, type Mode } from '../lib/constants'
import type { TranscriptLine } from './SessionScreen'

interface ScoreData {
  overall: number
  scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  suggested_improvement: string
  example_reframe: string
}

interface ResultsScreenProps {
  mode: Mode
  transcript: TranscriptLine[]
  onRestart: (mode: Mode | null) => void
}

export default function ResultsScreen({ mode, transcript, onRestart }: ResultsScreenProps) {
  const [scores, setScores] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const cfg = MODE_CONFIG[mode]

  useEffect(() => {
    const flat = transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n')
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, action: 'score', transcript: flat }),
    })
      .then((r) => r.json())
      .then(({ result }) => {
        try {
          const parsed = JSON.parse(result.replace(/```json|```/g, '').trim())
          setScores(parsed)
        } catch {
          setScores(null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [mode, transcript])

  return (
    <div style={s.screen}>
      <div style={s.inner}>
        {/* Mode pill */}
        <div style={{
          ...s.pill,
          background: `${cfg.accent}18`,
          color: cfg.accent,
          borderColor: `${cfg.accent}33`,
          marginBottom: 24,
        }}>
          {cfg.pill} · DEBRIEF
        </div>

        {loading ? (
          <div style={s.loading}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.accent, animation: 'blink 0.9s ease-in-out infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: '0.1em' }}>Analysing session…</span>
          </div>
        ) : scores ? (
          <>
            {/* Overall */}
            <div style={s.overallRow}>
              <span style={{ ...s.overallNum, color: cfg.accent }}>{scores.overall}</span>
              <span style={s.overallSub}>/ 10 overall</span>
            </div>

            {/* Score rings */}
            <div style={s.rings}>
              {Object.entries(scores.scores || {}).map(([key, val]) => (
                <ScoreRing key={key} value={val} label={SCORE_LABELS[mode][key] || key} mode={mode} />
              ))}
            </div>

            {/* Strengths */}
            <Section label="STRENGTHS">
              {scores.strengths?.map((s, i) => (
                <div key={i} style={{ ...fs.item, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ color: '#00d4aa', marginRight: 8 }}>+</span>{s}
                </div>
              ))}
            </Section>

            {/* Weaknesses */}
            <Section label="DEVELOP">
              {scores.weaknesses?.map((w, i) => (
                <div key={i} style={{ ...fs.item, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ color: '#ff6060', marginRight: 8 }}>△</span>{w}
                </div>
              ))}
            </Section>

            {/* Coaching note */}
            {scores.suggested_improvement && (
              <Section label="COACHING NOTE">
                <div style={{ ...fs.item, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  {scores.suggested_improvement}
                </div>
                {scores.example_reframe && (
                  <div style={{
                    marginTop: 14, padding: '14px 16px',
                    border: `1px solid ${cfg.accent}33`,
                    background: `${cfg.accent}0a`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 9, color: cfg.accent, letterSpacing: '0.12em', marginBottom: 6 }}>TRY THIS</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, fontStyle: 'italic' }}>
                      &ldquo;{scores.example_reframe}&rdquo;
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Transcript */}
            <Section label="TRANSCRIPT">
              {transcript.map((t, i) => (
                <div key={i} style={fs.txLine}>
                  <span style={{ fontSize: 9, minWidth: 22, color: t.speaker === 'You' ? cfg.accent : 'rgba(255,255,255,0.22)', textTransform: 'uppercase' as const }}>
                    {t.speaker === 'You' ? 'YOU' : 'AI'}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{t.text}</span>
                </div>
              ))}
            </Section>
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '20px 0' }}>
            Session too short to score. Try a longer conversation.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button onClick={() => onRestart(mode)} style={{ ...s.btn, borderColor: `${cfg.accent}44`, color: cfg.accent }}>
          Same Mode
        </button>
        <button onClick={() => onRestart(null)} style={{ ...s.btn, borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
          Switch Mode
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', marginBottom: 10, textTransform: 'uppercase' as const }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100dvh',
    background: '#080c12',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  inner: { padding: '32px 20px 0', flex: 1 },
  pill: {
    display: 'inline-block',
    fontSize: 9, letterSpacing: '0.14em',
    padding: '4px 10px', borderRadius: 4, border: '1px solid',
  },
  loading: { display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' },
  overallRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 28 },
  overallNum: { fontSize: 68, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em' },
  overallSub: { fontSize: 13, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' },
  rings: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 },
  actions: { display: 'flex', gap: 10, padding: '16px 20px 24px' },
  btn: {
    flex: 1, padding: '14px', background: 'transparent',
    border: '1px solid', borderRadius: 8,
    fontSize: 11, letterSpacing: '0.1em',
    cursor: 'pointer', textTransform: 'uppercase' as const,
    transition: 'all 0.2s',
  },
}

const fs: Record<string, React.CSSProperties> = {
  item: { fontSize: 13, lineHeight: 1.5, marginBottom: 6 },
  txLine: { display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 2 },
}
