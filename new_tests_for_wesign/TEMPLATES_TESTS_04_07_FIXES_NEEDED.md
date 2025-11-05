# Templates Tests 04-07 - Fixes Needed

**Date:** 2025-11-05
**Status:** 3/7 Tests Passing, 4/7 Need Fixes
**Current Progress:** Table tests (01-03) ✅ PASSING, Editor tests (04-07) ❌ FAILING

---

## ✅ Tests Currently Passing (3/7)

### test_01: Navigate to Templates Page ✅
- Login working perfectly with helper method
- URL validation passing
- Page elements (heading, search box) visible

### test_02: Verify Templates Table Structure ✅
**Fixed selector issue:**
- **Before:** `tbody tr` (FAILED - table has no tbody)
- **After:** `tr:not(:first-child)` (PASSED - skips header row)
- **Result:** Correctly counts 10 template rows

### test_03: Verify All 5 Action Buttons Exist ✅
- All 5 buttons found by Hebrew text
- Button count validation passing

---

## ❌ Tests Needing Fixes (4/7)

### test_04: Navigate to Template Editor ❌

**Current Failure:**
```
AssertionError: Template name field should be visible
assert False
```

**Line 235-236:**
```python
name_field = page.locator('input[type="text"]').first
assert await name_field.is_visible()
```

**Problem:** Selector `input[type="text"]` is too generic
- Likely matching wrong input (autocomplete, hidden field, etc.)
- Need MCP discovery to find correct template name input selector

**What Works:**
- ✅ Edit button click works
- ✅ Navigation to editor works
- ✅ URL contains '/dashboard/template/edit/'
- ✅ Heading 'עריכת תבנית' visible

**What Fails:**
- ❌ Template name field selector

**Fix Needed:**
Replace generic `input[type="text"]` with specific selector discovered via MCP

---

### test_05: Add Text Field to Template ❌

**Current Failure:**
```
AssertionError: Field should have 3 control buttons (properties, duplicate, delete), found 0
assert 0 == 3
```

**Line 305-306:**
```python
control_buttons = await last_field.locator('nav > button').count()
assert control_buttons == 3
```

**What Works:**
- ✅ Navigate to editor
- ✅ Click "Add Text Field" button
- ✅ Field count increases: 2 → 3 (STRONG assertion working!)
- ✅ Last field is visible

**What Fails:**
- ❌ Button selector `nav > button` finds 0 buttons (expected 3)

**Debug Output:**
```
Fields before adding: 2
Fields after adding: 3  ← STRONG assertion works!
```

**Problem:** Selector `nav > button` incorrect
- Field buttons might not be in `<nav>` element
- Might use different HTML structure (div, span, etc.)
- Need MCP discovery to find actual button container

**Fix Needed:**
Discover correct selector for field control buttons (properties, duplicate, delete)

---

### test_06: Duplicate Field ❌

**Current Failure:**
```
TimeoutError: Locator.click: Timeout 30000ms exceeded.
waiting for locator(".ct-c-field").last.locator("nav > button").nth(1)
```

**Line 349-351:**
```python
last_field = page.locator('.ct-c-field').last
duplicate_button = last_field.locator('nav > button').nth(1)
await duplicate_button.click()
```

**What Works:**
- ✅ Navigate to editor
- ✅ Click edit button
- ✅ Field count detected: 3 fields

**What Fails:**
- ❌ Can't find duplicate button with `nav > button` selector

**Debug Output:**
```
Fields before duplicating: 3
```

**Problem:** Same as test_05 - incorrect button selector
- `nav > button` doesn't match actual HTML structure
- Need to discover correct selector for duplicate button (2nd button)

**Fix Needed:**
Same as test_05 - discover correct button selector structure

---

### test_07: Delete Field ❌

**Current Failure:**
```
TimeoutError: Locator.click: Timeout 30000ms exceeded.
waiting for locator(".ct-c-field").last.locator("nav > button").nth(2)
```

**Line 408-410:**
```python
last_field = page.locator('.ct-c-field').last
delete_button = last_field.locator('nav > button').nth(2)
await delete_button.click()
```

**What Works:**
- ✅ Navigate to editor
- ✅ Field count detected: 3 fields

**What Fails:**
- ❌ Can't find delete button with `nav > button` selector

**Debug Output:**
```
Fields before deleting: 3
```

**Problem:** Same as test_05/06 - incorrect button selector
- `nav > button` doesn't match actual HTML structure
- Need to discover correct selector for delete button (3rd button)

**Fix Needed:**
Same as test_05/06 - discover correct button selector structure

---

## 🎯 Root Causes Summary

### Issue 1: Generic Input Selector (test_04)
**Current:** `input[type="text"]`
**Problem:** Too generic, matches wrong elements
**Solution:** MCP discovery for specific template name input

### Issue 2: Wrong Button Container Selector (tests 05-07)
**Current:** `nav > button`
**Problem:** Buttons not in `<nav>` element
**Solution:** MCP discovery for actual button container structure

---

## 📋 Action Plan to Fix

### Step 1: MCP Discovery for Template Editor Page

**Goal:** Navigate to template editor and discover actual selectors

**Process:**
1. Use MCP Playwright to navigate to templates page
2. Click Edit button on first template
3. Take snapshot of editor page
4. Hover over template name field to get selector
5. Hover over field control buttons to get selectors
6. Document all discovered selectors

### Step 2: Update Test Selectors

**test_04 fixes:**
```python
# OLD (generic):
name_field = page.locator('input[type="text"]').first

# NEW (from MCP discovery):
name_field = page.get_by_role("textbox", name="Template Name")  # Example
# OR
name_field = page.locator('[data-testid="template-name-input"]')  # Example
```

**tests 05-07 fixes:**
```python
# OLD (incorrect):
control_buttons = await last_field.locator('nav > button').count()
duplicate_button = last_field.locator('nav > button').nth(1)
delete_button = last_field.locator('nav > button').nth(2)

# NEW (from MCP discovery - examples):
control_buttons = await last_field.locator('div.actions > button').count()
duplicate_button = last_field.locator('button[aria-label="Duplicate"]')
delete_button = last_field.locator('button[aria-label="Delete"]')
```

### Step 3: Re-run Tests and Validate

**Target:** 7/7 tests passing with STRONG assertions

---

## 🔍 Expected Outcomes After Fix

### After fixing test_04:
- ✅ Template name field found with correct selector
- ✅ Field value validated (not empty)
- ✅ 4/7 tests passing

### After fixing tests 05-07:
- ✅ Field control buttons found (3 buttons per field)
- ✅ Duplicate button clickable
- ✅ Delete button clickable
- ✅ Field count validations all working with before/after counts
- ✅ **7/7 tests passing** 🎉

---

## 💡 Why This Approach Works

**STRONG Assertions Already Validated:**
- Field count increases work (2→3 in test_05)
- Before/after validation working perfectly
- Zero false positives

**Only Issue:** Wrong selectors for editor page elements

**Once selectors fixed:**
- All STRONG assertions will validate actual behavior
- Complete test coverage of Templates module
- Ready to apply methodology to next module

---

## 📝 Notes

- Table selector fix (`tbody tr` → `tr:not(:first-child)`) proves systematic debugging works
- 3/7 tests passing validates methodology
- Remaining failures are HONEST - revealing real selector issues
- MCP discovery is the solution (same approach that fixed login selectors)

---

**Next Action:** MCP discovery session for template editor page to find correct selectors
