# Documents Module - MCP Discovery Session

**Date:** 2025-11-05
**Module:** Documents (Send Document Flow)
**Status:** ✅ COMPLETE - FLOW EXPLORED AND DOCUMENTED
**Goal:** Understand complete document sending workflow and create comprehensive test plan

---

## 📋 Session Overview

**Approach:** Interactive exploration with user ✅
**Result:** Complete E2E flow documented with all junctions identified

---

## 🗺️ Complete Exploration Log

### Step 1: Login
- **Action:** Fill credentials and sign in
- **Credentials:** `nirk@comsign.co.il` / `Comsign1!`
- **Result:** Navigated to `/dashboard/main`

### Step 2: Upload File
- **Action:** Click "העלאת קובץ" (Upload file) button
- **Result:** File chooser opened

### Step 3: Select File
- **Action:** Upload `test_document.pdf` from `test_files/`
- **Result:** Navigated to `/dashboard/selectsigners`
- **Validation:** Document name field shows "test_document"

### Step 4: Group Signature Tab
- **Action:** Click "חתימה קבוצתית" (Group Signature) tab
- **Result:** Group signature form displayed
- **Fields visible:** Name, Email, Send method dropdown

### Step 5: Fill Recipient Details
- **Action:** Fill name "Test Recipient", email "test@example.com"
- **Send method:** Email (default)
- **Signing order:** Sequential (checkbox unchecked - default)

### Step 6: Edit Document
- **Action:** Click "עריכת מסמך" (Edit document) button
- **Result:** Navigated to `/dashboard/groupsign`
- **Fields available:** 10 field types (Text, Signature, Initials, Email, Phone, Date, Number, List, Checkbox, Radio)

### Step 7: Add Signature Field
- **Action:** Click "חתימה" (Signature) button
- **Result:** Signature field added to document canvas
- **Validation:** Field appears with control buttons

### Step 8: Review
- **Action:** Click "סקירה" (Review) button
- **Result:** Navigated to `/dashboard/selectsigners/review`
- **Validation:**
  - Document name: "test_document"
  - Recipients table: 1 row
  - Recipient: "Test Recipient"
  - Method: "EMAIL"

### Step 9: Send Document ✅
- **Action:** Click "שליחה" (Send) button
- **Result:** Navigated to `/dashboard/success`
- **SUCCESS PAGE ASSERTIONS:**
  - ✅ URL: `https://devtest.comda.co.il/dashboard/success`
  - ✅ Main heading: "הצלחה!" (Success!)
  - ✅ Sub-heading: "המסמך נשלח ליעדו." (The document was sent to its destination)
  - ✅ Message: "כשהמסמך ייחתם, יתקבל דואר אלקטרוני לתיבתכם." (When signed, email received)
  - ✅ Button: "תודה" (Thank you)

---

## 📝 User Requirements Log

### Requirement #1: Multiple Recipient Methods (TESTING JUNCTION #1)
**User stated:** "you need to add from contact / send a new one by mail / send a new one by phone / send for multiple contacts"

**Scenarios to test:**
1. Add from contacts list
2. Send to new recipient by email ✅ (explored)
3. Send to new recipient by SMS/phone
4. Send to multiple contacts (2+)

**With/without checkbox:**
- Checkbox CHECKED: Simultaneous signing (no order)
- Checkbox UNCHECKED: Sequential signing (ordered) ✅ (explored)

### Requirement #2: All Field Types (TESTING JUNCTION #2)
**User stated:** "you need to test all fields as we did in self sign. including overlapping and all edge cases for fields on a document"

**Field types (10 total):**
1. טקסט (Text)
2. חתימה (Signature) ✅ (explored)
3. ראשי תיבות (Initials)
4. דוא"ל (Email)
5. טלפון (Phone)
6. תאריך (Date)
7. מספר (Number)
8. רשימה (List/Dropdown)
9. תיבת סימון (Checkbox)
10. רדיו (Radio button)

**Field actions:**
- Add field
- Drag field
- Resize field
- Delete field

**Edge cases:**
- Overlapping fields
- Fields at edges (top, bottom, left, right)
- Fields outside document bounds
- Minimum/maximum field sizes
- Multiple fields of same type
- Multi-page documents

### Requirement #3: Success Assertion
**User stated:** "this page meaning success. assert this"

**Success page validation:**
- URL must be `/dashboard/success`
- Heading "הצלחה!" must be visible
- Message "המסמך נשלח ליעדו." must be visible
- This confirms document was sent successfully

---

## 🔍 MCP Discovery Findings

### Page URLs Discovered
1. `/login` - Login page
2. `/dashboard/main` - Main dashboard
3. `/dashboard/selectsigners` - Add recipients page
4. `/dashboard/groupsign` - Document editor
5. `/dashboard/selectsigners/review` - Review before send
6. `/dashboard/success` - Success confirmation ✅

### Key Selectors (get_by_role preferred)
- Login: `get_by_role("textbox", name="Username / Email")`
- Upload: `get_by_role('button', name='העלאת קובץ')`
- Group tab: `get_by_role('button', name='חתימה קבוצתית')`
- Name field: `get_by_role('textbox', name='שם מלא')`
- Email field: `get_by_role('textbox', name='דואר אלקטרוני')`
- Edit button: `get_by_role('button', name='עריכת מסמך')`
- Signature button: `get_by_role('button', name='חתימה')`
- Review button: `get_by_role('button', name='סקירה')`
- Send button: `get_by_role('button', name='שליחה')`

### Test Data
- Test file: `test_files/test_document.pdf` ✅ (created)
- Test recipient: "Test Recipient"
- Test email: "test@example.com"

---

## 📊 Test Plan

**Created:** `DOCUMENTS_SEND_COMPLETE_TEST_PLAN.md`

**Total test scenarios:** 84 tests
- Happy path: 1 test ✅
- Recipient methods: 8 tests
- Field types: 40 tests (10 fields × 4 actions)
- Field edge cases: 10 tests
- Validation tests: 15 tests
- Error scenarios: 10 tests

---

## ✅ Exploration Status: COMPLETE

**Next Actions:**
1. Write test file #1: Happy path E2E test
2. Execute and fix until passing
3. Write remaining 83 tests
4. Achieve 100% pass rate
5. Commit to master

**User approved approach:** Execute all scenarios in tests, explored one path to understand flow

