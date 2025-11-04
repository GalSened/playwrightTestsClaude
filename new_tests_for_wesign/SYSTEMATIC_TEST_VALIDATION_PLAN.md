# WeSign Systematic Test Validation Plan
**Created:** 2025-10-30
**Purpose:** Validate every test one-by-one, ensuring each works as designed
**Total Tests:** 25+ tests across 5 modules

---

## Validation Methodology

For each test, we will:
1. ✅ **Run the test individually** with headed browser (slow_mo=1500ms)
2. ✅ **Verify it actually performs the action** (not just UI checks)
3. ✅ **Confirm expected outcome** (create/edit/delete/navigate)
4. ✅ **Document any issues found**
5. ✅ **Fix issues immediately** before moving to next test
6. ✅ **Generate Allure report** after each module completion

---

## Module 1: Authentication Tests (5 tests)
**File:** `tests/auth/test_authentication_core_fixed.py`
**Status:** ⏳ PENDING VALIDATION

### Test 1.1: `test_login_with_valid_company_credentials_success`
- **Purpose:** Login with valid company credentials
- **Expected:** User logs in and reaches dashboard
- **Command:**
  ```bash
  py -m pytest tests/auth/test_authentication_core_fixed.py::TestAuthenticationFixed::test_login_with_valid_company_credentials_success -v -s --headed --browser chromium --slowmo 1500
  ```
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 1.2: `test_login_with_invalid_credentials_failure`
- **Purpose:** Login with invalid credentials should fail
- **Expected:** Error message shown, stays on login page
- **Command:**
  ```bash
  py -m pytest tests/auth/test_authentication_core_fixed.py::TestAuthenticationFixed::test_login_with_invalid_credentials_failure -v -s
  ```
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 1.3: `test_login_page_elements_visibility`
- **Purpose:** Verify all login page elements are visible
- **Expected:** Email field, password field, login button visible
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 1.4: `test_logout_functionality`
- **Purpose:** User can logout successfully
- **Expected:** After logout, redirected to login page
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 1.5: `test_login_validation_messages`
- **Purpose:** Validation messages shown for empty fields
- **Expected:** Proper validation errors displayed
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

**Module 1 Completion:** ⏳ 0/5 tests validated

---

## Module 2: Documents Tests (5 tests)
**File:** `tests/documents/test_documents_core_fixed.py`
**Status:** ⏳ PENDING VALIDATION

### Test 2.1: `test_navigate_to_documents_page`
- **Purpose:** Navigate from dashboard to documents page
- **Expected:** URL changes to `/dashboard/documents/all`, page loads
- **Status:** ⏳ NOT VALIDATED YET
- **Navigation Fix Applied:** ✅ Uses `page.locator('text=מסמכים').click()` instead of goto
- **Notes:** _To be filled after validation_

### Test 2.2: `test_upload_pdf_document_success`
- **Purpose:** Upload a PDF document
- **Expected:** Document count increases, document appears in list
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 2.3: `test_upload_docx_document_success`
- **Purpose:** Upload a DOCX document
- **Expected:** Document count increases, document appears in list
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 2.4: `test_search_documents_functionality`
- **Purpose:** Search for documents by name
- **Expected:** Search filters document list correctly
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 2.5: `test_delete_document`
- **Purpose:** Delete a document
- **Expected:** Document count decreases, document removed from list
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

**Module 2 Completion:** ⏳ 0/5 tests validated

---

## Module 3: Contacts Tests (5 tests)
**File:** `tests/contacts/test_e2e_contact_creation_5tests.py`
**Status:** ⏳ PENDING VALIDATION

### Test 3.1: `test_1_create_contact_with_email_and_phone`
- **Purpose:** Create contact with name, email, and phone
- **Expected:** Contact count increases, contact searchable
- **Status:** ⏳ NOT VALIDATED YET
- **Known Issue:** Tests pass but don't actually create contacts (count stays at 10)
- **Notes:** _To be filled after validation_

