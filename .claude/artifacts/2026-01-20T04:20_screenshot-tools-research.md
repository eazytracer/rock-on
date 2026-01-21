---
created: 2026-01-20T04:20
title: Custom Screenshot Tools for Agent UI Verification
status: research-complete
prompt: Research creating custom tools/scripts to minimize context usage when verifying UI changes
---

# Research: Custom Screenshot Tools for Agent UI Verification

## Executive Summary

This research explores creating automated screenshot tools to reduce agent context usage when verifying UI changes. Currently, agents use Playwright MCP to manually navigate and screenshot the app each time, consuming significant context. The proposed solution creates reusable scripts that automatically navigate to common pages, take screenshots, and save them to a defined directory for agent consumption.

**Key Finding:** Extend the existing E2E test infrastructure to create a screenshot library. This reuses established patterns and minimizes new code.

**Estimated Effort:** ~14 hours over 3 phases

**Expected Context Reduction:** 50% fewer Playwright MCP calls for UI verification

## Current State Analysis

### Existing Screenshot Infrastructure

**Current Directory:** `.playwright-mcp/`

- 11 existing screenshots from recent feature work
- All screenshots are 1280x1265 PNG images taken via Playwright MCP
- Git-ignored, ad-hoc organization

**Existing E2E Test Infrastructure:**

The project has a mature E2E testing setup using Playwright:

| File                       | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `playwright.config.ts`     | Base URL, projects (Chromium/Firefox/WebKit), web server auto-start |
| `tests/e2e/auth/`          | Session expiry tests (1 file)                                       |
| `tests/e2e/journeys/`      | Complete user flows (4 files)                                       |
| `tests/e2e/songs/`         | Song management (3 files)                                           |
| `tests/e2e/user-settings/` | Settings pages (3 files)                                            |

**Standard Authentication Pattern:**

```typescript
await page.goto('/auth')
await page.getByTestId('login-email-input').fill('test@example.com')
await page.getByTestId('login-password-input').fill('testpassword123')
await page.getByTestId('login-submit-button').click()
await expect(page).toHaveURL('/songs')
```

### Application Pages (11 Total)

| Page                | Route                   | data-testid             |
| ------------------- | ----------------------- | ----------------------- |
| AuthPage            | `/auth`                 | `auth-page`             |
| SongsPage           | `/songs`                | `songs-page`            |
| SetlistsPage        | `/setlists`             | `setlists-page`         |
| SetlistViewPage     | `/setlists/:id`         | `setlist-view-page`     |
| PracticePage        | `/practice`             | `practice-page`         |
| PracticeSessionPage | `/practice/session/:id` | `practice-session-page` |
| PracticeViewPage    | `/practice/view/:id`    | `practice-view-page`    |
| BandsPage           | `/bands`                | `bands-page`            |
| ShowsPage           | `/shows`                | `shows-page`            |
| DashboardPage       | `/dashboard`            | `dashboard-page`        |
| UserSettingsPage    | `/settings`             | `user-settings-page`    |

### Current Workflow Pain Points

**When agents need to verify UI:**

1. Use Playwright MCP to navigate to page (~5-10 tool calls)
2. Wait for page load
3. Take screenshot (large binary in context)
4. Read screenshot to analyze
5. Repeat for each page variation needed

**Context Cost:**

- Each navigation session: ~1000-2000 tokens
- No caching or reuse between agent sessions
- Repeated for same feature across multiple sessions

## Proposed Solution: Screenshot Library

### Architecture

**Extend E2E Test Suite** with screenshot-specific specs:

```
tests/e2e/screenshots/
├── common-pages.spec.ts          # All main pages (logged in)
├── auth-states.spec.ts           # Auth page variations
├── song-states.spec.ts           # Song modal states
├── setlist-states.spec.ts        # Setlist variations
├── practice-states.spec.ts       # Practice session states
└── helpers/
    └── screenshot-helper.ts      # Shared utilities
```

**Output Directory:**

```
.claude-screenshots/
├── common-pages/
│   ├── songs-page.png
│   ├── setlists-page.png
│   ├── practice-page.png
│   └── ...
├── auth/
│   ├── login-page.png
│   └── signup-page.png
├── modals/
│   ├── add-song-empty.png
│   ├── add-song-filled.png
│   └── edit-song-links.png
├── features/
│   └── external-links/
│       └── song-list-with-links.png
└── states/
    ├── empty-song-list.png
    └── loading-spinner.png
```

### Why Extend E2E Instead of Separate Scripts

| Consideration | E2E Extension | Separate Script |
| ------------- | ------------- | --------------- |
| Reuse config  | Yes           | No              |
| Auth patterns | Already exist | Must recreate   |
| Browser setup | Automatic     | Manual          |
| Test runner   | npm scripts   | Custom          |
| Maintenance   | Minimal       | Higher          |

