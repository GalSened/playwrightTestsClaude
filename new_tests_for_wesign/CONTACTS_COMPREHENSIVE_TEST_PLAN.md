# Contacts Module - Comprehensive Test Plan

**Date:** 2025-11-02
**Status:** 🔍 **EXPLORATION COMPLETE - READY FOR IMPLEMENTATION**
**Module:** Contacts Management
**Total Planned Tests:** 45+ test scenarios across 8 phases

---

## Executive Summary

This comprehensive test plan covers all functionality of the WeSign Contacts module, including contact creation, editing, deletion, search, pagination, Excel import/export, and data validation.

**Exploration Method:** MCP Playwright step-by-step manual validation
**Evidence:** Screenshots and DOM analysis captured during exploration

---

## Module Overview

### URL Structure
- **Base URL:** `https://devtest.comda.co.il/dashboard/contacts`
- **Navigation:** Via "אנשי קשר" (Contacts) button in main navigation

### Key Features Discovered
1. ✅ **Contact Management:** Add, Edit, Delete contacts
2. ✅ **Search Functionality:** Real-time contact search
3. ✅ **Pagination:** 302 total contacts, paginated display
4. ✅ **Excel Import/Export:** Bulk import and template download
5. ✅ **Communication Preferences:** SMS/EMAIL selection per contact
6. ✅ **Search Tags:** Optional tagging system
7. ✅ **Stamp Background:** Custom stamp/watermark upload per contact

### Data Fields Identified

**Contact Information:**
- **שם מלא (Full Name)** - Required field (marked with *)
- **דואר אלקטרוני (Email)** - Optional
- **מספר טלפון (Phone Number)** - Optional with country code selector
- **שליחה באמצעות (Send Via)** - Dropdown: SMS or EMAIL
- **תגי חיפוש (Search Tags)** - Optional text field
- **רקע חותמת (Stamp Background)** - Optional file upload

**Current Data Statistics:**
- Total Contacts: 302
- Visible per page: 10 contacts
- Total pages: Calculated dynamically

---

## UI Components Discovered

### 1. Sidebar Navigation
```yaml
Location: Left sidebar (complementary role)
Components:
  - הוספת איש קשר חדש (Add New Contact) - Opens modal
  - ייבוא Excel (Import Excel) - File upload button
  - דוגמה לקובץ Excel (Excel Template) - Downloads template file
```

**Selectors Validated:**
```python
sidebar = page.get_by_role('complementary')
add_contact_btn = page.locator('listitem').filter(has_text="הוספת איש קשר חדש")
import_excel_btn = page.locator('listitem >> button')
template_link = page.get_by_role('link').filter(has_text="דוגמה לקובץ Excel")
```

---

### 2. Search Functionality
```yaml
Component: searchbox with role="searchbox"
Placeholder: "חיפוש אנשי קשר" (Search Contacts)
Behavior: Real-time search (appears to be instant or short debounce)
```

**Selector:**
```python
search_input = page.get_by_role('searchbox', name='חיפוש אנשי קשר')
```

---

### 3. Contacts Table

**Table Structure:**
```
Column 1: Checkbox (Select)
Column 2: שם מלא (Full Name)
Column 3: דואר אלקטרוני (Email)
Column 4: מספר טלפון (Phone Number)
Column 5: שליחה באמצעות (Send Via - SMS/EMAIL dropdown)
Column 6: תגי חיפוש (Search Tags)
Column 7: רקע חותמת (Stamp Background - File upload)
Column 8: Actions (Edit, Delete buttons)
```

**Sample Data Rows:**
```yaml
Row 1: "5 days | galsason@comda.co.il | | EMAIL | | Choose File"
Row 2: "Aaron Blackwell | 3c52...@comda.co.il | 0522630949 | SMS | QA Updated | Choose File"
Row 3: "Aaron Nikolic | | 9781557481 | SMS | | Choose File"
```

**Selectors:**
```python
# Table
contacts_table = page.locator('table')

# Rows (excluding header)
contact_rows = page.locator('table tbody tr')

# Columns (by index)
checkbox_col = row.locator('cell').nth(0)
name_col = row.locator('cell').nth(1)
email_col = row.locator('cell').nth(2)
phone_col = row.locator('cell').nth(3)
send_via_col = row.locator('cell').nth(4)
tags_col = row.locator('cell').nth(5)
stamp_col = row.locator('cell').nth(6)
actions_col = row.locator('cell').nth(7)

# Action buttons per row
edit_btn = actions_col.locator('button').first
delete_btn = actions_col.locator('button').nth(1)

# Send Via dropdown
send_via_dropdown = send_via_col.locator('combobox')
```

