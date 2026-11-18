#!/usr/bin/env node
/**
 * Writes the fake-mic WAVs for the tuner e2e specs (tests/e2e/tools):
 * a steady string-like tone (fundamental + harmonics) at A2 in tune (110 Hz)
 * and flat (107 Hz). Chromium loops the file as the microphone
 * (--use-file-for-fake-audio-capture). Re-run after changing a fixture:
 *   node scripts/make-audio-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../tests/fixtures/audio'
)
const SR = 48000
const SECONDS = 4

function tone(hz) {
  const n = SR * SECONDS
  const pcm = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    let v = 0
    for (let k = 1; k <= 6; k++)
      v += Math.sin((2 * Math.PI * k * hz * i) / SR) / k
    pcm[i] = Math.round(0.35 * v * 0x7fff * 0.6)
  }
  return pcm
}

function wav(pcm) {
  const data = Buffer.from(pcm.buffer)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(1, 22) // mono
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

mkdirSync(OUT, { recursive: true })
for (const [name, hz] of [
  ['a2-110hz.wav', 110],
  ['a2-107hz.wav', 107],
]) {
  writeFileSync(join(OUT, name), wav(tone(hz)))
  console.log(`wrote ${name}`)
}
