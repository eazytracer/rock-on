# Rock On redesign · implementation guide

Applying the locked redesign (Nov 2026) to this app. Written Nov 7 2026 against `main` @ v0.5.0.

## Where the design lives

The design is a set of clickable HTML prototypes in **[`design/`](../../design/README.md)** in this repo (copied
from the claude.ai design project on Nov 7 2026). Every page opens from disk with no sign-in. Everything below
refers to files under `design/`. Part A decisions are in `design/source/DECISIONS.md`; the server contract is
`design/OPERATIONS.md`; web vs native is `design/PLATFORM-NOTES.md`.

| What                  | File in the design project                                                           | Use it for                                                                             |
| --------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Mobile demo           | `demo/Rock On Mobile.html`                                                           | Every phone screen, linked, with a checklist down the side                             |
| Desktop demo          | `demo/Rock On Desktop.html`                                                          | The desktop app at ≥1024 px, fully clickable                                           |
| Working jam           | `demo/Jam Night.html`                                                                | A real jam you can run: host, guest, bar TV, counter iPad, synced across windows       |
| Locked decisions      | `source/DECISIONS.md`                                                                | **The source of truth.** Every rule, dated, with its UX law. Wins over everything else |
| Parity                | `source/PARITY.md`                                                                   | What exists on mobile vs desktop, and the deliberate exceptions                        |
| Kit                   | `source/kit/rock.css`, `rock.js`, `pickers.*`, `Components.html`, `Foundations.html` | Tokens and the component catalog                                                       |
| Data the design needs | `design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md`, `source/CHART-DATA-MODEL.md`  | Diffed against this schema in [04-data.md](04-data.md)                                 |

The prototypes are reference, not code to paste: they use string templates and inline mock data. Rebuild each
screen in this codebase's own React / Tailwind / repository patterns.

## The guides

1. [01-foundations.md](01-foundations.md) — tokens, fonts, light theme, context accent, tuning colours. Mostly edits to `src/index.css`, `tailwind.config.js`, `src/utils/tokens.ts`, `src/utils/tunings.ts`.
2. [02-components.md](02-components.md) — kit component → existing React component: keep, restyle, replace or new.
3. [03-screens.md](03-screens.md) — every route: which design screens it becomes, what changes, which files.
4. [04-data.md](04-data.md) — what the design needs stored, marked **exists / change / new**, with migration sketches.
5. [05-plan.md](05-plan.md) — the build order as PR-sized phases with acceptance checks, sized for this repo's release gate.
6. [06-open-decisions.md](06-open-decisions.md) — **Events vs Jam**: decided Nov 7, option A (Jam on the Events tables). Background for the Jam phase.
7. [07-handoff-to-build.md](07-handoff-to-build.md) — the build agent's handoff checklist. Done Nov 7: answers in `design/source/DECISIONS.md`, files in `design/`.

## Rules that apply to every phase

- **Both platforms, same pass.** A screen isn't done until its mobile and desktop layouts both match the demos (PARITY.md lists the few deliberate exceptions).
- **No capability disappears silently.** If the design drops something the live app does (separate Shows / Practices list pages, the Events casting console), redirect or flag it, and ask before deleting. DECISIONS.md: "any change that removes or hides an existing capability is flagged and asked first."
- **Every list has three states:** skeleton while loading, empty with its action, error with Retry. One offline banner, no per-row sync icons (online-only).
- **Overlays by job:** full-screen route for forms with many fields; bottom sheet (mobile) / anchored menu or centred dialog (desktop) for picks and actions; dialog only for destructive confirms that name the consequence; toast for your own actions.
- **Targets:** 44 px minimum, 64 px on stage screens (chart reader, practice session, jam host). Body text 16, never under 13.
- Repo rules still apply: repository layer only (no direct `db.*` writes), one idempotent migration per release with explicit GRANTs, `useConfirm` / `useToast` instead of native dialogs, testability attributes on every interactive element, version bump + CHANGELOG + `release_notes` row in every prod-bound PR.

## Definition of done for a screen

- Matches the demo on mobile (390 wide) and desktop (1280 wide) in dark **and** light, in a band and in Personal.
- Loading / empty / error states drawn in the demo are implemented.
- `data-testid`s added; a Playwright spec covers the main flow from the mobile checklist in `Rock On Mobile.html`.
- Any field the screen needs that 04-data.md marks **new** has landed in the release's migration.