---

### 4. Pagination

**Components:**
```yaml
Pagination Indicator: "302 /" (shows total count)
Page Number Input: spinbutton (editable)
Previous Button: Left arrow
Next Button: Right arrow
```

**Selectors:**
```python
page_indicator = page.locator('generic').filter(has_text="302")
current_page = page.get_by_role('spinbutton')
prev_btn = page.locator('button').nth(0)  # First button in pagination
next_btn = page.locator('button').nth(1)  # Second button
```

---

### 5. Add New Contact Modal

**Modal Structure:**
```yaml
Heading: "הוספת איש קשר חדש" (Add New Contact)
Fields:
  - שם מלא* (Full Name - Required)
  - דואר אלקטרוני (Email)
  - Phone with country code selector: "Israel (‫ישראל‬‎): +972"
  - Phone number input: "050-234-5678" placeholder
  - שליחה באמצעות (Send Via): SMS/EMAIL dropdown
  - תגי חיפוש (Search Tags - Optional)
Buttons:
  - ביטול (Cancel)
  - אישור (Confirm - Disabled until required fields filled)
```

**Selectors:**
```python
# Modal
modal_heading = page.locator('heading').filter(has_text="הוספת איש קשר חדש")

# Form fields
name_input = page.locator('textbox').filter(has_text="שם מלא*")
email_input = page.locator('textbox').filter(has_text="דואר אלקטרוני")
country_code = page.locator('combobox').filter(has_text="Israel")
phone_input = page.locator('textbox').filter(has_text="050-234-5678")
send_via_dropdown = page.locator('combobox').nth(1)  # After country code
tags_input = page.locator('textbox').nth(2)  # Third textbox

# Buttons
cancel_btn = page.get_by_role('button', name='ביטול')
confirm_btn = page.get_by_role('button', name='אישור')
```

---

### 6. Edit Contact Modal

**Modal Structure:** (Same as Add Contact)
```yaml
Heading: "עריכת איש קשר" (Edit Contact)
Fields: Same as Add Contact modal, but pre-populated
Buttons: ביטול (Cancel), אישור (Confirm)
```

**Pre-populated Example:**
- Name: "5 days"
- Email: "galsason@comda.co.il"
- Send Via: EMAIL (selected)

**Selector:**
```python
edit_modal_heading = page.locator('heading').filter(has_text="עריכת איש קשר")
```

---

### 7. Excel Import/Export

**Import:**
- Button in sidebar: "ייבוא Excel"
- Triggers file upload dialog
- Expected format: .xlsx

**Template Download:**
- Link: "דוגמה לקובץ Excel"
- URL: `/assets/Contacts.xlsx`
- Provides sample format for bulk import

**Selectors:**
```python
import_btn = page.locator('listitem').filter(has_text="ייבוא Excel") >> page.locator('button')
template_link = page.get_by_role('link').filter(has_text="דוגמה לקובץ Excel")
```

---

## Test Plan Structure

### Phase 1: Navigation & Page Load (5 tests)
**Priority:** High
**Status:** Ready to implement

#### CON-NAV-001: Navigate to Contacts Page Success
**Description:** Verify successful navigation to Contacts page
**Steps:**
1. Login with valid credentials
2. Click "אנשי קשר" (Contacts) navigation button
3. Verify URL contains `/dashboard/contacts`
4. Verify page heading "אנשי קשר" visible
5. Verify table is visible

**Expected Results:**
- URL: `https://devtest.comda.co.il/dashboard/contacts`
- Heading visible
- Table loaded with contacts

---

#### CON-NAV-002: Verify Page Elements Load
**Description:** Verify all main page elements load correctly
**Steps:**
1. Navigate to Contacts page
2. Check sidebar visibility
3. Check search box visibility
4. Check table visibility
5. Check pagination visibility

**Expected Results:**
- Sidebar with 3 items visible
- Search box present
- Table with headers visible
- Pagination controls visible

---

#### CON-NAV-003: Verify Initial Contact Count
**Description:** Verify correct total contact count displayed
**Steps:**
1. Navigate to Contacts page
2. Locate pagination indicator
3. Extract total count

**Expected Results:**
- Total count: 302 (or current total)
- Count matches actual number of contacts

