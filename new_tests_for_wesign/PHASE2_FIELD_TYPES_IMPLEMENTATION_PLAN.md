# Phase 2: Field Types Tests - Implementation Plan

**Status:** Planning Complete - Ready to Implement
**Date:** 2025-11-01
**Prerequisites:** ✅ Phase 1 Complete (Sanity test passing)
**Total Tests:** 10 tests

---

## 🎯 Phase 2 Overview

**Goal:** Verify that all field types can be added, signed, and completed successfully in self-signing workflow.

**Scope:** Test each of the 10 field type buttons available on the selfsignfields page.

**Pattern:** Each test follows the same structure as Phase 1, but changes the field type button clicked in Step 6.

---

## 📋 Test List (10 Tests)

### Test 2: Text Field
**Test Name:** `test_2_add_text_field_and_complete_success`
**Field Button:** "טקסט" (Text)
**Expected Behavior:** Add text field, complete workflow, verify document signed

### Test 3: Initials Field
**Test Name:** `test_3_add_initials_field_and_complete_success`
**Field Button:** "ראשי תיבות" (Initials)
**Expected Behavior:** Add initials field, complete workflow, verify document signed

### Test 4: Email Field
**Test Name:** `test_4_add_email_field_and_complete_success`
**Field Button:** "אימייל" (Email)
**Expected Behavior:** Add email field, complete workflow, verify document signed

### Test 5: Phone Field
**Test Name:** `test_5_add_phone_field_and_complete_success`
**Field Button:** "טלפון" (Phone)
**Expected Behavior:** Add phone field, complete workflow, verify document signed

### Test 6: Date Field
**Test Name:** `test_6_add_date_field_and_complete_success`
**Field Button:** "תאריך" (Date)
**Expected Behavior:** Add date field, complete workflow, verify document signed

### Test 7: Number Field
**Test Name:** `test_7_add_number_field_and_complete_success`
**Field Button:** "מספר" (Number)
**Expected Behavior:** Add number field, complete workflow, verify document signed

### Test 8: List Field
**Test Name:** `test_8_add_list_field_and_complete_success`
**Field Button:** "רשימה" (List)
**Expected Behavior:** Add list field, complete workflow, verify document signed

### Test 9: Checkbox Field
**Test Name:** `test_9_add_checkbox_field_and_complete_success`
**Field Button:** "תיבת סימון" (Checkbox)
**Expected Behavior:** Add checkbox field, complete workflow, verify document signed

### Test 10: Radio Field
**Test Name:** `test_10_add_radio_field_and_complete_success`
**Field Button:** "כפתור בחירה" (Radio)
**Expected Behavior:** Add radio field, complete workflow, verify document signed

### Test 11: Multiple Different Fields
**Test Name:** `test_11_add_multiple_different_fields_and_complete_success`
**Fields:** Signature + Text + Email
**Expected Behavior:** Add 3 different field types, complete workflow, verify all fields added

---

## 🔧 Implementation Strategy

### Reusable Pattern (from Phase 1):

```python
@pytest.mark.asyncio
async def test_X_add_FIELD_TYPE_field_and_complete_success(self):
    """
    PHASE 2 - FIELD TYPE TEST

    Test adding [FIELD_TYPE] field in self-signing workflow

    Workflow:
    1. Login
    2. Count Documents BEFORE
    3. Upload PDF file
    4. Select Personal Signature (Self-Sign)
    5. Edit Document
    6. Add [FIELD_TYPE] Field ← ONLY DIFFERENCE
    7. Complete document (no signature modal for non-signature fields)
    8. Verify Success Page
    9. Verify Document in Documents Page

    Assertions:
    1. URL → /selectsigners after upload
    2. URL → /selfsignfields after edit
    3. URL → /success/selfsign after finish
    4. Success heading visible
    5. Document appears in list
    6. Document status is "נחתם" (Signed)
    """
```

### Key Differences from Phase 1:

1. **Field Type Button:** Different Hebrew text for each field type
2. **No Signature Modal:** Non-signature fields don't open the signature modal
3. **Field Placement:** Click field type → field appears on canvas (no modal interaction needed)
4. **Finish Immediately:** Can click "סיים" (Finish) right after adding field

### Shared Code Opportunity:

Create a helper method to reduce duplication:

```python
async def _complete_self_sign_workflow_with_field_type(
    self,
    page,
    field_type_hebrew: str,
    test_name: str,
    requires_signature_modal: bool = False
):
    """
    Helper method for Phase 2 field type tests

    Args:
        page: Playwright page object
        field_type_hebrew: Hebrew text of field button (e.g., "טקסט", "אימייל")
        test_name: Name for assertions/logging
        requires_signature_modal: True if field type opens signature modal
    """
    # Steps 1-5: Same for all tests (login → upload → select self-sign → edit)
    # Step 6: Click the specified field type button
    # Step 7 (conditional): Handle signature modal if needed
    # Step 8: Finish document
    # Step 9-11: Verify success and document appears
```

---

## 📝 Field Type Button Selectors

Based on the discovered selectors from manual exploration:

```python
field_type_buttons = {
    'signature': 'button:has-text("חתימה")',      # ref e262
    'text': 'button:has-text("טקסט")',            # ref e264
    'initials': 'button:has-text("ראשי תיבות")', # ref e266
    'email': 'button:has-text("אימייל")',         # ref e268
    'phone': 'button:has-text("טלפון")',          # ref e270
    'date': 'button:has-text("תאריך")',           # ref e272
    'number': 'button:has-text("מספר")',          # ref e274
    'list': 'button:has-text("רשימה")',           # ref e276
    'checkbox': 'button:has-text("תיבת סימון")', # ref e278
    'radio': 'button:has-text("כפתור בחירה")',   # ref e280
}
```

