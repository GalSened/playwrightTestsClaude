# 🎯 Claude Code Skills - Playwright Testing System Guide

**Project:** QA Intelligence Platform with WeSign Integration
**Location:** `C:/Users/gals/Desktop/playwrightTestsClaude`
**Last Updated:** 2025-10-17

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Using Skill #1: Code Understanding & Navigation](#skill-1-code-understanding--navigation)
3. [Using Skill #2: Refactoring & Code Improvement](#skill-2-refactoring--code-improvement)
4. [Using Skill #3: Bug Fixing & Debugging](#skill-3-bug-fixing--debugging)
5. [Real-World Examples](#real-world-examples)
6. [Project-Specific Commands](#project-specific-commands)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Claude Code installed globally: `npm install -g @anthropic-ai/claude-code`
- Navigate to project: `cd C:/Users/gals/Desktop/playwrightTestsClaude`
- Ensure environment is configured (`.env` file exists with required variables)

### Start Claude Code
```bash
# Option 1: Interactive mode (recommended)
claude

# Option 2: Direct command
claude "analyze the test structure"
```

---

## 🔍 Skill #1: Code Understanding & Navigation

### What This Skill Does
- Quickly understand the codebase structure
- Find specific test files and functionality
- Trace test execution flows
- Analyze Page Object Models and test patterns

### When to Use
✅ New to the project or onboarding
✅ Finding where a specific feature is tested
✅ Understanding test architecture
✅ Preparing for refactoring or bug fixes

### Commands You Can Use

#### 1. Get Project Overview
```bash
claude "analyze the playwrightTestsClaude project structure"
```

**What you'll get:**
- Overall architecture (Frontend, Backend, Tests)
- Test organization (unit, integration, E2E)
- Key directories and their purposes
- Technology stack overview

#### 2. Find Specific Tests
```bash
# Find all authentication tests
claude "where are the authentication tests located?"

# Find WeSign-specific tests
claude "show me all WeSign test files"

# Find template management tests
claude "locate the template management test suite"
```

#### 3. Understand Test Structure
```bash
# Understand a specific test file
claude "explain what tests/e2e/tests/auth/authentication.spec.ts does"

# Understand Page Object Model
claude "explain the page object structure in this project"

# See test organization
claude "how are the tests organized by feature?"
```

#### 4. Trace Test Dependencies
```bash
# Find what a test uses
claude "what Page Objects does the login test use?"

# Find test utilities
claude "what helper functions are available for test setup?"

# Find shared fixtures
claude "show me all test fixtures and data files"
```

#### 5. Analyze Configuration
```bash
# Understand Playwright config
claude "explain the playwright.config.ts settings"

# Check environment setup
claude "what environment variables are required for tests?"

# Review test reporting
claude "how are test results reported in this project?"
```

### Real Examples for This Project

```bash
# Example 1: Understanding WeSign Integration
claude "how does the WeSign testing integration work in this project?"

# Example 2: Finding Authentication Flow
claude "trace the complete authentication test flow from login to dashboard"

# Example 3: Understanding Test Data
claude "where is test data stored and how is it used?"

# Example 4: Analyzing Test Coverage
claude "which features have E2E tests and which don't?"
```

---

## 🔧 Skill #2: Refactoring & Code Improvement

### What This Skill Does
- Modernize test code and patterns
- Remove code duplication across tests
- Improve Page Object Models
- Add TypeScript types and better error handling
- Optimize test performance

### When to Use
✅ Tests are hard to maintain
✅ Code duplication across test files
✅ Missing TypeScript types
✅ Inconsistent test patterns
✅ Performance optimization needed

### Commands You Can Use

#### 1. Remove Code Duplication
```bash
# Find and extract common test patterns
claude "find duplicated login code in test files and create a reusable helper"

# Extract repeated selectors
claude "extract common selectors from authentication tests into constants"

# Create shared utilities
claude "create a shared utility for document upload tests"
```

#### 2. Improve Page Object Models
```bash
# Refactor a Page Object
claude "refactor pages/login_page.py to follow best practices"

# Add TypeScript to POM
claude "add TypeScript types to all Page Object files in pages/"

# Improve method naming
claude "improve method names in DocumentsPage for clarity"
```

#### 3. Modernize Test Code
```bash
# Update to modern patterns
claude "refactor callback-based waits to async/await in all test files"

# Improve assertions
claude "replace basic assertions with more descriptive Playwright expect in tests/e2e/"

# Add better error handling
claude "add try-catch and better error messages to template tests"
```

#### 4. Optimize Test Performance
```bash
# Reduce test timeouts
claude "optimize wait times in signing workflow tests"

# Improve selectors
claude "replace XPath selectors with data-testid in all tests"

# Parallelize tests
claude "identify tests that can run in parallel and update config"
```

#### 5. Add Type Safety
```bash
# Add TypeScript types
claude "add TypeScript interfaces for all test data in tests/e2e/"

# Type test fixtures
claude "create TypeScript types for Page Object Models"

# Type configuration
claude "add types to playwright.config.ts"
```

### Real Examples for This Project

```bash
# Example 1: DRY Up Login Code
claude "all tests have similar login code - extract into a reusable fixture"

# Example 2: Improve WeSign Tests
claude "refactor WeSign document signing tests to reduce duplication"

# Example 3: Better Selectors
claude "update all tests to use data-testid instead of CSS selectors"

# Example 4: Type Safety
claude "add TypeScript types to all Page Objects in playwright_tests/pages/"
```

---

## 🐛 Skill #3: Bug Fixing & Debugging

### What This Skill Does
- Diagnose failing tests
- Fix flaky tests
- Resolve timeout issues
- Debug selector problems
- Fix environment configuration errors

### When to Use
✅ Tests are failing
✅ Flaky tests that pass/fail randomly
✅ Timeout errors
✅ Element not found errors
✅ Configuration issues

### Commands You Can Use

#### 1. Diagnose Test Failures
```bash
# Analyze a specific failing test
claude "fix the failing test in tests/auth/test_login.py::test_login_with_valid_credentials"

# Debug error message
claude "I'm getting 'Element not found: #submit-button' - debug and fix"

# Investigate timeout
claude "tests timeout during document upload - investigate and fix"
```

#### 2. Fix Flaky Tests
```bash
# Stabilize timing issues
claude "the login test is flaky - add proper waits and make it stable"

# Fix race conditions
claude "document signing sometimes fails - fix the race condition"

# Improve reliability
claude "make the template creation test more reliable"
```

#### 3. Fix Selector Issues
```bash
# Element not found
claude "fix 'element not found' error in dashboard navigation test"

# Update selectors
claude "update selectors in contact management tests - UI changed"

# Add fallback selectors
claude "add selector fallback strategy for self-healing tests"
```

#### 4. Fix Environment Issues
```bash
# Missing env vars
claude "tests fail with 'SUPABASE_URL required' - fix the configuration"

# Database issues
claude "tests fail to connect to database - debug and fix"

# Port conflicts
claude "backend server won't start - port already in use - fix it"
```

#### 5. Performance Issues
```bash
# Slow tests
claude "tests are running slowly - identify and fix performance bottlenecks"

# Memory leaks
claude "browser crashes during long test runs - investigate memory issues"

# Optimize waits
claude "reduce unnecessary waits in navigation tests"
```

### Real Examples for This Project

```bash
# Example 1: Fix Failing Login Test
claude "the test 'test_login_with_valid_credentials_success' is failing with timeout - debug and fix"

# Example 2: WeSign Document Upload
claude "document upload test fails randomly - make it stable and reliable"

# Example 3: Configuration Error
claude "tests fail with missing SUPABASE_URL - fix the .env configuration"

# Example 4: Selector Problems
claude "template tests fail with 'button not found' after UI update - fix selectors"
```

---

## 💡 Real-World Examples

### Complete Workflow Examples

#### Example 1: Fix a Failing Test Suite
```bash
# Step 1: Understand what's failing
claude "analyze why the authentication test suite is failing"

# Step 2: Get details
claude "show me the error logs from the last test run"

# Step 3: Fix the issue
claude "fix the authentication timeout errors"

# Step 4: Verify
claude "run the authentication tests and verify they pass"
```

#### Example 2: Refactor WeSign Tests
```bash
# Step 1: Analyze current state
claude "analyze the WeSign test files for code duplication and issues"

# Step 2: Create plan
claude "create a refactoring plan for WeSign tests to improve maintainability"

# Step 3: Execute refactoring
claude "implement the refactoring plan for WeSign document signing tests"

# Step 4: Verify
claude "run WeSign tests to ensure refactoring didn't break anything"
```

#### Example 3: Add New Feature Tests
```bash
# Step 1: Understand existing patterns
claude "how are document management features tested in this project?"

# Step 2: Create test structure
claude "create a Page Object and test file for the new batch upload feature"

# Step 3: Implement tests
claude "write comprehensive E2E tests for batch document upload"

# Step 4: Integrate
claude "add the new tests to the test suite and CI pipeline"
```

---

## 📋 Project-Specific Commands

### Test Execution Commands

```bash
# Run all Playwright tests
npm run test

# Run specific test suite
npm run test tests/e2e/tests/auth/

# Run tests in headed mode
npm run test:headed

# Debug a specific test
npm run test:debug -- tests/e2e/tests/auth/authentication.spec.ts

# Run tests with UI mode
npm run test:ui

# View test report
npm run test:report
```

### Claude Code Commands for This Project

#### Quick Analysis
```bash
# Get test count
claude "how many test files are in this project?"

# Check test coverage
claude "which features have E2E test coverage?"

# Find outdated tests
claude "find tests that might be outdated based on recent code changes"
```

#### Maintenance Tasks
```bash
# Update all imports
claude "update all test imports to use absolute paths"

# Fix linting issues
claude "fix all TypeScript errors in test files"

# Update dependencies
claude "check for outdated test dependencies and update safely"
```

#### Documentation
```bash
# Generate test docs
claude "generate documentation for all Page Object Models"

# Create test plan
claude "create a test plan document for the WeSign integration"

# Update README
claude "update the test README with current test structure"
```

---

## 🎯 Combining All Three Skills

### Typical Workflow: Complete Feature Testing

```bash
# 1. UNDERSTAND (Skill #1)
claude "analyze how user authentication is currently tested"

# 2. IDENTIFY ISSUES (Skill #3)
claude "identify any bugs or flaky tests in the authentication suite"

# 3. FIX BUGS (Skill #3)
claude "fix all identified issues in authentication tests"

# 4. REFACTOR (Skill #2)
claude "refactor authentication tests to remove duplication and improve maintainability"

# 5. VERIFY (Skills #1 & #3)
claude "run all authentication tests and verify they pass"
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue: "Cannot find module"
```bash
claude "fix module resolution errors in test files"
```

#### Issue: "Tests timing out"
```bash
claude "increase timeout for slow tests and optimize wait times"
```

#### Issue: "Selector not found"
```bash
claude "update selectors in failing tests - UI has changed"
```

#### Issue: "Environment variables missing"
```bash
claude "fix missing environment variables - update .env file"
```

#### Issue: "Tests fail in CI but pass locally"
```bash
claude "debug CI-specific test failures and fix environment differences"
```

---

## 📊 Best Practices

### DO:
✅ Be specific in your requests
✅ Provide error messages when debugging
✅ Ask for explanations before making changes
✅ Run tests after refactoring
✅ Use incremental changes

### DON'T:
❌ Ask to "fix everything" at once
❌ Skip understanding the code first
❌ Make changes without testing
❌ Ignore test failures
❌ Forget to update documentation

---

## 🎓 Learning Path

### Week 1: Understanding
- Day 1-2: Use Skill #1 to understand overall architecture
- Day 3-4: Learn test patterns and Page Objects
- Day 5: Study test data and fixtures

### Week 2: Debugging
- Day 1-3: Fix failing tests using Skill #3
- Day 4-5: Improve test reliability

### Week 3: Refactoring
- Day 1-3: Remove duplication using Skill #2
- Day 4-5: Improve code quality and types

### Week 4: Mastery
- Combine all skills for complex tasks
- Optimize test suite performance
- Add new feature tests

---

## 🚀 Advanced Usage

### Extended Thinking Mode
For complex problems:
```bash
claude --extended-thinking "analyze the entire test architecture and propose improvements"
```

### Plan Mode
For safe exploration:
```bash
claude --plan "analyze tests before making changes"
```

### Resume Sessions
Continue previous work:
```bash
claude --resume
```

---

## 📞 Getting Help

### From Claude Code
```bash
claude --help
claude "how do I use extended thinking mode?"
```

### From Documentation
- Claude Code Docs: https://docs.claude.com/claude-code
- Playwright Docs: https://playwright.dev
- Project README: `./README.md`

---

## ✨ Quick Reference Card

| Task | Command Template | Skill |
|------|-----------------|-------|
| Understand feature | `claude "how does [feature] work?"` | #1 |
| Find tests | `claude "where are [feature] tests?"` | #1 |
| Fix bug | `claude "fix [error message]"` | #3 |
| Remove duplication | `claude "extract common [pattern]"` | #2 |
| Add types | `claude "add TypeScript types to [file]"` | #2 |
| Debug timeout | `claude "fix timeout in [test]"` | #3 |
| Optimize | `claude "optimize [slow process]"` | #2 |
| Create test | `claude "write E2E test for [feature]"` | #1,#2 |

---

**Remember:** Claude Code is conversational - just describe what you want in natural language!

**Start your journey:** `claude "analyze the test structure and help me get started"`

---

*Last Updated: 2025-10-17 | QA Intelligence Platform Team*