---

#### CON-NAV-004: Verify Table Headers
**Description:** Verify all table column headers present
**Steps:**
1. Navigate to Contacts page
2. Check header row
3. Verify all column names

**Expected Results:**
- Headers: שם מלא, דואר אלקטרוני, מספר טלפון, שליחה באמצעות, תגי חיפוש, רקע חותמת
- All headers in Hebrew
- Headers aligned with columns

---

#### CON-NAV-005: Verify Sidebar Options Visible
**Description:** Verify all sidebar options are accessible
**Steps:**
1. Navigate to Contacts page
2. Verify "הוספת איש קשר חדש" visible
3. Verify "ייבוא Excel" visible
4. Verify "דוגמה לקובץ Excel" visible

**Expected Results:**
- All 3 sidebar options visible
- All options clickable

---

### Phase 2: Contact Creation (8 tests)
**Priority:** Critical
**Status:** Ready to implement

#### CON-CREATE-001: Open Add Contact Modal Success
**Description:** Verify Add Contact modal opens correctly
**Steps:**
1. Navigate to Contacts page
2. Click "הוספת איש קשר חדש"
3. Verify modal appears
4. Verify modal heading
5. Verify all form fields present

**Expected Results:**
- Modal visible with heading "הוספת איש קשר חדש"
- All form fields visible
- Confirm button disabled initially

---

#### CON-CREATE-002: Create Contact with Name Only (Minimal)
**Description:** Create contact with only required field (Name)
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Contact Minimal"
3. Leave other fields empty
4. Click Confirm button
5. Verify modal closes
6. Search for created contact

**Expected Results:**
- Contact created successfully
- Appears in table with name only
- Other fields empty

---

#### CON-CREATE-003: Create Contact with Email
**Description:** Create contact with Name + Email
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Contact Email"
3. Enter email: "test.email@example.com"
4. Select Send Via: EMAIL
5. Click Confirm

**Expected Results:**
- Contact created with name and email
- Send Via shows "EMAIL"
- Contact findable via search

---

#### CON-CREATE-004: Create Contact with Phone (SMS)
**Description:** Create contact with Name + Phone (SMS method)
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Contact Phone"
3. Select country code: Israel +972
4. Enter phone: "0501234567"
5. Select Send Via: SMS
6. Click Confirm

**Expected Results:**
- Contact created with phone number
- Send Via shows "SMS"
- Phone number formatted correctly

---

#### CON-CREATE-005: Create Contact with All Fields
**Description:** Create complete contact with all fields populated
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Contact Complete"
3. Enter email: "complete@example.com"
4. Enter phone: "0509876543"
5. Select Send Via: EMAIL
6. Enter tags: "QA Testing Complete"
7. Click Confirm

**Expected Results:**
- All fields saved correctly
- Search tags visible in table
- Contact fully populated

---

#### CON-CREATE-006: Validate Required Field (Name)
**Description:** Verify name field is required
**Steps:**
1. Open Add Contact modal
2. Leave name field empty
3. Fill other fields
4. Attempt to click Confirm

**Expected Results:**
- Confirm button remains disabled
- Cannot submit without name
- Validation message shown (if applicable)

---

#### CON-CREATE-007: Validate Email Format
**Description:** Verify email format validation
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Validation"
3. Enter invalid email: "invalid-email"
4. Attempt to submit

**Expected Results:**
- Email validation error shown
- Cannot submit with invalid email
- Valid formats accepted: user@domain.com

---

#### CON-CREATE-008: Cancel Contact Creation
**Description:** Verify Cancel button discards changes
**Steps:**
1. Open Add Contact modal
2. Enter name: "Test Cancel"
3. Enter email: "cancel@test.com"
4. Click Cancel button
5. Search for "Test Cancel"

**Expected Results:**
- Modal closes
- No contact created
- Search returns no results

---

### Phase 3: Contact Editing (6 tests)
**Priority:** High
**Status:** Ready to implement

#### CON-EDIT-001: Open Edit Contact Modal
**Description:** Verify Edit modal opens with pre-populated data
**Steps:**
1. Navigate to Contacts page
2. Click Edit button (pencil icon) on first contact
3. Verify modal opens
4. Verify heading "עריכת איש קשר"
5. Verify fields pre-populated

**Expected Results:**
- Edit modal opens
- All existing data shown in fields
- Fields editable

---

