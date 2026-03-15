# Bug Report: Mobile Sidebar Cannot Scroll

**Created:** 2025-12-05T20:58
**Status:** Open (confirmed 2026-03-15)
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

## Technical Investigation (2026-03-15)

### Root Cause Confirmed

`src/components/layout/Sidebar.tsx` line 79:

```tsx
<aside className="fixed left-0 top-0 h-screen w-60 bg-[#141414] border-r border-[#1f1f1f] flex flex-col p-6 z-50">
```

The `<aside>` uses `h-screen flex flex-col` but has no `overflow-y-auto`. The `MobileDrawer.tsx` renders this `<Sidebar>` component directly inside a `h-screen` div — content that exceeds viewport height is clipped.

### Fix Required

In `src/components/layout/Sidebar.tsx`, add `overflow-y-auto custom-scrollbar` to the aside element and ensure the nav section grows/scrolls while the bottom actions (settings/sign out) remain accessible:

```tsx
// Option A: Make entire sidebar scroll
<aside className="fixed left-0 top-0 h-screen w-60 bg-[#141414] border-r border-[#1f1f1f] flex flex-col p-6 z-50 overflow-y-auto custom-scrollbar">

// Option B: Scroll middle section, pin top/bottom
<aside className="fixed left-0 top-0 h-screen w-60 bg-[#141414] border-r border-[#1f1f1f] flex flex-col p-6 z-50">
  {/* Brand header - fixed */}
  <div>...</div>
  {/* Nav links - scrollable */}
  <nav className="flex-1 overflow-y-auto custom-scrollbar">...</nav>
  {/* Settings/Sign Out - fixed at bottom */}
  <div>...</div>
</aside>
```

Option B is preferred — it keeps Settings and Sign Out always visible at the bottom.

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
