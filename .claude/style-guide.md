# Rock-On Style Guide

## TailwindCSS Configuration

### Custom Color Palette
Add to your `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary Brand Colors
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
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '3.25rem', fontWeight: '700' }],
        'h1': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'h2': ['1.75rem', { lineHeight: '2rem', fontWeight: '700' }],
        'h3': ['1.5rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        'h4': ['1.25rem', { lineHeight: '1.5rem', fontWeight: '700' }],
        'body-lg': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.375rem', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },
      borderRadius: {
        'component': '0.5rem',
        'card': '0.75rem',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(18, 18, 18, 0.1)',
        'elevated': '0 4px 16px rgba(18, 18, 18, 0.15)',
      },
    },
  },
}
```

## Component Classes

### Button Styles
```css
/* Primary Button */
.btn-primary {
  @apply bg-energy-orange text-white font-bold py-3 px-4 rounded-component
         hover:bg-energy-orange/90 focus:outline-none focus:ring-2
         focus:ring-energy-orange focus:ring-offset-2 transition-colors duration-150;
  min-height: 44px;
}

/* Secondary Button */
.btn-secondary {
  @apply border-2 border-steel-gray text-steel-gray font-medium py-3 px-4
         rounded-component hover:bg-steel-gray hover:text-white
         focus:outline-none focus:ring-2 focus:ring-steel-gray
         focus:ring-offset-2 transition-all duration-150;
  min-height: 44px;
}

/* Danger Button */
.btn-danger {
  @apply bg-amp-red text-white font-bold py-3 px-4 rounded-component
         hover:bg-amp-red/90 focus:outline-none focus:ring-2
         focus:ring-amp-red focus:ring-offset-2 transition-colors duration-150;
  min-height: 44px;
}
```

### Card Styles
```css
.card {
  @apply bg-smoke-white border border-steel-gray/10 rounded-card p-5 shadow-card;
}

.card-elevated {
  @apply bg-smoke-white border border-steel-gray/10 rounded-card p-5 shadow-elevated;
}
```

### Form Styles
```css
.form-input {
  @apply w-full px-4 py-3 border-2 border-steel-gray/20 rounded-component
         focus:border-energy-orange focus:ring-0 focus:outline-none
         transition-colors duration-150;
  min-height: 44px;
}

.form-label {
  @apply block text-body-sm font-medium text-steel-gray mb-2;
}

.form-error {
  @apply text-amp-red text-body-sm mt-1;
}
```

### Navigation Styles
```css
.navbar {
  @apply bg-stage-black/95 backdrop-blur-sm border-b border-steel-gray/20;
  height: 64px;
}

@media (min-width: 768px) {
  .navbar {
    height: 72px;
  }
}

.nav-link {
  @apply text-smoke-white hover:text-energy-orange transition-colors duration-150;
}

.nav-link-active {
  @apply text-energy-orange font-medium;
}
```

## Typography Classes

### Heading Classes
```css
.text-display {
  @apply text-display text-steel-gray;
}

.text-h1 {
  @apply text-h1 text-steel-gray;
}

.text-h2 {
  @apply text-h2 text-steel-gray;
}

.text-h3 {
  @apply text-h3 text-steel-gray;
}

.text-h4 {
  @apply text-h4 text-steel-gray;
}
```

### Body Text Classes
```css
.text-body-lg {
  @apply text-body-lg text-steel-gray;
}

.text-body {
  @apply text-body text-steel-gray;
}

.text-body-sm {
  @apply text-body-sm text-steel-gray;
}

.text-caption {
  @apply text-caption text-steel-gray/70;
}
```

## Layout Classes

### Container Classes
```css
.container-mobile {
  @apply mx-auto px-2;
  max-width: calc(100% - 8px);
}

.container-tablet {
  @apply mx-auto px-4;
  max-width: calc(100% - 32px);
}

.container-desktop {
  @apply mx-auto px-6;
  max-width: 1200px;
}

.container-wide {
  @apply mx-auto px-6;
  max-width: 1400px;
}

/* Responsive container */
.container-responsive {
  @apply container-mobile md:container-tablet lg:container-desktop xl:container-wide;
}
```

### Grid Classes
```css
.grid-mobile {
  @apply grid gap-4;
}

.grid-tablet {
  @apply grid gap-6;
}

.grid-desktop {
  @apply grid gap-8;
}

/* Responsive grid */
.grid-responsive {
  @apply grid-mobile md:grid-tablet lg:grid-desktop;
}
```

## State Classes

### Interactive States
```css
.interactive {
  @apply transition-all duration-150 ease-out;
}

.hover-lift {
  @apply hover:transform hover:-translate-y-0.5 hover:shadow-elevated;
}

.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-energy-orange focus:ring-offset-2;
}
```

### Loading States
```css
.loading {
  @apply opacity-50 pointer-events-none;
}

.pulse-loading {
  @apply animate-pulse bg-steel-gray/20 rounded-component;
}
```

## Icon Guidelines

### Icon Sizes
- **Small**: 16px - Inline with text, form icons
- **Medium**: 24px - Navigation, buttons
- **Large**: 32px - Featured content, headers
- **XL**: 48px+ - Hero sections, empty states

### Icon Colors
- **Primary**: Energy Orange for active/interactive icons
- **Secondary**: Steel Gray for neutral icons
- **Muted**: Steel Gray at 50% opacity for disabled icons

## Animation Classes

### Transition Classes
```css
.transition-fast {
  @apply transition-all duration-150 ease-out;
}

.transition-medium {
  @apply transition-all duration-250 ease-out;
}

.transition-slow {
  @apply transition-all duration-400 ease-out;
}
```

### Motion Classes
```css
.slide-in {
  @apply transform translate-x-full opacity-0 transition-transform duration-250 ease-out;
}

.slide-in-active {
  @apply transform translate-x-0 opacity-100;
}

.fade-in {
  @apply opacity-0 transition-opacity duration-250 ease-out;
}

.fade-in-active {
  @apply opacity-100;
}
```

## Utility Classes

### Spacing Utilities
```css
.space-y-component > * + * {
  @apply mt-4;
}

.space-y-section > * + * {
  @apply mt-8;
}

.space-y-page > * + * {
  @apply mt-12;
}
```

### Background Utilities
```css
.bg-app {
  @apply bg-stage-black;
}

.bg-surface {
  @apply bg-smoke-white;
}

.bg-overlay {
  @apply bg-stage-black/80 backdrop-blur-sm;
}
```