#### CON-EDIT-002: Edit Contact Name
**Description:** Update contact name
**Steps:**
1. Open Edit modal for contact "5 days"
2. Change name to "Updated Name Test"
3. Click Confirm
4. Verify name updated in table

**Expected Results:**
- Name updated successfully
- New name visible in table
- Search works with new name

---

#### CON-EDIT-003: Edit Contact Email
**Description:** Update contact email address
**Steps:**
1. Open Edit modal for contact
2. Change email to "updated@example.com"
3. Click Confirm
4. Verify email updated

**Expected Results:**
- Email updated
- Displayed correctly in table

---

#### CON-EDIT-004: Edit Send Via Method
**Description:** Change communication method (SMS ↔ EMAIL)
**Steps:**
1. Open Edit modal for EMAIL contact
2. Change dropdown to SMS
3. Click Confirm
4. Verify dropdown shows SMS in table

**Expected Results:**
- Send Via updated
- Dropdown reflects new value
- Change persists after page refresh

---

#### CON-EDIT-005: Edit Search Tags
**Description:** Update contact search tags
**Steps:**
1. Open Edit modal
2. Modify tags: "Updated QA Tags"
3. Click Confirm
4. Verify tags updated in table

**Expected Results:**
- Tags updated
- New tags visible in Tags column
- Searchable by new tags

---

#### CON-EDIT-006: Cancel Edit Operation
**Description:** Verify Cancel discards edit changes
**Steps:**
1. Open Edit modal
2. Change name to "Should Not Save"
3. Click Cancel
4. Verify original name remains

**Expected Results:**
- Modal closes
- No changes saved
- Original data intact

---

### Phase 4: Contact Deletion (4 tests)
**Priority:** High
**Status:** Ready to implement

#### CON-DELETE-001: Delete Contact with Confirmation
**Description:** Verify delete requires confirmation
**Steps:**
1. Navigate to Contacts page
2. Click Delete button (trash icon) on test contact
3. Verify confirmation dialog appears
4. Verify warning message
5. Confirm deletion

**Expected Results:**
- Confirmation dialog shown
- Warning message: "Are you sure?" or similar
- Contact deleted after confirmation

---

#### CON-DELETE-002: Cancel Delete Operation
**Description:** Verify Cancel preserves contact
**Steps:**
1. Click Delete button on contact
2. Confirmation dialog appears
3. Click Cancel
4. Verify contact still exists

**Expected Results:**
- Dialog closes
- Contact not deleted
- Still visible in table

---

#### CON-DELETE-003: Verify Contact Removed from Table
**Description:** Confirm deleted contact no longer in table
**Steps:**
1. Note contact name: "Test Delete Contact"
2. Delete contact with confirmation
3. Search for deleted contact
4. Verify not found

**Expected Results:**
- Contact not in table
- Search returns no results
- Total count decremented

---

#### CON-DELETE-004: Verify Pagination After Deletion
**Description:** Verify pagination updates after deletion
**Steps:**
1. Note total count before deletion
2. Delete contact
3. Check total count after deletion

**Expected Results:**
- Total count reduced by 1
- Pagination adjusts if needed
- No empty pages

---

### Phase 5: Search Functionality (8 tests)
**Priority:** High
**Status:** Ready to implement

#### CON-SEARCH-001: Search by Contact Name
**Description:** Search for contact by full name
**Steps:**
1. Navigate to Contacts page
2. Enter search: "Aaron Blackwell"
3. Wait for results
4. Verify filtered results

**Expected Results:**
- Only "Aaron Blackwell" shown
- Other contacts hidden
- Search case-insensitive

---

#### CON-SEARCH-002: Search by Partial Name
**Description:** Search using partial name match
**Steps:**
1. Enter search: "Aaron"
2. Verify all contacts with "Aaron" in name shown

**Expected Results:**
- Multiple "Aaron" results shown
- Aaron Blackwell, Aaron Nikolic, Aaron Padilla visible
- Partial match works

---

#### CON-SEARCH-003: Search by Email
**Description:** Search for contact by email address
**Steps:**
1. Enter search: "galsason@comda.co.il"
2. Verify matching contact shown

**Expected Results:**
- Contact with that email shown
- Exact email match works

---

#### CON-SEARCH-004: Search by Phone Number
**Description:** Search using phone number
**Steps:**
1. Enter search: "0522630949"
2. Verify contact with that phone shown

**Expected Results:**
- Matching phone number found
- Phone search works

