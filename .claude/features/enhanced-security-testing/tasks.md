# Enhanced Security Testing - Tasks

**Feature:** enhanced-security-testing
**Created:** 2026-01-06
**Status:** Research Complete

## Task Overview

Implementation tasks for comprehensive security testing in CICD workflow.

---

## Phase 1: Quick Wins

### T001: Add npm audit to CI

**Status:** Not Started
**Effort:** 30 minutes
**Priority:** High

Add `npm audit --audit-level=high` to GitHub Actions workflow.

### T002: Add ESLint security plugins

**Status:** Not Started
**Effort:** 2 hours
**Priority:** Medium

Install and configure:

- `eslint-plugin-security`
- `eslint-plugin-no-secrets`

### T003: Add Gitleaks secrets scanning

**Status:** Not Started
**Effort:** 2 hours
**Priority:** High

- Add Gitleaks GitHub Action
- Configure pre-commit hook

### T004: Add HTTPS verification tests

**Status:** Not Started
**Effort:** 2 hours
**Priority:** Medium

Create `tests/security/https-verification.test.ts`

---

## Phase 2: Core Security

### T005: Integrate Semgrep SAST

**Status:** Not Started
**Effort:** 4 hours
**Priority:** High

- Add Semgrep GitHub Action
- Configure rulesets (p/react, p/typescript, p/security-audit)
- Set up SARIF upload for GitHub Security tab

### T006: Install and configure Supashield

**Status:** Not Started
**Effort:** 6 hours
**Priority:** High

- Install Supashield CLI
- Run initial audit
- Add to CI workflow
- Document findings

### T007: Create RLS behavioral tests

**Status:** Not Started
**Effort:** 12 hours
**Priority:** High

Create comprehensive pgTAP tests for:

- Cross-tenant isolation
- Role-based access (admin vs member)
- Personal data protection
- Audit log integrity

---

## Phase 3: Advanced Testing

### T008: Integrate Snyk (optional)

**Status:** Not Started
**Effort:** 2 hours
**Priority:** Medium

- Create Snyk account
- Add SNYK_TOKEN secret
- Add Snyk GitHub Action

### T009: Set up OWASP ZAP DAST

**Status:** Not Started
**Effort:** 6 hours
**Priority:** Low

- Configure ZAP baseline scan
- Create rules file for false positive management
- Add to weekly scheduled workflow

### T010: Create custom Semgrep rules

**Status:** Not Started
**Effort:** 4 hours
**Priority:** Low

Rock-on specific rules:

- Detect direct Supabase queries bypassing repository layer
- Flag console.log statements with sensitive data patterns
- Enforce proper date handling (timezone issues)

---

## Dependencies

- [ ] Supabase local development environment working
- [ ] GitHub Actions configured
- [ ] Test environment accessible from CI

## Notes

- Always test security tools on staging/local before production
- Document any false positives for future reference
- Consider security tool performance impact on CI times
