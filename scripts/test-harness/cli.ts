#!/usr/bin/env tsx
/**
 * Test harness CLI entry point.
 *
 * Usage:
 *   tsx scripts/test-harness/cli.ts <command> [args...]
 *
 * See scripts/test-harness/README.md for the full command reference.
 */

import { runCreateJam } from './commands/create-jam'
import { runDumpSession } from './commands/dump-session'
import { runEnsure } from './commands/ensure'
import { runJoinJam } from './commands/join-jam'
import { runListSongs } from './commands/list-songs'
import { runRecompute } from './commands/recompute'
import { runReset } from './commands/reset'
import { runSeedSongs } from './commands/seed-songs'
import { runSignIn } from './commands/sign-in'
import { runWatch } from './commands/watch'

interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq === -1) {
        flags[arg.slice(2)] = true
      } else {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      }
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

function printHelp(): void {
  console.log(
    `Test Harness CLI

Commands:
  ensure [--fresh]                          Provision all fixed personas.
  reset [<persona>...]                      Reset one, many, or all personas.
  sign-in <persona> [--json]                Print tokens for a persona.
  seed-songs <persona> [--count=N]
            [--file=<path>] [--preset=<n>]  Insert songs into persona's personal catalog.
  list-songs <persona>                      Print persona's personal catalog.
  create-jam <persona> [--name=<n>] [--json]  Persona creates a jam session.
  join-jam <persona> <joinCode>             Persona joins an existing session.
  recompute <sessionId> [--as=<persona>]    Trigger jam-recompute Edge Function.
  dump-session <sessionId>                  Service-role snapshot of a jam session.
  watch <sessionId>                         Stream realtime events for a session.

See scripts/test-harness/README.md for examples.
`
  )
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || command === 'help' || command === '--help') {
    printHelp()
    return
  }
  const { positional, flags } = parseArgs(rest)

  switch (command) {
    case 'ensure':
      await runEnsure({ fresh: Boolean(flags.fresh) })
      break
    case 'reset':
      await runReset({ names: positional })
      break
    case 'sign-in':
      requirePositional(positional, 1, command)
      await runSignIn({ name: positional[0], json: Boolean(flags.json) })
      break
    case 'seed-songs':
      requirePositional(positional, 1, command)
      await runSeedSongs({
        name: positional[0],
        count: flags.count ? parseInt(String(flags.count), 10) : undefined,
        file: typeof flags.file === 'string' ? flags.file : undefined,
        preset: typeof flags.preset === 'string' ? flags.preset : undefined,
      })
      break
    case 'list-songs':
      requirePositional(positional, 1, command)
      await runListSongs({ name: positional[0] })
      break
    case 'create-jam':
      requirePositional(positional, 1, command)
      await runCreateJam({
        name: positional[0],
        sessionName: typeof flags.name === 'string' ? flags.name : undefined,
        json: Boolean(flags.json),
      })
      break
    case 'join-jam':
      requirePositional(positional, 2, command)
      await runJoinJam({ name: positional[0], joinCode: positional[1] })
      break
    case 'recompute':
      requirePositional(positional, 1, command)
      await runRecompute({
        sessionId: positional[0],
        asName: typeof flags.as === 'string' ? flags.as : undefined,
      })
      break
    case 'dump-session':
      requirePositional(positional, 1, command)
      await runDumpSession({ sessionId: positional[0] })
      break
    case 'watch':
      requirePositional(positional, 1, command)
      await runWatch({ sessionId: positional[0] })
      break
    default:
      console.error(`Unknown command: ${command}\n`)
      printHelp()
      process.exit(2)
  }
}

function requirePositional(
  positional: string[],
  needed: number,
  command: string
): void {
  if (positional.length < needed) {
    console.error(
      `Command "${command}" requires ${needed} positional argument${needed === 1 ? '' : 's'}.`
    )
    printHelp()
    process.exit(2)
  }
}

main().catch(err => {
  console.error('[harness] error:', err instanceof Error ? err.message : err)
  if (err instanceof Error && err.stack && process.env.DEBUG)
    console.error(err.stack)
  process.exit(1)
})
