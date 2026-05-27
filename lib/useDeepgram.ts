import { useRef, useCallback } from 'react'

interface DeepgramOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onUtteranceEnd: (text: string) => void
  onError: (err: string) => void
}

export function useDeepgram({ onTranscript, onUtteranceEnd, onError }: DeepgramOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const accumulatedRef = useRef<string>('')

  const start = useCallback(async () => {
    accumulatedRef.current = ''
    try {
      const tokenRes = await fetch('/api/deepgram-token', { method: 'POST' })
      const { key } = await tokenRes.json()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 },
      })
      streamRef.current = stream
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&utterance_end_ms=1200&vad_events=true&endpointing=400`,
        ['token', key]
      )
      wsRef.current = ws
      ws.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        const mediaRecorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = mediaRecorder
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
        }
        mediaRecorder.start(50)
      }
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'UtteranceEnd') {
            if (accumulatedRef.current.trim()) {
              onUtteranceEnd(accumulatedRef.current.trim())
              accumulatedRef.current = ''
            }
            return
          }
          const transcript = data?.channel?.alternatives?.[0]?.transcript
          if (!transcript) return
          const isFinal = data.is_final === true
          if (isFinal) {
            accumulatedRef.current = (accumulatedRef.current + ' ' + transcript).trim()
            onTranscript(accumulatedRef.current, true)
          } else {
            onTranscript((accumulatedRef.current + ' ' + transcript).trim(), false)
          }
        } catch {}
      }
      ws.onerror = () => onError('Connection error — check mic permissions')
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [onTranscript, onUtteranceEnd,
git diff --stat
