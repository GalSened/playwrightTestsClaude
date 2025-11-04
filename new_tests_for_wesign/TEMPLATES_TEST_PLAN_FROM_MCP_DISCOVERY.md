# Templates Module - Comprehensive Test Plan
**Date**: 2025-11-04
**Based on**: MCP Discovery Session (TEMPLATES_MCP_DISCOVERY_SESSION.md)
**Approach**: Write tests with STRONG assertions using real locators discovered via MCP

---

## Test Strategy

### Principles
1. **STRONG Assertions Only** - No `assert True`, no `isinstance()` without value checks
2. **Before/After State Validation** - Count items, verify changes occurred
3. **Real Locators** - Use selectors discovered via MCP, not guessed
4. **Visibility Checks** - Verify elements are actually visible, not just exist
5. **URL Validation** - Check page navigation actually happened

---

## Test Suite 1: Navigation & Page Structure (Priority: HIGH)

### Test 1.1: Navigate to Templates Page
**Goal**: Verify templates page loads correctly

**Steps**:
1. Login to application
2. Click "תבניות" button
3. Wait for page load

**STRONG Assertions**:
```python
# Verify URL
assert page.url == "https://devtest.comda.co.il/dashboard/templates"

# Verify heading visible
heading = page.locator('h1:has-text("תבניות")')
assert await heading.is_visible()

# Verify search box exists
search = page.locator('searchbox:has-text("חיפוש תבניות")')
assert await search.is_visible()
```

**Locators Discovered via MCP**:
- Templates button: `button:has-text("תבניות")`
- Page heading: `h1:has-text("תבניות")`
- Search box: `searchbox:has-text("חיפוש תבניות")`

---

### Test 1.2: Verify Templates Table Structure
**Goal**: Validate table exists and has correct columns

**STRONG Assertions**:
```python
# Verify table exists and is visible
table = page.locator('table')
assert await table.is_visible()

# Verify headers exist (Hebrew column names)
assert await page.locator('cell:has-text("כותרת")').is_visible()  # Title
assert await page.locator('cell:has-text("נוצר על ידי")').is_visible()  # Created by
assert await page.locator('cell:has-text("תאריך יצירה")').is_visible()  # Creation date

# Verify at least one template row exists
rows = await table.locator('tbody tr').count()
assert rows > 0, f"Expected at least 1 template row, found {rows}"
```

---

### Test 1.3: Verify All 5 Action Buttons Exist
**Goal**: Confirm all 5 action buttons are present on first template row

**STRONG Assertions**:
```python
# Get first template row
first_row = page.locator('tbody tr').first

# Verify each action button by Hebrew text
assert await first_row.locator('button:has-text("ערוך")').is_visible()  # Edit
assert await first_row.locator('button:has-text("שכפל")').is_visible()  # Duplicate
assert await first_row.locator('button:has-text("URL")').is_visible()  # Share
assert await first_row.locator('button:has-text("הורדת תבנית")').is_visible()  # Download
assert await first_row.locator('button:has-text("מחיקה")').is_visible()  # Delete

# Verify exactly 5 action buttons
action_buttons = await first_row.locator('button').count()
assert action_buttons == 5, f"Expected 5 action buttons, found {action_buttons}"
```

---

## Test Suite 2: Edit Template & Field Management (Priority: CRITICAL)

### Test 2.1: Navigate to Template Editor
**Goal**: Verify edit button opens template editor page

**Steps**:
1. Navigate to templates page
2. Click "ערוך" (Edit) button on first template
3. Wait for editor page to load

**STRONG Assertions**:
```python
# Capture template name before editing
template_name = await page.locator('tbody tr').first.locator('cell').nth(1).text_content()

# Click edit button
await page.locator('button:has-text("ערוך")').first.click()

# Verify URL changed to edit page
await page.wait_for_url(lambda url: "/dashboard/template/edit/" in url, timeout=5000)
assert "/dashboard/template/edit/" in page.url

# Verify editor heading visible
heading = page.locator('h1:has-text("עריכת תבנית")')
assert await heading.is_visible()

# Verify template name field contains expected name
name_field = page.locator('textbox[name="Name"]')
actual_name = await name_field.input_value()
assert actual_name == template_name, f"Expected '{template_name}', got '{actual_name}'"
```

**Locators Discovered via MCP**:
- Edit button: `button:has-text("ערוך")`
- Editor heading: `h1:has-text("עריכת תבנית")`
- Template name field: `textbox[name="Name"]`

---

### Test 2.2: Add Text Field to Template
**Goal**: Validate adding a text field increases field count

**Steps**:
1. Navigate to template editor
2. Count fields before adding
3. Click "טקסט" (Text) button
4. Count fields after adding