**Winner:** E2E Extension

### Example Implementation

**`tests/e2e/screenshots/helpers/screenshot-helper.ts`:**

```typescript
import { Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SCREENSHOT_DIR = path.join(process.cwd(), '.claude-screenshots')

export async function takeScreenshot(
  page: Page,
  filename: string,
  options?: {
    fullPage?: boolean
    clip?: { x: number; y: number; width: number; height: number }
  }
): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, filename)
  const dir = path.dirname(filepath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await page.screenshot({
    path: filepath,
    fullPage: options?.fullPage ?? false,
    clip: options?.clip,
  })

  console.log(`Screenshot saved: ${filename}`)
}

export async function takeComponentScreenshot(
  page: Page,
  selector: string,
  filename: string
): Promise<void> {
  const element = await page.locator(selector)
  const filepath = path.join(SCREENSHOT_DIR, filename)
  const dir = path.dirname(filepath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await element.screenshot({ path: filepath })
}
```

**`tests/e2e/screenshots/common-pages.spec.ts`:**

```typescript
import { test, expect } from '@playwright/test'
import { takeScreenshot } from './helpers/screenshot-helper'

test.describe('Common Pages Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
    await page.getByTestId('login-email-input').fill('test@example.com')
    await page.getByTestId('login-password-input').fill('testpassword123')
    await page.getByTestId('login-submit-button').click()
    await expect(page).toHaveURL('/songs')
  })

  test('songs page', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForSelector('[data-testid="songs-page"]')
    await takeScreenshot(page, 'common-pages/songs-page.png')
  })

  test('setlists page', async ({ page }) => {
    await page.goto('/setlists')
    await page.waitForSelector('[data-testid="setlists-page"]')
    await takeScreenshot(page, 'common-pages/setlists-page.png')
  })

  // ... other pages
})
```

### npm Scripts

```json
{
  "scripts": {
    "screenshots": "playwright test tests/e2e/screenshots/",
    "screenshots:common": "playwright test tests/e2e/screenshots/common-pages.spec.ts",
    "screenshots:modals": "playwright test tests/e2e/screenshots/song-states.spec.ts tests/e2e/screenshots/setlist-states.spec.ts",
    "screenshots:all": "npm run screenshots"
  }
}
```

## Maintenance Strategy

### When to Regenerate

| Trigger                             | Action                    |
| ----------------------------------- | ------------------------- |
| After UI changes                    | `npm run screenshots:all` |
| After adding new pages              | Add test, regenerate      |
| On main branch merge                | CI/CD regenerates         |
| When agent reports stale screenshot | Manual regenerate         |

### Feature Screenshot Specifications

When planning new features, include a `screenshot-spec.md` in the feature directory:

```markdown
# Screenshots for Feature: External Links

## New Screenshots Needed

1. **Song Modal - Reference Links Section**
   - File: `modals/edit-song-reference-links.png`
   - Page: Edit song modal
   - State: With 3 links added (Spotify, YouTube, SoundCloud)
   - Script: `tests/e2e/screenshots/song-states.spec.ts`

2. **Song List - With Link Icons**
   - File: `features/external-links/song-list-with-links.png`
   - Page: Songs page
   - State: Multiple songs with various link icons
```

## Agent Integration Strategy

### Decision Tree for Agents

```
Need to see current UI state?
└── Check .claude-screenshots/ first
    └── Found relevant screenshot?
        ├── YES: Use screenshot (Read tool)
        └── NO: Continue below
            └── Need interactive testing?
                ├── YES: Use Playwright MCP
                └── NO: Regenerate screenshot (npm run screenshots)
```

### Cost Comparison

| Method             | Context Cost      | Speed        | Freshness                |
| ------------------ | ----------------- | ------------ | ------------------------ |
| Screenshot Library | ~100 tokens       | Instant      | May be slightly outdated |
| Playwright MCP     | ~1000-2000 tokens | 5-10 seconds | Always current           |

**Rule of Thumb:**

- Use library for 80% of UI verification needs
- Use Playwright MCP for interactive testing and edge cases

### CLAUDE.md Update

Add new section:

````markdown
## Screenshot Library

Pre-generated screenshots are available in `.claude-screenshots/`.

### Available Screenshots

**Common Pages:** (`.claude-screenshots/common-pages/`)

- Songs page, setlists page, practice page, etc.
- Standard viewport: 1280x1265

**Modal States:** (`.claude-screenshots/modals/`)

- Add/edit song modals, Spotify search, confirm dialogs

**Feature-Specific:** (`.claude-screenshots/features/`)

- External links display, etc.

### When to Use

**Use Screenshot Library:**

- Planning UI changes
- Verifying recent implementations
- Diagnosing visual issues
- Researching existing patterns

