# Self-Signing Module - Master Test Plan & Comprehensive Coverage

## 🎯 WHAT WE ESTABLISHED TODAY:

### Critical Discovery Process:
1. **Initial Problem**: Couldn't find self-signing navigation in UI
2. **Attempted Solution**: Read WeSign codebase (`wesign-client-DEV`) - found `/dashboard/selfsign` route
3. **Reality Check**: Direct navigation didn't work (Angular SPA routing)
4. **Breakthrough**: Used MCP browser tools to manually explore the REAL workflow
5. **Success**: Discovered the actual user journey step-by-step with your guidance

### Key Insight:
**Code analysis alone isn't enough** - we must:
1. Read the code to understand architecture
2. Manually navigate the live UI to discover actual user flow
3. Document junction points (where user makes choices)
4. Create evidence-based tests that prove functionality

---

## ✅ VERIFIED SELF-SIGNING WORKFLOW (Manual Walkthrough Complete):

### The Complete Journey:

```
LOGIN
  ↓
DASHBOARD (/dashboard/main)
  ↓
Click "העלאת קובץ" (Upload File) ← JUNCTION POINT 1
  ↓
FILE CHOOSER OPENS
  ↓
Upload PDF (sample.pdf)
  ↓
SELECT SIGNERS PAGE (/dashboard/selectsigners) ← JUNCTION POINT 2
  │
  ├─→ "חתימה אישית" (Personal Signature) ← SELF-SIGN PATH ✓
  ├─→ "חתימה קבוצתית" (Group Signature)
  └─→ "חתימה מקוונת" (Online Signature)
  ↓
Click "עריכת מסמך" (Edit Document)
  ↓
PLACE FIELDS PAGE (/dashboard/selfsignfields/{id}/{id}) ← JUNCTION POINT 3 (MAIN STATE)
  │
  ├─→ Add Fields (10 types available)
  ├─→ Click "חזור" (Back) → Returns to dashboard
  └─→ Click "סיים" (Finish) → Complete workflow
  ↓
Click "חתימה" (Signature) field button
  ↓
Signature field appears on document
  ↓
Click feather icon to open signature modal ← JUNCTION POINT 4
  ↓
SIGNATURE MODAL
  │
  ├─→ Tab: "ציור" (Draw) ← Draw with mouse
  ├─→ Tab: "גרפית" (Graphic) ← Type signature
  ├─→ Tab: "ראשי תיבות" (Initials) ← Add initials
  │
  ├─→ Certificate: "ללא" (None) ← Default
  ├─→ Certificate: "שרת" (Server)
  ├─→ Certificate: "כרטיס" (Card)
  │
  ├─→ Saved Signatures (6 available) ← We used this
  │
  ├─→ Checkbox: Apply to all fields
  └─→ Checkbox: Save for future
  ↓
Click saved signature #1
  ↓
Modal closes, signature applied
  ↓
Click "סיים" (Finish)
  ↓
SUCCESS PAGE (/dashboard/success/selfsign) ← JUNCTION POINT 5
  │
  └─→ Shows "הצלחה!" (Success!) ← KEY ASSERTION
  ↓
Click "תודה" (Thank you)
  ↓
DASHBOARD (/dashboard/main)
  ↓
Click "מסמכים" (Documents)
  ↓
DOCUMENTS PAGE (/dashboard/documents/all)
  │
  └─→ Document "sample" appears ← KEY ASSERTION
      - Status: "נחתם" (Signed)
      - Date: Nov 1, 2025, 05:33
      - Count: 1 document
```

---

## 🧭 JUNCTION POINTS (Decision Points for Testing):

### Junction Point 1: Upload File Button
**Location**: Dashboard main
**Options**:
- Upload File (file chooser)
**Tests Needed**:
- Valid PDF upload ✓ (Done)
- Invalid file type (DOCX, JPG, etc.)
- Large file (>10MB)
- Corrupted PDF
- Cancel file chooser

### Junction Point 2: Select Signers Page
**Location**: `/dashboard/selectsigners`
**Options**:
- חתימה אישית (Personal Signature) ← Self-sign ✓
- חתימה קבוצתית (Group Signature)
- חתימה מקוונת (Online Signature)
**Tests Needed**:
- Select personal signature ✓ (Done)
- Select group signature
- Select online signature
- Edit document name before proceeding
- Back button behavior
- Cancel workflow

