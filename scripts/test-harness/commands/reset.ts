/**
 * `reset [<persona>...]` — delete one, many, or all personas.
 *
 * No args = reset all fixed personas. Otherwise reset only the named
 * ones. Deleting cascades through auth.users → public.users → all
 * owned rows (songs, setlists, jam_sessions, ...).
 */

import { findPersona, PERSONAS } from '../config'
import { resetPersona } from '../personas'

export async function runReset(args: { names: string[] }): Promise<void> {
  const targets =
    args.names.length === 0 ? [...PERSONAS] : args.names.map(findPersona)
  for (const p of targets) {
    const removed = await resetPersona(p)
    console.log(`  ${p.name}: ${removed ? 'removed' : 'did not exist'}`)
  }
}