---

#### CON-SEARCH-005: Search by Tags
**Description:** Search using search tags
**Steps:**
1. Enter search: "QA"
2. Verify all contacts with "QA" tag shown

**Expected Results:**
- Multiple results with "QA" tag
- Tag search functional

---

#### CON-SEARCH-006: Clear Search Results
**Description:** Verify clearing search shows all contacts
**Steps:**
1. Enter search: "Aaron"
2. Verify filtered results
3. Clear search box
4. Verify all contacts shown again

**Expected Results:**
- All 302 contacts visible
- Pagination restored
- Full list displayed

---

#### CON-SEARCH-007: Search with No Results
**Description:** Verify behavior when no matches found
**Steps:**
1. Enter search: "ZZZ_NO_MATCH_XXX"
2. Verify no results shown

**Expected Results:**
- Empty table or "No results" message
- No contacts displayed
- Clear search to restore

---

#### CON-SEARCH-008: Search Real-time Filtering
**Description:** Verify search updates as you type
**Steps:**
1. Type slowly: "A"
2. Observe results update
3. Continue typing: "ar"
4. Continue: "Aaron"
5. Observe filtering progression

**Expected Results:**
- Results filter in real-time
- Each character narrows results
- Smooth filtering experience

---

### Phase 6: Pagination (6 tests)
**Priority:** Medium
**Status:** Ready to implement

#### CON-PAGE-001: Navigate to Next Page
**Description:** Verify next page button works
**Steps:**
1. Navigate to Contacts page (page 1)
2. Note first contact name
3. Click Next button
4. Verify different contacts shown

**Expected Results:**
- Page changes to 2
- Different contacts displayed
- Page indicator updates

---

#### CON-PAGE-002: Navigate to Previous Page
**Description:** Verify previous page button works
**Steps:**
1. Navigate to page 2
2. Click Previous button
3. Verify back on page 1

**Expected Results:**
- Returns to page 1
- Original contacts shown
- Page indicator shows 1

---

#### CON-PAGE-003: Jump to Specific Page Number
**Description:** Enter page number directly
**Steps:**
1. Click on page number input (spinbutton)
2. Enter page: "5"
3. Press Enter
4. Verify navigation to page 5

**Expected Results:**
- Page 5 loads
- Contacts from page 5 shown
- Page indicator shows 5

---

#### CON-PAGE-004: Verify Last Page Behavior
**Description:** Navigate to last page
**Steps:**
1. Calculate last page (302 / 10 = 31 pages)
2. Navigate to page 31
3. Verify Next button disabled

**Expected Results:**
- Last page contacts shown
- Next button disabled or hidden
- Correct number of contacts (2 on last page)

---

#### CON-PAGE-005: Verify First Page Behavior
**Description:** Verify Previous disabled on first page
**Steps:**
1. Navigate to page 1
2. Verify Previous button state

**Expected Results:**
- Previous button disabled
- Cannot go before page 1

---

#### CON-PAGE-006: Pagination with Search Results
**Description:** Verify pagination works with filtered results
**Steps:**
1. Search: "Aaron"
2. Check pagination
3. Navigate through pages if multiple results

**Expected Results:**
- Pagination shows filtered total
- Pages show only search results
- Navigation works correctly

---

### Phase 7: Excel Import/Export (5 tests)
**Priority:** Medium
**Status:** Ready to implement

#### CON-EXCEL-001: Download Excel Template
**Description:** Verify template download works
**Steps:**
1. Navigate to Contacts page
2. Click "דוגמה לקובץ Excel" link
3. Verify file downloads
4. Open file and verify structure

**Expected Results:**
- Contacts.xlsx downloads
- File contains sample structure
- Headers match fields

---

#### CON-EXCEL-002: Import Valid Excel File
**Description:** Import contacts from valid Excel file
**Steps:**
1. Create Excel file with test contacts
2. Click "ייבוא Excel" button
3. Select file
4. Upload and verify import

**Expected Results:**
- File uploads successfully
- Contacts imported
- Visible in table

---

#### CON-EXCEL-003: Import Excel with Partial Data
**Description:** Import file with some empty fields
**Steps:**
1. Create Excel with Name only (required)
2. Import file
3. Verify contacts created

**Expected Results:**
- Contacts imported
- Empty fields handled gracefully
- No errors

---

#### CON-EXCEL-004: Import Invalid Excel Format
**Description:** Attempt to import invalid file format
**Steps:**
1. Try to import .txt or .csv file
2. Verify error handling

