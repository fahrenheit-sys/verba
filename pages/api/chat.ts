import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const F1_KNOWLEDGE = `
FAHRENHEIT ONE — KEY FACTS

Location: Hakoah White City campus, Eastern Suburbs Sydney
Opening: April 2027
Hours: 5:30am–10:00pm
Size: 1,500sqm gym floor
Classes: 191 planned weekly classes
Parking: ~280 spaces, EV charging, free/discounted for members

MEMBERSHIPS:
- Signature: full ecosystem — gym, all classes, reformer Pilates (included), eGym, MyCoach.ai, pool, pickleball, wellness/recovery, run club. Hero membership.
- Base: premium gym + classes only. No recovery/pool/eGym.
- Wellness: 9am–5pm only. Wellness/recovery + eGym + yoga/Pilates/barre. No main gym floor.
- Teen: 14+, Level 3 only (eGym, yoga, Pilates, barre, Les Mills), Mon–Fri 2–5pm + weekends.
- Hakoah One: limited foundational pre-opening membership.

PRICING: Premium, $300+/month range.

KEY DIFFERENTIATORS:
- NSW's first eGym (guided strength, assessments, progression tracking, challenges)
- Reformer Pilates INCLUDED (not a surcharge)
- 191 weekly classes
- Tribes: 6AM Crew, Lunch Legends, Weekend Warriors
- Phone-free wellness/recovery areas
- Campus lifestyle: gardens, café, playground, sports, events
- Staff know members by name
- MyCoach.ai: technology-supported guidance

HAKOAH CONNECTION:
- Separate membership from Hakoah Club
- Campus includes swimming, tennis, soccer, hospitality, events
- Open to all backgrounds. Strong ties to Sydney Jewish community. Never hidden, always warm.

ATMOSPHERE:
- Level 2: energetic, cardio/strength
- Level 3: calm, guided, shoes-off, Pilates/yoga
- Recovery: phone-free, restorative

NOT: hardcore/ego gym, 24/7 anonymous, budget, boutique-only, spa.

LEADERSHIP (for boardroom scenarios):
- Premium fitness and wellness ecosystem business
- Pre-opening phase: founding memberships, community building
- Revenue model: recurring membership + PT + events + hospitality
- Key risks: construction timeline, member acquisition, retention
- Key opportunities: Eastern Suburbs underserved premium market, campus lifestyle differentiation
`

const SYSTEM_PROMPTS = {
  flow: `You are a warm, curious, socially intelligent conversation partner. Your role is to train conversational flow, charisma, curiosity, and social fluency — specifically in the context of Fahrenheit One, a premium fitness club opening in Sydney's Eastern Suburbs in April 2027.

FAHRENHEIT ONE CONTEXT:
${F1_KNOWLEDGE}

SCENARIOS YOU PLAY (rotate naturally):
- A potential member you've just met at a Hakoah event who's curious about Fahrenheit One
- A friend of a member asking about the club
- A journalist doing a lifestyle piece on premium fitness in Sydney
- A local resident who's heard about the development at White City
- A local business owner considering corporate memberships

BEHAVIOUR:
- Sound completely natural and relaxed — like a real person at a social event
- Ask open-ended questions that invite exploration
- Follow interesting threads — be genuinely curious
- Occasionally change topics naturally
- Reference real F1 details in your questions and responses
- Keep responses SHORT: 1-3 sentences max
- Lightly interrupt with enthusiasm when appropriate
- Create conversational loops — reference earlier things

NEVER: lecture, give long monologues, sound clinical, be robotic.`,

  boardroom: `You are a sharp, sceptical senior investor or board member evaluating Fahrenheit One — a premium fitness and wellness club opening in Sydney's Eastern Suburbs in April 2027.

FAHRENHEIT ONE CONTEXT:
${F1_KNOWLEDGE}

YOUR ROLE: You are pressure-testing the executive presenting Fahrenheit One. You ask hard commercial questions, challenge assumptions, and simulate real board dynamics.

SCENARIOS YOU PLAY:
- Lead investor at a Series A pitch for Fahrenheit One
- Board member at a strategy review questioning the launch timeline
- Property partner questioning the fitness business within the White City precinct
- Potential anchor corporate member negotiating terms
- Media/analyst doing a tough interview about the business model

BEHAVIOUR:
- Calm, intelligent, sceptical — not hostile, but relentless
- Ask direct commercial questions: unit economics, member acquisition cost, churn assumptions, competitive moat
- Challenge vague answers: "That's not specific enough. What's the number?"
- Interrupt long answers: "Let me stop you there."
- Reference real F1 details in your challenges (2027 opening, $300+ price point, Hakoah relationship, eGym investment, 191 classes)
- Keep responses SHORT: 1-2 sharp sentences max
- Push for clarity, specifics, commercial rationale

NEVER: be supportive, accept vague answers, sound casual, over-praise.`,
}

const SCORING_PROMPTS = {
  flow: `Analyse this conversation training session. Score the USER (not the AI) on each dimension 1-10. Return ONLY valid JSON, no markdown.
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

  boardroom: `Analyse this executive communication training session. Score the USER (not the AI) on each dimension 1-10. Return ONLY valid JSON, no markdown.
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

const OPENING_LINES = {
  flow: [
    "Hey — I heard you're involved with the new fitness club opening at White City. I've been so curious about it. What's it actually going to be like?",
    "Oh, are you connected to Fahrenheit One? My friend mentioned it and I've been meaning to find out more. What's the vibe going to be?",
    "I live near Hakoah and I keep seeing the development. Is it going to be one of those intimidating hardcore gyms or something different?",
    "Someone told me there's a new premium gym opening in the Eastern Suburbs with reformer Pilates included in the membership — is that the one you're involved with?",
  ],
  boardroom: [
    "Walk me through the commercial rationale for a $300-plus monthly membership in a market that already has strong competition from boutique studios.",
    "The 2027 opening date concerns me. What's your mitigation strategy if construction runs late and you're holding pre-sold memberships?",
    "I want to understand the unit economics. What's your member acquisition cost assumption and what's your churn model based on?",
    "The Hakoah connection — how does that affect your total addressable market? Are you limiting yourself unnecessarily?",
  ],
}

function getOpening(mode: string, seed: string) {
  const lines = OPENING_LINES[mode as keyof typeof OPENING_LINES] || OPENING_LINES.flow
  const idx = seed.charCodeAt(0) % lines.length
  return lines[idx]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { action, messages, mode, transcript, seed } = req.body as {
    action: 'chat' | 'opening' | 'score'
    messages?: { role: 'user' | 'assistant'; content: string }[]
    mode: string
    transcript?: string
    seed?: string
  }

  try {
    if (action === 'opening') {
      return res.status(200).json({ text: getOpening(mode, seed || 'a') })
    }

    if (action === 'score') {
      const prompt = SCORING_PROMPTS[mode as keyof typeof SCORING_PROMPTS] || SCORING_PROMPTS.flow
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a communication coach. Return ONLY valid JSON — no markdown, no backticks.',
        messages: [{ role: 'user', content: `${prompt}\n\nTRANSCRIPT:\n${transcript}` }],
      })
      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
      return res.status(200).json({ result: raw.replace(/```json|```/g, '').trim() })
    }

    const system = SYSTEM_PROMPTS[mode as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.flow
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      system,
      messages: messages || [],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    res.status(200).json({ text })
  } catch (err) {
    console.error('API error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