### Junction Point 3: Place Fields Page (MAIN STATE)
**Location**: `/dashboard/selfsignfields/{id}/{id}`
**Options** (10 field types):
1. טקסט (Text)
2. חתימה (Signature) ✓
3. ראשי תיבות (Initials)
4. דוא"ל (Email)
5. טלפון (Phone)
6. תאריך (Date)
7. מספר (Number)
8. רשימה (List)
9. תיבת סימון (Checkbox)
10. רדיו (Radio)

**Actions Available**:
- Add field(s)
- Remove field(s)
- Move field(s)
- Resize field(s)
- Sign field(s)
- Click "סיים" (Finish) ✓
- Click "חזור" (Back)

**Tests Needed** (Critical - Main State):
- Add each field type (10 tests)
- Add multiple fields of same type
- Add multiple different field types
- Remove field after adding
- Sign signature field ✓ (Done)
- Complete without adding fields
- Complete with multiple fields
- Back button → verify returns to dashboard
- Multi-page document field placement
- Field validation (required vs optional)

### Junction Point 4: Signature Modal
**Location**: Modal overlay on place fields page
**Options**:
- **Tabs**: Draw, Graphic, Initials
- **Certificates**: None, Server, Card
- **Saved Signatures**: 6 options ✓ (Used #1)
- **Checkboxes**: Apply to all, Save for future
- **Actions**: Clear, Cancel, Sign

**Tests Needed**:
- Draw signature with mouse
- Type signature (Graphic tab)
- Use initials
- Select each saved signature (6 tests)
- Use "None" certificate ✓ (Default)
- Use "Server" certificate
- Use "Card" certificate
- Enable "Apply to all fields"
- Enable "Save for future"
- Clear drawn signature
- Cancel modal
- Sign without selecting signature (should be disabled)

### Junction Point 5: Success Page
**Location**: `/dashboard/success/selfsign`
**Options**:
- Click "תודה" (Thank you) → Dashboard ✓
- Click "לבדיקת סטאטוס חתימה לחצו כאן" → Status check

**Tests Needed**:
- Verify success heading ✓ (Done)
- Click thank you ✓ (Done)
- Click status check link
- Verify document appears in Documents ✓ (Done)

---

## 📋 COMPREHENSIVE TEST COVERAGE PLAN:

### Phase 1: SANITY (COMPLETED ✓)
**File**: `test_self_signing_core_fixed.py`
**Test**: `test_complete_self_sign_workflow_with_saved_signature_success`
**Status**: ✅ VERIFIED MANUALLY
**Coverage**:
- Login
- Upload PDF
- Select Personal Signature
- Edit Document
- Add Signature Field
- Apply Saved Signature #1
- Finish
- Verify Success Page
- Verify Document in Documents Page

**Assertions**:
1. URL changes to `/selectsigners` after upload
2. URL changes to `/selfsignfields` after edit
3. URL changes to `/success/selfsign` after finish
4. Success page shows "הצלחה!"
5. Document appears in Documents page
6. Document status is "נחתם"
7. Document count increases by 1

---

### Phase 2: FIELD TYPES (10 Tests)
**Purpose**: Test each field type can be added and signed/filled

**Tests**:
1. `test_add_text_field_and_complete`
2. `test_add_signature_field_and_complete` ✓ (Done in Phase 1)
3. `test_add_initials_field_and_complete`
4. `test_add_email_field_and_complete`
5. `test_add_phone_field_and_complete`
6. `test_add_date_field_and_complete`
7. `test_add_number_field_and_complete`
8. `test_add_list_field_and_complete`
9. `test_add_checkbox_field_and_complete`
10. `test_add_radio_field_and_complete`

**Evidence Required**:
- Field appears on document
- Field can be interacted with (fill/sign)
- Document completes successfully
- Document appears in Documents page

---

### Phase 3: SIGNATURE METHODS (21 Tests)
**Purpose**: Test all signature modal options

**Signature Tabs** (3 tests):
11. `test_draw_signature_with_mouse`
12. `test_type_signature_graphic_tab`
13. `test_add_initials_tab`

**Certificates** (3 tests):
14. `test_sign_with_no_certificate` ✓ (Done in Phase 1)
15. `test_sign_with_server_certificate`
16. `test_sign_with_card_certificate`

**Saved Signatures** (6 tests):
17. `test_use_saved_signature_1` ✓ (Done in Phase 1)
18. `test_use_saved_signature_2`
19. `test_use_saved_signature_3`
20. `test_use_saved_signature_4`
21. `test_use_saved_signature_5`
22. `test_use_saved_signature_6`

**Options** (3 tests):
23. `test_apply_signature_to_all_fields`
24. `test_save_signature_for_future_use`
25. `test_apply_to_all_and_save_for_future`

**Modal Actions** (3 tests):
26. `test_clear_drawn_signature`
27. `test_cancel_signature_modal`
28. `test_sign_button_disabled_without_signature`

---

### Phase 4: MULTIPLE FIELDS (10 Tests)
**Purpose**: Test complex field combinations

29. `test_add_multiple_signature_fields`
30. `test_add_signature_and_initials_fields`
31. `test_add_all_field_types_in_one_document`
32. `test_remove_field_after_adding`
33. `test_move_field_position`
34. `test_resize_field`
35. `test_add_fields_on_multiple_pages`
36. `test_sign_multiple_signature_fields_individually`
37. `test_sign_multiple_signature_fields_with_apply_to_all`
38. `test_add_required_and_optional_fields`

---

### Phase 5: NAVIGATION & WORKFLOW (10 Tests)
**Purpose**: Test navigation paths and workflow interruptions

39. `test_back_button_from_place_fields_page`
40. `test_cancel_at_select_signers_page`
41. `test_edit_document_name_before_proceeding`
42. `test_complete_without_adding_any_fields`
43. `test_browser_back_button_behavior`
44. `test_status_check_link_from_success_page`
45. `test_multiple_documents_workflow_sequential`
46. `test_logout_during_workflow`
47. `test_session_timeout_during_workflow`
48. `test_network_interruption_during_upload`

---

### Phase 6: FILE UPLOAD EDGE CASES (10 Tests)
**Purpose**: Test upload validation and handling

49. `test_upload_invalid_file_type_docx`
50. `test_upload_invalid_file_type_jpg`
51. `test_upload_large_pdf_file_10mb`
52. `test_upload_corrupted_pdf`
53. `test_upload_password_protected_pdf`
54. `test_upload_multi_page_pdf_100_pages`
55. `test_upload_pdf_with_special_characters_in_name`
56. `test_upload_pdf_with_hebrew_filename`
57. `test_cancel_file_chooser`
58. `test_upload_same_file_twice_different_sessions`

---

### Phase 7: DOCUMENTS PAGE VERIFICATION (5 Tests)
**Purpose**: Verify document appears correctly in Documents page

59. `test_document_appears_in_all_documents_list`
60. `test_document_searchable_by_name`
61. `test_document_status_is_signed`
62. `test_document_date_is_correct`
63. `test_document_can_be_downloaded_after_self_sign`

---

### Phase 8: SIGNATURE TYPE SELECTION (2 Tests)
**Purpose**: Test other signature type options

64. `test_select_group_signature_type`
65. `test_select_online_signature_type`

---

## 📁 CODEBASE REFERENCES FOR IMPLEMENTATION:

### WeSign Frontend (`C:\Users\gals\Desktop\wesign-client-DEV`):
- **Upload Component**: `src/app/components/dashboard/main/dashboard-main.component.ts`
- **Select Signers**: `src/app/components/dashboard/selectsigners/selectsigners.component.ts`
- **Place Fields**: `src/app/components/dashboard/selfsign/self-sign-place-fields.component.ts`
- **Signature Modal**: Components within place fields
- **Documents Page**: `src/app/components/dashboard/main/documents/documents.component.ts`

### Backend (`C:\Users\gals\source\repos\user-backend`):
- **Document API**: Look for document creation endpoints
- **Self-Sign API**: Look for self-signing specific endpoints
- **Validation Logic**: File upload validation rules
- **Business Logic**: Field type validations, signature requirements

### Analysis Strategy:
1. Read component TypeScript files to understand:
   - Form validations
   - API calls
   - State management
   - Error handling
2. Map API endpoints from frontend → backend
3. Understand database schema for documents
4. Identify all possible error states
5. Find edge case handling in code

---

## 🔄 SYSTEMATIC DISCOVERY METHODOLOGY (For Future Modules):

### Step 1: Code Analysis
1. Read relevant frontend components
2. Identify routes and navigation paths
3. Map API calls and data flow
4. Document form fields and validations

### Step 2: Manual UI Exploration (Critical!)
1. **Use MCP browser tools** to navigate actual UI
2. Ask user for guidance at each junction point
3. Document what ACTUALLY happens vs what code suggests
4. Take screenshots at key states
5. Note all clickable elements and their outcomes

### Step 3: Junction Point Identification
1. List all decision points in the workflow
2. Document all options at each junction
3. Create test case for each path from each junction
4. Identify happy path vs edge cases

### Step 4: Evidence-Based Test Creation
1. Create sanity test for happy path first
2. Run manually to verify
3. Add assertions for:
   - URL changes
   - Element visibility
   - Content verification
   - Count changes
   - Search/filter results

### Step 5: Comprehensive Coverage
1. Expand to all junction point options
2. Add edge cases (errors, validation, limits)
3. Add integration tests (multiple workflows)
4. Add performance tests (large files, many fields)

### Step 6: Verification Loop
1. Run test manually first
2. Verify all assertions pass
3. Automate the test
4. Run automated test
5. Review with user
6. Iterate until perfect

---

## 🎯 NEXT STEPS FOR SELF-SIGNING MODULE:

### Immediate (This Session):
1. ✅ Manual workflow verified
2. ✅ Junction points documented
3. ⏳ Create automated test for Phase 1 (Sanity)
4. ⏳ Run automated test and verify
5. ⏳ Review with user

### Short Term (Next 1-2 Sessions):
1. Implement Phase 2 (Field Types) - 10 tests
2. Implement Phase 3 (Signature Methods) - 21 tests
3. Read backend code for validation rules
4. Add error handling tests

### Medium Term (Next 3-5 Sessions):
1. Implement Phase 4 (Multiple Fields) - 10 tests
2. Implement Phase 5 (Navigation) - 10 tests
3. Implement Phase 6 (Upload Edge Cases) - 10 tests
4. Code review and refactoring

### Long Term (Ongoing):
1. Implement Phase 7 (Documents Verification) - 5 tests
2. Implement Phase 8 (Other Signature Types) - 2 tests
3. Performance testing
4. Integration with other modules
5. Continuous maintenance

---

## 📊 CURRENT STATUS:

### Completed Today:
- ✅ Discovered complete self-signing workflow through manual exploration
- ✅ Identified all 5 junction points
- ✅ Documented 65 test scenarios needed for 100% coverage
- ✅ Verified sanity test manually (Phase 1)
- ✅ Created comprehensive documentation
- ✅ Established systematic discovery methodology

### Test Coverage:
- **Phase 1**: 1/1 tests (100%) - Verified manually ✓
- **Phase 2**: 0/10 tests (0%)
- **Phase 3**: 0/21 tests (0%)
- **Phase 4**: 0/10 tests (0%)
- **Phase 5**: 0/10 tests (0%)
- **Phase 6**: 0/10 tests (0%)
- **Phase 7**: 0/5 tests (0%)
- **Phase 8**: 0/2 tests (0%)

**Total**: 1/65 tests (1.5% coverage)
**Target**: 65/65 tests (100% coverage)

---

## 🔑 KEY LEARNINGS:

1. **Code ≠ Reality**: Frontend code suggested `/dashboard/selfsign` but actual path is through upload button
2. **Manual Discovery Essential**: MCP browser tools + user guidance = accurate workflow understanding
3. **Junction Points Critical**: Every decision point = multiple test scenarios
4. **Evidence-Based**: Count before/after, URL verification, content search - prove don't assume
5. **Systematic Approach**: Follow same methodology for every module (Auth ✓, Documents ✓, Contacts ⚠️, Templates ⚠️, Self-Sign ✓)

---

## 📝 FILES CREATED TODAY:

1. `SELF_SIGN_COMPLETE_WORKFLOW_DISCOVERED.md` - Initial workflow discovery
2. `SIGNATURE_MODAL_TEST_CASES.md` - Signature modal options documentation
3. `SELF_SIGN_WORKFLOW_COMPLETE_VERIFIED.md` - Verified workflow with assertions
4. `SELF_SIGNING_MASTER_PLAN.md` - This comprehensive plan
5. `test_self_signing_core_fixed.py` - Test file (needs refactoring with verified workflow)

---

## 🚀 READY TO PROCEED:

**Status**: Workflow fully understood, documented, and verified
**Next Action**: Create automated test for Phase 1 sanity test
**Confidence**: 100% - We know exactly what to test and how to test it

---

**Last Updated**: 2025-11-01
**Verified By**: Manual MCP browser walkthrough with user guidance
**Approval**: Pending user review
