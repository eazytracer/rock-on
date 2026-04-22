# Component Library Spec

**Created:** 2026-04-03T02:10  
**Source:** UI audit of 2026-04-03  
**Purpose:** Full specification of every proposed shared component, ordered by priority

---

## Build Priority

| #   | Component             | Priority  | Rationale                                                     |
| --- | --------------------- | --------- | ------------------------------------------------------------- |
| 1   | `SongAvatar`          | Immediate | Dependency of QueueSongRow; utility already duplicated 4×     |
| 2   | `KebabMenu`           | Immediate | 7–8 inconsistent hand-rolled copies; blocks new jam UI        |
| 3   | `EmptyState`          | Immediate | 9+ inline copies; every new jam panel needs one               |
| 4   | `TabSwitcher`         | Immediate | Replaces existing jam tabs + fixes active-color inconsistency |
| 5   | `QueueSongRow`        | Immediate | Core row for jam setlist builder                              |
| 6   | `SearchBar` (rewrite) | High      | Current version wrong theme; 6+ pages roll their own          |
| 7   | `StatusBadge`         | High      | 3 separate read-only implementations                          |
| 8   | `DarkCard`            | Medium    | 25+ hardcoded string instances                                |
| 9   | `Modal`               | Medium    | 10+ modal shells; replaces `window.confirm` violations        |
| 10  | `SectionHeader`       | Low       | Cosmetic; easy to extract when touching a file                |
| 11  | `NextEventCard`       | Low       | ShowsPage + PracticesPage only                                |

---

## Component Specifications

---

### 1. SongAvatar

**File:** `src/utils/songAvatar.ts` (pure functions) + `src/components/common/SongAvatar.tsx` (component)

**Purpose:** Extract the colored circle avatar with artist initials — currently duplicated verbatim in `SongListItem`, `BrowseSongsDrawer`, `SetlistsPage`, and elsewhere.

**Utility functions (`songAvatar.ts`):**

```typescript
// 6-color hash palette matching existing implementation
export function generateAvatarColor(text: string): string
// Returns one of: '#3b82f6' '#8b5cf6' '#ec4899' '#f59e0b' '#10b981' '#06b6d4'

// Extracts up to 2 initials from a string
export function generateInitials(text: string): string
```

**Component API:**

```tsx
interface SongAvatarProps {
  title: string // song title — used for color hash
  artist?: string // falls back to title if absent
  size?: 'xs' | 'sm' | 'md' | 'lg' // 24 / 32 / 40 / 48px
  className?: string
}
```

**Sizes:**

- `xs` — 24×24px, text-xs
- `sm` — 32×32px, text-xs
- `md` — 40×40px, text-sm (default)
- `lg` — 48×48px, text-base

**Notes:**

- Replace all direct calls to `generateAvatarColor`/`generateInitials` in consuming files with imports from `src/utils/songAvatar.ts`
- When existing files are touched for other reasons, swap inline avatar JSX for `<SongAvatar>`

---

### 2. KebabMenu

**File:** `src/components/common/KebabMenu.tsx`

**Purpose:** Single canonical 3-dot menu replacing 7–8 hand-rolled implementations. Standardises z-index, backdrop, positioning, and visual design.

**Component API:**

```tsx
interface KebabMenuItem {
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  onClick: () => void
  variant?: 'default' | 'danger' // danger = red text
  disabled?: boolean
  dividerBefore?: boolean // renders a separator line above this item
}

interface KebabMenuProps {
  items: KebabMenuItem[]
  align?: 'left' | 'right' // default: 'right'
  triggerSize?: 'sm' | 'md' // icon size: 14 / 18px
  disabled?: boolean
  'data-testid'?: string
  className?: string // applied to trigger button
}
```

**Visual spec:**

- Trigger: `p-1.5 rounded-md text-[#707070] hover:text-white hover:bg-[#2a2a2a] transition-colors`
- Icon: `MoreVertical` from lucide-react
- Dropdown: `w-48 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl py-1 z-50`
- Backdrop: `fixed inset-0 z-40` (transparent, click to dismiss)
- Item default: `flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors`
- Item danger: same but `text-red-400 hover:text-red-300`
- Item disabled: `opacity-40 cursor-not-allowed pointer-events-none`
- Divider: `border-t border-[#2a2a2a] my-1`
- Positioning: `absolute right-0 top-full mt-1` (align=right) or `absolute left-0 top-full mt-1` (align=left)

**Behaviour:**

- Opens on trigger click, closes on backdrop click or Escape key
- Stops propagation on trigger click (prevents row selection)
- Items with `onClick` auto-close the menu

**Migration target:** `SongsPage` (×2), `SetlistsPage`, `ShowsPage`, `PracticesPage`, `BandMembersPage` (×2), `SongListItem`

---

### 3. EmptyState

**File:** `src/components/common/EmptyState.tsx`

**Purpose:** Unified empty-state panel replacing 9+ inline implementations.

**Component API:**

