export const MODES = {
  FLOW: 'flow',
  BOARDROOM: 'boardroom',
} as const

export type Mode = typeof MODES[keyof typeof MODES]

export const OPENING_LINES: Record<Mode, string> = {
  flow: "Hey — good to finally connect. What have you been up to lately?",
  boardroom: "Let's get into it. Walk me through the core commercial rationale.",
}

export const SCORE_LABELS: Record<Mode, Record<string, string>> = {
  flow: {
    conversational_flow: 'Flow',
    curiosity: 'Curiosity',
    topic_expansion: 'Expansion',
    emotional_engagement: 'Engagement',
    responsiveness: 'Responsiveness',
    energy: 'Energy',
    question_quality: 'Questions',
  },
  boardroom: {
    clarity: 'Clarity',
    executive_presence: 'Presence',
    commercial_strength: 'Commercial',
    structure: 'Structure',
    conciseness: 'Conciseness',
    confidence: 'Confidence',
    narrative_control: 'Narrative',
    interruption_handling: 'Interruptions',
  },
}

export const MODE_CONFIG = {
  flow: {
    label: 'Conversation Flow',
    tag: 'SOCIAL · CHARISMA · FLUENCY',
    icon: '⟳',
    accent: '#ff6b9d',
    pill: '⟳ FLOW',
    desc: 'Train natural conversational rhythm, curiosity, and social presence. Ideal for networking, confidence, and charisma development.',
  },
  boardroom: {
    label: 'Executive Pressure',
    tag: 'BOARD · INVESTOR · STRATEGY',
    icon: '◆',
    accent: '#4a9eff',
    pill: '◆ EXECUTIVE',
    desc: 'Sharpen executive communication under pressure. Field tough investor questions, pressure-test your thinking, command the room.',
  },
}
