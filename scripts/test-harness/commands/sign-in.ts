/**
 * `sign-in <persona> [--json]` — print the persona's access + refresh
 * token so you can drop them into a browser session or an HTTP client.
 *
 * Pretty-print by default; `--json` emits a single JSON object for
 * piping into jq.
 */

import { userClient } from '../clients'
import { findPersona } from '../config'

export async function runSignIn(args: {
  name: string
  json?: boolean
}): Promise<void> {
  const persona = findPersona(args.name)
  const { userId, accessToken, refreshToken } = await userClient(persona)

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          persona: persona.name,
          userId,
          email: persona.email,
          accessToken,
          refreshToken,
        },
        null,
        2
      )
    )
    return
  }

  console.log(`Signed in as ${persona.name} (${persona.email})`)
  console.log(`  userId:       ${userId}`)
  console.log(`  accessToken:  ${accessToken}`)
  console.log(`  refreshToken: ${refreshToken}`)
  console.log('')
  console.log('Browser snippet (paste into app devtools console):')
  console.log('---')
  console.log(
    `const { createClient } = await import('@supabase/supabase-js')\n` +
      `const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)\n` +
      `await supabase.auth.setSession({ access_token: '${accessToken}', refresh_token: '${refreshToken}' })\n` +
      `location.reload()`
  )
  console.log('---')
}
