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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      // Use utterance_end_ms so Deepgram tells us when the person has stopped speaking
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?` +
        `model=nova-2&` +
        `language=en&` +
        `smart_format=true&` +
        `interim_results=true&` +
        `utterance_end_ms=1200&` +
        `vad_events=true&` +
        `endpointing=400`,
        ['token', key]
      )
      wsRef.current = ws

      ws.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

        const mediaRecorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }

        // Smaller chunks = faster transcription
        mediaRecorder.start(50)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle utterance end event — Deepgram detected speech has stopped
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
            // Accumulate final segments
            accumulatedRef.current = (accumulatedRef.current + ' ' + transcript).trim()
            onTranscript(accumulatedRef.current, true)
          } else {
            // Show interim results as preview
            onTranscript((accumulatedRef.current + ' ' + transcript).trim(), false)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = (e) => {
        console.error('Deepgram WS error', e)
        onError('Connection error — check mic permissions')
      }

      ws.onclose = (e) => {
        if (e.code !== 1000) {
          console.warn('Deepgram closed unexpectedly', e.code, e.reason)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      onError(message)
    }
  }, [onTranscript, onUtteranceEnd, onError])

  const stop = useCallback((): string => {
    const finalText = accumulatedRef.current.trim()
    accumulatedRef.current = ''

    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send UtteranceEnd signal before closing
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      wsRef.current.close(1000)
    }
    wsRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    return finalText
  }, [])

  return { start, stop }
}
