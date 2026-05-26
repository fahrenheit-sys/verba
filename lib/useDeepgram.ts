import { useRef, useCallback } from 'react'

interface DeepgramOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (err: string) => void
}

export function useDeepgram({ onTranscript, onError }: DeepgramOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    try {
      // Get Deepgram key from our server
      const tokenRes = await fetch('/api/deepgram-token', { method: 'POST' })
      const { key } = await tokenRes.json()

      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      // Open Deepgram WebSocket
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?` +
        `model=nova-2&` +
        `language=en&` +
        `smart_format=true&` +
        `interim_results=true&` +
        `endpointing=300&` +
        `utterance_end_ms=1000`,
        ['token', key]
      )
      wsRef.current = ws

      ws.onopen = () => {
        // Start recording and sending audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm',
        })
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }

        mediaRecorder.start(100) // send chunks every 100ms
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const transcript = data?.channel?.alternatives?.[0]?.transcript
          if (transcript) {
            const isFinal = data.is_final === true
            onTranscript(transcript, isFinal)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => onError('Deepgram connection error')
      ws.onclose = () => {}
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      onError(message)
    }
  }, [onTranscript, onError])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      wsRef.current.close()
    }
    wsRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  return { start, stop }
}
