# Rock-On Design Implementation Instructions

## Overview
These instructions guide the implementation of the Rock-On design system across the application. Follow these guidelines to ensure consistent branding, accessibility, and user experience.

## Setup Instructions

### 1. Update Tailwind Configuration
Update your `tailwind.config.js` with the Rock-On design tokens:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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

        // Semantic Aliases for easier usage
        primary: '#FE4401',
        secondary: '#FFD400',
        danger: '#D7263D',
        background: '#121212',
        surface: '#F5F5F5',
        text: '#2E2E2E',
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
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
```

### 2. Create Base CSS File
Create `src/styles/globals.css` with essential styles:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base styles */
@layer base {
  html {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  body {
    @apply bg-stage-black text-steel-gray;
  }

  /* Focus outline for accessibility */
  *:focus-visible {
    @apply outline-none ring-2 ring-energy-orange ring-offset-2;
  }
}

/* Component styles */
@layer components {
  /* Button Components */
  .btn-primary {
    @apply bg-energy-orange text-white font-bold py-3 px-4 rounded-component
           hover:bg-energy-orange/90 focus:outline-none focus:ring-2
           focus:ring-energy-orange focus:ring-offset-2 transition-colors duration-150;
    min-height: 44px;
  }

  .btn-secondary {
    @apply border-2 border-steel-gray text-steel-gray font-medium py-3 px-4
           rounded-component hover:bg-steel-gray hover:text-white
           focus:outline-none focus:ring-2 focus:ring-steel-gray
           focus:ring-offset-2 transition-all duration-150;
    min-height: 44px;
  }

  .btn-danger {
    @apply bg-amp-red text-white font-bold py-3 px-4 rounded-component
           hover:bg-amp-red/90 focus:outline-none focus:ring-2
           focus:ring-amp-red focus:ring-offset-2 transition-colors duration-150;
    min-height: 44px;
  }

  /* Card Components */
  .card {
    @apply bg-smoke-white border border-steel-gray/10 rounded-card p-5 shadow-card;
  }

  .card-elevated {
    @apply bg-smoke-white border border-steel-gray/10 rounded-card p-5 shadow-elevated;
  }

  /* Form Components */
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

  /* Navigation Components */
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
}

/* Utility classes */
@layer utilities {
  .container-responsive {
    @apply mx-auto px-2 md:px-4 lg:px-6;
    max-width: calc(100% - 8px);
  }

  @media (min-width: 768px) {
    .container-responsive {
      max-width: calc(100% - 32px);
    }
  }

  @media (min-width: 1024px) {
    .container-responsive {
      max-width: 1200px;
    }
  }

  @media (min-width: 1440px) {
    .container-responsive {
      max-width: 1400px;
    }
  }

  .transition-fast {
    @apply transition-all duration-150 ease-out;
  }

  .transition-medium {
    @apply transition-all duration-250 ease-out;
  }

  .transition-slow {
    @apply transition-all duration-400 ease-out;
  }
}
```

## Implementation Guidelines

### 1. Component Development

#### When Creating New Components:
1. **Follow the mobile-first approach**: Start with mobile styles, then add tablet and desktop breakpoints
2. **Use semantic color names**: Use `primary`, `secondary`, `danger` instead of specific color values
3. **Implement proper focus states**: All interactive elements must have visible focus indicators
4. **Ensure minimum touch targets**: 44px × 44px for mobile interactions
5. **Add proper ARIA labels**: Every interactive element needs accessible labels

#### Component Template:
```tsx
interface ComponentProps {
  children: React.ReactNode;
  className?: string;
  // ... other props
}

export const Component: React.FC<ComponentProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`component-base-classes ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
```

### 2. Layout Implementation

#### Page Layout Structure:
```tsx
export const PageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-stage-black">
      <Navbar />
      <main className="container-responsive py-6">
        {children}
      </main>
    </div>
  );
};
```

#### Content Container:
```tsx
export const ContentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="bg-smoke-white rounded-card p-6 shadow-card">
      {children}
    </div>
  );
};
```

### 3. Typography Usage

#### Heading Hierarchy:
```tsx
// Page titles
<h1 className="text-h1 text-steel-gray mb-6">Dashboard</h1>

// Section headings
<h2 className="text-h2 text-steel-gray mb-4">My Setlists</h2>

// Subsection headings
<h3 className="text-h3 text-steel-gray mb-3">Practice Sessions</h3>

// Component titles
<h4 className="text-h4 text-steel-gray mb-2">Song Details</h4>

// Body text
<p className="text-body text-steel-gray">Description text here...</p>

// Small text
<span className="text-body-sm text-steel-gray/70">Last updated 5 minutes ago</span>
```

### 4. Color Usage Guidelines

#### Primary Actions:
```tsx
// Primary CTA buttons
<button className="btn-primary">Start Practice</button>

// Active navigation states
<a className="nav-link-active">Dashboard</a>

// Progress indicators
<div className="bg-energy-orange h-2 rounded-full" style={{ width: '60%' }} />
```

#### Secondary Actions:
```tsx
// Secondary buttons
<button className="btn-secondary">Cancel</button>

// Caution states
<div className="bg-electric-yellow/20 border border-electric-yellow text-steel-gray p-3 rounded-component">
  Warning message
