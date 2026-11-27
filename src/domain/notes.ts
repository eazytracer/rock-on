/**
 * Note maths: MIDI ↔ frequency ↔ name (no I/O; ports to Dart line for line).
 * Concert pitch is A4 = 440 Hz (MIDI 69).
 */

export const A4_HZ = 440

/** Note letters in pitch order from C, flats spelled ASCII (as KEY_ROOTS). */
export const NOTE_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

/** MIDI note → frequency in Hz. */
export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - 69) / 12)
}

/** Frequency → fractional MIDI note (69.0 = A4). */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / A4_HZ)
}

/** "E", "Eb" (no octave). */
export function noteLetter(midi: number): string {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12]
}

/** Scientific octave: MIDI 60 = C4. */
export function noteOctave(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1
}

/** "E2", "Eb3". */
export function noteName(midi: number): string {
  return `${noteLetter(midi)}${noteOctave(midi)}`
}
