# Documents Module - Complete Test Plan (Send Document Flow)

**Date:** 2025-11-05
**Module:** Documents - Group Signature Send Flow
**Status:** ✅ FLOW EXPLORED - READY FOR TEST IMPLEMENTATION
**Methodology:** Systematic MCP Discovery + STRONG Assertions

---

## 🎯 Flow Overview - Complete Journey

### End-to-End Flow (8 Steps)
1. **Login** → Dashboard
2. **Upload File** → Click "העלאת קובץ" button
3. **Select File** → Choose test_document.pdf from test_files/
4. **Add Recipients** → Group signature tab, fill recipient details
5. **Edit Document** → Place signature fields on PDF
6. **Review** → Verify recipients and settings
7. **Send** → Click send button
8. **Success** → Confirmation page

---

## 📋 Complete Step-by-Step Flow (Recorded via MCP)

### Step 1: Login
- **Page:** `/login`
- **Actions:**
  - Fill username: `nirk@comsign.co.il`
  - Fill password: `Comsign1!`
  - Click "Sign in"
- **Expected:** Navigate to `/dashboard/main`
- **Selectors:**
  - Username: `page.get_by_role("textbox", name="Username / Email")`
  - Password: `page.get_by_role("textbox", name="Password")`
  - Submit: `page.get_by_role("button", name="Sign in")`

### Step 2: Upload File
- **Page:** `/dashboard/main`
- **Actions:**
  - Click "העלאת קובץ" (Upload file) button
- **Expected:** File chooser opens
- **Selector:** `page.get_by_role('button', name='העלאת קובץ')`
- **Test File:** `test_files/test_document.pdf`

### Step 3: File Upload
- **Actions:**
  - Upload file via file chooser
- **Expected:** Navigate to `/dashboard/selectsigners`
- **Validation:**
  - URL contains `/dashboard/selectsigners`
  - Document name field shows "test_document"

### Step 4: Select Recipients (GROUP SIGNATURE TAB)
- **Page:** `/dashboard/selectsigners`
- **Actions:**
  - Click "חתימה קבוצתית" (Group Signature) tab
  - Fill recipient name: "Test Recipient"
  - Fill recipient email: "test@example.com"
- **Selectors:**
  - Tab: `page.get_by_role('button', name='חתימה קבוצתית')`
  - Name: `page.get_by_role('textbox', name='שם מלא')`
  - Email: `page.get_by_role('textbox', name='דואר אלקטרוני')`
- **Options:**
  - Dropdown: "שלח באמצעות דוא\"ל" (default)
  - Checkbox: "המכותבים יקבלו את המסמך לחתימה בו זמנית" (unchecked = sequential)

### Step 5: Edit Document
- **Actions:**
  - Click "עריכת מסמך" (Edit document) button
- **Expected:** Navigate to `/dashboard/groupsign`
- **Validation:**
  - Editor page loads
  - Recipient dropdown shows "Test Recipient"
  - 10 field types available

### Step 6: Add Signature Field
- **Page:** `/dashboard/groupsign`
- **Actions:**
  - Click "חתימה" (Signature) button
- **Expected:**
  - Signature field appears on document canvas
  - Field is selected/active
- **Selector:** `page.get_by_role('button', name='חתימה')`

### Step 7: Review
- **Actions:**
  - Click "סקירה" (Review) button
- **Expected:** Navigate to `/dashboard/selectsigners/review`
- **Validation:**
  - Document name: "test_document"
  - Recipients table shows 1 recipient
  - Recipient name: "Test Recipient"
  - Send method: "EMAIL"
- **Selector:** `page.get_by_role('button', name='סקירה')`

### Step 8: Send Document
- **Page:** `/dashboard/selectsigners/review`
- **Actions:**
  - Click "שליחה" (Send) button
- **Expected:** Navigate to `/dashboard/success`
- **Validation:**
  - Success message: "הצלחה!" (Success!)
  - Message: "המסמך נשלח ליעדו." (Document was sent)
