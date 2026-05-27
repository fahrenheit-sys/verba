import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: { responseLimit: false },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, mode } = req.body as { text: string; mode?: string }
  if (!text) return res.status(400).json({ error: 'Missing text' })

  // Use different voices per mode — both fall back gracefully
  const voiceId = mode === 'boardroom'
    ? (process.env.ELEVENLABS_VOICE_BOARDROOM || 'onwK4e9ZLuTAKqWW03F9')
    : (process.env.ELEVENLABS_VOICE_FLOW || 'EXAVITQu4vr4xnSDxMaL')

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: mode === 'boardroom' ? 0.72 : 0.5,
            similarity_boost: 0.85,
            style: mode === 'boardroom' ? 0.08 : 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('ElevenLabs error:', err)
      return res.status(500).json({ error: 'TTS failed', detail: err })
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')

    const reader = response.body!.getReader()
    const pump = async () => {
      const { done, value } = await reader.read()
      if (done) { res.end(); return }
      res.write(Buffer.from(value))
      await pump()
    }
    await pump()
  } catch (err) {
    console.error('TTS route error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
