import { useRef, useCallback } from 'react'

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<MediaSource | null>(null)
  const bufferRef = useRef<SourceBuffer | null>(null)
  const queueRef = useRef<Uint8Array[]>([])
  const isAppendingRef = useRef(false)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    sourceRef.current = null
    bufferRef.current = null
    queueRef.current = []
    isAppendingRef.current = false
  }, [])

  const speak = useCallback(
    async (text: string, mode: string, onEnd: () => void): Promise<void> => {
      stop()

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, mode }),
        })

        if (!res.ok) throw new Error('TTS request failed')

        // Read the full audio then play — most reliable approach for streaming MP3
        const arrayBuffer = await res.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(blob)

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          onEnd()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          onEnd()
        }

        await audio.play()
      } catch (err) {
        console.error('TTS error:', err)
        onEnd()
      }
    },
    [stop]
  )

  return { speak, stop }
}