**Use Playwright MCP:**

- Testing interactive behaviors
- Reproducing specific user flows
- Capturing edge cases not in library
- Debugging dynamic states

### Regenerating Screenshots

```bash
npm run screenshots:all     # All screenshots
npm run screenshots:common  # Common pages only
```
````

````

### Agent Skill Updates

**Diagnosis Agent** should check screenshot library before using Playwright MCP:

```markdown
## Screenshot Strategy

1. Check `.claude-screenshots/` for existing screenshots
2. If found, use for initial assessment
3. Only use Playwright MCP for:
   - Interactive testing
   - Missing scenarios
   - Edge cases
````

## Implementation Plan

### Phase 1: MVP (Week 1, ~4 hours)

**Tasks:**

1. Create `.claude-screenshots/` directory structure
2. Create `tests/e2e/screenshots/helpers/screenshot-helper.ts`
3. Create `tests/e2e/screenshots/common-pages.spec.ts`
4. Add npm scripts
5. Update `.gitignore`
6. Generate initial screenshots (7-10)
7. Update CLAUDE.md

**Deliverables:**

- Basic infrastructure
- 7-10 screenshots of main pages
- Documentation

### Phase 2: Comprehensive Coverage (Week 2, ~6 hours)

**Tasks:**

1. Create auth, song, setlist, practice state specs
2. Document feature screenshot specs
3. Update agent skills
4. Create Screenshot Manager skill

**Deliverables:**

- 25-30 total screenshots
- Complete agent integration docs

### Phase 3: Automation (Week 3, ~4 hours)

**Tasks:**

1. Add screenshot regeneration to CI/CD
2. Create development workflow docs
3. Monitor agent usage
4. Gather feedback and iterate

**Deliverables:**

- CI/CD integration
- Usage metrics
- Troubleshooting guide

## Success Metrics

| Metric            | Target                                        | How to Measure             |
| ----------------- | --------------------------------------------- | -------------------------- |
| Context reduction | 50% fewer Playwright MCP calls                | Track tool calls           |
| Coverage          | 90% of agent UI questions answered by library | % library vs MCP usage     |
| Maintenance       | <30 min per feature                           | Time to update screenshots |

## Risks & Mitigations

### Screenshots Become Stale

**Risk:** Agents see outdated UI, make incorrect assumptions

**Mitigation:**

- CI/CD regenerates on main branch merges
- Add metadata file with regeneration timestamp
- Screenshot Manager skill alerts when >7 days old

### Screenshot Scripts Break

**Risk:** Can't regenerate screenshots after UI changes

**Mitigation:**

- Use `data-testid` attributes (already standard)
- Document screenshot scripts clearly
- Add screenshot script tests to CI

### Agents Still Prefer Playwright MCP

**Risk:** No adoption, wasted effort

**Mitigation:**

- Clear decision tree in CLAUDE.md
- Make library discovery easy (standard paths)
- Monitor usage and iterate

## Alternatives Considered

| Option                  | Verdict      | Reason                                    |
| ----------------------- | ------------ | ----------------------------------------- |
| Storybook + Screenshots | Rejected     | Too heavy, extra dependency               |
| Percy/Chromatic (SaaS)  | Rejected     | Unnecessary cost/complexity               |
| Custom CLI Tool         | Rejected     | Reinvents Playwright                      |
| **Extend E2E Suite**    | **Selected** | Best balance of simplicity and capability |

## Open Questions

| Question                | Recommendation                         |
| ----------------------- | -------------------------------------- |
| Screenshot format?      | **PNG** - Universal, lossless          |
| Viewport size?          | **1280x1265** (current standard)       |
| Full page vs viewport?  | **Viewport default**, full page option |
| Regeneration frequency? | **On main merge + on demand**          |

## Next Steps

1. **Get approval** from user on approach
2. **Create implementation plan** (move to `/plan`)
3. **Execute Phase 1 MVP**
4. **Validate** with agent usage
5. **Iterate** based on feedback

## Appendix: File Changes Summary

### New Files

```
tests/e2e/screenshots/
├── common-pages.spec.ts
├── auth-states.spec.ts
├── song-states.spec.ts
├── setlist-states.spec.ts
├── practice-states.spec.ts
└── helpers/
    └── screenshot-helper.ts
```

### Modified Files

| File                                | Changes                        |
| ----------------------------------- | ------------------------------ |
| `.gitignore`                        | Add `.claude-screenshots`      |
| `package.json`                      | Add screenshot npm scripts     |
| `CLAUDE.md`                         | Add Screenshot Library section |
| `.claude/MCP-USAGE-GUIDE.md`        | Add decision tree              |
| `.claude/skills/diagnosis-agent.md` | Add screenshot strategy        |
