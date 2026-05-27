import { useRef, useCallback } from 'react'

let abortFlag = false

// Pre-create and unlock a single shared Audio element from user gesture
let sharedAudio: HTMLAudioElement | null = null

export function unlockAudio() {
  abortFlag = false
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.volume = 1
  }
  // Play a silent data URL — unlocks the audio element for future playback on iOS
  sharedAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
  sharedAudio.play().catch(() => {})
}

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    abortFlag = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setTimeout(() => { abortFlag = false }, 50)
  }, [])

  const speak = useCallback(async (text: string, onEnd: () => void, mode?: string): Promise<void> => {
    abortFlag = false

    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      })
      if (!res.ok) throw new Error('TTS failed')
      if (abortFlag) return

      const blob = await res.blob()
      if (abortFlag) return

      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url

      // Reuse the shared unlocked audio element if available
      const audio = sharedAudio || new Audio()
      sharedAudio = null // take ownership
      audioRef.current = audio

      audio.src = url
      audio.volume = 1

      audio.onended = () => {
        URL.revokeObjectURL(url)
        blobUrlRef.current = null
        audioRef.current = null
        sharedAudio = audio // return for reuse
        audio.onended = null
        audio.onerror = null
        if (!abortFlag) onEnd()
      }

      audio.onerror = () => {
        URL.revokeObjectURL(url)
        blobUrlRef.current = null
        audioRef.current = null
        if (!abortFlag) onEnd()
      }

      const playPromise = audio.play()
      if (playPromise) {
        playPromise.catch(err => {
          console.error('Audio play failed:', err)
          if (!abortFlag) onEnd()
        })
      }
    } catch (err) {
      console.error('TTS error:', err)
      if (!abortFlag) onEnd()
    }
  }, [])

  return { speak, stop }
}
