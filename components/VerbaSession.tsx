import { useState, useRef, useEffect, useCallback } from 'react'
import { useDeepgram } from '../lib/useDeepgram'
import { useTTS, unlockAudio } from '../lib/useTTS'

const VERSION = 'v2.0'

type Screen = 'start' | 'session' | 'results'
type Mode = 'flow' | 'boardroom'
type Turn = 'ai' | 'listening' | 'thinking' | 'speaking' | 'ending'

interface Msg { role: 'user' | 'assistant'; content: string }
interface TxLine { speaker: 'ai' | 'you'; text: string }

interface ScoreData {
  overall: number
  scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  suggested_improvement: string
  example_reframe: string
}

const SCORE_LABELS: Record<Mode, Record<string, string>> = {
  flow: {
    conversational_flow: 'Flow', curiosity: 'Curiosity', topic_expansion: 'Expansion',
    emotional_engagement: 'Engagement', responsiveness: 'Responsiveness', energy: 'Energy', question_quality: 'Questions',
  },
  boardroom: {
    clarity: 'Clarity', executive_presence: 'Presence', commercial_strength: 'Commercial',
    structure: 'Structure', conciseness: 'Conciseness', confidence: 'Confidence',
    narrative_control: 'Narrative', interruption_handling: 'Interruptions',
  },
}

const MODE_CONFIG = {
  flow: {
    label: 'Conversation Flow',
    tag: 'SOCIAL · CHARISMA · FLUENCY',
    desc: 'Train natural conversational rhythm and social presence. AI plays a curious contact in the Fahrenheit One world — member, journalist, local resident.',
    accent: '#000',
    pill: 'FLOW',
  },
  boardroom: {
    label: 'Executive Pressure',
    tag: 'BOARD · INVESTOR · STRATEGY',
    desc: 'Sharpen communication under pressure. AI plays a sceptical investor or board member challenging your Fahrenheit One strategy.',
    accent: '#000',
    pill: 'BOARD',
  },
}