### Test 3.2: `test_2_create_contact_with_different_data`
- **Purpose:** Create contact with different data format
- **Expected:** Contact count increases, contact searchable
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 3.3: `test_3_create_contact_israeli_phone_format`
- **Purpose:** Create contact with Israeli phone format (054...)
- **Expected:** Contact count increases, phone format accepted
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 3.4: `test_4_create_contact_business_email`
- **Purpose:** Create business contact with company email
- **Expected:** Contact count increases, contact searchable
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 3.5: `test_5_duplicate_contact_detection`
- **Purpose:** Test duplicate contact prevention
- **Expected:** Count doesn't increase when creating duplicate
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

**Module 3 Completion:** ⏳ 0/5 tests validated

---

## Module 4: Templates Tests (5 tests)
**File:** `tests/templates/test_e2e_template_operations.py`
**Status:** ⏳ PENDING VALIDATION

### Test 4.1: `test_1_create_new_template_with_pdf_file`
- **Purpose:** Create template by uploading PDF
- **Expected:** Template count increases, template appears in list
- **Status:** ⏳ NOT VALIDATED YET
- **File:** Uses `test_files/sample.pdf` ✅ File exists
- **Notes:** _To be filled after validation_

### Test 4.2: `test_2_edit_existing_template_name`
- **Purpose:** Edit template name
- **Expected:** Template name changes in the list
- **Status:** ✅ PASSED (previous run)
- **Notes:** Edit functionality works correctly

### Test 4.3: `test_3_delete_template`
- **Purpose:** Delete a template
- **Expected:** Template count decreases, template removed
- **Status:** ✅ PASSED (previous run)
- **Notes:** Delete functionality works correctly

### Test 4.4: `test_4_create_template_from_blank`
- **Purpose:** Create blank template
- **Expected:** Navigates to template editor
- **Status:** ✅ PASSED (previous run)
- **Notes:** Blank template creation works

### Test 4.5: `test_5_duplicate_template`
- **Purpose:** Duplicate existing template
- **Expected:** Template count increases, duplicate appears
- **Status:** ✅ PASSED (previous run)
- **Notes:** Duplicate functionality works correctly

**Module 4 Completion:** ✅ 4/5 tests validated (80%)

---

## Module 5: Self-Signing Tests (5 tests)
**File:** `tests/self_signing/test_self_signing_core_fixed.py`
**Status:** ⏳ PENDING VALIDATION

### Test 5.1: `test_navigate_to_self_signing_page`
- **Purpose:** Navigate to self-signing page
- **Expected:** URL changes to self-signing page, page loads
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 5.2: `test_upload_new_pdf_file_and_add_signature_field_success`
- **Purpose:** Upload PDF and add signature field
- **Expected:** PDF uploads, signature field added to document
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 5.3: `test_add_text_field_to_document`
- **Purpose:** Add text field to document
- **Expected:** Text field appears on document
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 5.4: `test_add_date_field_to_document`
- **Purpose:** Add date field to document
- **Expected:** Date field appears on document
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

### Test 5.5: `test_sign_document_with_signature`
- **Purpose:** Sign document with signature
- **Expected:** Document marked as signed, signature visible
- **Status:** ⏳ NOT VALIDATED YET
- **Notes:** _To be filled after validation_

**Module 5 Completion:** ⏳ 0/5 tests validated

---

## Overall Progress

| Module | Tests | Validated | Pass Rate | Status |
|--------|-------|-----------|-----------|---------|
| Authentication | 5 | 0/5 | 0% | ⏳ Pending |
| Documents | 5 | 0/5 | 0% | ⏳ Pending |
| Contacts | 5 | 0/5 | 0% | ⏳ Pending |
| Templates | 5 | 4/5 | 80% | 🔄 In Progress |
| Self-Signing | 5 | 0/5 | 0% | ⏳ Pending |
| **TOTAL** | **25** | **4/25** | **16%** | 🔄 In Progress |

---

## Critical Issues to Track

### Issue 1: Contact Creation Not Working
- **Module:** Contacts
- **Symptom:** Tests pass but contacts aren't created (count stays at 10)
- **Root Cause:** Submit button click doesn't trigger actual creation
- **Status:** ⏳ Needs investigation
- **Priority:** 🔴 HIGH