```tsx
interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: React.ComponentType<{ size?: number }>
  variant?: 'primary' | 'secondary' // default: 'primary' (orange)
  'data-testid'?: string
}

interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  size?: 'sm' | 'md' | 'lg' // controls padding and icon size
  className?: string
}
```

**Visual spec:**

- Container: `flex flex-col items-center justify-center text-center`
- `sm`: `py-8 gap-2`, icon 24px
- `md`: `py-12 gap-3`, icon 32px (default)
- `lg`: `py-16 gap-3`, icon 40px
- Icon: `text-[#404040]` (opacity equivalent ~25%)
- Title: `text-[#a0a0a0] text-sm font-medium`
- Description: `text-[#606060] text-xs` (max-w-xs, optional)
- Primary action button: `mt-2 px-4 py-2 rounded-lg bg-[#f17827ff]/10 text-[#f17827ff] hover:bg-[#f17827ff]/20 text-sm font-medium transition-colors flex items-center gap-1.5`
- Secondary action: ghost style, smaller

**Migration target:** All empty states in `SongsPage`, `SetlistsPage`, `ShowsPage`, `PracticesPage`, `JamSessionPage`, `BrowseSongsDrawer`

---

### 4. TabSwitcher

**File:** `src/components/common/TabSwitcher.tsx`

**Purpose:** Pill-container tab switcher replacing 2 existing implementations and standardising the active color (currently SongsPage uses one shade, JamSessionPage uses two different shades on the same page).

**Component API:**

```tsx
interface TabItem<T extends string = string> {
  value: T
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  badge?: number // shows a count pill
  badgeAnimate?: boolean // pulsing icon when true (for "computing" state)
}

interface TabSwitcherProps<T extends string = string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md' // default: 'md'
  className?: string
}
```

**Visual spec:**

- Container: `flex gap-1 bg-[#1a1a1a] rounded-lg p-1`
- Inactive tab: `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#a0a0a0] hover:text-white transition-colors`
- Active tab: same + `bg-[#f17827ff] text-white` (single brand color, no more amber vs orange split)
- Badge: `ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs`
- Animated icon: applies `animate-pulse` class when `badgeAnimate` is true on the active tab

**Notes:**

- Generic typed — `TabSwitcher<'common' | 'queue' | 'setlist'>` for the jam page
- Replaces both `SongsPage` Band/Personal tabs and `JamSessionPage` Common/Queue tabs
- The jam page will gain a third "Setlist" tab

---

### 5. QueueSongRow

**File:** `src/components/common/QueueSongRow.tsx`

**Purpose:** A lightweight, reorderable song row for the jam setlist builder. Intentionally lighter than `SongListItem` (no session notes, no castings, no practice links). Supports drag-to-reorder via dnd-kit.

**Component API:**

```tsx
interface QueueSongRowProps {
  song: { id: string; title: string; artist?: string }
  position: number // 1-based display number
  isDragging?: boolean
  showDragHandle?: boolean // default true
  actions?: KebabMenuItem[] // passed to KebabMenu
  badge?: React.ReactNode // optional right-side badge (e.g. "2 know this")
  onClick?: () => void
  'data-testid'?: string
  className?: string
}
```

**Visual spec:**

- Container: `flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] group`
- Drag handle: `GripVertical` size 14, `text-[#404040] group-hover:text-[#707070] cursor-grab active:cursor-grabbing`
- Position: `text-[#707070] text-xs w-5 text-right tabular-nums`
- `<SongAvatar size="sm" title={song.title} artist={song.artist} />`
- Song info: `flex-1 min-w-0` — title `text-white text-sm font-medium truncate`, artist `text-[#707070] text-xs truncate`
- Badge slot: `flex-shrink-0` (for "2 know this" participant count etc.)
- `<KebabMenu items={actions} triggerSize="sm" />` (only if actions provided)
- Drag state: `opacity-50 ring-1 ring-[#f17827ff]/50`

**Sortable wrapper:** Also export `SortableQueueSongRow` that wraps with `@dnd-kit/sortable` using `useSortable` hook (same pattern as `SortableSongListItem`).

---

### 6. SearchBar (rewrite)

**File:** `src/components/common/SearchBar.tsx` (replace existing)

**Purpose:** The existing `SearchBar` uses a light theme and is unused. Rewrite to dark theme so pages can stop rolling their own search inputs.

**Component API (same as current, different styles):**

```tsx
interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  showClearButton?: boolean
  autoFocus?: boolean
  loading?: boolean
  className?: string
  'data-testid'?: string
}
```

**Visual spec (dark theme):**

- Container: `relative`
- `Search` icon: `absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]` size 16
- Input: `w-full h-9 pl-9 pr-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:outline-none focus:border-[#f17827ff] transition-colors`
- Clear button: `absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707070] hover:text-white`
- Loading: replace Search icon with `Loader2` + `animate-spin`

---

### 7. StatusBadge

**File:** `src/components/common/StatusBadge.tsx`

**Purpose:** Read-only status pill. Consolidates `ShowStatusBadge` (component), `getStatusBadge()` (PracticesPage), and inline status spans (SetlistsPage).

**Component API:**

