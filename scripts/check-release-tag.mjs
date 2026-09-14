#!/usr/bin/env node
/**
 * Release-metadata gate — post-merge tag audit (Phase 2 of the release policy).
 *
 * Runs on push to `main`. Verifies that a `v<version>` tag exists for the
 * `package.json` version currently on `main`. This is the backstop for the
 * "forgot to tag" failure mode (three v0.4.x hotfixes shipped untagged) — a tag
 * can't be a PR precondition because it points at the merge commit, so we audit
 * it right after merge instead.
 *
 * Non-blocking by design at the repo level: it exits 1 so the CI job fails
 * loudly (and can open an issue), signaling "run /release", without being able
 * to block a merge that already happened.
 *
 * Usage:  node scripts/check-release-tag.mjs
 * Exit 1 if no matching tag; exit 0 if `v<version>` exists.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

function main() {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  const tag = `v${version}`

  let tags = ''
  try {
    tags = execSync('git tag --list', { encoding: 'utf8' })
  } catch {
    console.error('\u2717 release-tag-audit: could not list git tags.')
    process.exit(1)
  }

  const exists = tags
    .split('\n')
    .map(t => t.trim())
    .includes(tag)

  if (exists) {
    console.log(`\u2713 release-tag-audit: ${tag} exists for package.json ${version}.`)
    process.exit(0)
  }

  console.error(
    `\u2717 release-tag-audit: main is at version ${version} but no ${tag} tag exists.`
  )
  console.error(
    '  Phase 2 (tagging) has not been run for the merged version. Run `/release` on main:'
  )
  console.error(`    git tag -a ${tag} -m "Release ${tag}" && git push origin ${tag}`)
  console.error('  (then create the GitHub release). See CLAUDE.md "Versioning & Release Policy".')
  process.exit(1)
}

main()
