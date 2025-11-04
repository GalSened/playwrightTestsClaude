# Systematic Test Automation Methodology

**Version**: 2.0
**Date**: 2025-11-03
**Module**: All WeSign UI Testing
**Status**: MANDATORY - Must follow for all test implementation

---

## 🎯 Core Principles

### **PRINCIPLE #1: ASSUME NOTHING**
- Never assume a button works without testing it
- Never assume a field accepts data without validation
- Never assume a modal closes without verifying it
- Never assume navigation succeeded without checking URL/elements
- Never assume data saved without querying it back

### **PRINCIPLE #2: EVIDENCE-BASED VALIDATION**
- Every assertion must have observable evidence
- Capture screenshots at critical junctions
- Verify state before AND after each action
- Use MCP Playwright for live exploration before automating
- Document discoveries with proof (screenshots, DOM snapshots)

### **PRINCIPLE #3: SYSTEMATIC NAVIGATION**
- Navigate yourself through each workflow manually first
- Validate every step of the user journey
- Test both happy path AND edge cases
- Verify error states and negative scenarios
- Document junction points (where user makes choices)

### **PRINCIPLE #4: STEP-BY-STEP VERIFICATION**
- Break complex workflows into atomic steps
- Verify each step before proceeding to next
- Use explicit waits, not implicit assumptions
- Check intermediate states, not just final outcomes
- Validate both UI state and data state

---

## 📋 Mandatory Workflow for Every Test

### Phase 1: MANUAL EXPLORATION (Required)
**Before writing ANY automated test**:

1. **Login and Navigate**
   - Use MCP Playwright to login manually
   - Navigate to the module/page
   - Take screenshot: `01_page_loaded.png`
   - Verify all expected elements visible

2. **Explore the Workflow**
   - Click each button/link manually
   - Fill each form field with test data
   - Observe what happens (modals, messages, navigation)
   - Take screenshots at each step: `02_step_name.png`
   - Document unexpected behavior

3. **Validate Selectors**
   - For each interactive element, get the selector
   - Test selector uniqueness (does it match one element?)
   - Prefer role-based selectors over xpath
   - Document selector + real ref from page

4. **Test Edge Cases**
   - What happens if you cancel?
   - What happens with invalid data?
   - What happens with empty fields?
   - What happens if you press Enter?
   - Document each discovery

5. **Create Evidence Document**
   - File: `{MODULE}_DISCOVERY_VALIDATION.md`
   - Include: All selectors, screenshots, workflows, discoveries
   - Mark critical findings (e.g., "Search requires Enter key!")

### Phase 2: POM IMPLEMENTATION (Required)
**After exploration, before tests**:

1. **Create/Update Page Object**
   - File: `pages/{module}_page.py`
   - Add selectors as lambda properties
   - Create methods for each workflow
   - Include discovery notes in docstrings

2. **Method Requirements**
   - Each method must verify pre-conditions
   - Each method must verify post-conditions
   - Use explicit waits with timeouts
   - Return self for chaining (where applicable)
   - Include comprehensive docstrings

3. **Selector Strategy**
   - Prefer: `get_by_role()` > `get_by_placeholder()` > `locator()`
   - Always use Hebrew text if UI is Hebrew
   - Test selector stability (will it break on updates?)
   - Document alternative selectors as fallbacks

### Phase 3: TEST IMPLEMENTATION (Required)
**Write tests using validated POM**:

1. **Test Structure**
   ```python
   def test_feature_name(self, page: Page, setup_fixture):
       """
       Test: Clear description of what's being tested

       Steps:
       1. Navigate to X
       2. Click Y
       3. Fill Z
       4. Verify W

       Expected:
       - Specific assertion 1
       - Specific assertion 2

       Evidence: screenshot_name.png
       """
       # Setup
       initial_state = get_initial_state()

       # Execute action
       result = perform_action()

       # Verify outcome
       assert expected_outcome, "Clear failure message"

       # Cleanup
       cleanup_test_data()
   ```