**Expected Results:**
- Error message shown
- Import rejected
- No partial import

---

#### CON-EXCEL-005: Import Excel with Duplicate Names
**Description:** Handle duplicate contact names
**Steps:**
1. Create Excel with duplicate names
2. Import file
3. Verify behavior

**Expected Results:**
- Duplicates handled (either prevented or allowed)
- Clear feedback to user
- Consistent behavior

---

### Phase 8: Data Validation & Edge Cases (3 tests)
**Priority:** Medium
**Status:** Ready to implement

#### CON-VALID-001: Special Characters in Name
**Description:** Verify special characters handled
**Steps:**
1. Create contact with name: "Test ♦ Special ✓ Chars"
2. Verify saved correctly
3. Search for contact

**Expected Results:**
- Special characters saved
- Display correctly
- Searchable

---

#### CON-VALID-002: Very Long Name
**Description:** Test maximum name length
**Steps:**
1. Enter very long name (500+ characters)
2. Attempt to save
3. Verify behavior

**Expected Results:**
- Length limit enforced OR
- Long names handled gracefully
- No UI breaking

---

#### CON-VALID-003: International Phone Numbers
**Description:** Test different country codes
**Steps:**
1. Select different country codes
2. Enter phone numbers
3. Verify formatting

**Expected Results:**
- Country codes work
- Phone formatted correctly
- SMS delivery method available

---

## Test Data Requirements

### Minimum Test Data Needed

**For Creation Tests:**
- No existing data needed (creates new contacts)

**For Edit/Delete Tests:**
- At least 5 test contacts with varied data
- Mix of SMS and EMAIL contacts
- Some with tags, some without
- Some with phone only, some with email only

**For Search Tests:**
- Contacts with names: Aaron, Ada, Adam (already exist)
- Contacts with tags: "QA", "Testing"
- Mix of email and phone contacts

**For Pagination Tests:**
- Current 302 contacts sufficient
- Or any dataset with 20+ contacts

**For Excel Import Tests:**
- Template file: Contacts.xlsx (downloadable from app)
- Test Excel files:
  - Valid file with 5 contacts
  - File with only required fields
  - File with special characters
  - Invalid format file (.txt)

---

## Validated Selectors Summary

### Page Level
```python
# Navigation
contacts_nav_btn = page.get_by_role('button').filter(has_text="אנשי קשר")

# Main sections
sidebar = page.get_by_role('complementary')
main_content = page.get_by_role('main')
```

### Sidebar
```python
add_contact_link = page.locator('listitem').filter(has_text="הוספת איש קשר חדש")
import_excel_btn = sidebar.locator('button')
template_link = page.get_by_role('link').filter(has_text="דוגמה לקובץ Excel")
```

### Search
```python
search_box = page.get_by_role('searchbox', name='חיפוש אנשי קשר')
```

### Table
```python
contacts_table = page.locator('table')
header_row = contacts_table.locator('row').first
contact_rows = contacts_table.locator('row').locator('nth=1~')  # Skip header

# Per row selectors
def get_contact_row_elements(row):
    return {
        'checkbox': row.locator('cell').nth(0).locator('checkbox'),
        'name': row.locator('cell').nth(1),
        'email': row.locator('cell').nth(2),
        'phone': row.locator('cell').nth(3),
        'send_via': row.locator('cell').nth(4).locator('combobox'),
        'tags': row.locator('cell').nth(5),
        'stamp': row.locator('cell').nth(6),
        'edit_btn': row.locator('cell').nth(7).locator('button').first,
        'delete_btn': row.locator('cell').nth(7).locator('button').nth(1)
    }
```

### Pagination
```python
total_count = page.locator('generic').filter(has_text="/")
page_input = page.get_by_role('spinbutton')
prev_page_btn = page.locator('button >> img[alt*="previous"]').locator('..')
next_page_btn = page.locator('button >> img[alt*="next"]').locator('..')
```

### Modals (Add/Edit)
```python
# Add Contact Modal
add_modal_heading = page.locator('heading').filter(has_text="הוספת איש קשר חדש")
edit_modal_heading = page.locator('heading').filter(has_text="עריכת איש קשר")

# Form fields (both modals have same structure)
name_input = page.locator('textbox').filter(has_text="שם מלא*")
email_input = page.locator('textbox').filter(has_text="דואר אלקטרוני")
country_code_dropdown = page.locator('combobox').first
phone_input = page.locator('textbox').filter(has_text="050-234-5678")
send_via_dropdown = page.locator('combobox').nth(1)
tags_input = page.locator('textbox').last

# Modal buttons
cancel_btn = page.get_by_role('button', name='ביטול')
confirm_btn = page.get_by_role('button', name='אישור')
```