### Issue 2: Network Connection Issues
- **Module:** All
- **Symptom:** `ERR_NAME_NOT_RESOLVED` for devtest.comda.co.il
- **Root Cause:** Website might be down or VPN/network issue
- **Status:** ⏳ Needs checking
- **Priority:** 🔴 HIGH

### Issue 3: Navigation Methods Failing
- **Module:** Documents, Contacts, Templates
- **Symptom:** `page.goto()` doesn't navigate correctly in Angular app
- **Fix Applied:** ✅ Using `page.locator('text=...').click()` instead
- **Status:** ✅ FIXED
- **Priority:** ✅ RESOLVED

---

## Execution Plan

### Phase 1: Authentication (Day 1)
1. Run test 1.1 → Validate → Fix if needed
2. Run test 1.2 → Validate → Fix if needed
3. Run test 1.3 → Validate → Fix if needed
4. Run test 1.4 → Validate → Fix if needed
5. Run test 1.5 → Validate → Fix if needed
6. Generate Allure report for Authentication module

### Phase 2: Documents (Day 1-2)
1. Run test 2.1 → Validate → Fix if needed
2. Run test 2.2 → Validate → Fix if needed
3. Run test 2.3 → Validate → Fix if needed
4. Run test 2.4 → Validate → Fix if needed
5. Run test 2.5 → Validate → Fix if needed
6. Generate Allure report for Documents module

### Phase 3: Contacts (Day 2)
1. Debug contact creation issue FIRST
2. Run test 3.1 → Validate → Fix if needed
3. Run test 3.2 → Validate → Fix if needed
4. Run test 3.3 → Validate → Fix if needed
5. Run test 3.4 → Validate → Fix if needed
6. Run test 3.5 → Validate → Fix if needed
7. Generate Allure report for Contacts module

### Phase 4: Templates (Day 2-3)
1. Validate test 4.1 (only one pending)
2. Re-run tests 4.2-4.5 to confirm still working
3. Generate Allure report for Templates module

### Phase 5: Self-Signing (Day 3)
1. Run test 5.1 → Validate → Fix if needed
2. Run test 5.2 → Validate → Fix if needed
3. Run test 5.3 → Validate → Fix if needed
4. Run test 5.4 → Validate → Fix if needed
5. Run test 5.5 → Validate → Fix if needed
6. Generate Allure report for Self-Signing module

### Phase 6: Final Validation (Day 3)
1. Run ALL 25 tests together
2. Generate comprehensive Allure report
3. Document any remaining issues
4. Create final test summary report

---

## Success Criteria

A test is considered **validated** when:
- ✅ Test runs without errors
- ✅ Browser opens in headed mode (visible)
- ✅ Actions are actually performed (not just UI checks)
- ✅ Expected outcome occurs (create/edit/delete verified)
- ✅ Allure report generated with results
- ✅ No false positives (test passes but feature doesn't work)

---

## Commands Reference

### Run Single Test (Headed Mode)
```bash
cd "C:\Users\gals\Desktop\playwrightTestsClaude\new_tests_for_wesign"
py -m pytest <test_file>::<test_class>::<test_name> -v -s --tb=short
```

### Run Module (All Tests)
```bash
py -m pytest tests/<module>/ -v --tb=short --maxfail=999 --alluredir=allure-results --clean-alluredir
```

### Generate Allure Report
```bash
allure generate allure-results --clean -o allure-report
allure open allure-report
```

### Kill Background Processes
```bash
taskkill /F /IM chromedriver.exe /T
taskkill /F /IM chrome.exe /T
```

---

## Next Steps

1. ✅ Check network connection to devtest.comda.co.il
2. ⏳ Start Phase 1: Authentication Tests (test-by-test)
3. ⏳ Document each test result in this file
4. ⏳ Fix issues as they are discovered
5. ⏳ Progress through all 5 phases systematically

---

**Last Updated:** 2025-10-30
**Current Phase:** Phase 0 - Planning Complete
**Next Action:** Verify network connection and start Phase 1
