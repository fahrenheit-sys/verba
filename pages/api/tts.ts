import type { NextApiRequest, NextApiResponse } from 'next'

const VOICE_IDS: Record<string, string> = {
  flow: process.env.ELEVENLABS_VOICE_FLOW || 'EXAVITQu4vr4xnSDxMaL',
  boardroom: process.env.ELEVENLABS_VOICE_BOARDROOM || 'onwK4e9ZLuTAKqWW03F9',
}

export const config = {
  api: { responseLimit: false },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, mode } = req.body as { text: string; mode: string }
  if (!text || !mode) return res.status(400).json({ error: 'Missing text or mode' })

  const voiceId = VOICE_IDS[mode] || VOICE_IDS.flow

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
            stability: mode === 'boardroom' ? 0.75 : 0.55,
            similarity_boost: 0.8,
            style: mode === 'boardroom' ? 0.1 : 0.35,
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
