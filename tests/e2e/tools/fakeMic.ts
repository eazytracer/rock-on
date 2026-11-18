/**
 * Chromium launch args for a fake microphone that plays a WAV on loop
 * (tests/fixtures/audio, made by scripts/make-audio-fixtures.mjs).
 */
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

const BASE = [
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream',
]

export const fakeMic = (wav: string, { prompt = 'accept' } = {}) => ({
  launchOptions: {
    args: [
      ...BASE,
      ...(prompt === 'accept' ? ['--use-fake-ui-for-media-stream'] : []),
      `--use-file-for-fake-audio-capture=${path.resolve(
        HERE,
        '../../fixtures/audio',
        wav
      )}`,
    ],
  },
})
