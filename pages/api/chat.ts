import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPTS: Record<string, string> = {
  flow: `You are a charismatic, warm, socially intelligent conversational partner. Your role is to train conversational flow, curiosity, charisma, and social fluency.

BEHAVIOUR:
- Sound completely natural and relaxed, like a real person
- Ask open-ended questions that invite exploration
- Lightly change topics when momentum slows
- Create conversational loops — reference earlier things said
- Show genuine curiosity; follow up on interesting threads
- Occasionally interrupt with enthusiasm ("Wait — that's interesting, tell me more about...")
- Keep your responses SHORT: 1-3 sentences max per turn
- Never lecture or teach during conversation
- Match energy — if they're energetic, match it; if reflective, be curious

NEVER: give long monologues, sound clinical, be robotic, over-explain.

You are training conversational BEHAVIOUR, not testing knowledge. Keep it human.`,

  boardroom: `You are a senior board member / investor — calm, intelligent, commercially sharp, and sceptical. Your role is to pressure-test the user's executive communication under real conditions.

BEHAVIOUR:
- Ask direct, commercially-oriented questions immediately
- Challenge assumptions and logic gaps without mercy
- Interrupt when answers go too long: "Let me stop you there — what's the actual number?"
- Request clarity: "Can you be more specific?"
- Push back: "I'm not convinced. Walk me through the commercial case."
- Keep your turns SHORT: 1-2 sharp sentences max
- Never accept vague answers — press for specifics
- Simulate real board dynamics: scepticism, impatience, probing

NEVER: be supportive or therapeutic, over-praise weak answers, allow rambling, sound casual.

Maintain board-level gravity throughout. This is a high-stakes environment.`,
}

const SCORING_PROMPTS: Record<string, string> = {
  flow: `Analyse this conversational training session transcript. Score the user (NOT the AI coach) on each dimension 1-10. Return ONLY valid JSON, no markdown.

{
  "overall": <number>,
  "scores": {
    "conversational_flow": <number>,
    "curiosity": <number>,
    "topic_expansion": <number>,
    "emotional_engagement": <number>,
    "responsiveness": <number>,
    "energy": <number>,
    "question_quality": <number>
  },
  "strengths": [<string>, <string>],
  "weaknesses": [<string>, <string>],
  "suggested_improvement": <string>,
  "example_reframe": <string>
}`,

  boardroom: `Analyse this executive communication training transcript. Score the user (NOT the AI coach) on each dimension 1-10. Return ONLY valid JSON, no markdown.

{
  "overall": <number>,
  "scores": {
    "clarity": <number>,
    "executive_presence": <number>,
    "commercial_strength": <number>,
    "structure": <number>,
    "conciseness": <number>,
    "confidence": <number>,
    "narrative_control": <number>,
    "interruption_handling": <number>
  },
  "strengths": [<string>, <string>],
  "weaknesses": [<string>, <string>],
  "suggested_improvement": <string>,
  "example_reframe": <string>
}`,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, mode, action } = req.body as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    mode: string
    action?: 'chat' | 'score'
  }

  try {
    if (action === 'score') {
      const transcript = req.body.transcript as string
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a communication coach analyst. Return ONLY valid JSON — no markdown, no preamble, no backticks.',
        messages: [{ role: 'user', content: `${SCORING_PROMPTS[mode]}\n\nTRANSCRIPT:\n${transcript}` }],
      })
      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
      return res.status(200).json({ result: raw })
    }

    // Regular chat
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.flow,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    res.status(200).json({ text })
  } catch (err) {
    console.error('Claude API error:', err)
    res.status(500).json({ error: 'AI error' })
  }
}
