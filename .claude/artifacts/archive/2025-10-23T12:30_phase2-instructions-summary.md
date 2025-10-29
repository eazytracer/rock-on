---
timestamp: 2025-10-23T12:30
prompt: "Create Phase 2 database integration instructions with small numbered tasks, checkboxes, links to specs, and Chrome MCP validation requirements."
type: summary
status: complete
---

# Phase 2 Database Integration Instructions - Complete

## 📋 What Was Created

### New Instructions File
**Location:** `/workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md`

**Size:** 29KB with comprehensive step-by-step instructions

**Contents:**
- 23 detailed tasks with 100+ sub-task checkboxes
- Links to all specification files
- Links to all 6 original MVP page instruction files
- Chrome MCP tool validation requirements for every task
- Troubleshooting section
- Success metrics

---

## ✅ Original MVP Instruction Files Status

All original MVP instruction files are **still valid and up-to-date** for UI implementation:

| File | Size | Status | Purpose |
|------|------|--------|---------|
| `mvp-auth-pages.md` | 14KB | ✅ Valid | Auth UI user stories |
| `mvp-band-members-page.md` | 15KB | ✅ Valid | Band members UI user stories |
| `mvp-songs-page.md` | 13KB | ✅ Valid | Songs UI user stories |
| `mvp-setlists-page.md` | 14KB | ✅ Valid | Setlists UI user stories |
| `mvp-shows-page.md` | 13KB | ✅ Valid | Shows UI user stories |
| `mvp-practices-page.md` | 13KB | ✅ Valid | Practices UI user stories |

**Note:** These files describe the UI/UX requirements which are already implemented in Phase 1. Phase 2 instructions reference these files for feature context while adding database integration.

---

## 📂 Updated README

**File:** `/workspaces/rock-on/.claude/instructions/README.md`

**Updates Made:**
1. ✅ Added Phase 2 status banner at top
2. ✅ Added Phase 2 instructions as primary reference
3. ✅ Updated build order with phase completion status
4. ✅ Added UI/Database status to each page guide
5. ✅ Linked each page to its Phase 2 task numbers

---

## 🎯 Phase 2 Task Breakdown

### Setup & Preparation (Tasks 1-3)
**Tasks:** 3 main tasks, 16 checkboxes
- [ ] Database initialization with seed data
- [ ] Create utility functions (formatters, date helpers)
- [ ] Create database service hooks (useSongs, useSetlists, etc.)

### Sprint 1: Auth & Band Management (Tasks 4-5)
**Tasks:** 2 main tasks, 16 checkboxes
- [ ] Wire up Authentication Pages (sign up, login, get started)
- [ ] Wire up Band Members Page (load members, instruments, invite codes)

### Sprint 2: Songs & Setlists (Tasks 6-9)
**Tasks:** 4 main tasks, 32 checkboxes
- [ ] Songs Page - Data loading (load, search, filter, "next show")
- [ ] Songs Page - CRUD operations (create, update, delete)
- [ ] Setlists Page - Data loading (load items, breaks, sections)
- [ ] Setlists Page - CRUD operations (drag-drop, inline edit, associations)

### Sprint 3: Shows & Practices (Tasks 10-13)
**Tasks:** 4 main tasks, 28 checkboxes
- [ ] Shows Page - Data loading (load shows, metadata, setlist links)
- [ ] Shows Page - CRUD operations (create, edit, payment conversion)
- [ ] Practices Page - Data loading (load practices, song lists)
- [ ] Practices Page - CRUD & auto-suggest (create, auto-suggest from shows)

### Sprint 4: Integration & Polish (Tasks 14-18)
**Tasks:** 5 main tasks, 28 checkboxes
- [ ] Navigation & routing updates
- [ ] Context/state management (AuthContext, BandContext)
- [ ] Role-based permissions enforcement
- [ ] Error handling & loading states
- [ ] Data consistency & relationships (cascading deletes)

### Sprint 5: Testing & Validation (Tasks 19-23)
**Tasks:** 5 main tasks, 35+ checkboxes
- [ ] End-to-end user flows testing
- [ ] CRUD operations testing (all pages)
- [ ] Edge cases & error scenarios
- [ ] Performance & optimization
- [ ] Responsive design testing

**Total:** 23 tasks, 155+ checkboxes

---

## 🧪 Chrome MCP Tool Validation

### Every task includes validation steps using Chrome MCP:

**Example from Task 6.6 (Songs Page - Filter):**
```markdown
- [ ] 6.7. Implement filter by tuning, tags, show
- [ ] 6.8. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/songs
  - Verify 17 songs load from database
  - Search "Hotel" → verify filters to Hotel California
  - Filter by tuning "Standard" → verify correct songs show
```

**Instructions for agents:**
> "Test your changes using Chrome MCP tool after each task. Don't just check for errors, actually test the feature works. Mark task complete only after validation passes."

---

## 📚 Reference Links Included

### Specification Files:
- Database Schema (Version 5)
- Functional MVP Spec
- Schema Mapping Analysis
- Schema Implementation Summary
- Seed Data Script

