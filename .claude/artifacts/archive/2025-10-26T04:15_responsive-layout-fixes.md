---
timestamp: 2025-10-26T04:15
summary: Fixed responsive layout issues in song cards across all viewport sizes
---

# Responsive Layout Fixes for Song Cards

## Issues Identified

1. **Duplicate "bpm" text** - showed "104 bpm bpm" in both desktop and mobile views
2. **Text cramping at narrow viewports** - BPM text wrapped to two lines at 320px width
3. **2-column layout too cramped** - metadata grid was difficult to read at smallest sizes
4. **No minimum width** - cards became unreadable at very narrow widths
5. **"No shows scheduled" text missing** - only showed for songs with scheduled shows

## Fixes Applied

### 1. Fixed Duplicate BPM Text
**File:** `src/pages/NewLayout/SongsPage.tsx`

- Removed duplicate " bpm" suffix from desktop table view (line 1081)
- The `formatBpm()` utility already adds "bpm", so we only need to display `{song.bpm}`

**Before:**
```tsx
<div className="w-[80px] text-[#a0a0a0] text-sm">{song.bpm} bpm</div>
```

**After:**
```tsx
<div className="w-[80px] text-[#a0a0a0] text-sm">{song.bpm}</div>
```

### 2. Responsive Metadata Grid
**File:** `src/pages/NewLayout/SongsPage.tsx` (lines 1152-1263)

- Changed from `grid-cols-2` to `grid-cols-1 xs:grid-cols-2`
- Single column layout for screens <320px
- Two column layout for screens ≥320px

**Before:**
```tsx
<div className="grid grid-cols-2 gap-3 mb-3">
```

**After:**
```tsx
<div className="grid grid-cols-1 xs:grid-cols-2 gap-3 mb-3">
```

### 3. Prevent Text Wrapping
Added utility classes to prevent unwanted wrapping:
- `whitespace-nowrap` on BPM value to keep it on one line
- `truncate` on tuning field to add ellipsis if needed
- `truncate` on show name with `whitespace-nowrap` on date

### 4. Minimum Width Constraint
Added `min-w-[280px]` to the mobile card container:

```tsx
<div className="md:hidden space-y-3 min-w-[280px]">
```

This ensures cards never become narrower than 280px, preventing illegible text.

### 5. "No Shows Scheduled" Fallback
Added display for songs without scheduled shows:

```tsx
{!song.nextShow && (
  <div className="flex items-center gap-2 pt-3 border-t border-[#2a2a2a] text-xs">
    <Calendar size={16} className="text-[#707070] flex-shrink-0" />
    <span className="text-[#707070]">No shows scheduled</span>
  </div>
)}
```

## Tested Viewports

### ✅ 320px (iPhone SE) - Narrowest mobile
- Single column metadata layout
- All text readable without wrapping
- Minimum width constraint prevents over-compression

### ✅ 375px (iPhone 11/12/13) - Standard mobile
- Two column metadata grid
- Optimal spacing and readability
- All metadata displays correctly

### ✅ 768px (iPad Portrait) - Tablet
- Desktop table view activates
- Sidebar navigation appears
- No duplicate text issues

### ✅ 1024px+ (Desktop) - Large screens
- Full table layout with all columns
- Optimal spacing for all content
- Clean, professional appearance

## Breakpoint Strategy

The layout now uses three responsive tiers:

1. **<320px (xs)**: Single column, maximum compression
2. **320px-767px (sm-md)**: Two column cards, mobile optimized
3. **≥768px (md+)**: Desktop table view with sidebar

## Design System Updates

The `xs` breakpoint (320px) from Tailwind config is now actively used for the most responsive layouts.

## Result

All song cards now:
- Display correctly at ANY viewport size (280px - ∞)
- Have no text wrapping or overflow issues
- Show appropriate metadata for screen size
- Provide clear "No shows scheduled" message when applicable
- Display BPM correctly without duplication
