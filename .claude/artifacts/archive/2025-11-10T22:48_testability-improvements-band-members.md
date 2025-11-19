---
created: 2025-11-10T22:48
type: technical-specification
status: draft
priority: high
related-tests: tests/e2e/auth/join-band.spec.ts
---

# Testability Improvements: Band Members Page

## Summary

E2E tests for the join-band flow are failing because critical UI elements lack proper test identifiers (`data-testid`, `id`, and `name` attributes). Per CLAUDE.md testability standards, all interactive elements and key data display fields must have these attributes.

## Problem

The join-band e2e test cannot reliably locate the invite code element because it lacks proper identifiers. The test currently relies on complex fallback strategies (pattern matching, text content parsing), which is fragile and violates our testability standards.

## CLAUDE.md Testability Standards Reference

From CLAUDE.md:

```
**Form Inputs (`<input>`, `<textarea>`, `<select>`):**
- `name` attribute - For form functionality
- `id` attribute - For label association (`<label htmlFor="id">`)
- `data-testid` attribute - For E2E testing

**Buttons and Interactive Elements:**
- `data-testid` attribute - For E2E testing

**Example:**
```tsx
<InputField
  label="Email"
  name="email"                    // Form functionality
  id="login-email"                // Label association
  data-testid="login-email-input" // E2E testing
  type="email"
  value={email}
  onChange={setEmail}
/>

<Button
  type="submit"
  data-testid="login-submit-button"
>
  Log In
</Button>
```

**Naming Conventions:**
- `id`: kebab-case (`login-email`, `band-name`)
- `name`: camelCase (`email`, `bandName`)
- `data-testid`: `{context}-{field}-{type}` (`login-email-input`, `create-band-button`)
```

## Required Changes

### File: `src/pages/NewLayout/BandMembersPage.tsx`

#### 1. Invite Code Display (Line 592)

**Current Code:**
```tsx
<div className="text-white text-2xl font-mono font-bold">{activeInviteCode}</div>
```

**Updated Code:**
```tsx
<div
  className="text-white text-2xl font-mono font-bold"
  data-testid="invite-code"
  id="band-invite-code"
>
  {activeInviteCode}
</div>
```

#### 2. Search Input (Line 626-632)

**Current Code:**
```tsx
<input
  type="text"
  placeholder="Search members..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
/>
```

**Updated Code:**
```tsx
<input
  type="text"
  name="memberSearch"
  id="member-search-input"
  data-testid="member-search-input"
  placeholder="Search members..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
/>
```

#### 3. Member Rows (Line 656-683)

**Current Code:**
```tsx
<div
  key={member.userId}
  className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl hover:bg-[#252525] transition-colors"
>
```

**Updated Code:**
```tsx
<div
  key={member.userId}
  data-testid={`member-row-${member.email}`}
  className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl hover:bg-[#252525] transition-colors"
>
```

#### 4. Member Role Badge (Lines 680-682)

Add `data-testid` to the role badge container:

```tsx
<div className="w-[140px]" data-testid="member-role">
  {getRoleBadge(member.role)}
</div>
```

#### 5. Action Buttons

**Copy Button (Line 595-601):**
```tsx
<button
  onClick={handleCopyInviteCode}
  data-testid="copy-invite-code-button"
  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
>
  <Copy size={16} />
  <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
</button>
```

**Regenerate Button (Line 611-618):**
```tsx
<button
  onClick={() => setShowRegenerateCodeDialog(true)}
  data-testid="regenerate-invite-code-button"
  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-[#a0a0a0] text-sm font-medium hover:bg-[#1f1f1f] hover:text-white transition-colors"
>
  <RefreshCw size={16} />
  <span>Regenerate</span>
</button>
```

**Edit Band Info Button (Line 549-560):**
```tsx
<button
  onClick={() => {
    setEditBandName(band.name)
    setEditBandDescription(band.description || '')
    setShowEditBandModal(true)
  }}
  data-testid="edit-band-info-button"
  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
>
  <Edit size={16} />
  <span>Edit Band Info</span>
</button>
```

#### 6. Edit Band Modal Inputs (Lines 863-887)

**Band Name Input:**
```tsx
<input
  type="text"
  name="bandName"
  id="edit-band-name"
  data-testid="edit-band-name-input"
  value={editBandName}
  onChange={(e) => setEditBandName(e.target.value)}
  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
  autoFocus
/>
```

**Band Description Textarea:**
```tsx
<textarea
  name="bandDescription"
  id="edit-band-description"
  data-testid="edit-band-description-input"
  value={editBandDescription}
  onChange={(e) => setEditBandDescription(e.target.value)}
  rows={3}
  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20 resize-none"
  placeholder="Tell us about your band..."
/>
```

**Save Changes Button:**
```tsx
<button
  onClick={handleSaveBandInfo}
  data-testid="save-band-info-button"
  disabled={!editBandName.trim()}
  className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Save Changes
</button>
```

#### 7. Mobile Member Cards (Line 791-844)

Add `data-testid` to mobile view member rows as well:

```tsx
<div
  key={member.userId}
  data-testid={`member-row-${member.email}`}
  className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]"
>
```

## Benefits

1. **Stable E2E Tests**: Tests can reliably find elements without fragile pattern matching
2. **Better Accessibility**: `id` attributes improve screen reader support and form functionality
3. **Developer Experience**: Clear, semantic identifiers make debugging easier
4. **Browser Features**: Proper `name` and `id` attributes enable autofill and password managers
5. **Compliance**: Meets CLAUDE.md testability standards

## Implementation Notes

1. **Consistency**: Use the naming convention `{context}-{field}-{type}` for all `data-testid` values
2. **User Emails**: For member rows, use email as the unique identifier since userId is not visible
3. **Modal Elements**: All modal inputs and buttons must have identifiers
4. **Mobile Parity**: Ensure mobile and desktop versions have the same test IDs

## Testing Impact

After these changes, the `getInviteCodeViaUI()` fixture can be simplified to:

```typescript
export async function getInviteCodeViaUI(page: Page): Promise<string> {
  // Navigate to band members if needed
  const currentUrl = page.url();
  if (!currentUrl.includes('/band-members')) {
    await page.goto('/band-members');
    await page.waitForLoadState('networkidle');
  }

  // Simply locate by data-testid
  const inviteCodeElement = page.locator('[data-testid="invite-code"]');
  await expect(inviteCodeElement).toBeVisible();
  const inviteCode = await inviteCodeElement.textContent();

  if (!inviteCode || inviteCode.trim().length === 0) {
    throw new Error('Invite code not found');
  }

  return inviteCode.trim();
}
```

## Affected Tests

- `tests/e2e/auth/join-band.spec.ts` - Join band via invite code flow
- Future tests for:
  - Band member management
  - Role changes
  - Member search/filtering
  - Band info editing

## Priority

**HIGH** - Blocking e2e test implementation for Phase 2.2 (Join Band via Invite Code)

## Recommendation

I recommend using the `nextjs-react-developer` agent to apply these changes, as it specializes in React/Next.js component modifications with proper testability attributes.

## Related Files

- `src/pages/NewLayout/BandMembersPage.tsx` - Primary file requiring changes
- `tests/fixtures/bands.ts` - Can be simplified after changes
- `tests/e2e/auth/join-band.spec.ts` - Will pass after changes
- `.claude/specifications/2025-10-22T14:01_design-style-guide.md` - Testability standards reference
