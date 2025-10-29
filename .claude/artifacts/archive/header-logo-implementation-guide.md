# Header with Logo Implementation Guide

## Overview
This guide outlines the steps to add a header with the Rock-On logo and apply the energy-orange brand colors from the style guide. The implementation requires minimal changes and maintains the current mobile-first approach.

## Difficulty Assessment: **Easy to Medium**
- **Time Estimate**: 2-3 hours
- **Complexity**: Low - mostly styling updates and component creation
- **Risk Level**: Low - non-breaking visual changes

## Prerequisites
- Logo file: `/.claude/artifacts/rockon-logo.png` (already exists)
- Style guide: `/.claude/style-guide.md` (already exists)
- Current TailwindCSS setup (already configured)

## Implementation Steps

### Step 1: Update TailwindCSS Configuration
**File**: `tailwind.config.js`

**Action**: Replace the current custom colors with the style guide colors
```javascript
// Current colors to replace:
colors: {
  primary: {
    50: '#f0f9ff',
    500: '#3b82f6',  // Replace with energy-orange
    600: '#2563eb',  // Replace with darker orange
    700: '#1d4ed8',  // Replace with darker orange
    900: '#1e3a8a',  // Replace with stage-black
  },
  confidence: {
    // Keep existing confidence colors
  }
}

// Add new style guide colors:
colors: {
  // Brand Colors from Style Guide
  'energy-orange': '#FE4401',
  'stage-black': '#121212',
  'electric-yellow': '#FFD400',
  'smoke-white': '#F5F5F5',
  'amp-red': '#D7263D',
  'steel-gray': '#2E2E2E',

  // Semantic Aliases
  primary: '#FE4401',
  secondary: '#FFD400',
  danger: '#D7263D',
  background: '#121212',
  surface: '#F5F5F5',
  text: '#2E2E2E',

  // Keep existing confidence colors
  confidence: {
    1: '#ef4444',
    2: '#f97316',
    3: '#eab308',
    4: '#22c55e',
    5: '#10b981',
  }
}
```

### Step 2: Copy Logo to Public Directory
**Action**: Move the logo file to be accessible by the app
```bash
# Copy logo from artifacts to public directory
cp /.claude/artifacts/rockon-logo.png /workspaces/rock-on/public/rockon-logo.png
```

### Step 3: Create Header Component
**File**: `src/components/common/Header.tsx` (new file)

**Purpose**: Create a reusable header component with logo
```typescript
interface HeaderProps {
  title?: string
  showLogo?: boolean
  className?: string
  onLogoClick?: () => void
}

// Component features:
// - Logo image with fallback text
// - Optional title text
// - Click handler for logo navigation
// - Mobile-responsive sizing
// - Brand color theming
```

**Key styling classes to use**:
- Background: `bg-stage-black` or `bg-smoke-white`
- Logo sizing: Mobile `h-8`, Desktop `h-10`
- Text color: `text-energy-orange` for logo text
- Padding: `px-4 py-3` for mobile touch targets

### Step 4: Update App Layout
**File**: `src/App.tsx`

**Changes needed**:
1. Import the new Header component
2. Add header above the main content area
3. Adjust main content padding to account for fixed header

```typescript
// Current structure:
<div className="min-h-screen bg-gray-50 pb-20">
  <main className="relative">
    {/* Routes */}
  </main>
  <BottomNavigation />
</div>

// New structure:
<div className="min-h-screen bg-surface pb-20 pt-16"> {/* Add pt-16 */}
  <Header /> {/* Add header */}
  <main className="relative">
    {/* Routes */}
  </main>
  <BottomNavigation />
</div>
```

### Step 5: Update Base Styles
**File**: `src/index.css`

**Add new component classes**:
```css
@layer components {
  /* Header styles */
  .header {
    @apply fixed top-0 left-0 right-0 z-40 bg-stage-black/95 backdrop-blur-sm border-b border-steel-gray/20;
    height: 64px;
  }

  @media (min-width: 768px) {
    .header {
      height: 72px;
    }
  }

  /* Logo styles */
  .logo {
    @apply h-8 w-auto md:h-10;
  }

  /* Update existing touch targets with brand colors */
  .touch-target {
    @apply min-h-touch min-w-touch;
  }
}
```