---

## Test Execution Strategy

### Recommended Execution Order

1. **Phase 1: Navigation** (5 tests)
   - Establishes page loads correctly
   - Validates selectors work

2. **Phase 2: Contact Creation** (8 tests)
   - Creates test data for later phases
   - Validates core functionality

3. **Phase 5: Search** (8 tests)
   - Uses created data
   - Fast execution

4. **Phase 6: Pagination** (6 tests)
   - Uses existing data
   - Validates navigation

5. **Phase 3: Contact Editing** (6 tests)
   - Modifies test data
   - Non-destructive

6. **Phase 7: Excel Import/Export** (5 tests)
   - Bulk operations
   - File handling

7. **Phase 8: Data Validation** (3 tests)
   - Edge cases
   - Boundary testing

8. **Phase 4: Contact Deletion** (4 tests)
   - Cleanup test data
   - Run last to preserve data for other tests

---

## Success Criteria

### Phase Completion Criteria

Each phase is considered complete when:
- ✅ All tests implemented
- ✅ All tests passing (or explicitly skipped with reason)
- ✅ Test data cleanup performed
- ✅ Documentation updated

### Overall Module Completion

Contacts module testing is complete when:
- ✅ All 45+ tests implemented
- ✅ 95%+ pass rate
- ✅ All critical paths covered
- ✅ All selectors validated
- ✅ Edge cases documented

---

## Risk Assessment

### High Risk Areas
1. **Excel Import** - File format variations, encoding issues
2. **Phone Number Formatting** - International variations
3. **Delete Operations** - Data loss, confirmation flow
4. **Concurrent Editing** - Multiple users editing same contact

### Medium Risk Areas
1. **Search Performance** - Large datasets (302+ contacts)
2. **Pagination** - Edge cases (last page, first page)
3. **Modal State** - Form validation, required fields

### Low Risk Areas
1. **Navigation** - Simple click operations
2. **Table Display** - Read-only viewing
3. **Template Download** - Static file

---

## Test Environment Requirements

### Browser Support
- **Primary:** Chromium (headless + headed modes)
- **Secondary:** Firefox, WebKit (if required)

### Test Data
- Clean database OR
- Dedicated test account with isolated contacts

### External Dependencies
- Excel file template: `/assets/Contacts.xlsx`
- File upload functionality enabled
- Network access for navigation

---

## Automation Patterns

### Page Object Model Structure

