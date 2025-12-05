---
created: 2025-12-05T15:44
severity: medium
status: diagnosed
affected_feature: show-date-display
---

# Bug Report: Show Date Displays One Day Earlier Than Selected

## Summary

**Problem:** When a user selects a date (e.g., December 8th) in the show edit modal, the calendar widget/badge displays December 7th.

**Impact:** Users see incorrect dates for their shows, causing confusion about when shows are scheduled.

**Root Cause:** Timezone handling issue. When the date input value (e.g., "2025-12-08") is parsed with `new Date()`, JavaScript treats it as **UTC midnight**. For users west of UTC (all US timezones), this converts to the **previous day** in local time.

## Root Cause Analysis

### The Problem Flow

1. **User selects date:** December 8, 2025 in the date picker
2. **Form stores value:** `"2025-12-08"` (string from `<input type="date">`)
3. **On save, date is parsed:**
   ```typescript
   // ShowsPage.tsx:943
   const baseDate = new Date(formData.date)  // "2025-12-08"
   ```
4. **JavaScript parses as UTC:** `new Date("2025-12-08")` = December 8, 2025 at **00:00:00 UTC**
5. **User is in PST (UTC-8):** December 8 00:00 UTC = December **7**, 2025 at 16:00 PST
6. **Calendar badge displays local date:** Shows December 7 instead of December 8

### Code Evidence

**ShowsPage.tsx:242-248** - `formatDateBadge()`:
```typescript
const formatDateBadge = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = d.getDate()  // ← Uses local timezone, shows wrong day
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  return { month, day, weekday }
}
```

**ShowsPage.tsx:919-921** - Date initialization in modal:
```typescript
date: show?.scheduledDate
  ? new Date(show.scheduledDate).toISOString().split('T')[0]
  : '',
```
This uses `toISOString()` which converts to UTC, potentially shifting the date.

**ShowsPage.tsx:943-946** - Date parsing on save:
```typescript
const baseDate = new Date(formData.date)  // ← BUG: Parses as UTC
const scheduledDate = formData.time
  ? parseTime12Hour(formData.time, baseDate)
  : baseDate
```

### Why This Happens

JavaScript's `new Date("YYYY-MM-DD")` (ISO date format without time) is parsed as **UTC midnight**, not local midnight.

```javascript
// Example in PST (UTC-8):
new Date("2025-12-08")                    // Dec 7, 2025 16:00:00 PST (WRONG!)
new Date("2025-12-08T00:00:00")           // Dec 7, 2025 16:00:00 PST (still UTC)
new Date("2025-12-08T00:00:00.000Z")      // Dec 7, 2025 16:00:00 PST (explicit UTC)
new Date(2025, 11, 8)                     // Dec 8, 2025 00:00:00 PST (LOCAL - correct!)
```

## Affected Files

1. **`src/pages/ShowsPage.tsx`**
   - Line 919-921: `toISOString()` usage for date initialization
   - Line 943: `new Date(formData.date)` parsing
   - Line 242-248: `formatDateBadge()` display function

2. **`src/utils/dateHelpers.ts`**
   - Line 113: `formatDateForInput()` uses `toISOString()` which converts to UTC

3. **Potentially other pages:** `PracticesPage.tsx`, `SetlistsPage.tsx` may have similar issues

## Fix Actions

### Option 1: Parse Dates as Local Time (Recommended)

**File:** `src/utils/dateHelpers.ts`

**Add new helper function:**
```typescript
/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC
 * This is the correct way to handle dates from <input type="date">
 */
export function parseDateAsLocal(dateString: string): Date {
  if (!dateString) return new Date()

  // Split the date string and create date in local timezone
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)  // month is 0-indexed
}

/**
 * Parse a date string with optional time as local time
 */
export function parseDateTimeAsLocal(dateString: string, timeString?: string): Date {
  if (!dateString) return new Date()

  const [year, month, day] = dateString.split('-').map(Number)

  if (timeString) {
    // Use parseTime12Hour with the local date as base
    const localDate = new Date(year, month - 1, day)
    return parseTime12Hour(timeString, localDate)
  }

  return new Date(year, month - 1, day)
}

/**
 * Format a date for input fields (YYYY-MM-DD) using LOCAL time
 * Not UTC, so the date shown matches what the user selected
 */
export function formatDateForInputLocal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (!d || isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
```

### Option 2: Update ShowsPage.tsx to Use Local Time

**File:** `src/pages/ShowsPage.tsx`

**Change 1 - Line 919-921:**
```typescript
// BEFORE (buggy):
date: show?.scheduledDate
  ? new Date(show.scheduledDate).toISOString().split('T')[0]
  : '',

// AFTER (fixed):
date: show?.scheduledDate
  ? formatDateForInputLocal(show.scheduledDate)
  : '',
```

**Change 2 - Line 943:**
```typescript
// BEFORE (buggy):
const baseDate = new Date(formData.date)

// AFTER (fixed):
const baseDate = parseDateAsLocal(formData.date)
```

### Option 3: Use date-fns or Luxon Library

For more robust date handling, consider using a date library:

```typescript
import { parseISO, format } from 'date-fns'

// Parsing
const date = parseISO(formData.date + 'T00:00:00')

// Formatting for input
const dateStr = format(scheduledDate, 'yyyy-MM-dd')
```

## Test Gaps

### 1. Unit Tests for Date Parsing

**File:** `tests/unit/utils/dateHelpers.test.ts`

