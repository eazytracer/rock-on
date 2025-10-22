---
timestamp: 2025-10-22T14:01
appended_time: 2025-10-22T14:15
summary: Design style guide for rock-on UI revamp based on modern dark-mode mockup featuring sidebar navigation and table-based song catalog
update: Added mobile drawer navigation specifications (hamburger menu with slide-out drawer pattern, similar to Slack)
---

# Rock-On Design Style Guide

## Overview
This style guide documents the visual design system for the rock-on application, featuring a modern, clean interface with sidebar navigation and table-based content views. The design prioritizes clarity, accessibility, and mobile-first responsive patterns.

## Color System

### Background Colors
- **Primary Background**: `#0a0a0a` - Main app background
- **Surface**: `#1a1a1a` - Cards, panels, elevated surfaces
- **Surface Hover**: `#252525` - Hover states for interactive surfaces
- **Sidebar Background**: `#141414` - Sidebar/navigation background

### Text Colors
- **Primary Text**: `#ffffff` - Headers, primary content
- **Secondary Text**: `#a0a0a0` - Subtext, labels, metadata
- **Tertiary Text**: `#707070` - Placeholder text, disabled states

### Accent Colors
- **Primary Accent**: `#3b82f6` - Links, primary actions, active states
- **Success**: `#10b981` - Positive actions, confirmations
- **Warning**: `#f59e0b` - Warnings, alerts
- **Error**: `#ef4444` - Errors, destructive actions

### Border & Divider
- **Border**: `#2a2a2a` - Subtle borders between elements
- **Border Focus**: `#3b82f6` - Focused input borders
- **Divider**: `#1f1f1f` - Section dividers

## Typography

### Font Family
- **Primary**: System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Monospace**: `"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace`

### Font Sizes
- **XS**: `0.75rem` (12px) - Metadata, timestamps
- **SM**: `0.875rem` (14px) - Secondary text, labels
- **Base**: `1rem` (16px) - Body text
- **LG**: `1.125rem` (18px) - Subheadings
- **XL**: `1.25rem` (20px) - Section headers
- **2XL**: `1.5rem` (24px) - Page titles
- **3XL**: `1.875rem` (30px) - Large headlines

### Font Weights
- **Normal**: `400`
- **Medium**: `500`
- **Semibold**: `600`
- **Bold**: `700`

## Spacing System
Based on 8px grid system:
- **0**: `0`
- **1**: `0.25rem` (4px)
- **2**: `0.5rem` (8px)
- **3**: `0.75rem` (12px)
- **4**: `1rem` (16px)
- **5**: `1.25rem` (20px)
- **6**: `1.5rem` (24px)
- **8**: `2rem` (32px)
- **10**: `2.5rem` (40px)
- **12**: `3rem` (48px)
- **16**: `4rem` (64px)

## Layout Components

### Sidebar Navigation

#### Desktop (≥768px)
- **Width**: `240px` (fixed)
- **Position**: Fixed left
- **Background**: `#141414`
- **Padding**: `24px 16px`
- **Z-index**: `50`

**Structure**:
```
┌─────────────────────┐
│  Brand Header       │ (Logo + Band/User info)
├─────────────────────┤
│  Navigation Items   │
│  - Home             │
│  - Practices        │
│  - Setlists         │
│  - Shows            │
│  - Songs            │
│  - Band Members     │
├─────────────────────┤
│  Spacer (flex-grow) │
├─────────────────────┤
│  Settings           │
│  Sign Out           │
└─────────────────────┘
```

**Navigation Item**:
- Height: `40px`
- Padding: `8px 12px`
- Border Radius: `8px`
- Gap between icon and text: `12px`
- Icon size: `20px`
- Font size: `14px` (SM)
- Font weight: `500` (Medium)

**States**:
- Default: `transparent` background, `#a0a0a0` text
- Hover: `#1f1f1f` background
- Active: `#252525` background, `#ffffff` text, `#3b82f6` icon tint