### Step 6: Update Button Components
**File**: `src/components/common/TouchButton.tsx`

**Update primary button colors**:
```typescript
const variantClasses = {
  primary: [
    'bg-energy-orange text-white',  // Was: bg-primary-500
    'hover:bg-energy-orange/90',    // Was: hover:bg-primary-600
    'focus:ring-energy-orange'      // Was: focus:ring-primary-500
  ],
  secondary: [
    'border-steel-gray text-steel-gray',  // Update colors
    'hover:bg-steel-gray hover:text-smoke-white'
  ],
  danger: [
    'bg-amp-red text-white',        // Was: bg-red-500
    'hover:bg-amp-red/90',          // Was: hover:bg-red-600
    'focus:ring-amp-red'            // Was: focus:ring-red-500
  ]
}
```

### Step 7: Update Navigation Colors
**File**: `src/components/common/BottomNavigation.tsx`

**Update active/inactive states**:
```typescript
// Current classes to update:
const activeClasses = 'text-primary-600'    // → 'text-energy-orange'
const inactiveClasses = 'text-gray-500'     // → 'text-steel-gray'
const backgroundClasses = 'bg-white'        // → 'bg-smoke-white'
```

### Step 8: Update Page Backgrounds
**Files**: All page components and App.tsx

**Color replacements**:
- `bg-gray-50` → `bg-surface`
- `bg-white` → `bg-smoke-white`
- `text-gray-900` → `text-steel-gray`
- `text-blue-600` → `text-energy-orange`

### Step 9: Test Responsive Behavior
**Testing checklist**:
- [ ] Logo scales properly on mobile/desktop
- [ ] Header doesn't interfere with navigation
- [ ] Touch targets remain 44px minimum
- [ ] Colors are consistent across components
- [ ] Logo loads and displays correctly
- [ ] Header is sticky/fixed positioned

## File Structure After Implementation
```
src/
├── components/
│   ├── common/
│   │   ├── Header.tsx          # NEW - Logo header component
│   │   ├── TouchButton.tsx     # MODIFIED - Updated colors
│   │   └── BottomNavigation.tsx # MODIFIED - Updated colors
├── index.css                   # MODIFIED - Added header styles
├── App.tsx                     # MODIFIED - Added header, updated layout
└── tailwind.config.js          # MODIFIED - Added brand colors

public/
└── rockon-logo.png             # NEW - Logo file
```

## Expected Visual Changes

### Before:
- Blue primary colors throughout
- No header/logo branding
- Gray backgrounds
- Generic button styling

### After:
- Energy orange (#FE4401) primary colors
- Header with Rock-On logo
- Smoke white (#F5F5F5) backgrounds
- Brand-consistent styling throughout
- Steel gray (#2E2E2E) text colors

## Potential Issues & Solutions

### Issue: Logo file loading
**Solution**: Ensure logo is in public directory and referenced as `/rockon-logo.png`

### Issue: Header overlapping content
**Solution**: Add proper top padding/margin to main content area

### Issue: Mobile navigation spacing
**Solution**: Ensure header height + bottom nav height + content padding work together

### Issue: Brand colors too bold
**Solution**: Use opacity variants like `bg-energy-orange/90` for hover states

## Testing Strategy
1. **Desktop**: Test header logo sizing and navigation
2. **Mobile**: Verify touch targets and responsive logo
3. **Dark/Light modes**: Ensure contrast with new colors
4. **Color consistency**: Check all interactive elements use brand colors
5. **Performance**: Verify logo loads quickly and doesn't cause layout shift

## Rollback Plan
If issues arise, revert these files in order:
1. `tailwind.config.js` - Remove brand colors
2. `src/App.tsx` - Remove header and padding
3. `src/index.css` - Remove header styles
4. Delete `src/components/common/Header.tsx`
5. Revert button/navigation color changes