# Mobile-First Navbar Specification

## Overview
The Rock-On navbar follows a mobile-first approach with a clean, accessible design that scales beautifully across all device sizes.

## Mobile Design (320px - 767px)

### Structure
```
┌─────────────────────────────────────┐
│ [Logo] [App Title]         [Menu ☰] │ 64px height
└─────────────────────────────────────┘
```

### Components
- **Logo**: 32px × 32px, positioned left with 16px margin
- **App Title**: "Rock On" in H4 typography, Steel Gray color
- **Hamburger Menu**: 24px icon, positioned right with 16px margin
- **Background**: Stage Black with 95% opacity, backdrop blur
- **Border**: Bottom border, Steel Gray at 20% opacity

### Mobile Menu Drawer
```
┌─────────────────────────────────────┐
│ [×]                                 │
│                                     │
│ 🏠 Dashboard                        │
│                                     │
│ 🎵 Setlists                         │
│                                     │
│ 🎸 Practice                         │
│                                     │
│ ⚙️  Settings                        │
│                                     │
│ 👤 Profile                          │
│                                     │
└─────────────────────────────────────┘
```

### Mobile Menu Features
- **Slide Animation**: Slides in from right, 250ms transition
- **Overlay**: Stage Black at 80% opacity with backdrop blur
- **Close Button**: 24px × icon, top-right, 16px margins
- **Menu Items**: 56px height, full width, left-aligned
- **Icons**: 24px, Energy Orange when active, Steel Gray when inactive
- **Typography**: Body text, Steel Gray, medium weight
- **Active State**: Energy Orange text and icon, Steel Gray background at 10%

## Tablet Design (768px - 1023px)

### Structure
```
┌───────────────────────────────────────────────────────────┐
│ [Logo] [App Title]    [Nav Links]            [Profile] │ 72px height
└───────────────────────────────────────────────────────────┘
```

### Components
- **Logo**: 36px × 36px, positioned left with 24px margin
- **App Title**: "Rock On" in H3 typography
- **Navigation Links**: Horizontal list, centered
- **Profile Menu**: Avatar/icon, positioned right with 24px margin
- **Height**: Increased to 72px for better touch targets

### Navigation Links
- **Spacing**: 32px between items
- **Typography**: Body text, medium weight
- **Active State**: Energy Orange color, 2px bottom border
- **Hover State**: Energy Orange color, 150ms transition

## Desktop Design (1024px+)

### Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo] [App Title]      [Nav Links]              [Search] [Profile] │ 72px height
└─────────────────────────────────────────────────────────────────────┘
```

### Additional Components
- **Search Bar**: 320px width, positioned right of nav links
- **Enhanced Profile**: Dropdown menu with avatar and name
- **Logo**: Can scale up to 40px × 40px if desired

## Component States

### Default State
```css
background: rgba(18, 18, 18, 0.95);
backdrop-filter: blur(8px);
border-bottom: 1px solid rgba(46, 46, 46, 0.2);
```

### Scroll State (when page scrolled)
```css
background: rgba(18, 18, 18, 0.98);
backdrop-filter: blur(12px);
box-shadow: 0 2px 8px rgba(18, 18, 18, 0.2);
```

## Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logo → Nav Links → Search → Profile → Mobile Menu
- **Focus States**: 2px Energy Orange outline with 2px offset
- **Skip Link**: "Skip to main content" for screen readers

### Screen Reader Support
- **ARIA Labels**: All interactive elements properly labeled
- **Menu State**: aria-expanded for mobile menu
- **Current Page**: aria-current="page" for active nav item

### Touch Targets
- **Minimum Size**: 44px × 44px for all interactive elements
- **Spacing**: 8px minimum between touch targets

## Animation Specifications

### Mobile Menu Transitions
```css
/* Slide In */
transform: translateX(100%);
transition: transform 250ms cubic-bezier(0.4, 0.0, 0.2, 1);

/* Active State */
transform: translateX(0);
```

### Navigation Link Hover
```css
color: #2E2E2E;
transition: color 150ms ease-out;

/* Hover */
color: #FE4401;
```

### Scroll Detection
```css
/* Default */
background: rgba(18, 18, 18, 0.95);
transition: all 250ms ease-out;

/* Scrolled */
background: rgba(18, 18, 18, 0.98);
box-shadow: 0 2px 8px rgba(18, 18, 18, 0.2);
```

## React Component Structure

### Navbar Component
```tsx
<nav className="navbar">
  <div className="navbar-container">
    <NavbarBrand />
    <NavbarNav />
    <NavbarActions />
    <MobileMenuToggle />
  </div>
  <MobileMenu />
</nav>
```

### Props Interface
```tsx
interface NavbarProps {
  currentPath?: string;
  user?: User;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  showSearch?: boolean;
}
```

## Implementation Checklist

### Mobile Menu
- [ ] Hamburger icon with proper animation
- [ ] Slide-in drawer from right
- [ ] Overlay with backdrop blur
- [ ] Close button functionality
- [ ] Touch-friendly menu items
- [ ] Active state indicators

### Responsive Behavior
- [ ] Mobile-first CSS approach
- [ ] Proper breakpoint handling
- [ ] Touch target optimization
- [ ] Keyboard navigation support

### Accessibility
- [ ] ARIA labels and states
- [ ] Focus management
- [ ] Screen reader announcements
- [ ] Skip navigation link

### Performance
- [ ] Backdrop filter browser support
- [ ] Animation performance optimization
- [ ] Lazy loading considerations

## Brand Integration

### Logo Usage
- **Primary**: Full color logo on Stage Black background
- **Minimum Size**: 24px × 24px
- **Clear Space**: 8px minimum around logo
- **Accessibility**: Alt text: "Rock On - Music Practice App"

### Color Application
- **Background**: Stage Black primary, Smoke White for light themes
- **Text**: Steel Gray primary, Energy Orange for active states
- **Accents**: Electric Yellow for notifications, Amp Red for alerts