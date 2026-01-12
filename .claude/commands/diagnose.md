---
description: Diagnose test failures or bugs - performs root cause analysis and creates fix plan
---

# Diagnose Issues

Investigate failing tests, bugs, or unexpected behavior. This command spawns the diagnose-agent to perform root cause analysis and create a fix plan.

## Usage

```
/diagnose <description-of-issue>
/diagnose <feature-name>
```

## Examples

```
/diagnose ProtectedRoute tests are failing
/diagnose improved-auth-flow
/diagnose Users seeing "Not logged in" on protected pages
/diagnose npm test fails with timeout errors
```

## What This Does

1. **Gathers context**:
   - Reads error messages and stack traces
   - Finds related test files and source code
   - Checks recent changes (git diff)
   - Reviews feature docs if feature-name provided

2. **Performs root cause analysis**:
   - Traces error back to source
   - Identifies failing assertions
   - Checks for race conditions, timing issues
   - Looks for missing dependencies or config

3. **Creates diagnosis report**:
   - Saved to `.claude/active-work/<feature-or-issue>/diagnosis.md`
   - Includes root cause explanation
   - Lists affected files with line numbers
   - Proposes fix strategies

4. **Suggests next steps**:
   - Quick fix vs proper fix options
   - Test commands to verify fix
   - Related issues to watch for

## Process

The diagnose-agent will:

1. **Collect Evidence**
   - Run failing tests to capture output
   - Read error messages and stack traces
   - Check test file and source file
   - Review git history for recent changes

2. **Analyze Root Cause**
   - Trace execution flow
   - Identify where expected != actual
   - Check for common issues:
     - Async/timing problems
     - Mock setup issues
     - Missing test data
     - Environment differences
     - Type mismatches

3. **Create Diagnosis Report**

   ```markdown
   # Diagnosis: <Issue Description>

   ## Summary

   Brief explanation of what's wrong

   ## Root Cause

   Detailed explanation with file:line references

   ## Evidence

   - Error output
   - Relevant code snippets
   - Test expectations vs actual

   ## Fix Options

   1. Quick fix: ...
   2. Proper fix: ...

   ## Verification

   Commands to verify the fix works
   ```

4. **Recommend Action**
   - Fix complexity estimate
   - Risk assessment
   - Whether to fix now or defer

## Output Location

Diagnosis reports are saved to:

- `.claude/active-work/<feature-name>/diagnosis.md` (if feature context)
- `.claude/active-work/issues/<issue-slug>/diagnosis.md` (if standalone issue)

Note: `.claude/active-work/` is gitignored for temporary working files.

## Common Diagnoses

**Test Timeout**

- Usually async operation not completing
- Missing await, unresolved promise, or infinite loop

**Mock Not Working**

- Mock not properly set up or cleared between tests
- Wrong import path (actual vs mock)

**Type Error in Tests**

- Test using outdated interface
- Missing required props

**Flaky Tests**

- Race condition in async code
- Test order dependency
- Shared mutable state

## After Diagnosis

If the fix is straightforward, apply it directly.

If the fix requires planning:

```
/plan <feature-name>  # Create proper fix plan
```

## User Input

$ARGUMENTS