2. **Required Assertions**
   - ✅ Verify action succeeded (modal opened, page navigated, etc.)
   - ✅ Verify data changed (count increased, item visible, etc.)
   - ✅ Verify state correct (enabled/disabled, visible/hidden)
   - ✅ Verify cleanup successful (test data removed)

3. **Evidence Collection**
   - Screenshot on failure (automatic via Playwright)
   - Capture DOM state before critical actions
   - Log important values (counts, names, IDs)
   - Save evidence to `reports/` directory

### Phase 4: VALIDATION EXECUTION (Required)
**Run and verify each test**:

1. **First Run: Headed Mode**
   ```bash
   py -m pytest tests/{module}/test_{name}.py::test_specific -v -s --headed --slowmo 100
   ```
   - Watch test execute
   - Verify each step visually
   - Note any flakiness or timing issues

2. **Second Run: Headless Mode**
   ```bash
   py -m pytest tests/{module}/test_{name}.py::test_specific -v
   ```
   - Verify test works without UI
   - Check for timing-dependent failures
   - Ensure screenshots captured on failure

3. **Evidence Verification**
   - Review test output logs
   - Check screenshots captured
   - Verify assertions meaningful
   - Confirm cleanup executed

---

## 🔍 Systematic Test Development Process

### Step 1: Identify Test Scope
```markdown
Test Name: test_cancel_add_contact
Feature: Cancel button in Add Contact modal
Priority: High (core UX)
Prerequisites: Login, navigate to Contacts
```

### Step 2: Manual Exploration with Evidence
```bash
# Use MCP Playwright
1. Login → Screenshot
2. Navigate to Contacts → Screenshot
3. Click "Add Contact" → Screenshot modal
4. Fill form data → Screenshot filled form
5. Click "Cancel" → Screenshot after cancel
6. Verify modal closed → Screenshot
7. Verify no contact created → Screenshot search results
```

### Step 3: Document Discoveries
```markdown
DISCOVERY: Cancel button selector: get_by_role('button', name='ביטול')
DISCOVERY: Modal closes immediately on cancel (no confirmation)
DISCOVERY: Form data is NOT retained after cancel
CRITICAL: Count does not change after cancel (verified)
```

### Step 4: Implement POM Method
```python
def cancel_add_contact(self):
    """
    Click cancel button in Add Contact modal

    DISCOVERY: Modal closes immediately without confirmation

    Returns:
        ContactsPage: Self for chaining
    """
    cancel_btn = self.cancel_btn()
    cancel_btn.click()

    # Verify modal closed
    expect(self.modal_heading()).to_be_hidden(timeout=3000)

    return self
```

### Step 5: Write Test with Full Validation
```python
def test_cancel_add_contact(self, page: Page, setup_contacts_page):
    """
    Test: Cancel Add Contact - Verify no contact created

    Steps:
    1. Get initial contact count
    2. Click Add Contact button
    3. Verify modal opened
    4. Fill name and email
    5. Click Cancel button
    6. Verify modal closed
    7. Verify contact NOT created
    8. Verify count unchanged

    Expected:
    - Modal opens when clicking Add Contact
    - Form can be filled with data
    - Cancel closes modal immediately
    - No contact is created
    - Total count remains unchanged

    Evidence: Tested manually on 2025-11-03
    """
    contacts_page = setup_contacts_page

    # Step 1: Get baseline state
    initial_count = contacts_page.get_total_count()
    print(f"Initial count: {initial_count}")

    # Step 2: Open add contact modal
    contacts_page.add_contact_btn().click()
    expect(contacts_page.modal_heading()).to_contain_text('הוספת איש קשר חדש', timeout=5000)
    print("✓ Modal opened")

    # Step 3: Fill form with test data
    test_name = "CANCEL_TEST_Contact"
    contacts_page.name_input().fill(test_name)
    contacts_page.email_input().fill("cancel@test.com")
    print(f"✓ Form filled with: {test_name}")

    # Step 4: Click CANCEL (not Confirm!)
    contacts_page.cancel_btn().click()
    print("✓ Cancel clicked")

    # Step 5: Verify modal closed
    expect(contacts_page.modal_heading()).to_be_hidden(timeout=3000)
    print("✓ Modal closed")

    # Step 6: Verify contact NOT created
    page.wait_for_timeout(500)  # Brief wait for any background processing
    exists = contacts_page.verify_contact_exists(test_name, should_exist=False)
    assert exists, f"Contact '{test_name}' should NOT exist after cancel"
    print(f"✓ Contact NOT created (verified via search)")

    # Step 7: Verify count unchanged
    final_count = contacts_page.get_total_count()
    assert final_count == initial_count, \
        f"Count should remain {initial_count}, but is {final_count}"
    print(f"✓ Count unchanged: {final_count} = {initial_count}")
```

