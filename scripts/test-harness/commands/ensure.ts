/**
 * `ensure [--fresh]` — provision all fixed personas.
 *
 * Idempotent: re-running without `--fresh` is a no-op for existing
 * personas (app-side rows are re-upserted to heal drift).
 *
 * `--fresh` deletes each persona first. All cascading data (songs,
 * setlists, jams) is wiped with them.
 */

import { PERSONAS } from '../config'
import { ensurePersona, resetPersona } from '../personas'

export async function runEnsure(args: { fresh?: boolean }): Promise<void> {
  if (args.fresh) {
    console.log('[ensure] --fresh: resetting existing personas first...')
    for (const p of PERSONAS) {
      const removed = await resetPersona(p)
      console.log(`  ${p.name}: ${removed ? 'removed' : 'did not exist'}`)
    }
  }

  for (const p of PERSONAS) {
    const { userId, created } = await ensurePersona(p)
    console.log(
      `  ${p.name} (${p.email}) — ${created ? 'CREATED' : 'exists'} — ${userId}`
    )
  }
  console.log(`[ensure] ${PERSONAS.length} personas ready.`)
}