**Brand Header**:
- Logo/Icon: `40px × 40px`
- Band name: `16px` (Base), `600` (Semibold)
- User email: `12px` (XS), `#707070`
- Padding bottom: `24px`
- Border bottom: `1px solid #1f1f1f`

#### Mobile (<768px)
- Sidebar collapses into bottom navigation
- See "Bottom Navigation" section below

### Main Content Area

#### Desktop Layout
- **Margin Left**: `240px` (sidebar width)
- **Padding**: `24px`
- **Max Width**: `1400px` (optional, for very wide screens)

#### Mobile Layout
- **Margin Left**: `0`
- **Padding**: `16px`
- **Padding Bottom**: `80px` (to accommodate bottom nav)

### Page Header

**Structure**:
- Page Title + Optional Dropdown
- Action Buttons (Filter, Search, Add)

**Page Title**:
- Font size: `24px` (2XL)
- Font weight: `700` (Bold)
- Margin bottom: `24px`
- Color: `#ffffff`

**Action Bar**:
- Display: `flex`
- Justify: `space-between`
- Align: `center`
- Gap: `12px`
- Margin bottom: `24px`
- Flex wrap on mobile

**Buttons**:
- Height: `40px`
- Padding: `8px 16px`
- Border radius: `8px`
- Font size: `14px`
- Font weight: `500`

### Table/List View (Songs Catalog)

#### Desktop Table
**Container**:
- Background: `transparent`
- Border radius: `12px`
- Overflow: Hidden

**Header Row**:
- Background: `transparent`
- Padding: `12px 16px`
- Border bottom: `1px solid #2a2a2a`
- Font size: `12px` (XS)
- Font weight: `600` (Semibold)
- Color: `#707070`
- Text transform: `uppercase`
- Letter spacing: `0.05em`

**Header Cells**:
- Display icon above or beside label
- Icon size: `20px`
- Icon color: `#707070`
- Gap: `8px`

**Data Row**:
- Background: `#1a1a1a`
- Padding: `16px`
- Margin bottom: `8px`
- Border radius: `12px`
- Transition: `background 0.2s ease`

**Data Row Hover**:
- Background: `#252525`
- Cursor: `pointer`

**Cell Spacing**:
- Gap between cells: `16px`

**Column Widths** (suggested):
- Song Info: `flex-1` (min-width: 200px)
- Duration: `100px`
- Key: `80px`
- Tuning: `140px`
- BPM: `100px`
- Next Show: `180px`

#### Song Info Cell
- **Avatar**: `40px × 40px` circle
- **Avatar Background**: Generate color from song/artist name
- **Avatar Text**: Initials, `14px`, `600`, centered
- **Song Name**: `14px`, `600`, `#ffffff`
- **Artist Name**: `12px`, `400`, `#a0a0a0`
- Gap: `12px`

#### Mobile Cards
On screens <768px, table converts to stacked cards:

**Card Structure**:
- Background: `#1a1a1a`
- Padding: `16px`
- Border radius: `12px`
- Margin bottom: `12px`
- Border: `1px solid #2a2a2a`

**Card Layout**:
```
┌─────────────────────────────┐
│ Avatar | Song Name           │
│        | Artist Name         │
├─────────────────────────────┤
│ Icon Duration | Icon Key    │
│ Icon Tuning   | Icon BPM    │
├─────────────────────────────┤
│ Next Show: Date/Venue       │
└─────────────────────────────┘
```

- Song info at top (full width)
- Metadata in 2-column grid below
- Next show as full-width row at bottom

### Mobile Header

**Container**:
- Position: `fixed`
- Top: `0`
- Width: `100%`
- Height: `64px`
- Background: `#141414`
- Border bottom: `1px solid #1f1f1f`
- Z-index: `30`
- Padding: `0 16px`
- Display: `flex`
- Align items: `center`

