# Rock-On Design Specification

## Brand Identity

### Logo
- **Primary Mark**: Rock-on hand gesture with bold typography
- **Style**: Minimalist, modern, music-focused
- **Usage**: Clean geometric forms with strong visual impact
- **File**: `.claude/artifacts/ChatGPT Image Sep 27, 2025, 04_59_12 PM.png`

### Brand Personality
- **Energetic**: High-energy music application
- **Modern**: Clean, contemporary design language
- **Bold**: Strong visual presence and confident typography
- **Accessible**: Clear, readable interface design

## Color Palette

### Primary Colors
```css
--energy-orange: #FE4401;     /* Primary Accent - CTAs, highlights, active states */
--stage-black: #121212;       /* Background Dark - main backgrounds, headers */
--electric-yellow: #FFD400;   /* Secondary Accent - warnings, notifications */
--smoke-white: #F5F5F5;       /* Neutral Light - content backgrounds, cards */
--amp-red: #D7263D;           /* Highlight - errors, alerts, urgent actions */
--steel-gray: #2E2E2E;        /* Calm Contrast - text, borders, subtle elements */
```

### Color Usage Guidelines
- **Energy Orange (#FE4401)**: Primary CTAs, active navigation items, progress indicators
- **Stage Black (#121212)**: Main app background, header backgrounds, dark mode primary
- **Electric Yellow (#FFD400)**: Secondary buttons, caution states, highlights
- **Smoke White (#F5F5F5)**: Card backgrounds, content areas, light surfaces
- **Amp Red (#D7263D)**: Error states, delete actions, critical alerts
- **Steel Gray (#2E2E2E)**: Text, borders, inactive states, subtle UI elements

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Type Scale
- **Display**: 48px/52px - Hero headings, brand moments
- **H1**: 36px/40px - Page titles, major sections
- **H2**: 28px/32px - Section headings, card titles
- **H3**: 24px/28px - Subsection headings
- **H4**: 20px/24px - Component titles
- **Body Large**: 18px/24px - Important body text
- **Body**: 16px/22px - Default body text
- **Body Small**: 14px/20px - Secondary text, captions
- **Caption**: 12px/16px - Labels, metadata

### Font Weights
- **Bold (700)**: Headings, emphasis, CTAs
- **Medium (500)**: Subheadings, important UI text
- **Regular (400)**: Body text, general content

## Spacing System

### Base Unit: 4px
```css
--space-1: 4px;   /* 0.25rem */
--space-2: 8px;   /* 0.5rem */
--space-3: 12px;  /* 0.75rem */
--space-4: 16px;  /* 1rem */
--space-5: 20px;  /* 1.25rem */
--space-6: 24px;  /* 1.5rem */
--space-8: 32px;  /* 2rem */
--space-10: 40px; /* 2.5rem */
--space-12: 48px; /* 3rem */
--space-16: 64px; /* 4rem */
--space-20: 80px; /* 5rem */
```

## Layout Guidelines

### Grid System
- **Mobile**: 4px margins, 16px gutters
- **Tablet**: 16px margins, 24px gutters
- **Desktop**: 24px margins, 32px gutters

### Breakpoints
```css
--mobile: 320px;
--tablet: 768px;
--desktop: 1024px;
--wide: 1440px;
```

### Container Widths
- **Mobile**: 100% - 8px margins
- **Tablet**: 100% - 32px margins
- **Desktop**: 1200px max-width, centered
- **Wide**: 1400px max-width, centered

## Component Design Principles

### Buttons
- **Primary**: Energy Orange background, white text, bold weight
- **Secondary**: Steel Gray border, Steel Gray text, medium weight
- **Danger**: Amp Red background, white text, bold weight
- **Height**: 44px minimum for touch targets
- **Padding**: 16px horizontal, 12px vertical
- **Border Radius**: 8px

### Cards
- **Background**: Smoke White
- **Border**: 1px solid rgba(46, 46, 46, 0.1)
- **Border Radius**: 12px
- **Shadow**: 0 2px 8px rgba(18, 18, 18, 0.1)
- **Padding**: 20px

### Form Elements
- **Input Height**: 44px
- **Border**: 2px solid Steel Gray (20% opacity)
- **Focus Border**: Energy Orange
- **Border Radius**: 8px
- **Padding**: 12px 16px

### Navigation
- **Mobile-First**: Hamburger menu, slide-out drawer
- **Active State**: Energy Orange accent
- **Height**: 64px on mobile, 72px on desktop
- **Background**: Stage Black with 95% opacity

## Accessibility Standards

### Color Contrast
- **AA Standard**: 4.5:1 for normal text, 3:1 for large text
- **AAA Standard**: 7:1 for normal text, 4.5:1 for large text
- All primary color combinations meet AA standards

### Touch Targets
- **Minimum Size**: 44px × 44px
- **Recommended**: 48px × 48px for primary actions

### Focus States
- **Outline**: 2px solid Energy Orange
- **Offset**: 2px from element
- **Visible**: All interactive elements must have clear focus states

## Motion & Animation

### Timing
- **Fast**: 150ms - Micro-interactions, hover states
- **Medium**: 250ms - Component transitions, state changes
- **Slow**: 400ms - Page transitions, complex animations

### Easing
- **Standard**: cubic-bezier(0.4, 0.0, 0.2, 1)
- **Decelerate**: cubic-bezier(0.0, 0.0, 0.2, 1)
- **Accelerate**: cubic-bezier(0.4, 0.0, 1, 1)

### Principles
- **Purposeful**: Animations should guide user attention
- **Subtle**: Enhance UX without being distracting
- **Performant**: Use transform and opacity for smooth animations