export default function VerbaSession({ autostart = false }: { autostart?: boolean }) {
  const [screen, setScreen] = useState<Screen>('start')
  const [mode, setMode] = useState<Mode>('flow')
  const [turn, setTurnState] = useState<Turn>('ai')
  const [transcript, setTranscript] = useState<TxLine[]>([])
  const [interim, setInterim] = useState('')
  const [duration, setDuration] = useState(0)
  const [scores, setScores] = useState<ScoreData | null>(null)
  const [scoresLoading, setScoresLoading] = useState(false)

  const msgsRef = useRef<Msg[]>([])
  const txRef = useRef<TxLine[]>([])
  const turnRef = useRef<Turn>('ai')
  const seedRef = useRef(String.fromCharCode(65 + Math.floor(Math.random() * 26)))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopSTTRef = useRef<() => void>(() => {})
  const pauseSTTRef = useRef<() => void>(() => {})
  const resumeSTTRef = useRef<() => void>(() => {})
  const startSTTRef = useRef<() => Promise<void>>(async () => {})

  const setTurn = (t: Turn) => { turnRef.current = t; setTurnState(t) }
  const { speak, stop: stopTTS } = useTTS()

  const goHome = useCallback(() => {
    stopTTS()
    stopSTTRef.current()
    if (timerRef.current) clearInterval(timerRef.current)
    setScreen('start')
    setTranscript([])
    setScores(null)
    setTurn('ai')
    msgsRef.current = []
    txRef.current = []
    seedRef.current = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  }, [stopTTS])

  const startSession = useCallback(async (m: Mode) => {
    setMode(m)
    setScreen('session')
    setDuration(0)
    setTranscript([])
    msgsRef.current = []
    txRef.current = []
    setTurn('speaking')

    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'opening', mode: m, seed: seedRef.current }),
    })
    const { text: opening } = await res.json()

    msgsRef.current = [{ role: 'assistant', content: opening }]
    txRef.current = [{ speaker: 'ai', text: opening }]
    setTranscript([{ speaker: 'ai', text: opening }])

    await speak(opening, async () => {
      await startSTTRef.current()
      setTurn('listening')
    })

    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }, [speak])

  const endSession = useCallback(async () => {
    setTurn('ending')
    stopSTTRef.current()
    stopTTS()
    if (timerRef.current) clearInterval(timerRef.current)
    setScoresLoading(true)
    setScreen('results')

    const flat = txRef.current.map(t => `${t.speaker === 'you' ? 'USER' : 'AI'}: ${t.text}`).join('\n')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score', mode, transcript: flat }),
      })
      const { result } = await res.json()
      const parsed = JSON.parse(result.replace(/```json|```/g, '').trim())
      setScores(parsed)
    } catch { setScores(null) }
    setScoresLoading(false)
  }, [mode, stopTTS])

  const handleSpeech = useCallback(async (text: string) => {
    if (!text.trim()) { setTurn('listening'); return }

    const lower = text.toLowerCase().trim().replace(/[.,!?]$/, '')
    if (lower === 'end' || lower === 'end session' || lower === 'stop') {
      endSession(); return
    }

    const userMsg: Msg = { role: 'user', content: text }
    const updated = [...msgsRef.current, userMsg]
    msgsRef.current = updated
    txRef.current = [...txRef.current, { speaker: 'you', text }]
    setTranscript([...txRef.current])
    setInterim('')
    setTurn('thinking')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', messages: updated, mode }),
      })
      const { text: reply } = await res.json()
      msgsRef.current = [...updated, { role: 'assistant', content: reply }]
      txRef.current = [...txRef.current, { speaker: 'ai', text: reply }]
      setTranscript([...txRef.current])
      setTurn('speaking')
      pauseSTTRef.current()
      await speak(reply, () => {
        setTimeout(() => { setTurn('listening'); resumeSTTRef.current() }, 400)
      })
    } catch {
      setTurn('listening')
      setTimeout(() => resumeSTTRef.current(), 400)
    }
  }, [mode, speak, endSession])

  const { start: startSTT, stop: stopSTT, pause: pauseSTT, resume: resumeSTT } = useDeepgram({
    onTranscript: useCallback((text: string) => { if (turnRef.current === 'listening') setInterim(text) }, []),
    onUtteranceEnd: useCallback((text: string) => { if (turnRef.current === 'listening') handleSpeech(text) }, [handleSpeech]),
    onError: useCallback((err: string) => { console.error(err); setTurn('listening') }, []),
  })

  stopSTTRef.current = stopSTT
  pauseSTTRef.current = pauseSTT
  resumeSTTRef.current = resumeSTT
  startSTTRef.current = startSTT

  useEffect(() => {
    if (!autostart) return
    unlockAudio()
    startSession('boardroom')
  }, [autostart, startSession])

  useEffect(() => {
    return () => { stopTTS(); stopSTTRef.current(); if (timerRef.current) clearInterval(timerRef.current) }
  }, [stopTTS])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── START ──
  if (screen === 'start') {
    return (
      <div style={s.screen}>
        <div style={s.startInner}>
          <div style={{ fontSize: 11, letterSpacing: '0.25em', color: '#999', marginBottom: 12, textTransform: 'uppercase' as const }}>Verba · {VERSION}</div>
          <h1 style={{ fontSize: 38, fontWeight: 700, color: '#000', letterSpacing: '-0.02em', marginBottom: 6 }}>Communication Training</h1>
          <p style={{ fontSize: 15, color: '#666', marginBottom: 36, fontWeight: 400 }}>Fahrenheit One · Powered by AI</p>

          <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {(['flow', 'boardroom'] as Mode[]).map(m => {
              const cfg = MODE_CONFIG[m]
              return (
                <button key={m} onClick={() => { unlockAudio(); startSession(m) }} style={s.modeCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#000', letterSpacing: '0.04em' }}>{cfg.label.toUpperCase()}</div>
                    <div style={{ fontSize: 9, color: '#999', background: '#f0f0f0', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.08em' }}>{cfg.tag}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.55, marginBottom: 12 }}>{cfg.desc}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#000' }}>Begin session →</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── RESULTS ──
  if (screen === 'results') {
    const cfg = MODE_CONFIG[mode]
    const labels = SCORE_LABELS[mode]

    return (
      <div style={s.screen}>
        <div style={{ padding: '52px 20px 0', flex: 1, overflowY: 'auto' as const }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#999', marginBottom: 8, textTransform: 'uppercase' as const }}>
            {cfg.label} · Debrief · {VERSION}
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#000', letterSpacing: '-0.01em', marginBottom: 24 }}>Your Results</h2>

          {scoresLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000', animation: 'blink 0.9s ease-in-out infinite' }} />
              <span style={{ color: '#999', fontSize: 14 }}>Analysing your session…</span>
            </div>
          ) : scores ? (
            <>
              {/* Overall score */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 28 }}>
                <span style={{ fontSize: 72, fontWeight: 200, color: '#000', lineHeight: 1, letterSpacing: '-0.02em' }}>{scores.overall}</span>
                <span style={{ fontSize: 14, color: '#999' }}>/ 10 overall</span>
              </div>

              {/* Score grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
                {Object.entries(scores.scores || {}).map(([key, val]) => {
                  const textColor = val >= 7 ? '#1a7a4a' : val >= 5 ? '#b45309' : '#b91c1c'
                  const r = 26
                  const circ = 2 * Math.PI * r
                  const progress = (val / 10) * circ
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6 }}>
                      <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r={r} fill="none" stroke="#f0f0f0" strokeWidth="4" />
                        <circle cx="32" cy="32" r={r} fill="none" stroke="#000" strokeWidth="4"
                          strokeDasharray={`${progress} ${circ}`} strokeLinecap="round"
                          transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray 1s ease', opacity: 0.8 }} />
                        <text x="32" y="32" textAnchor="middle" dominantBaseline="central"
                          style={{ fill: textColor, fontSize: '13px', fontFamily: '-apple-system, sans-serif', fontWeight: 700 }}>
                          {val}
                        </text>
                      </svg>
                      <span style={{ fontSize: 9, letterSpacing: '0.1em', color: '#999', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>
                        {labels[key] || key}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Strengths */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Strengths</div>
                {scores.strengths?.map((str, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 6 }}>
                    <span style={{ color: '#1a7a4a', marginRight: 8 }}>+</span>{str}
                  </div>
                ))}
              </div>

              {/* Develop */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Develop</div>
                {scores.weaknesses?.map((w, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 6 }}>
                    <span style={{ color: '#b91c1c', marginRight: 8 }}>△</span>{w}
                  </div>
                ))}
              </div>

              {/* Coaching note */}
              {scores.suggested_improvement && (
                <div style={s.section}>
                  <div style={s.sectionLabel}>Coaching Note</div>
                  <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>{scores.suggested_improvement}</div>
                  {scores.example_reframe && (
                    <div style={{ padding: '14px 16px', background: '#f5f5f7', borderRadius: 12, borderLeft: '3px solid #000' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#666', marginBottom: 6 }}>TRY THIS</div>
                      <div style={{ fontSize: 14, color: '#000', lineHeight: 1.65, fontStyle: 'italic' }}>"{scores.example_reframe}"</div>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              <div style={s.section}>
                <div style={s.sectionLabel}>Transcript</div>
                {txRef.current.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, minWidth: 28, color: t.speaker === 'you' ? '#000' : '#bbb', textTransform: 'uppercase' as const, fontWeight: 600, paddingTop: 2 }}>
                      {t.speaker === 'you' ? 'YOU' : 'AI'}
                    </span>
                    <span style={{ fontSize: 13, color: t.speaker === 'you' ? '#000' : '#777', lineHeight: 1.5 }}>{t.text}</span>
                  </div>
                ))}
                <div style={{ height: 16 }} />
              </div>
            </>
          ) : (
            <div style={{ color: '#999', fontSize: 14 }}>Session too short to score — try a longer conversation.</div>
          )}
        </div>

        <div style={{ padding: '16px 20px 28px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
          <button onClick={goHome} style={s.secondaryBtn}>← Home</button>
          <button onClick={() => { unlockAudio(); startSession(mode) }} style={s.primaryBtn}>Same Mode</button>
        </div>
      </div>
    )
  }

  // ── SESSION ──
  const isListening = turn === 'listening'
  const isSpeaking = turn === 'speaking'
  const isThinking = turn === 'thinking'
  const orbAnim = isThinking ? 'breathe 1.5s ease-in-out infinite' : isSpeaking ? 'speak-anim 0.6s ease-in-out infinite' : 'none'
  const cfg = MODE_CONFIG[mode]

  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#fff', background: '#000', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
            {cfg.pill}
          </div>
          <span style={{ fontSize: 13, color: '#bbb' }}>{fmt(duration)}</span>
        </div>
        <span style={{ fontSize: 11, color: '#ddd' }}>{VERSION}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 14, padding: '28px 0 16px', flexShrink: 0 }}>
        <div style={{ position: 'relative' as const, width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[108, 128].map((size, i) => (
            <div key={i} style={{
              position: 'absolute' as const, width: size, height: size, borderRadius: '50%',
              border: '1px solid #000',
              opacity: isListening ? (i === 0 ? 0.12 : 0.06) : 0,
              animation: isListening ? `pulse-ring 1.4s ease-in-out ${i * 0.2}s infinite` : 'none',
              transition: 'opacity 0.4s',
            }} />
          ))}
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            background: isListening ? '#000' : isSpeaking ? '#333' : '#aaa',
            boxShadow: isListening ? '0 0 24px rgba(0,0,0,0.15)' : 'none',
            animation: orbAnim,
            transition: 'background 0.4s, box-shadow 0.4s',
          }} />
        </div>

        <div style={{ fontSize: 14, color: '#999' }}>
          {turn === 'ai' ? 'Preparing…'
            : isSpeaking ? `${mode === 'boardroom' ? 'Board member' : 'Contact'} speaking…`
            : isThinking ? 'Thinking…'
            : turn === 'ending' ? 'Ending session…'
            : 'Your turn — speak naturally'}
        </div>

        {isListening && interim && (
          <div style={{ maxWidth: 300, textAlign: 'center' as const, fontSize: 14, color: '#666', fontStyle: 'italic', background: '#f5f5f7', padding: '10px 16px', borderRadius: 10, lineHeight: 1.5 }}>
            {interim}
          </div>
        )}
      </div>

      {isListening && mode === 'boardroom' && (
        <div style={{ margin: '0 20px 12px', padding: '12px 16px', background: '#f5f5f7', borderRadius: 10, fontSize: 13, color: '#555', lineHeight: 1.6, flexShrink: 0 }}>
          Lead with the <strong style={{ color: '#000' }}>commercial answer</strong> · Be <strong style={{ color: '#000' }}>specific</strong> · Control the <strong style={{ color: '#000' }}>narrative</strong>
        </div>
      )}

      {isListening && mode === 'flow' && (
        <div style={{ margin: '0 20px 12px', padding: '12px 16px', background: '#f5f5f7', borderRadius: 10, fontSize: 13, color: '#555', lineHeight: 1.6, flexShrink: 0 }}>
          Be <strong style={{ color: '#000' }}>curious</strong> · Ask questions back · Keep energy <strong style={{ color: '#000' }}>warm</strong>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 20px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        {transcript.slice(-8).map((t, i, arr) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            paddingBottom: 10, borderBottom: '1px solid #f5f5f5',
            opacity: arr.length > 4 && i < 2 ? 0.4 : 1,
            animation: i === arr.length - 1 ? 'fade-in 0.3s ease' : 'none',
          }}>
            <span style={{ fontSize: 10, minWidth: 28, color: t.speaker === 'you' ? '#000' : '#bbb', textTransform: 'uppercase' as const, fontWeight: 600, paddingTop: 3 }}>
              {t.speaker === 'you' ? 'YOU' : 'AI'}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: t.speaker === 'you' ? '#000' : '#888' }}>{t.text}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px 24px', flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={goHome} disabled={turn === 'ending'} style={{ ...s.secondaryBtn, opacity: turn === 'ending' ? 0.4 : 1 }}>End</button>
          <button onClick={endSession} disabled={turn === 'ending'} style={{ ...s.primaryBtn, opacity: turn === 'ending' ? 0.4 : 1 }}>Get Score</button>
        </div>
        <p style={{ textAlign: 'center' as const, fontSize: 11, color: '#ccc', letterSpacing: '0.02em' }}>
          {transcript.length} exchanges · say "end" to stop · always listening
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: { height: '100dvh', background: '#fff', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' },
  startInner: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' },
  modeCard: { width: '100%', textAlign: 'left' as const, padding: '20px', background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 16, cursor: 'pointer', transition: 'all 0.15s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '52px 20px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  primaryBtn: { flex: 1, padding: '16px', background: '#000', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer', transition: 'opacity 0.2s', letterSpacing: '-0.01em' },
  secondaryBtn: { flex: 1, padding: '16px', background: '#f5f5f7', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, color: '#000', cursor: 'pointer', transition: 'opacity 0.2s', letterSpacing: '-0.01em' },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 10, letterSpacing: '0.15em', color: '#999', marginBottom: 12, textTransform: 'uppercase' as const, fontWeight: 600 },
}