- **Selector:** `page.get_by_role('button', name='שליחה')`

---

## 🧪 Testing Junction #1: Recipient Selection Methods

### Options Available
1. **New recipient by email** (explored ✅)
2. New recipient by SMS
3. Add from contacts list
4. Multiple recipients

### Test Matrix: Recipient Methods

| Scenario | Method | Signing Order | Test ID |
|----------|--------|---------------|---------|
| Single email (sequential) | Email | Sequential | T1.1 ✅ |
| Single email (simultaneous) | Email | Simultaneous | T1.2 |
| Single SMS (sequential) | SMS | Sequential | T1.3 |
| Single SMS (simultaneous) | SMS | Simultaneous | T1.4 |
| From contacts (sequential) | Contacts | Sequential | T1.5 |
| From contacts (simultaneous) | Contacts | Simultaneous | T1.6 |
| Multiple (2+) email | Email | Sequential | T1.7 |
| Multiple (2+) email | Email | Simultaneous | T1.8 |

**Total Tests:** 8 scenarios

---

## 🧪 Testing Junction #2: Document Field Placement

### Available Field Types (10 total)
1. טקסט (Text)
2. חתימה (Signature) ✅
3. ראשי תיבות (Initials)
4. דוא"ל (Email)
5. טלפון (Phone)
6. תאריך (Date)
7. מספר (Number)
8. רשימה (List/Dropdown)
9. תיבת סימון (Checkbox)
10. רדיו (Radio button)

### Test Matrix: Field Types

| Field Type | Add | Drag | Resize | Delete | Test ID |
|------------|-----|------|--------|--------|---------|
| Text | ✅ | ✅ | ✅ | ✅ | T2.1 |
| Signature | ✅ | ✅ | ✅ | ✅ | T2.2 |
| Initials | ✅ | ✅ | ✅ | ✅ | T2.3 |
| Email | ✅ | ✅ | ✅ | ✅ | T2.4 |
| Phone | ✅ | ✅ | ✅ | ✅ | T2.5 |
| Date | ✅ | ✅ | ✅ | ✅ | T2.6 |
| Number | ✅ | ✅ | ✅ | ✅ | T2.7 |
| List | ✅ | ✅ | ✅ | ✅ | T2.8 |
| Checkbox | ✅ | ✅ | ✅ | ✅ | T2.9 |
| Radio | ✅ | ✅ | ✅ | ✅ | T2.10 |

**Total Tests:** 40 tests (10 fields × 4 actions)

### Test Matrix: Field Edge Cases

| Edge Case | Description | Test ID |
|-----------|-------------|---------|
| Overlapping fields | Two fields on top of each other | T2.E1 |
| Field at top edge | Field positioned at document top | T2.E2 |
| Field at bottom edge | Field positioned at document bottom | T2.E3 |
| Field at left edge | Field positioned at document left | T2.E4 |
| Field at right edge | Field positioned at document right | T2.E5 |
| Field outside bounds | Try to place field outside document | T2.E6 |
| Minimum field size | Very small field | T2.E7 |
| Maximum field size | Very large field covering page | T2.E8 |
| Multiple same type | 3+ signature fields | T2.E9 |
| Multi-page navigation | Fields on different pages | T2.E10 |

**Total Tests:** 10 edge case tests

---

## 📊 Complete Test Suite Summary

### Test Categories

| Category | # Tests | Status |
|----------|---------|--------|
| **Happy Path** (E2E) | 1 | ✅ Explored |
| **Recipient Methods** | 8 | 📝 To Implement |
| **Field Types** | 40 | 📝 To Implement |
| **Field Edge Cases** | 10 | 📝 To Implement |
| **Validation Tests** | 15 | 📝 To Implement |
| **Error Scenarios** | 10 | 📝 To Implement |
| **---** | **---** | **---** |
| **TOTAL** | **84 tests** | 🎯 Target |