</div>
```

#### Error States:
```tsx
// Error messages
<span className="text-amp-red text-body-sm">Invalid input</span>

// Danger buttons
<button className="btn-danger">Delete Setlist</button>
```

### 5. Mobile-First Navbar Implementation

#### Basic Navbar Structure:
```tsx
export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="container-responsive flex items-center justify-between h-full">
          {/* Logo and title */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="Rock On"
              className="w-8 h-8 md:w-9 md:h-9"
            />
            <span className="text-h4 md:text-h3 text-smoke-white">Rock On</span>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/setlists">Setlists</NavLink>
            <NavLink href="/practice">Practice</NavLink>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-smoke-white hover:text-energy-orange transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
};
```

#### Mobile Menu Component:
```tsx
interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-stage-black/80 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Menu drawer */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-smoke-white z-50
        transform transition-transform duration-250 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6">
          <button
            onClick={onClose}
            className="mb-8 p-2 hover:bg-steel-gray/10 rounded-component"
            aria-label="Close menu"
          >
            <CloseIcon className="w-6 h-6" />
          </button>

          <nav className="space-y-2">
            <MobileNavLink href="/dashboard" icon={<HomeIcon />}>
              Dashboard
            </MobileNavLink>
            <MobileNavLink href="/setlists" icon={<MusicIcon />}>
              Setlists
            </MobileNavLink>
            <MobileNavLink href="/practice" icon={<PlayIcon />}>
              Practice
            </MobileNavLink>
          </nav>
        </div>
      </div>
    </>
  );
};
```

### 6. Form Implementation

#### Input Component:
```tsx
interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  required = false,
}) => {
  return (
    <div className="space-y-1">
      <label className="form-label">
        {label} {required && <span className="text-amp-red">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`form-input ${error ? 'border-amp-red focus:border-amp-red' : ''}`}
        required={required}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};
```

### 7. Responsive Breakpoints

#### Use these patterns for responsive design:
```tsx
// Component that adapts to screen size
<div className="
  grid grid-cols-1 gap-4
  md:grid-cols-2 md:gap-6
  lg:grid-cols-3 lg:gap-8
">
  {/* Content */}
</div>

// Text that scales with screen size
<h1 className="text-h2 md:text-h1 lg:text-display">
  Page Title
</h1>

// Spacing that increases with screen size
<div className="p-4 md:p-6 lg:p-8">
  {/* Content */}
</div>
```

### 8. Accessibility Checklist

#### For Every Component:
- [ ] Proper semantic HTML elements
- [ ] ARIA labels for screen readers
- [ ] Keyboard navigation support
- [ ] Focus indicators visible
- [ ] Color contrast ratios met (4.5:1 minimum)
- [ ] Touch targets 44px minimum
- [ ] Error messages associated with form fields

#### Testing Commands:
```bash
# Run accessibility tests
npm run test -- --testNamePattern="accessibility"

# Check color contrast
# Use browser dev tools or online contrast checkers

# Test keyboard navigation
# Tab through entire interface without mouse
```

### 9. Performance Guidelines

#### Optimize Images:
```tsx
// Use appropriate image formats and sizes
<img
  src="/logo.webp"
  alt="Rock On Logo"
  className="w-8 h-8"
  loading="lazy"
/>
```

#### Lazy Load Components:
```tsx
import { lazy, Suspense } from 'react';

const SetlistBuilder = lazy(() => import('./SetlistBuilder'));

// In component
<Suspense fallback={<div>Loading...</div>}>
  <SetlistBuilder />
</Suspense>
```

### 10. Development Workflow

#### Before Implementing Any UI:
1. Review the design specification (`.claude/design-specification.md`)
2. Check component guidelines (`.claude/component-guidelines.md`)
3. Use mobile-first approach
4. Test on multiple screen sizes
5. Verify accessibility with keyboard navigation
6. Run linting and type checking

#### Code Review Checklist:
- [ ] Uses design system colors and typography
- [ ] Follows mobile-first responsive design
- [ ] Includes proper accessibility attributes
- [ ] Has appropriate focus states
- [ ] Meets minimum touch target sizes
- [ ] Uses semantic HTML elements
- [ ] Handles loading and error states
- [ ] Optimized for performance

## Quick Reference

### Color Classes:
- `bg-energy-orange` / `text-energy-orange` - Primary actions
- `bg-stage-black` / `text-stage-black` - Backgrounds
- `bg-electric-yellow` / `text-electric-yellow` - Warnings
- `bg-smoke-white` / `text-smoke-white` - Light surfaces
- `bg-amp-red` / `text-amp-red` - Errors/danger
- `bg-steel-gray` / `text-steel-gray` - Text/borders

### Typography Classes:
- `text-display` - Hero headings
- `text-h1` through `text-h4` - Heading levels
- `text-body-lg`, `text-body`, `text-body-sm` - Body text
- `text-caption` - Small text

### Component Classes:
- `btn-primary`, `btn-secondary`, `btn-danger` - Buttons
- `card`, `card-elevated` - Cards
- `form-input`, `form-label`, `form-error` - Forms
- `navbar`, `nav-link`, `nav-link-active` - Navigation

### Layout Classes:
- `container-responsive` - Responsive container
- `transition-fast/medium/slow` - Transitions