**Hamburger Menu Button**:
- Width: `40px`
- Height: `40px`
- Border radius: `8px`
- Icon size: `24px`
- Color: `#ffffff`
- Hover background: `#1f1f1f`
- Margin right: `12px`

**Brand Display**:
- Logo: `32px × 32px` rounded square
- Band name: `16px` (Base), `600` (Semibold)
- Gap: `12px`

### Mobile Drawer Navigation

**Backdrop**:
- Position: `fixed`
- Full screen overlay
- Background: `rgba(0, 0, 0, 0.6)` (60% black)
- Backdrop filter: `blur(4px)`
- Z-index: `40`
- Click to dismiss

**Drawer Container**:
- Position: `fixed`
- Left: `0`, Top: `0`
- Width: `280px`
- Height: `100vh`
- Z-index: `50`
- Slide animation from left

**Animation**:
- Duration: `300ms`
- Easing: `ease-in-out`
- Transform: `translateX(-100%)` (closed) → `translateX(0)` (open)
- Backdrop opacity: `0` (closed) → `1` (open)

**Close Button**:
- Position: `absolute`
- Top right corner: `16px` from edges
- Size: `40px × 40px`
- Border radius: `8px`
- Background: `#1f1f1f`
- Icon: `20px` X icon
- Color: `#a0a0a0`
- Hover: `#252525` background, `#ffffff` color

**Content**:
- Uses same Sidebar component as desktop
- All navigation items work the same
- Drawer auto-closes on navigation
- Body scroll locked when open
- Escape key closes drawer

**Interaction**:
- Tap backdrop to close
- Tap X button to close
- Tap any nav item to navigate and close
- Swipe left to close (optional enhancement)

### Bottom Navigation (Mobile - Alternative)

**Note**: The primary mobile navigation pattern is the drawer (hamburger menu). Bottom navigation is an alternative pattern that can be used instead of or in addition to the drawer.

### Bottom Navigation (Mobile)

**Container**:
- Position: `fixed`
- Bottom: `0`
- Width: `100%`
- Height: `64px`
- Background: `#141414`
- Border top: `1px solid #2a2a2a`
- Z-index: `100`
- Backdrop blur (if supported)

**Items**:
- Display: `flex`
- Justify: `space-around`
- Each item: Centered column layout

**Navigation Item**:
- Icon: `24px`
- Label: `10px`, `500`
- Gap: `4px`
- Min width: `60px`
- Text align: `center`

**States**:
- Default: `#707070` (icon and text)
- Active: `#3b82f6` (icon), `#ffffff` (text)
- Tap target: Min `44px × 44px`

## Component Patterns

### Avatar (Initials)
**Purpose**: Visual identifier for songs, users, bands

**Sizes**:
- **SM**: `32px`
- **MD**: `40px` (default)
- **LG**: `56px`
- **XL**: `80px`

**Styling**:
- Border radius: `50%`
- Background: Generate from name hash
- Text: White, centered
- Font weight: `600`

**Background Colors** (rotate through):
1. `#3b82f6` (blue)
2. `#8b5cf6` (purple)
3. `#ec4899` (pink)
4. `#f59e0b` (amber)
5. `#10b981` (green)
6. `#06b6d4` (cyan)

### Icon Buttons
- Size: `40px × 40px`
- Icon size: `20px`
- Border radius: `8px`
- Background hover: `#1f1f1f`
- Transition: `0.2s ease`

### Text Buttons
- Padding: `8px 16px`
- Border radius: `8px`
- Font size: `14px`
- Font weight: `500`
- Min height: `40px`

**Variants**:
- **Primary**: `#3b82f6` background, white text
- **Secondary**: `#252525` background, white text
- **Outline**: `transparent` background, `#3b82f6` border, `#3b82f6` text
- **Ghost**: `transparent` background, white text

### Input Fields
- Height: `40px`
- Padding: `8px 12px`
- Border radius: `8px`
- Border: `1px solid #2a2a2a`
- Background: `#1a1a1a`
- Font size: `14px`
- Color: `#ffffff`

