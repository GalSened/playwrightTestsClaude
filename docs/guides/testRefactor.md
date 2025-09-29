You are tasked with reviewing, fixing, and refactoring all 633 Playwright tests in this project. Work systematically through each test file following this exact process:

## PHASE 1: UNDERSTAND EACH TEST

For every test:

1. Read the test name and code to understand its intended purpose
2. Document what the test is SUPPOSED to verify based on its name and actions
3. Identify the current assertions and evaluate if they actually validate the test's purpose
4. Flag tests with weak/missing assertions (only checking visibility when it should check specific values/states)

## PHASE 2: STRENGTHEN ASSERTIONS

For each test that needs improvement:

1. Determine what STRONG assertions would actually validate the test's purpose:
   - Don't just check toBeVisible() - verify actual content with toHaveText()
   - Don't just check element exists - verify its state (enabled/disabled/checked)
   - Add multiple assertions to fully validate the expected outcome
   - Ensure assertions match the test's documented purpose
2. Add these assertions to the test

## PHASE 3: RUN AND VALIDATE

For every modified test:

1. Run the test using: npx playwright test [testfile] --headed
2. Document the result:
   - PASS: Move to next test
   - FAIL: Proceed to PHASE 4

## PHASE 4: FIX BROKEN TESTS (CODEGEN MODE)

When a test fails:

1. DO NOT ASSUME why it failed - get real evidence:

   - Run with --debug flag to see exactly what happened
   - Capture the actual error message and failed locator
2. Find correct locators like Playwright codegen would:

   - Inspect the ACTUAL HTML on the page when test runs
   - Never guess or assume element structure
   - Apply Playwright's locator priority:
     a) getByRole() with accessible name
     b) getByTestId() if data-testid exists
     c) getByText() for visible text
     d) getByLabel() for labeled inputs
     e) getByPlaceholder() for placeholders
     f) getByAltText() for images
     g) getByTitle() for titles
     h) page.locator() CSS only as last resort
3. Update the test with correct locators found from REAL page inspection
4. Re-run the test to confirm it passes
5. If still failing:

   - Check for timing issues - add appropriate waits
   - Check for dynamic content - use proper wait conditions
   - Verify the application flow matches test expectations

## PHASE 5: REFACTOR FOR MAINTAINABILITY

After fixing each test:

1. Extract common locators to constants
2. Remove redundant waits or actions
3. Add descriptive comments for complex flows
4. Group related assertions together
5. Ensure consistent formatting

## EXECUTION RULES:

- NEVER assume a locator is correct without inspecting the actual page
- NEVER skip running a test to validate changes
- NEVER use generic assertions when specific ones would be stronger
- ALWAYS run tests with --headed first to SEE what's happening
- ALWAYS capture real error messages before making changes
- TREAT every test as potentially broken until proven working

## PROGRESS TRACKING:

Maintain a log file (test-refactor-log.md) with:

- Test file name
- Test name
- Original assertion count
- New assertion count
- Status: PASSED / FIXED / NEEDS_MANUAL_REVIEW
- Changes made
- Any blockers or issues

## START COMMAND:

Begin with: "Starting systematic review of 633 tests. I will work through each file methodically, never assuming anything works without running it."

Process tests in alphabetical order by filename. After every 10 tests, provide a summary of:

- Tests reviewed
- Tests strengthened
- Tests fixed
- Tests that need manual intervention

This is a systematic, evidence-based refactoring. Every change must be validated by running the actual test.
