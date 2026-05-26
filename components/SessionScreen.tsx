import { useState, useRef, useEffect, useCallback } from 'react'
import Orb from './Orb'
import { useDeepgram } from '../lib/useDeepgram'
import { useTTS } from '../lib/useTTS'
import { OPENING_LINES, MODE_CONFIG, type Mode } from '../lib/constants'

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Message { role: 'user' | 'assistant'; content: string }
export interface TranscriptLine { speaker: string; text: string }

interface SessionScreenProps {
  mode: Mode
  onEnd: (transcript: TranscriptLine[]) => void
}

export default function SessionScreen({ mode, onEnd }: SessionScreenProps) {
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [statusText, setStatusText] = useState('Initialising…')
  const [interimText, setInterimText] = useState('')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [duration, setDuration] = useState(0)
  const [isPressed, setIsPressed] = useState(false)
  const [ready, setReady] = useState(false)

  const messagesRef = useRef<Message[]>([])
  const transcriptRef = useRef<TranscriptLine[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orbStateRef = useRef<OrbState>('idle')
  const cfg = MODE_CONFIG[mode]

  const { speak, stop: stopTTS } = useTTS()

  const sendToAI = useCallback(async (text: string) => {
    if (!text.trim()) {
      setOrbState('idle')
      orbStateRef.current = 'idle'
      setStatusText('Hold to speak')
      return
    }

    const userMsg: Message = { role: 'user', content: text }
    const updated = [...messagesRef.current, userMsg]
    messagesRef.current = updated

    const newLine = { speaker: 'You', text }
    transcriptRef.current = [...transcriptRef.current, newLine]
    setTranscript([...transcriptRef.current])
    setInterimText('')

    setOrbState('thinking')
    orbStateRef.current = 'thinking'
    setStatusText('Thinking…')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, mode, action: 'chat' }),
      })
      const { text: reply } = await res.json()

      const aiMsg: Message = { role: 'assistant', content: reply }
      messagesRef.current = [...updated, aiMsg]

      const aiLine = { speaker: 'AI', text: reply }
      transcriptRef.current = [...transcriptRef.current, aiLine]
      setTranscript([...transcriptRef.current])

      setOrbState('speaking')
      orbStateRef.current = 'speaking'
      setStatusText('Speaking…')

      await speak(reply, mode, () => {
        setOrbState('idle')
        orbStateRef.current = 'idle'
        setStatusText('Hold to speak')
      })
    } catch {
      setOrbState('idle')
      orbStateRef.current = 'idle'
      setStatusText('Error — try again')
    }
  }, [mode, speak])

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    setInterimText(text)
  }, [])

  // Called by Deepgram when it detects end of utterance
  const handleUtteranceEnd = useCallback((text: string) => {
    if (orbStateRef.current !== 'listening') return
    setIsPressed(false)
    setInterimText('')
    sendToAI(text)
  }, [sendToAI])

  const handleSTTError = useCallback((err: string) => {
    console.error('STT error:', err)
    setStatusText(err)
    setOrbState('idle')
    orbStateRef.current = 'idle'
    setIsPressed(false)
  }, [])

  const { start: startSTT, stop: stopSTT } = useDeepgram({
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onError: handleSTTError,
  })

  // Open with AI line
  useEffect(() => {
    const opening = OPENING_LINES[mode]
    const aiMsg: Message = { role: 'assistant', content: opening }
    messagesRef.current = [aiMsg]
    const line = { speaker: 'AI', text: opening }
    transcriptRef.current = [line]
    setTranscript([line])

    setOrbState('speaking')
    orbStateRef.current = 'speaking'
    setStatusText('Speaking…')

    speak(opening, mode, () => {
      setOrbState('idle')
      orbStateRef.current = 'idle'
      setStatusText('Hold to speak')
      setReady(true)
    })

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      stopTTS()
    }
  }, [])

  const handlePressStart = useCallback(async () => {
    if (!ready || orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking') return
    stopTTS()
    setIsPressed(true)
    setOrbState('listening')
    orbStateRef.current = 'listening'
    setStatusText('Listening…')
    setInterimText('')
    await startSTT()
  }, [ready, stopTTS, startSTT])

  const handlePressEnd = useCallback(() => {
    if (!isPressed) return
    // Stop the recorder — Deepgram will fire UtteranceEnd with final text
    // If it doesn't fire within 1.5s, fall back to whatever we have
    const capturedText = stopSTT()

    setTimeout(() => {
      if (orbStateRef.current === 'listening') {
        setIsPressed(false)
        setInterimText((current) => {
          const text = current || capturedText
          sendToAI(text)
          return ''
        })
      }
    }, 1500)
  }, [isPressed, stopSTT, sendToAI])

  const handleEnd = () => {
    stopTTS()
    stopSTT()
    if (timerRef.current) clearInterval(timerRef.current)
    onEnd(transcriptRef.current)
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const isDisabled = !ready || orbStateRef.current === 'thinking' || orbStateRef.current === 'speaking'

  return (
    <div style={s.screen}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...s.pill, background: `${cfg.accent}18`, color: cfg.accent, borderColor: `${cfg.accent}33` }}>
            {cfg.pill}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'monospace' }}>
            {fmt(duration)}
          </span>
        </div>
        <button onClick={handleEnd} style={s.endBtn}>End</button>
      </div>

      <div style={s.orbArea}>
        <Orb state={orbState} mode={mode} />
        <div style={s.status}>{statusText}</div>
        {interimText ? (
          <div style={s.interim}>{interimText}</div>
        ) : (
          <div style={{ ...s.interim, opacity: 0, pointerEvents: 'none' }}>—</div>
        )}
      </div>

      <div style={s.transcript}>
        {transcript.slice(-8).map((t, i, arr) => (
          <div key={i} style={{
            ...s.line,
            opacity: arr.length > 4 && i < 2 ? 0.3 : 1,
            animation: i === arr.length - 1 ? 'fade-in 0.3s ease' : 'none',
          }}>
            <span style={{
              fontSize: 9, letterSpacing: '0.1em', minWidth: 22,
              color: t.speaker === 'You' ? cfg.accent : 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase', paddingTop: 2,
            }}>
              {t.speaker === 'You' ? 'YOU' : 'AI'}
            </span>
            <span style={{
              fontSize: 13, lineHeight: 1.55,
              color: t.speaker === 'You' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
            }}>
              {t.text}
            </span>
          </div>
        ))}
      </div>

      <div style={s.pttArea}>
        <button
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onTouchStart={(e) => { e.preventDefault(); handlePressStart() }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressEnd() }}
          disabled={isDisabled}
          style={{
            ...s.ptt,
            background: isPressed ? cfg.accent : 'rgba(255,255,255,0.05)',
            borderColor: isPressed ? cfg.accent : 'rgba(255,255,255,0.1)',
            boxShadow: isPressed ? `0 0 40px ${cfg.accent}44` : 'none',
            transform: isPressed ? 'scale(0.97)' : 'scale(1)',
            opacity: isDisabled ? 0.4 : 1,
          }}
        >
          {isPressed ? '● RECORDING' : '🎙  HOLD TO SPEAK'}
        </button>
        <p style={s.hint}>
          {transcript.length} exchanges · {mode === 'boardroom' ? 'Board simulation' : 'Flow training'}
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: { height: '100dvh', background: '#080c12', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  pill: { fontSize: 9, letterSpacing: '0.14em', padding: '4px 10px', borderRadius: 4, border: '1px solid' },
  endBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.08em', padding: '6px 14px', borderRadius: 4, cursor: 'pointer' },
  orbArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0 16px', flexShrink: 0 },
  status: { fontSize: 11, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
  interim: { maxWidth: 280, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontStyle: 'italic', background: 'rgba(255,255,255,0.04)', padding: '8px 14px', borderRadius: 8, minHeight: 36, transition: 'opacity 0.2s' },
  transcript: { flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  line: { display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' },
  pttArea: { padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 },
  ptt: { width: '100%', maxWidth: 340, padding: '18px', borderRadius: 10, border: '1px solid', fontSize: 12, letterSpacing: '0.14em', cursor: 'pointer', color: '#fff', transition: 'all 0.15s ease', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' },
  hint: { fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' },
}