### Step 6: Execute and Validate
```bash
# Run in headed mode first
py -m pytest tests/contacts/test_contacts_core.py::TestContactsCore::test_cancel_add_contact -v -s --headed --slowmo 100

# Watch execution:
# ✓ Modal opens
# ✓ Form fills
# ✓ Cancel closes modal
# ✓ No contact created
# ✓ Count unchanged

# Run in headless mode
py -m pytest tests/contacts/test_contacts_core.py::TestContactsCore::test_cancel_add_contact -v

# Verify PASSED
```

---

## 🚫 ANTI-PATTERNS (Never Do These)

### ❌ Don't: Assume Button Works
```python
# BAD
def add_contact(self, name):
    self.name_input().fill(name)
    self.confirm_btn().click()
    # No verification!
```

### ✅ Do: Verify Each Step
```python
# GOOD
def add_contact(self, name):
    # Verify modal is open
    expect(self.modal_heading()).to_be_visible()

    # Fill and verify
    self.name_input().fill(name)

    # Click and verify modal closes
    self.confirm_btn().click()
    expect(self.modal_heading()).to_be_hidden(timeout=5000)

    return self
```

### ❌ Don't: Skip Edge Cases
```python
# BAD - Only tests happy path
def test_create_contact(self):
    contacts_page.add_contact("Test Name", "test@email.com")
    assert contacts_page.verify_contact_exists("Test Name")
```

### ✅ Do: Test Edge Cases
```python
# GOOD - Tests multiple scenarios
def test_create_contact_email_only(self):
    """Junction Point 1: Email only"""

def test_create_contact_phone_only(self):
    """Junction Point 2: Phone only"""

def test_create_contact_empty_name(self):
    """Edge Case: Required field validation"""

def test_create_contact_invalid_email(self):
    """Edge Case: Email validation"""
```

### ❌ Don't: Use Magic Numbers
```python
# BAD
page.wait_for_timeout(2000)  # Why 2000? Will it always work?
```

### ✅ Do: Use Explicit Waits with Reason
```python
# GOOD
# Wait for modal to close (animation takes ~500ms)
expect(self.modal_heading()).to_be_hidden(timeout=3000)

# Brief wait for search filter to apply
page.wait_for_timeout(500)  # Known from manual testing
```

### ❌ Don't: Ignore Cleanup
```python
# BAD - Leaves test data in system
def test_add_contact(self):
    contacts_page.add_contact("Test", "test@test.com")
    assert contacts_page.verify_contact_exists("Test")
    # No cleanup!
```

### ✅ Do: Always Cleanup
```python
# GOOD - Cleans up test data
def test_add_contact(self):
    try:
        contacts_page.add_contact("Test", "test@test.com")
        assert contacts_page.verify_contact_exists("Test")
    finally:
        # Cleanup even if test fails
        contacts_page.delete_contact("Test", confirm=True)
```

---

## 📊 Coverage Checklist

For each module, ensure:

### UI Elements Coverage
- [ ] All buttons tested (click, enable/disable states)
- [ ] All inputs tested (fill, clear, validation)
- [ ] All dropdowns tested (select, options)
- [ ] All checkboxes tested (check, uncheck)
- [ ] All radio buttons tested (select, deselect)
- [ ] All modals tested (open, close, cancel)
- [ ] All links tested (click, navigation)

### Workflow Coverage
- [ ] Happy path (all steps succeed)
- [ ] Alternative paths (junctions, different routes)
- [ ] Cancel/abort paths (user changes mind)
- [ ] Error paths (validation failures)
- [ ] Edge cases (boundaries, limits)

