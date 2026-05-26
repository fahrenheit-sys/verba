import { useState } from 'react'
import Head from 'next/head'
import ModeSelect from '../components/ModeSelect'
import SessionScreen, { type TranscriptLine } from '../components/SessionScreen'
import ResultsScreen from '../components/ResultsScreen'
import { type Mode } from '../lib/constants'

type Screen = 'select' | 'session' | 'results'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('select')
  const [mode, setMode] = useState<Mode>('flow')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])

  const handleModeSelect = (m: Mode) => {
    setMode(m)
    setScreen('session')
  }

  const handleSessionEnd = (t: TranscriptLine[]) => {
    setTranscript(t)
    setScreen('results')
  }

  const handleRestart = (m: Mode | null) => {
    if (m) {
      setMode(m)
      setScreen('session')
    } else {
      setScreen('select')
    }
  }

  return (
    <>
      <Head>
        <title>Verba — Communication Training</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="AI-powered communication training. Real-time voice. Scored feedback." />
      </Head>

      {screen === 'select' && <ModeSelect onSelect={handleModeSelect} />}
      {screen === 'session' && <SessionScreen mode={mode} onEnd={handleSessionEnd} />}
      {screen === 'results' && (
        <ResultsScreen mode={mode} transcript={transcript} onRestart={handleRestart} />
      )}
    </>
  )
}