**Add tests:**
```typescript
describe('parseDateAsLocal', () => {
  it('should parse YYYY-MM-DD as local time, not UTC', () => {
    const result = parseDateAsLocal('2025-12-08')

    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(11)  // December (0-indexed)
    expect(result.getDate()).toBe(8)     // Should be 8, not 7
    expect(result.getHours()).toBe(0)    // Local midnight
  })

  it('should not shift date for users in any timezone', () => {
    // This test should pass regardless of system timezone
    const result = parseDateAsLocal('2025-01-15')
    expect(result.getDate()).toBe(15)
  })
})

describe('formatDateForInputLocal', () => {
  it('should format date using local timezone', () => {
    const date = new Date(2025, 11, 8, 20, 0, 0)  // Dec 8, 8:00 PM local
    const result = formatDateForInputLocal(date)
    expect(result).toBe('2025-12-08')
  })
})
```

### 2. E2E Tests for Show Date Handling

**File:** `tests/e2e/show-date-handling.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('show date should display correctly after creation', async ({ page }) => {
  // Navigate to shows page
  await page.goto('/shows')

  // Create a new show
  await page.click('[data-testid="create-show-button"]')

  // Fill in the form
  await page.fill('[data-testid="show-name-input"]', 'Test Show')
  await page.fill('[data-testid="show-date-input"]', '2025-12-08')
  await page.fill('[data-testid="show-time-input"]', '8:00 PM')

  // Save the show
  await page.click('[data-testid="save-show-button"]')

  // Verify the date badge shows December 8
  const dateBadge = page.locator('[data-testid="show-date-badge"]')
  await expect(dateBadge).toContainText('Dec')
  await expect(dateBadge).toContainText('8')  // Should be 8, not 7
})

test('show date should not change when editing', async ({ page }) => {
  // Navigate to existing show
  await page.goto('/shows')
  await page.click('[data-testid^="edit-show-"]')

  // Get the date from the input
  const dateInput = page.locator('[data-testid="show-date-input"]')
  const dateValue = await dateInput.inputValue()

  // Save without changes
  await page.click('[data-testid="save-show-button"]')

  // Verify date hasn't shifted
  await page.click('[data-testid^="edit-show-"]')
  const newDateValue = await dateInput.inputValue()
  expect(newDateValue).toBe(dateValue)
})
```

## Verification Steps

### 1. Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Create a show with date December 8, 2025
# 3. Verify the date badge shows "Dec 8" not "Dec 7"
# 4. Edit the show and verify the date input still shows 2025-12-08
# 5. Save and verify it still shows December 8
```

### 2. Console Debugging

Add temporary logging to verify:
```typescript
// In ShowsPage.tsx handleSubmit:
console.log('Date input value:', formData.date)
console.log('Parsed base date:', baseDate)
console.log('Parsed base date local:', baseDate.toLocaleDateString())
console.log('Parsed base date UTC:', baseDate.toUTCString())
console.log('Final scheduled date:', scheduledDate)
```

### 3. Timezone Testing

Test in different timezones:
```bash
# Run dev server with different timezones
TZ=America/Los_Angeles npm run dev  # PST (UTC-8)
TZ=America/New_York npm run dev     # EST (UTC-5)
TZ=Europe/London npm run dev        # GMT (UTC+0)
TZ=Asia/Tokyo npm run dev           # JST (UTC+9)
```

## Impact Assessment

### User Impact
- **Severity:** Medium
- **Affected Users:** Anyone west of UTC (most US users)
- **Symptoms:** Show dates appear one day earlier than selected
- **Data Integrity:** Actual stored date may be wrong (shifted by timezone offset)

### Code Impact
- **Files Changed:** 2 (dateHelpers.ts, ShowsPage.tsx)
- **Lines Changed:** ~30
- **Breaking Changes:** None (new helper functions, existing code updated)
- **Risk:** Low (isolated date handling change)

## Related Issues

- Similar issue may exist in `PracticesPage.tsx`
- May affect date display in other components using `toISOString()` or `new Date(dateString)`
- `mapShowFromSupabase` in RemoteRepository uses `new Date(row.scheduled_date)` which may have similar issues

## Prevention Recommendations

### 1. Create Date Handling Standard

Document in CLAUDE.md:
```markdown
## Date Handling Rules

1. **Never use** `new Date("YYYY-MM-DD")` - it parses as UTC
2. **Always use** `parseDateAsLocal()` for date input values
3. **Use** `formatDateForInputLocal()` for date input `value` props
4. **Store dates in database as TIMESTAMPTZ** with explicit timezone
5. **Test date handling in PST timezone** to catch off-by-one bugs
```

### 2. Add ESLint Rule (Optional)

Create custom ESLint rule to flag `new Date("string")` patterns:
```javascript
// eslint-plugin-local/no-date-string-constructor.js
module.exports = {
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.name === 'Date' &&
            node.arguments.length === 1 &&
            node.arguments[0].type === 'Literal' &&
            typeof node.arguments[0].value === 'string') {
          context.report({
            node,
            message: 'Avoid new Date(string). Use parseDateAsLocal() for date inputs.'
          })
        }
      }
    }
  }
}
```

## References

- MDN: [Date() constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
- Stack Overflow: [Why does Date parse "2020-01-01" as December 31, 2019?](https://stackoverflow.com/questions/7556591)
- Similar issue: [GitHub issue on date parsing](https://github.com/moment/moment/issues/1407)