**STRONG Assertions**:
```python
# Count fields BEFORE adding
fields_before = await page.locator('.ct-c-field').count()

# Click text field button
await page.locator('button:has-text("טקסט")').click()
await page.wait_for_timeout(500)  # Brief wait for field to appear

# Count fields AFTER adding
fields_after = await page.locator('.ct-c-field').count()

# STRONG assertion - count increased by exactly 1
assert fields_after == fields_before + 1, f"Expected {fields_before + 1} fields after adding, got {fields_after}"

# Verify new field is visible
last_field = page.locator('.ct-c-field').last
assert await last_field.is_visible(), "Newly added field should be visible"

# Verify field has 3 control buttons
control_buttons = await last_field.locator('nav > button').count()
assert control_buttons == 3, f"Expected 3 control buttons, got {control_buttons}"
```

**Locators Discovered via MCP**:
- Text field button: `button:has-text("טקסט")`
- Field container: `.ct-c-field`
- Field control buttons: `.ct-c-field > nav > button`

---

### Test 2.3: Duplicate Field
**Goal**: Verify duplicate button creates a copy of the field

**Steps**:
1. Add a text field
2. Count fields before duplicating
3. Click duplicate button (2nd button)
4. Count fields after duplicating

**STRONG Assertions**:
```python
# Add initial field
await page.locator('button:has-text("טקסט")').click()
await page.wait_for_timeout(500)

# Count fields BEFORE duplicating
fields_before = await page.locator('.ct-c-field').count()

# Click duplicate button on last field (2nd control button)
last_field = page.locator('.ct-c-field').last
await last_field.locator('nav > button:nth-child(2)').click()
await page.wait_for_timeout(500)

# Count fields AFTER duplicating
fields_after = await page.locator('.ct-c-field').count()

# STRONG assertion - count increased by exactly 1
assert fields_after == fields_before + 1, f"Expected {fields_before + 1} fields after duplicating, got {fields_after}"

# Verify both fields are visible
assert await page.locator('.ct-c-field').nth(-2).is_visible(), "Original field should be visible"
assert await page.locator('.ct-c-field').nth(-1).is_visible(), "Duplicated field should be visible"
```

**Locators Discovered via MCP**:
- Duplicate button: `.ct-c-field > nav > button:nth-child(2)`

---

### Test 2.4: Delete Field
**Goal**: Verify delete button removes the field

**Steps**:
1. Add a text field
2. Count fields before deleting
3. Click delete button (3rd button)
4. Count fields after deleting

**STRONG Assertions**:
```python
# Add initial field
await page.locator('button:has-text("טקסט")').click()
await page.wait_for_timeout(500)

# Count fields BEFORE deleting
fields_before = await page.locator('.ct-c-field').count()
assert fields_before > 0, "Need at least one field to delete"

# Click delete button on last field (3rd control button)
last_field = page.locator('.ct-c-field').last
await last_field.locator('nav > button:nth-child(3)').click()
await page.wait_for_timeout(500)

# Count fields AFTER deleting
fields_after = await page.locator('.ct-c-field').count()

# STRONG assertion - count decreased by exactly 1
assert fields_after == fields_before - 1, f"Expected {fields_before - 1} fields after deleting, got {fields_after}"
```

**Locators Discovered via MCP**:
- Delete button: `.ct-c-field > nav > button:nth-child(3)`

---

### Test 2.5: Open Field Properties Modal
**Goal**: Verify properties button opens modal with field settings

**Steps**:
1. Add a text field
2. Click properties button (1st button)
3. Verify modal appears with expected elements

**STRONG Assertions**:
```python
# Add initial field
await page.locator('button:has-text("טקסט")').click()
await page.wait_for_timeout(500)

# Click properties button on last field (1st control button)
last_field = page.locator('.ct-c-field').last
await last_field.locator('nav > button:nth-child(1)').click()
await page.wait_for_timeout(500)

# Verify modal heading exists
modal_heading = page.locator('h3:has-text("טקסט")')
assert await modal_heading.is_visible(), "Field properties modal should have heading"

# Verify field name textbox exists and has a value
name_textbox = page.locator('textbox').filter(has_text='שם השדה')
assert await name_textbox.is_visible(), "Field name textbox should be visible"
name_value = await name_textbox.input_value()
assert len(name_value) > 0, "Field name should have a generated value"

# Verify required checkbox exists
required_checkbox = page.locator('checkbox:has-text("שדה חובה")')
assert await required_checkbox.is_visible(), "Required field checkbox should be visible"

# Verify Cancel and Confirm buttons exist
cancel_btn = page.locator('button:has-text("ביטול")')
confirm_btn = page.locator('button:has-text("אישור")')
assert await cancel_btn.is_visible(), "Cancel button should be visible"
assert await confirm_btn.is_visible(), "Confirm button should be visible"

# Close modal
await cancel_btn.click()
await page.wait_for_timeout(300)

# Verify modal closed
assert not await modal_heading.is_visible(), "Modal should be closed after clicking cancel"
```

**Locators Discovered via MCP**:
- Properties button: `.ct-c-field > nav > button:nth-child(1)`
- Modal heading: `h3:has-text("טקסט")`
- Field name label: text "שם השדה"
- Required checkbox: `checkbox:has-text("שדה חובה")`
- Cancel button: `button:has-text("ביטול")`
- Confirm button: `button:has-text("אישור")`

---