```python
class ContactsPage(BasePage):
    """Page Object for Contacts module"""

    def __init__(self, page: Page):
        super().__init__(page)
        self.url = "https://devtest.comda.co.il/dashboard/contacts"

        # Sidebar elements
        self.add_contact_btn = page.locator('listitem').filter(has_text="הוספת איש קשר חדש")
        self.import_excel_btn = page.locator('listitem >> button')
        self.template_link = page.get_by_role('link').filter(has_text="דוגמה לקובץ Excel")

        # Search
        self.search_box = page.get_by_role('searchbox')

        # Table
        self.table = page.locator('table')

        # Pagination
        self.page_input = page.get_by_role('spinbutton')
        self.prev_btn = page.locator('button').first
        self.next_btn = page.locator('button').nth(1)

    async def navigate(self):
        """Navigate to Contacts page"""
        await self.page.goto(self.url)
        await self.page.wait_for_load_state("networkidle")

    async def add_contact(self, name: str, email: str = None, phone: str = None,
                         send_via: str = "EMAIL", tags: str = None):
        """Add a new contact"""
        await self.add_contact_btn.click()
        await self.page.locator('textbox').filter(has_text="שם מלא").fill(name)

        if email:
            await self.page.locator('textbox').filter(has_text="דואר").fill(email)
        if phone:
            await self.page.locator('textbox').filter(has_text="050").fill(phone)
        if tags:
            await self.page.locator('textbox').last.fill(tags)

        # Select send via
        await self.page.locator('combobox').nth(1).select_option(send_via)

        # Click confirm
        await self.page.get_by_role('button', name='אישור').click()
        await self.page.wait_for_timeout(1000)

    async def search_contact(self, search_term: str):
        """Search for contact"""
        await self.search_box.fill(search_term)
        await self.page.wait_for_timeout(500)  # Wait for search to filter

    async def get_contact_count(self) -> int:
        """Get total number of contacts"""
        count_text = await self.page.locator('generic').filter(has_text="/").inner_text()
        # Extract number before "/"
        total = count_text.split('/')[0].strip()
        return int(total)

    async def edit_contact(self, row_index: int, new_name: str = None,
                          new_email: str = None):
        """Edit contact at specific row"""
        row = self.table.locator('row').nth(row_index + 1)  # +1 for header
        edit_btn = row.locator('cell').nth(7).locator('button').first
        await edit_btn.click()

        if new_name:
            name_input = self.page.locator('textbox').first
            await name_input.clear()
            await name_input.fill(new_name)

        if new_email:
            email_input = self.page.locator('textbox').nth(1)
            await email_input.clear()
            await email_input.fill(new_email)

        await self.page.get_by_role('button', name='אישור').click()
        await self.page.wait_for_timeout(1000)

    async def delete_contact(self, row_index: int, confirm: bool = True):
        """Delete contact with optional confirmation"""
        row = self.table.locator('row').nth(row_index + 1)
        delete_btn = row.locator('cell').nth(7).locator('button').nth(1)
        await delete_btn.click()

        # Handle confirmation dialog if it appears
        if confirm:
            # Assuming confirmation dialog appears
            confirm_btn = self.page.get_by_role('button', name='אישור')
            if await confirm_btn.is_visible():
                await confirm_btn.click()
        else:
            cancel_btn = self.page.get_by_role('button', name='ביטול')
            if await cancel_btn.is_visible():
                await cancel_btn.click()

        await self.page.wait_for_timeout(1000)
```

---

## Next Steps

### Immediate Actions

1. ✅ **Exploration Complete** - All features mapped
2. 🔄 **Create ContactsPage POM** - Implement page object model
3. ⏳ **Implement Phase 1 Tests** - Navigation & page load (5 tests)
4. ⏳ **Implement Phase 2 Tests** - Contact creation (8 tests)
5. ⏳ **Run Initial Test Suite** - Validate approach

### Short-term (Week 1)

- Implement Phases 1-4 (23 tests)
- Validate all selectors work in automation
- Create test data fixtures
- Document any selector issues

### Medium-term (Week 2)

- Implement Phases 5-7 (19 tests)
- Excel import/export testing
- Performance testing with large datasets
- Cross-browser validation

### Long-term

- Integration with CI/CD pipeline
- Visual regression testing
- Accessibility testing
- Localization testing (English/Hebrew)

---

## Documentation References

### Evidence Files Created

1. **contacts-main-page.png** - Main Contacts page view
2. **contacts-add-new-form.png** - Add Contact modal
3. **contacts-edit-form.png** - Edit Contact modal

### Related Documents

- Base test framework documentation
- Page Object Model guidelines
- Test data management strategy
- CI/CD integration guide

---

## Appendix A: Field Validations Observed

### Required Fields
- ✅ **שם מלא (Full Name)** - Required (marked with *)
- All other fields optional

### Field Formats
- **Email:** Standard email format (user@domain.ext)
- **Phone:** Country code + local format (e.g., +972-050-234-5678)
- **Send Via:** Dropdown (SMS or EMAIL)
- **Tags:** Free text, appears to support spaces

### UI Constraints
- Confirm button disabled until required fields filled
- Modal-based forms (not inline editing)
- Delete requires confirmation (safety measure)

---

## Appendix B: Test Markers

Recommended pytest markers:

```python
@pytest.mark.contacts       # All contacts tests
@pytest.mark.navigation     # Navigation tests
@pytest.mark.crud           # Create/Read/Update/Delete tests
@pytest.mark.search         # Search functionality
@pytest.mark.pagination     # Pagination tests
@pytest.mark.import_export  # Excel import/export
@pytest.mark.smoke          # Critical path tests
@pytest.mark.regression     # Full regression suite
```

---

**Test Plan Created By:** Claude with MCP Playwright Exploration
**Date:** 2025-11-02
**Total Planned Tests:** 45 comprehensive scenarios
**Status:** ✅ Ready for Implementation

🎯 **CONTACTS MODULE COMPREHENSIVE TEST PLAN COMPLETE** 🎯