---

## ✅ STRONG Assertions Strategy

### Before/After Validation Pattern
```python
# Example: File upload
files_before = await get_uploaded_files_count()
await upload_file("test_document.pdf")
files_after = await get_uploaded_files_count()
assert files_after == files_before + 1, f"Expected {files_before + 1} files, got {files_after}"
```

### URL Navigation Validation
```python
# After each step
assert page.url == expected_url, f"Expected {expected_url}, got {page.url}"
```

### Element Visibility Validation
```python
# Check critical elements exist
assert await element.is_visible(), "Element should be visible"
assert await element.text_content() == expected_text, f"Expected {expected_text}, got {actual}"
```

### Count Validation
```python
# Recipient table
recipients_count = await page.locator('tbody tr').count()
assert recipients_count == expected_count, f"Expected {expected_count} recipients, got {recipients_count}"
```

---

## 🔍 Key Selectors Discovered

### Login Page
- Username: `get_by_role("textbox", name="Username / Email")`
- Password: `get_by_role("textbox", name="Password")`
- Sign in: `get_by_role("button", name="Sign in")`

### Dashboard
- Upload button: `get_by_role('button', name='העלאת קובץ')`
- Documents nav: `get_by_role('button', name='מסמכים')`

### Select Signers Page
- Group tab: `get_by_role('button', name='חתימה קבוצתית')`
- Name field: `get_by_role('textbox', name='שם מלא')`
- Email field: `get_by_role('textbox', name='דואר אלקטרוני')`
- Send method dropdown: `combobox` (contains "שלח באמצעות דוא\"ל")
- Edit document: `get_by_role('button', name='עריכת מסמך')`

### Document Editor
- Signature button: `get_by_role('button', name='חתימה')`
- Text button: `get_by_role('button', name='טקסט')`
- Review button: `get_by_role('button', name='סקירה')`
- All 10 field types: `get_by_role('button', name='{field_name}')`

### Review Page
- Send button: `get_by_role('button', name='שליחה')`
- Recipients table: `table` selector
- Document name: `heading` with level 3

### Success Page
- Success heading: `heading` with "הצלחה!"
- Message: "המסמך נשלח ליעדו."

---

## 📁 Test File Structure

```
tests/
└── documents/
    ├── test_documents_send_happy_path.py          # T1.1 - Complete E2E
    ├── test_documents_recipient_methods.py        # T1.2-T1.8 - All methods
    ├── test_documents_field_types.py              # T2.1-T2.10 - All fields
    ├── test_documents_field_edge_cases.py         # T2.E1-T2.E10 - Edge cases
    ├── test_documents_validation.py               # Validation scenarios
    └── test_documents_error_handling.py           # Error scenarios

test_files/
└── test_document.pdf                              # Test file (created)
```

---

## 🎯 Implementation Priority

### Phase 1: Core Happy Path (COMPLETE E2E)
1. ✅ T1.1: Single email recipient, sequential, signature field, send success

### Phase 2: Recipient Variations
2. T1.2-T1.8: All recipient method combinations

### Phase 3: Field Types
3. T2.1-T2.10: All 10 field types with basic actions

### Phase 4: Edge Cases
4. T2.E1-T2.E10: Field placement edge cases

### Phase 5: Validations & Errors
5. Validation and error scenario tests

---

## 🚀 Next Steps

1. ✅ **Exploration Complete** - Full flow documented
2. 📝 **Write Test File #1** - Happy path test (test_documents_send_happy_path.py)
3. 🧪 **Execute Test** - Run and fix until passing
4. 📝 **Write Remaining Tests** - All 84 scenarios
5. ✅ **Achieve 100%** - All tests passing with STRONG assertions
6. 💾 **Commit to Master** - Complete Documents module

---

**Prepared by:** Claude Code
**Methodology:** Systematic MCP Discovery + User-Guided Exploration
**Status:** ✅ READY FOR TEST IMPLEMENTATION