```tsx
type StatusVariant =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'draft'
  | 'upcoming'
  | 'scheduled'
  | 'in-progress'
  | 'archived'
  | 'confirmed'
  | 'tentative'

interface StatusBadgeProps {
  status: StatusVariant | string // string fallback for custom statuses
  size?: 'xs' | 'sm' // default: 'sm'
  className?: string
}
```

**Visual spec:** `px-2 py-0.5 rounded-full text-xs font-medium` with color mappings:

- `active` / `confirmed` / `in-progress` → `bg-green-500/20 text-green-400`
- `upcoming` / `scheduled` / `draft` → `bg-blue-500/20 text-blue-400`
- `completed` → `bg-[#a0a0a0]/20 text-[#a0a0a0]`
- `cancelled` / `archived` → `bg-red-500/10 text-red-400`
- `tentative` → `bg-amber-500/20 text-amber-400`
- fallback → `bg-[#2a2a2a] text-[#a0a0a0]`

---

### 8. DarkCard

**File:** `src/components/common/DarkCard.tsx`

**Purpose:** Eliminate 25+ hardcoded `bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]` strings.

**Component API:**

```tsx
interface DarkCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg' // none / p-3 / p-5 / p-6
  hover?: boolean // adds hover:bg-[#202020] transition
  onClick?: () => void
  'data-testid'?: string
}
```

**Note:** Also export `DARK_CARD_CLASSES` as a string constant so it can be spread with `cn()` in places where a wrapper div would add unwanted nesting.

---

### 9. Modal

**File:** `src/components/common/Modal.tsx`

**Purpose:** Standard modal shell. Eliminates 10+ bare `fixed inset-0 bg-black/60` implementations. `ConfirmDialog` should be reimplemented on top of `Modal`.

**Component API:**

```tsx
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' // max-w: 384 / 448 / 512 / 640px
  children: React.ReactNode
  footer?: React.ReactNode // optional sticky footer slot
  'data-testid'?: string
  closeOnBackdrop?: boolean // default true
}
```

**Visual spec:**

- Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4`
- Card: `bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-h-[90vh] flex flex-col`
- Header (if title): `flex items-center justify-between px-5 pt-5 pb-0` + `X` close button
- Body: `flex-1 overflow-y-auto custom-scrollbar px-5 py-5`
- Footer (if provided): `border-t border-[#2a2a2a] px-5 py-4 flex justify-end gap-2`
- Animation: `transition-all duration-200` scale-in from 95%

**Migration target:** Replace custom modals in `BandMembersPage` (5 modals), `ShowsPage`, `PracticesPage`, `SetlistsPage`. Also reimplement `ConfirmDialog` on top of this.

---

### 10. SectionHeader

**File:** `src/components/common/SectionHeader.tsx`

**Purpose:** Lightweight section label. Very simple, low priority — extract when touching other files.

**Component API:**

```tsx
interface SectionHeaderProps {
  label: string
  actions?: React.ReactNode // right-side slot for buttons
  divider?: boolean // adds border-t above (default false)
  className?: string
}
```

**Visual spec:**

- `flex items-center justify-between`
- Label: `text-[#a0a0a0] text-xs font-medium uppercase tracking-wide`
- Divider: `border-t border-[#2a2a2a] pt-4 mt-2` when enabled

---

### 11. NextEventCard

**File:** `src/components/common/NextEventCard.tsx`

**Purpose:** The amber-gradient highlight card showing the next upcoming show/practice. Used identically in `ShowsPage` and `PracticesPage`.

**Component API:**

```tsx
interface NextEventMeta {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  color?: string // icon color, default amber
}

interface NextEventCardProps {
  entityType: 'show' | 'practice'
  title: string
  subtitle?: string
  status: string
  meta: NextEventMeta[] // displayed in a 2-col grid
  onClick?: () => void
  'data-testid'?: string
}
```

---

## Policy Violations to Fix During Migration

When touching the following files, also fix these violations (from `CLAUDE.md`):

| File                                            | Violation                                       |
| ----------------------------------------------- | ----------------------------------------------- |
| `src/components/common/EditableHeader.tsx`      | `window.confirm` on nav-away                    |
| `src/components/casting/CastingComparison.tsx`  | `window.confirm`                                |
| `src/components/casting/SetlistCastingView.tsx` | `window.confirm`                                |
| `src/components/casting/SongCastingEditor.tsx`  | `window.confirm`                                |
| `src/pages/SetlistsPage.tsx` line 952           | `prompt()` for section title                    |
| `src/pages/BandMembersPage.tsx`                 | Custom confirm modals → use `ConfirmDialog`     |
| `src/pages/ShowsPage.tsx`                       | `DeleteConfirmationModal` → use `ConfirmDialog` |
| `src/pages/PracticesPage.tsx`                   | `DeleteConfirmModal` → use `ConfirmDialog`      |

---

## Stale Specs to Update

| Spec                                     | What to update                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `2025-10-22T14:01_design-style-guide.md` | Primary accent from `#3b82f6` (blue) → `#f17827ff` (orange). Add `TabSwitcher`, `KebabMenu`, `EmptyState` component docs. |