### Test 2.6: Test All 10 Field Types
**Goal**: Verify all 10 field types can be added

**Steps**:
1. For each field type, click button and verify field appears

**STRONG Assertions**:
```python
field_types = [
    "טקסט",  # Text
    "חתימה",  # Signature
    "ראשי תיבות",  # Initials
    'דוא"ל',  # Email
    "טלפון",  # Phone
    "תאריך",  # Date
    "מספר",  # Number
    "רשימה",  # List
    "תיבת סימון",  # Checkbox
    "רדיו"  # Radio
]

for i, field_type in enumerate(field_types, 1):
    # Count before adding
    fields_before = await page.locator('.ct-c-field').count()

    # Click field type button
    await page.locator(f'button:has-text("{field_type}")').click()
    await page.wait_for_timeout(300)

    # Count after adding
    fields_after = await page.locator('.ct-c-field').count()

    # STRONG assertion for each field type
    assert fields_after == fields_before + 1, f"Field type '{field_type}' failed to add: expected {fields_before + 1}, got {fields_after}"

    # Verify field is visible
    assert await page.locator('.ct-c-field').last.is_visible(), f"Field type '{field_type}' should be visible"
```

---

## Test Suite 3: Save & Navigation (Priority: HIGH)

### Test 3.1: Save Template Changes
**Goal**: Verify save button persists changes

**Steps**:
1. Edit template name
2. Click save
3. Navigate back and verify change persisted

**STRONG Assertions**:
```python
# Generate unique template name
import time
new_name = f"Test_Template_{int(time.time())}"

# Edit template name
name_field = page.locator('textbox[name="Name"]')
await name_field.fill(new_name)

# Click save button
await page.locator('button:has-text("שמור")').click()
await page.wait_for_timeout(1000)

# Navigate back to templates list
await page.locator('button:has-text("חזור")').click()
await page.wait_for_url("**/dashboard/templates", timeout=5000)

# Find template by new name in table
template_cell = page.locator(f'cell:has-text("{new_name}")')
assert await template_cell.is_visible(), f"Template with name '{new_name}' should appear in table after saving"
```

---

### Test 3.2: Cancel Without Saving
**Goal**: Verify back button doesn't save changes

**Steps**:
1. Note original template name
2. Change template name
3. Click back without saving
4. Verify name unchanged

**STRONG Assertions**:
```python
# Get original name
name_field = page.locator('textbox[name="Name"]')
original_name = await name_field.input_value()

# Change name
temp_name = f"TempName_{int(time.time())}"
await name_field.fill(temp_name)

# Click back WITHOUT saving
await page.locator('button:has-text("חזור")').click()
await page.wait_for_url("**/dashboard/templates", timeout=5000)

# Verify original name still in table
original_cell = page.locator(f'cell:has-text("{original_name}")')
assert await original_cell.is_visible(), f"Original template name '{original_name}' should still appear (changes not saved)"

# Verify temp name NOT in table
temp_cell = page.locator(f'cell:has-text("{temp_name}")')
assert not await temp_cell.is_visible(), f"Temporary name '{temp_name}' should NOT appear (changes not saved)"
```

---

## Test Execution Order

### Phase 1: Core Navigation (Run First)
- Test 1.1: Navigate to Templates Page
- Test 1.2: Verify Templates Table Structure
- Test 1.3: Verify All 5 Action Buttons Exist

### Phase 2: Template Editor (Critical Path)
- Test 2.1: Navigate to Template Editor
- Test 2.6: Test All 10 Field Types (validates field buttons work)

### Phase 3: Field Management (Core Functionality)
- Test 2.2: Add Text Field to Template
- Test 2.3: Duplicate Field
- Test 2.4: Delete Field
- Test 2.5: Open Field Properties Modal

### Phase 4: Save & Persistence
- Test 3.1: Save Template Changes
- Test 3.2: Cancel Without Saving

---

## Success Criteria

### Minimum Acceptable (≥50%)
- All Phase 1 tests passing (navigation works)
- At least 1 field type can be added
- Save functionality works

### Target (≥75%)
- All Phase 1 & 2 tests passing
- At least 5 field types work
- Add, duplicate, delete all work

### Stretch Goal (≥90%)
- All 10 field types validated
- All CRUD operations working
- Strong assertions validating actual state changes

---

## Next Steps

1. **Create test file**: `tests/templates/test_templates_real_validation.py`
2. **Implement Phase 1 tests** (3 tests)
3. **Run and validate** - get actual pass rate with STRONG assertions
4. **Compare to existing tests** - prove the difference between weak and strong assertions
5. **Continue with Phase 2-4** based on Phase 1 results

---

**Key Difference from Existing Tests**:
- ❌ Old: `assert True, "Navigation should work"` (always passes)
- ✅ New: `assert page.url == "https://devtest.comda.co.il/dashboard/templates"` (validates actual navigation)

- ❌ Old: `assert isinstance(can_add, bool)` (passes for True or False)
- ✅ New: `assert fields_after == fields_before + 1` (validates field was actually added)

This is the fundamental difference you identified!
