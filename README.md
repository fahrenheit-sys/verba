# Verba — Communication Training Platform

AI-powered real-time voice communication training. Two modes: Conversation Flow and Executive Pressure.

**Stack:** Next.js · Deepgram STT · ElevenLabs TTS · Claude AI

---

## Deploy in 10 minutes

### Step 1 — Push to GitHub

1. Create a new repo at github.com (call it `verba`)
2. Unzip this project folder
3. Open Terminal, `cd` into the folder, then run:

```bash
git init
git add .
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/verba.git
git push -u origin main
```

---

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Import your `verba` GitHub repo
4. Click **Deploy** (no config needed — Vercel auto-detects Next.js)

---

### Step 3 — Add Environment Variables

In Vercel → your project → **Settings** → **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `DEEPGRAM_API_KEY` | Your Deepgram key |
| `ELEVENLABS_API_KEY` | Your ElevenLabs key |
| `ANTHROPIC_API_KEY` | Your Anthropic key |

Then go to **Deployments** → click the three dots on your latest deploy → **Redeploy**.

---

### Step 4 — Open on iPhone

1. Copy your Vercel URL (e.g. `https://verba-xyz.vercel.app`)
2. Open it in Safari on your iPhone
3. Tap **Share** → **Add to Home Screen** → Add
4. It will install like a native app

> **Allow microphone access** when prompted — required for voice.

---

## Local development

```bash
# Copy env template
cp .env.local.example .env.local
# Fill in your keys, then:
npm install
npm run dev
# Open http://localhost:3000
```

---

## Voice IDs (ElevenLabs)

Default voices are set in `.env.local.example`. To change them:

1. Go to elevenlabs.io → Voices
2. Copy the Voice ID from any voice
3. Set `ELEVENLABS_VOICE_FLOW` and/or `ELEVENLABS_VOICE_BOARDROOM` in Vercel env vars

---

## Cost estimate per session (10 min)

| Service | Cost |
|---------|------|
| Deepgram STT | ~$0.08 |
| ElevenLabs TTS | ~$0.09 |
| Claude API | ~$0.04 |
| **Total** | **~$0.21** |

---

## Architecture

```
iPhone Safari (HTTPS)
    │
    ▼
Vercel (Next.js)
    ├── /api/deepgram-token  →  Deepgram API (auth token)
    ├── /api/tts             →  ElevenLabs Flash v2.5 (streaming audio)
    └── /api/chat            →  Claude Sonnet (conversation + scoring)
    
Client:
    ├── Deepgram WebSocket   →  Real-time STT
    ├── MediaRecorder API    →  Microphone capture
    └── Audio API            →  ElevenLabs playback
```
