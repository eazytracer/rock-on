# Bug Report: Mobile Sidebar Cannot Scroll

**Created:** 2025-12-05T20:58
**Status:** Open
**Priority:** Medium
**Category:** UI / Mobile UX

---

## Summary

When opening the hamburger menu sidebar on mobile (or small viewport), the sidebar content cannot be scrolled. If menu items like "Sign Out" are below the visible area, users cannot access them without closing the sidebar, scrolling the page, and reopening.

---

## Steps to Reproduce

1. Open the app on a mobile device or resize browser to a small viewport
2. Open the hamburger menu (sidebar)
3. If the menu has enough items that "Sign Out" is below the fold, attempt to scroll within the sidebar
4. **Result:** Sidebar does not scroll; content below viewport is inaccessible

---

## Expected Behavior

- Sidebar should be independently scrollable when content exceeds viewport height
- All menu items should be accessible without closing/reopening the sidebar
- Main page scroll should be locked while sidebar is open (current behavior is correct)

---

## Current Behavior

- Sidebar appears to have `overflow: hidden` or no scroll container
- Touch/scroll gestures do not scroll sidebar content
- Users must close sidebar, scroll main page, reopen to access lower items

---

## Technical Investigation Needed

### Files to Check

1. `src/components/layout/ModernLayout.tsx` - Main layout with sidebar
2. `src/components/common/Sidebar.tsx` or similar - Sidebar component
3. CSS/Tailwind classes on sidebar container

### Likely Fix

Add scrolling to sidebar container:

```tsx
// Sidebar container needs:
<div className="overflow-y-auto max-h-screen">{/* sidebar content */}</div>
```

Or with Tailwind:

```tsx
<aside className="fixed inset-y-0 left-0 w-64 overflow-y-auto">
```

---

## Acceptance Criteria

- [ ] Sidebar content scrolls independently on mobile/small viewports
- [ ] All menu items (including Sign Out) are accessible
- [ ] Main page does not scroll while sidebar is open
- [ ] Scroll behavior works on both touch (mobile) and mouse (desktop)

---

## Related

- Mobile-first responsive design
- Accessibility - all navigation items must be reachable