**Focus State**:
- Border: `1px solid #3b82f6`
- Outline: `2px solid rgba(59, 130, 246, 0.2)`
- Outline offset: `2px`

**Placeholder**:
- Color: `#707070`

### Dropdown/Select
Same styling as input fields, with:
- Chevron icon: `16px`, right-aligned
- Padding right: `36px` (to accommodate icon)

### Search Bar
- Input with search icon prefix
- Icon: `20px`, `#707070`
- Icon position: Left, `12px` from edge
- Input padding left: `40px`

### Filter Button
- Icon + text
- Border: `1px solid #2a2a2a`
- Background: `transparent`
- Hover background: `#1f1f1f`

### Badge/Count
- Small circular or rounded rectangle
- Background: `#3b82f6`
- Color: `#ffffff`
- Padding: `2px 8px`
- Font size: `12px`
- Font weight: `600`
- Border radius: `12px` (pill shape)
- Position: Absolute or inline depending on context

Example: "Band Members (6)" - the "6" can be a badge

## Icons

### Icon Library
Recommend: **Lucide Icons** or **Heroicons**
- Consistent stroke width: `2px`
- Size variants: `16px`, `20px`, `24px`
- Default color: Inherit from parent

### Common Icons Mapping
- **Home**: `home` or `house`
- **Practices**: `calendar` or `calendar-check`
- **Setlists**: `list` or `list-music`
- **Shows**: `music` or `ticket`
- **Songs**: `disc` or `music-note`
- **Band Members**: `users` or `user-group`
- **Settings**: `settings` or `cog`
- **Sign Out**: `log-out` or `exit`
- **Duration**: `clock`
- **Key**: `music` or `key-signature`
- **Tuning**: `guitar` or `sliders`
- **BPM**: `metronome` or `activity`
- **Next Show**: `calendar`
- **Search**: `search`
- **Filter**: `filter` or `sliders-horizontal`
- **Add**: `plus`

## Responsive Breakpoints

```
sm: 640px   // Small tablets
md: 768px   // Tablets, sidebar appears
lg: 1024px  // Small laptops
xl: 1280px  // Laptops
2xl: 1536px // Large screens
```

### Key Breakpoints for Layout
- **< 768px**: Mobile layout (bottom nav, stacked cards)
- **≥ 768px**: Desktop layout (sidebar nav, table view)
- **≥ 1024px**: Enhanced spacing, larger content area
- **≥ 1400px**: Optional max-width constraint

## Animation & Transitions

### Default Transitions
- **Duration**: `200ms`
- **Easing**: `ease` or `cubic-bezier(0.4, 0, 0.2, 1)`

### Transition Properties
- Background color
- Border color
- Transform (for micro-interactions)
- Opacity

### Hover Effects
- Subtle background color change
- No dramatic movements
- Instant feedback (<100ms)

### Page Transitions
- Fade in: `opacity 0 → 1` over `300ms`
- Slide up: `translateY(10px) → 0` over `300ms`

## Accessibility

### Focus States
- Visible focus ring: `2px solid #3b82f6`
- Focus ring offset: `2px`
- Never remove focus indicators

### Color Contrast
- Ensure WCAG AA compliance (4.5:1 for normal text)
- Primary text on background: >10:1 ratio
- Secondary text on background: >7:1 ratio

### Interactive Elements
- Minimum tap target: `44px × 44px`
- Clear hover states
- Keyboard navigable
- ARIA labels for icon-only buttons

### Text Sizing
- Base font size: `16px` (never smaller for body text)
- Support user font scaling (use `rem` units)

## Mobile-First Patterns

### Thumb Zones
- Critical actions in bottom third of screen
- Bottom navigation for primary navigation
- Floating action buttons in bottom right

### Touch Targets
- Minimum: `44px × 44px`
- Adequate spacing between targets: `8px`

