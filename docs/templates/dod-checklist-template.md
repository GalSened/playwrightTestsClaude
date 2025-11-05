# Definition of Done (DoD) Checklist
## Page/Feature: {PAGE_NAME}

**Page Key:** `{PAGE_KEY}`
**Priority:** `{P0/P1/P2}`
**Review Date:** `{DATE}`
**Reviewer:** `{NAME}`
**Status:** `{IN_PROGRESS/COMPLETED/BLOCKED}`

---

## ✅ Functional Completeness

### Acceptance Criteria Validation
- [ ] All Gherkin scenarios identified and documented
- [ ] All AC scenarios have passing tests with evidence
- [ ] Happy path flows: **{X}/{Y} passing**
- [ ] Edge case flows: **{X}/{Y} passing**
- [ ] Error handling flows: **{X}/{Y} passing**
- [ ] Permission/role-based flows: **{X}/{Y} passing**

**Evidence Location:** `artifacts/{PAGE_KEY}/evidence.md`

### Core Functionality
- [ ] All UI components render correctly
- [ ] All user interactions work as expected
- [ ] All API calls succeed with correct data
- [ ] State management works correctly (global + local)
- [ ] Navigation to/from page works correctly
- [ ] Page loads within acceptable time (<2s for critical, <5s for complex)

---

## 🧪 Test Coverage

### Unit Tests
- [ ] Unit tests exist for all components/services
- [ ] Coverage: **{X}%** (Target: ≥80%)
- [ ] All tests passing: **{X}/{Y}**
- [ ] Edge cases covered
- [ ] Error scenarios covered
- [ ] Mocks properly implemented

**Report Location:** `reports/unit/{PAGE_KEY}/coverage-report.html`

### API Tests
- [ ] Postman collection created/updated
- [ ] All endpoints tested: **{X}/{Y}**
- [ ] Status codes validated (200, 400, 401, 403, 404, 500)
- [ ] Request/response schemas validated
- [ ] Authentication/authorization tested
- [ ] Error responses validated
- [ ] Newman HTML report generated

**Report Location:** `reports/api/{PAGE_KEY}/newman-report.html`

### E2E Tests (Playwright + Pytest)
- [ ] E2E tests exist for critical user flows
- [ ] POM (Page Object Model) implemented
- [ ] All scenarios passing: **{X}/{Y}**
- [ ] Screenshots on failure captured
- [ ] Videos on failure captured (if enabled)
- [ ] Tests run in both headless and headed modes
- [ ] Cross-browser tested (Chromium/Firefox/WebKit)
- [ ] Test data setup/cleanup working

**Report Location:** `reports/e2e/{PAGE_KEY}/index.html`

---

## ⚡ Non-Functional Requirements

### Accessibility (a11y)
- [ ] Automated accessibility scan completed (axe/pa11y)
- [ ] Critical issues: **{X}** (Target: 0)
- [ ] Major issues: **{X}** (Target: 0)
- [ ] Minor issues: **{X}** (Document if acceptable)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Color contrast ratios meet WCAG 2.1 AA
- [ ] Focus indicators visible and logical
- [ ] ARIA labels and roles properly implemented

**WCAG 2.1 AA Compliance:** `{✅ PASS / ⚠️ PARTIAL / ❌ FAIL}`
**Report Location:** `reports/a11y/{PAGE_KEY}/axe-report.md`

### Performance
- [ ] Performance baseline established
- [ ] Page load time (p50): **{X}ms** (Target: <1500ms)
- [ ] Page load time (p95): **{X}ms** (Target: <2000ms for critical, <5000ms for complex)
- [ ] Time to Interactive (TTI): **{X}ms** (Target: <3000ms)
- [ ] API response time (p95): **{X}ms** (Target: <1000ms)
- [ ] No memory leaks detected
- [ ] No performance regressions vs baseline

**Report Location:** `reports/perf/{PAGE_KEY}/performance-report.md`

### Security
- [ ] Security scan completed (npm audit, Snyk, etc.)
- [ ] Critical vulnerabilities: **{X}** (Target: 0)
- [ ] High vulnerabilities: **{X}** (Target: 0)
- [ ] Secrets scan passed (no hardcoded credentials)
- [ ] Input validation implemented
- [ ] XSS protection implemented
- [ ] CSRF protection implemented (if applicable)
- [ ] Authentication/authorization properly enforced
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] Sensitive data encrypted at rest (if applicable)

**Report Location:** `reports/security/{PAGE_KEY}/security-scan.md`

### Internationalization (i18n)
- [ ] English language support validated
- [ ] Hebrew language support validated (if applicable)
- [ ] RTL (Right-to-Left) layout correct for Hebrew
- [ ] LTR (Left-to-Right) layout correct for English
- [ ] No hardcoded strings (all externalized)
- [ ] Date/time formatting locale-aware
- [ ] Number formatting locale-aware
- [ ] Currency formatting locale-aware (if applicable)