### Data Coverage
- [ ] Required fields (empty, filled)
- [ ] Optional fields (empty, filled)
- [ ] Invalid data (format, type, range)
- [ ] Special characters (Hebrew, Unicode, symbols)
- [ ] Boundary values (min, max, zero)
- [ ] Duplicate data (uniqueness constraints)

### State Coverage
- [ ] Initial state (page load)
- [ ] Intermediate states (during action)
- [ ] Final state (after action)
- [ ] Error states (validation, network)
- [ ] Loading states (spinners, disabled)

---

## 🎯 Test Quality Standards

Every test MUST have:

1. ✅ **Clear Test Name** - Describes what's tested
2. ✅ **Comprehensive Docstring** - Steps, expected, evidence
3. ✅ **Initial State Capture** - Get baseline before action
4. ✅ **Step-by-Step Execution** - Atomic actions
5. ✅ **Explicit Verifications** - Assert each outcome
6. ✅ **Cleanup Routine** - Remove test data
7. ✅ **Evidence Trail** - Print statements, screenshots
8. ✅ **Meaningful Assertions** - Clear failure messages

Example Quality Test:
```python
def test_feature_quality_example(self, page: Page, setup_fixture):
    """
    ✅ Test: Clear description

    ✅ Steps:
    1. Initial state
    2. Execute action
    3. Verify outcome

    ✅ Expected:
    - Specific result 1
    - Specific result 2

    ✅ Evidence: Tested 2025-11-03, screenshots in /evidence
    """
    # ✅ Initial state
    initial_count = page_object.get_count()

    # ✅ Execute
    page_object.perform_action()

    # ✅ Verify
    assert page_object.verify_outcome(), "Clear failure message"

    # ✅ Cleanup
    page_object.cleanup()
```

---

## 📝 Documentation Requirements

### For Each Module
1. **Discovery Document** - Manual exploration results
2. **Coverage Plan** - What will be tested, what won't
3. **POM File** - All selectors and methods
4. **Test Suite** - All automated tests
5. **Evidence Report** - Screenshots, results, coverage metrics
6. **Completion Report** - Final status, known issues

### For Each Test
1. **Test Name** - Descriptive, follows convention
2. **Docstring** - Purpose, steps, expected, evidence
3. **Print Statements** - Log progress for debugging
4. **Comments** - Explain non-obvious code
5. **Assertions** - Clear failure messages

---

## ✅ Definition of Done

A test is DONE when:

1. ✅ Manual exploration completed with screenshots
2. ✅ Selectors validated against live app
3. ✅ POM method implemented and documented
4. ✅ Test written with full verification
5. ✅ Test passes in headed mode
6. ✅ Test passes in headless mode
7. ✅ Test passes 3 times in a row (stability)
8. ✅ Cleanup verified
9. ✅ Evidence collected
10. ✅ Documentation updated

---

## 🚀 Quick Reference

### Before ANY Test Implementation
1. ☑️ Explore manually with MCP Playwright
2. ☑️ Capture 5+ screenshots of workflow
3. ☑️ Document all selectors with real refs
4. ☑️ Test edge cases manually
5. ☑️ Create discovery document

### During Test Implementation
1. ☑️ Use validated selectors from discovery
2. ☑️ Verify EACH step before proceeding
3. ☑️ Print progress for debugging
4. ☑️ Include cleanup in test
5. ☑️ Write clear assertions with messages

### After Test Implementation
1. ☑️ Run in headed mode and watch
2. ☑️ Run in headless mode
3. ☑️ Run 3x to verify stability
4. ☑️ Review screenshots/evidence
5. ☑️ Update coverage report

---

**REMEMBER**:
- **ASSUME NOTHING** - Test everything explicitly
- **EVIDENCE-BASED** - Prove it works, don't assume
- **SYSTEMATIC** - Follow the process every time
- **COMPREHENSIVE** - Cover happy path + edge cases

---

**Version**: 2.0
**Last Updated**: 2025-11-03
**Status**: MANDATORY for all WeSign UI testing