### Original Page Instructions:
- Auth Pages (`mvp-auth-pages.md`)
- Band Members (`mvp-band-members-page.md`)
- Songs Page (`mvp-songs-page.md`)
- Setlists Page (`mvp-setlists-page.md`)
- Shows Page (`mvp-shows-page.md`)
- Practices Page (`mvp-practices-page.md`)

### Code References:
- Database service location
- Seed data script
- Type definitions
- Model interfaces

---

## 💡 Key Features of Instructions

### 1. Agent-Friendly Format
- Clear "Before You Start" section
- "As You Work" guidelines
- Testing protocol with examples
- Checkbox-driven progress tracking

### 2. Comprehensive Testing Protocol
```javascript
// Example test commands provided:
await db.songs.toArray()  // Verify load
await db.songs.add({ ... })  // Test create
await db.songs.update(id, { ... })  // Test update
await db.songs.delete(id)  // Test delete
```

### 3. Troubleshooting Section
Common issues with solutions:
- Database not found
- Data not showing
- Type mismatches
- Setlist items not displaying
- Shows not linking to setlists

### 4. Success Metrics
Clear definition of "done":
- All pages load real data
- Full user journey works end-to-end
- CRUD operations persist correctly
- No mock data remains
- Authentication and roles enforced
- Mobile experience polished
- No critical bugs

---

## 🔄 How Agents Should Use These Instructions

### Step 1: Read Phase 2 Instructions
Start at: `/workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md`

### Step 2: Reference Original Page Instructions
When working on a page, read the corresponding `mvp-*-page.md` file to understand UI requirements.

### Step 3: Follow Task Sequence
Complete tasks 1-23 in order, updating checkboxes as you go.

### Step 4: Validate with Chrome MCP
After each task, use Chrome MCP tool to:
1. Navigate to the page
2. Test the specific feature
3. Verify data loads from database
4. Test CRUD operations
5. Check console for errors

### Step 5: Update Checkboxes
Mark checkboxes complete only after validation passes.

---

## 📊 Current Status

### Phase 1: UI Implementation
**Status:** ✅ Complete
- All 6 MVP pages built with mock data
- All shared components created (TimePicker, DurationPicker)
- Design system implemented
- Responsive layouts complete

### Phase 2: Database Integration
**Status:** 🚧 Ready to Begin
- ✅ Version 5 schema implemented
- ✅ TypeScript interfaces updated
- ✅ Seed data script created
- ✅ Comprehensive instructions written
- 🚧 Tasks 1-23 pending (0/23 complete)

### Next Action
**Start with Task 1:** Database Initialization
- Import seed data function
- Clear existing database
- Verify seed loads successfully
- Validate in Chrome DevTools

---

## 🎯 Estimated Timeline

Based on task complexity:

| Sprint | Tasks | Estimated Time | Status |
|--------|-------|----------------|--------|
| Setup (1-3) | 3 tasks, 16 checkboxes | 4-6 hours | 🚧 Pending |
| Sprint 1 (4-5) | 2 tasks, 16 checkboxes | 6-8 hours | 🚧 Pending |
| Sprint 2 (6-9) | 4 tasks, 32 checkboxes | 12-16 hours | 🚧 Pending |
| Sprint 3 (10-13) | 4 tasks, 28 checkboxes | 10-12 hours | 🚧 Pending |
| Sprint 4 (14-18) | 5 tasks, 28 checkboxes | 8-10 hours | 🚧 Pending |
| Sprint 5 (19-23) | 5 tasks, 35+ checkboxes | 12-16 hours | 🚧 Pending |
| **Total** | **23 tasks, 155+ checkboxes** | **52-68 hours** | **0% Complete** |

**Estimated completion:** 2-3 weeks with focused development

---

## ✅ Completion Criteria

Phase 2 is complete when:
- [x] Instructions file created
- [x] Original instruction files verified as valid
- [x] README updated with phase status
- [ ] All 23 tasks completed
- [ ] All 155+ checkboxes marked
- [ ] All pages wire to database
- [ ] All Chrome MCP validations pass
- [ ] Full user journey works
- [ ] No mock data remains
- [ ] Ready for user testing

**Current Progress:** 3/10 (30%) - Instructions phase complete

---

## 📝 Files Modified/Created

### Created:
1. `/workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md` (29KB)
2. `/workspaces/rock-on/.claude/artifacts/2025-10-23T12:30_phase2-instructions-summary.md` (this file)

### Modified:
1. `/workspaces/rock-on/.claude/instructions/README.md`
   - Added Phase 2 status
   - Updated build order
   - Added task references
   - Updated page statuses

### Existing (Validated as Current):
1. All 6 MVP page instruction files (`mvp-*-page.md`)
2. Database schema documentation
3. Seed data script
4. Type definitions

---

## 🚀 Ready to Begin

**Everything is in place to start Phase 2 database integration:**

✅ Schema complete
✅ Instructions complete
✅ Seed data ready
✅ Dev server running
✅ All dependencies installed

**Next command to run:**
```bash
# Clear database and start fresh
# Run in browser console:
localStorage.clear()
indexedDB.deleteDatabase('RockOnDB')
location.reload()

# Then start Task 1
```

**Good luck with Phase 2! 🎸🎵**