---

## 🎯 Test Data Strategy

### Unique Document Names:
To avoid confusion with Phase 1 "sample.pdf" tests, use different file names or add metadata:

```python
# Option 1: Same PDF, different upload iterations (current approach)
test_pdf = Path("test_files/sample.pdf")

# Option 2: Create field-specific test files
test_pdfs = {
    'text': Path("test_files/test_text_field.pdf"),
    'email': Path("test_files/test_email_field.pdf"),
    # etc.
}

# Option 3: Track by timestamp or unique ID
doc_name = f"sample_{field_type}_{int(time.time())}"
```

**Recommendation:** Keep using `sample.pdf` for now (simplicity), but add field type to search verification:
- Search for document by name
- Verify the LATEST document has the correct status

---

## ⚠️ Important Considerations

### 1. Field Placement Behavior:
- **Signature field:** Opens modal (tested in Phase 1)
- **Other fields:** May appear directly on canvas without modal
- **Unknown:** Do any other fields open configuration modals?

**Action Required:** Manual discovery or exploratory test for each field type to confirm behavior.

### 2. Field Interaction Requirements:
- Some fields may require filling before document can be finished
- Example: Text field might require typing text
- Example: Date field might require selecting a date

**Mitigation:**
- Tests should focus on ADDING fields, not FILLING them
- Self-signing means the document creator is also the signer
- Fields should be optional for completion in self-sign mode

### 3. Multiple Fields Test (Test 11):
- Add 3 different field types in sequence
- Verify all 3 appear on canvas
- Complete and verify document

**Challenge:** How to verify all 3 fields were added?
- Count field elements on canvas?
- Visual verification (screenshot)?
- Backend API check?

---

## 🚀 Implementation Steps

### Step 1: Create Helper Method (30 min)
- Extract common workflow from Phase 1 test
- Parameterize field type button selector
- Add conditional logic for signature modal handling

### Step 2: Implement Tests 2-10 (2 hours)
- Create 9 tests using the helper method
- Each test calls helper with different field type
- Run each test individually to verify

### Step 3: Implement Test 11 - Multiple Fields (30 min)
- Add multiple field types in sequence
- Verify each field appears before adding next
- Complete workflow and verify

### Step 4: Run Full Test Suite (15 min)
- Run all 10 Phase 2 tests together
- Verify no flakiness
- Check execution time (should be ~10 minutes total)

### Step 5: Documentation (15 min)
- Create `PHASE2_IMPLEMENTATION_COMPLETE.md`
- Update master plan progress
- Document any new discoveries

**Total Estimated Time:** 3.5 hours

---

## ✅ Success Criteria

### Phase 2 Complete When:
1. ✅ All 10 tests pass independently
2. ✅ All 10 tests pass when run together
3. ✅ Each test verifies document appears in Documents list
4. ✅ Each test verifies document status is "נחתם" (Signed)
5. ✅ No flaky tests (95%+ pass rate over 3 runs)
6. ✅ Execution time under 15 minutes for all 10 tests
7. ✅ Documentation updated with discoveries

---

## 📊 Expected Test Results

| Test # | Field Type | Expected Duration | Status |
|--------|------------|------------------|--------|
| 2 | Text | ~45-60s | ⏳ Pending |
| 3 | Initials | ~45-60s | ⏳ Pending |
| 4 | Email | ~45-60s | ⏳ Pending |
| 5 | Phone | ~45-60s | ⏳ Pending |
| 6 | Date | ~45-60s | ⏳ Pending |
| 7 | Number | ~45-60s | ⏳ Pending |
| 8 | List | ~45-60s | ⏳ Pending |
| 9 | Checkbox | ~45-60s | ⏳ Pending |
| 10 | Radio | ~45-60s | ⏳ Pending |
| 11 | Multiple | ~60-75s | ⏳ Pending |

**Total:** ~8-10 minutes for all tests

---

## 🔍 Open Questions (To Be Discovered)

1. Do any non-signature field types open configuration modals?
2. Are fields required to be filled before finishing document?
3. Can we verify field count on canvas programmatically?
4. Do different field types affect document status differently?
5. Are there any field types that don't work in self-sign mode?

**Resolution:** Answer these during implementation through exploratory testing.

---

## 📚 References

- Phase 1 Implementation: `PHASE1_IMPLEMENTATION_COMPLETE.md`
- Master Plan: `SELF_SIGNING_MASTER_PLAN.md`
- Selectors Reference: `SELF_SIGN_WORKFLOW_COMPLETE_VERIFIED.md`
- Test File: `tests/self_signing/test_self_signing_core_fixed.py`

---

## 🎯 Next After Phase 2

**Phase 3: Signature Methods (21 tests)**
- Draw signature tab tests
- Graphic signature tab tests
- Initials tab tests
- Certificate options (None, Server, Card)
- Individual saved signature tests (6 tests)
- Options tests (Apply to all, Save for future)
- Combination tests

**Estimated Effort:** 6-8 hours

---

*Plan Created: 2025-11-01*
*Status: READY TO IMPLEMENT*
*Approval: PENDING USER REVIEW*
