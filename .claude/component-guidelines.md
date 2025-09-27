# UI Component Guidelines

## Core Components

### 1. Buttons

#### Primary Button
```tsx
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}
```

**Usage:**
- Main CTAs, form submissions, primary actions
- Energy Orange background, white text
- Bold font weight, 44px minimum height

**Variants:**
- `sm`: 36px height, 12px padding
- `md`: 44px height, 16px padding (default)
- `lg`: 52px height, 20px padding

#### Secondary Button
```tsx
interface SecondaryButtonProps extends PrimaryButtonProps {
  variant?: 'outline' | 'ghost';
}
```

**Usage:**
- Secondary actions, cancel buttons, navigation
- Steel Gray border and text
- Medium font weight

#### Icon Button
```tsx
interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  ariaLabel: string;
}
```

**Usage:**
- Navigation, toolbars, compact interfaces
- 44px × 44px minimum touch target
- Proper ARIA labels required

### 2. Cards

#### Basic Card
```tsx
interface CardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  elevation?: 'low' | 'medium' | 'high';
  interactive?: boolean;
}
```

**Design:**
- Smoke White background
- 12px border radius
- Subtle shadow (card or elevated)
- 20px default padding

#### Content Card
```tsx
interface ContentCardProps extends CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  media?: React.ReactNode;
}
```

**Usage:**
- Song cards, practice sessions, setlist items
- Structured content with optional media
- Action buttons in footer

### 3. Forms

#### Input Field
```tsx
interface InputProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}
```

**Design:**
- 44px height, Steel Gray border (20% opacity)
- Focus state: Energy Orange border
- Error state: Amp Red border and text

#### Select Dropdown
```tsx
interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  placeholder?: string;
}
```

#### Checkbox & Radio
```tsx
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
```

**Design:**
- 20px × 20px touch target
- Energy Orange when checked
- Clear focus states

### 4. Navigation

#### Tab Navigation
```tsx
interface TabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}
```

**Design:**
- Bottom border navigation style
- Active tab: Energy Orange border and text
- 44px minimum height for touch

#### Breadcrumbs
```tsx
interface BreadcrumbsProps {
  items: Array<{ label: string; href?: string }>;
  separator?: React.ReactNode;
}
```

### 5. Feedback Components

#### Alert/Notification
```tsx
interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}
```

**Color Mapping:**
- Info: Steel Gray
- Success: Energy Orange
- Warning: Electric Yellow
- Error: Amp Red

#### Loading Spinner
```tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary';
}
```

#### Progress Bar
```tsx
interface ProgressProps {
  value: number; // 0-100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

### 6. Layout Components

#### Container
```tsx
interface ContainerProps {
  children: React.ReactNode;
  size?: 'mobile' | 'tablet' | 'desktop' | 'wide' | 'responsive';
  padding?: boolean;
}
```

#### Grid
```tsx
interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
}
```

#### Stack
```tsx
interface StackProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  spacing?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between';
}
```

### 7. Music-Specific Components

#### Song Card
```tsx
interface SongCardProps {
  song: {
    title: string;
    artist: string;
    duration?: string;
    key?: string;
    tempo?: number;
  };
  onPlay?: () => void;
  onAddToSetlist?: () => void;
  onEdit?: () => void;
}
```

#### Practice Timer
```tsx
interface PracticeTimerProps {
  initialTime?: number; // seconds
  onComplete?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}
```

#### Chord Display
```tsx
interface ChordDisplayProps {
  chord: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'text' | 'diagram';
}
```

## Component Patterns

### Responsive Design
All components should follow mobile-first responsive principles:

```css
/* Mobile First */
.component {
  /* Mobile styles */
}

@media (min-width: 768px) {
  .component {
    /* Tablet styles */
  }
}

@media (min-width: 1024px) {
  .component {
    /* Desktop styles */
  }
}
```

### State Management
Components should handle these common states:

1. **Loading**: Skeleton screens, spinners, disabled states
2. **Error**: Error messages, retry actions
3. **Empty**: Empty states with helpful guidance
4. **Success**: Confirmation messages, positive feedback

### Animation Guidelines

#### Micro-interactions (150ms)
- Button hover states
- Input focus transitions
- Icon state changes

#### Component transitions (250ms)
- Modal open/close
- Dropdown expand/collapse
- Tab switching

#### Page transitions (400ms)
- Route changes
- Complex layout shifts

### Accessibility Requirements

#### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Logical tab order
- Visible focus indicators
- Skip links where appropriate

#### Screen Readers
- Semantic HTML elements
- Proper ARIA labels and roles
- Descriptive link text
- Form field associations

#### Color and Contrast
- Minimum 4.5:1 contrast ratio for normal text
- 3:1 for large text (18px+ or 14px+ bold)
- Information not conveyed by color alone

### Performance Guidelines

#### Component Optimization
- Lazy loading for non-critical components
- Memoization for expensive calculations
- Virtual scrolling for long lists
- Image optimization with proper sizing

#### Bundle Size
- Tree-shakeable component exports
- Minimal external dependencies
- Code splitting at route level

## File Organization

### Component Structure
```
src/components/
├── ui/                 # Base UI components
│   ├── Button/
│   ├── Card/
│   ├── Input/
│   └── index.ts
├── layout/            # Layout components
│   ├── Navbar/
│   ├── Sidebar/
│   └── Container/
├── music/             # Music-specific components
│   ├── SongCard/
│   ├── ChordDisplay/
│   └── PracticeTimer/
└── index.ts           # Main exports
```

### Component File Structure
```
Button/
├── Button.tsx         # Main component
├── Button.test.tsx    # Unit tests
├── Button.stories.tsx # Storybook stories
├── Button.module.css  # Component styles (if needed)
└── index.ts          # Export file
```

### Testing Requirements

#### Unit Tests
- Component rendering
- Props handling
- Event handlers
- Accessibility checks

#### Integration Tests
- Component interactions
- Form submissions
- Navigation flows

#### Visual Regression Tests
- Component appearance
- Responsive behavior
- State variations