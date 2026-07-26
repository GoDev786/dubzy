# UGC Voice Translator

A local-first Next.js MVP for dubbing UGC videos into another language. Videos are uploaded to `uploads/`; WAV intermediates and final MP4s are written to `outputs/`.

## Setup

1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and set `SARVAM_API_KEY` and `SARVAM_BASE_URL`.
3. Update the three clearly marked TODO implementations in `lib/sarvam.ts` with the current official Sarvam STT, Translate, and TTS API endpoint details.
4. Run `npm run dev`, then visit `http://localhost:3000`.

## Processing flow

`extractAudio()` → `transcribe()` → `translate()` → `textToSpeech()` → `mergeVideo()` → download URL

Each stage is independently implemented and API routes are available under `/api/upload`, `/api/transcribe`, `/api/translate`, `/api/tts`, `/api/merge`, and `/api/process`. `process` only coordinates the individual utilities.

## Sarvam API note

The request explicitly avoids inventing endpoint URLs. Therefore, `lib/sarvam.ts` compiles but throws an actionable configuration error until the three official endpoint implementations are filled in. The `textToSpeech` TODO is also where a Base64 audio response should be decoded with `Buffer.from(value, "base64")` and saved via `writeFile`.

## Constraints

This prototype has no database, auth, cloud storage, job queue, or persistent progress streaming. Generated files remain on the local filesystem and should be cleaned up by deployment-specific retention rules.