---

## 📚 Documentation

### Code Documentation
- [ ] All public APIs documented (JSDoc/TSDoc)
- [ ] Complex logic explained with comments
- [ ] README updated (if new dependencies/setup required)
- [ ] CHANGELOG updated with user-facing changes
- [ ] Migration guide created (if breaking changes)

### Design Documentation
- [ ] System map created: `artifacts/{PAGE_KEY}/system-map.md`
- [ ] Design document created: `artifacts/{PAGE_KEY}/design.md`
- [ ] ADR created (if architectural decisions made): `docs/adrs/{DATE}-{PAGE_KEY}.md`

### Test Documentation
- [ ] Acceptance criteria documented: `artifacts/{PAGE_KEY}/acceptance-criteria.feature`
- [ ] Test plan documented: `artifacts/{PAGE_KEY}/plan.md`
- [ ] Test data documented (fixtures, seeds, etc.)

### Operational Documentation
- [ ] Runbook updated (if monitoring/ops considerations)
- [ ] Error handling documented
- [ ] Troubleshooting guide updated (if common issues)
- [ ] Known limitations documented

---

## 🚀 CI/CD Integration

### Continuous Integration
- [ ] All tests passing in CI: **{✅ PASS / ❌ FAIL}**
- [ ] CI pipeline updated (if needed)
- [ ] All test reports published as CI artifacts
- [ ] Pipeline fails on test failures (no silent passes)
- [ ] Build time acceptable (<10 min for full suite)

**CI Build Link:** `{CI_BUILD_URL}`

### Deployment
- [ ] Deployment scripts updated (if needed)
- [ ] Environment variables documented
- [ ] Feature flags configured (if applicable)
- [ ] Rollback procedure documented
- [ ] Smoke tests pass in target environment

---

## 🐛 Defect Management

### Open Defects
| ID | Severity | Description | Status | Owner | ETA |
|----|----------|-------------|--------|-------|-----|
| {ID} | {Critical/Major/Minor} | {Description} | {Open/In Progress/Resolved} | {Name} | {Date} |

**Critical Defects:** **{X}** (Target: 0 before production)
**Major Defects:** **{X}** (Target: 0 before production)
**Minor Defects:** **{X}** (Acceptable with justification)

### Known Limitations
- {Limitation 1}: {Justification and mitigation}
- {Limitation 2}: {Justification and mitigation}

---

## 🎯 Final Approval

### Definition of Done Gate
- [ ] **All functional acceptance criteria passing** with evidence
- [ ] **All test suites green** (unit/API/E2E) in CI
- [ ] **Test coverage targets met** (or justified exceptions)
- [ ] **Accessibility baseline met** (WCAG 2.1 AA)
- [ ] **Performance baseline met** (or justified exceptions)
- [ ] **Security scan passed** (zero critical/high vulnerabilities)
- [ ] **i18n validated** (English + Hebrew if applicable)
- [ ] **Documentation complete** (code, design, tests, ops)
- [ ] **CI/CD integration validated**
- [ ] **Zero critical/major open defects**

### Approval Signatures

**Technical Lead Approval:**
- Name: `{NAME}`
- Date: `{DATE}`
- Signature: `{APPROVED / REJECTED}`
- Comments: `{COMMENTS}`

**QA Lead Approval:**
- Name: `{NAME}`
- Date: `{DATE}`
- Signature: `{APPROVED / REJECTED}`
- Comments: `{COMMENTS}`

**Product Owner Approval:**
- Name: `{NAME}`
- Date: `{DATE}`
- Signature: `{APPROVED / REJECTED}`
- Comments: `{COMMENTS}`

---

## 📊 Summary Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Functional Tests Passing | {X}/{Y} | 100% | {✅/⚠️/❌} |
| Unit Test Coverage | {X}% | ≥80% | {✅/⚠️/❌} |
| API Tests Passing | {X}/{Y} | 100% | {✅/⚠️/❌} |
| E2E Tests Passing | {X}/{Y} | 100% | {✅/⚠️/❌} |
| Accessibility Score | {X}/100 | ≥90 | {✅/⚠️/❌} |
| Performance (p95) | {X}ms | <2000ms | {✅/⚠️/❌} |
| Security Vulnerabilities | {X} | 0 critical/high | {✅/⚠️/❌} |
| Documentation Complete | {X}% | 100% | {✅/⚠️/❌} |

**Overall Status:** `{✅ PRODUCTION READY / ⚠️ NEEDS WORK / ❌ BLOCKED}`

---

**Last Updated:** `{DATE}`
**Next Review:** `{DATE}`