### Gestures
- Swipe to delete (optional)
- Pull to refresh (optional)
- Tap to expand cards

### Content Priority
- Most important information first
- Progressive disclosure
- Collapsible sections for detailed data

## Example Implementations

### Song Card (Mobile)
```tsx
<div className="bg-surface rounded-xl p-4 mb-3 border border-border">
  <div className="flex items-center gap-3 mb-3">
    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
      AS
    </div>
    <div className="flex-1">
      <div className="text-white font-semibold text-sm">All Star</div>
      <div className="text-secondary text-xs">Smash Mouth</div>
    </div>
  </div>

  <div className="grid grid-cols-2 gap-3 mb-3">
    <div className="flex items-center gap-2 text-secondary text-xs">
      <ClockIcon className="w-4 h-4" />
      <span>3:14</span>
    </div>
    <div className="flex items-center gap-2 text-secondary text-xs">
      <MusicIcon className="w-4 h-4" />
      <span>F#</span>
    </div>
    <div className="flex items-center gap-2 text-secondary text-xs">
      <GuitarIcon className="w-4 h-4" />
      <span>Standard</span>
    </div>
    <div className="flex items-center gap-2 text-secondary text-xs">
      <ActivityIcon className="w-4 h-4" />
      <span>104bpm</span>
    </div>
  </div>

  <div className="flex items-center gap-2 text-xs pt-3 border-t border-border">
    <CalendarIcon className="w-4 h-4 text-secondary" />
    <span className="text-white">Toys 4 Tots</span>
    <span className="text-secondary">Dec 8th, 2025</span>
  </div>
</div>
```

### Song Row (Desktop Table)
```tsx
<div className="bg-surface rounded-xl p-4 mb-2 hover:bg-surface-hover transition-colors cursor-pointer">
  <div className="flex items-center gap-4">
    {/* Song Info */}
    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
        AS
      </div>
      <div>
        <div className="text-white font-semibold text-sm">All Star</div>
        <div className="text-secondary text-xs">Smash Mouth</div>
      </div>
    </div>

    {/* Duration */}
    <div className="w-[100px] text-secondary text-sm">3:14</div>

    {/* Key */}
    <div className="w-[80px] text-secondary text-sm">F#</div>

    {/* Tuning */}
    <div className="w-[140px] text-secondary text-sm">Standard</div>

    {/* BPM */}
    <div className="w-[100px] text-secondary text-sm">104bpm</div>

    {/* Next Show */}
    <div className="w-[180px]">
      <div className="text-white text-sm">Toys 4 Tots</div>
      <div className="text-secondary text-xs">Dec 8th, 2025</div>
    </div>
  </div>
</div>
```

## Implementation Notes

### Tailwind Configuration
Add custom colors to `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      background: '#0a0a0a',
      surface: '#1a1a1a',
      'surface-hover': '#252525',
      sidebar: '#141414',
      border: '#2a2a2a',
      primary: '#3b82f6',
      secondary: '#a0a0a0',
      tertiary: '#707070',
    }
  }
}
```

### CSS Variables
For theme flexibility:
```css
:root {
  --color-background: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-surface-hover: #252525;
  --color-sidebar: #141414;
  --color-border: #2a2a2a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0a0a0;
  --color-text-tertiary: #707070;
  --color-primary: #3b82f6;
}
```

### Dark Mode Toggle
While the primary design is dark, support for light mode:
- Use CSS variables
- Toggle `data-theme` attribute on `<html>`
- Provide theme context/hook

## Future Considerations

### Potential Enhancements
- Skeleton loading states
- Toast notifications system
- Modal/dialog patterns
- Contextual menus
- Drag-and-drop interactions
- Empty states
- Error states
- Loading states within components

### Performance
- Lazy load images
- Virtual scrolling for long lists (>100 items)
- Debounce search inputs
- Optimize re-renders with React.memo

### Progressive Enhancement
- Works without JavaScript (where possible)
- Graceful degradation
- Offline support (future)
