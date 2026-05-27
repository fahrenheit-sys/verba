import Head from 'next/head'
import { useEffect, useState } from 'react'
import VerbaSession from '../components/VerbaSession'
import { unlockAudio } from '../lib/useTTS'

export default function Home() {
  const [autostart, setAutostart] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isAutostart = params.get('autostart') === 'true'
    setAutostart(isAutostart)
    setReady(true)
    if (isAutostart) {
      try { unlockAudio() } catch {}
      const unlock = () => { unlockAudio(); document.removeEventListener('touchstart', unlock) }
      document.addEventListener('touchstart', unlock, { once: true })
    }
  }, [])

  if (!ready) return null

  return (
    <>
      <Head>
        <title>Verba — Communication Training</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Verba" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="description" content="AI-powered communication training. Real-time voice. Scored feedback." />
      </Head>
      <VerbaSession autostart={autostart} />
    </>
  )
}
