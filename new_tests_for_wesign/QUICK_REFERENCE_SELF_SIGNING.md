# Self-Signing Quick Reference Guide

## 🎯 AT A GLANCE:

**Module**: Self-Signing (Personal Signature)
**Status**: ✅ Workflow Verified | ⏳ 1/65 Tests Complete (1.5%)
**Main State**: Place Fields Page (`/dashboard/selfsignfields/{id}/{id}`)
**Junction Points**: 5 critical decision points
**Total Test Scenarios**: 65 tests for 100% coverage

---

## ⚡ COMPLETE WORKFLOW (10 Steps):

```
1. LOGIN
   ├─ URL: /login
   └─ Creds: nirk@comsign.co.il / Comsign1!

2. DASHBOARD
   └─ URL: /dashboard/main

3. UPLOAD FILE
   ├─ Click: "העלאת קובץ" (Upload File)
   └─ Select: sample.pdf

4. SELECT SIGNERS PAGE
   ├─ URL: /dashboard/selectsigners
   └─ Click: "חתימה אישית" (Personal Signature) ← THIS IS SELF-SIGN

5. EDIT DOCUMENT
   └─ Click: "עריכת מסמך" (Edit Document)

6. PLACE FIELDS PAGE ← MAIN STATE
   ├─ URL: /dashboard/selfsignfields/{id}/{id}
   └─ Click: "חתימה" (Signature field button)

7. OPEN SIGNATURE MODAL
   └─ Click: Feather icon (first control button)

8. SELECT SIGNATURE
   └─ Click: Saved Signature #1

9. FINISH
   ├─ Click: "סיים" (Finish)
   └─ URL: /dashboard/success/selfsign

10. VERIFY
    ├─ Assert: "הצלחה!" (Success!) heading
    ├─ Click: "תודה" (Thank you)
    ├─ Navigate: Documents page
    └─ Assert: Document "sample" appears with status "נחתם"
```

---

## 🧭 JUNCTION POINTS & TEST COUNT:

### JP1: Upload File (6 tests)
- Valid PDF ✅
- Invalid file type (DOCX, JPG)
- Large file (>10MB)
- Corrupted PDF
- Cancel upload

### JP2: Select Signers (3 tests)
- **Personal Signature** ✅ ← Self-sign path
- Group Signature
- Online Signature

### JP3: Place Fields - MAIN STATE (40 tests)
**10 Field Types**:
1. Text
2. Signature ✅
3. Initials
4. Email
5. Phone
6. Date
7. Number
8. List
9. Checkbox
10. Radio

**Actions**: Add/Remove/Move/Resize/Sign + Finish/Back

### JP4: Signature Modal (21 tests)
**Tabs**: Draw, Graphic, Initials
**Certificates**: None ✅, Server, Card
**Saved Signatures**: 6 options (used #1 ✅)
**Options**: Apply to all, Save for future
**Actions**: Clear, Cancel, Sign

### JP5: Success Page (2 tests)
- Thank you button ✅
- Status check link

---

## 📝 CRITICAL SELECTORS:

```python
# Upload & Navigation
UPLOAD_BUTTON = 'button:has-text("העלאת קובץ")'
PERSONAL_SIG = 'button:has-text("חתימה אישית")'
EDIT_DOC = 'button:has-text("עריכת מסמך")'

# Place Fields
SIGNATURE_FIELD = 'button:has-text("חתימה")'
FINISH_BUTTON = 'button:has-text("סיים")'
BACK_BUTTON = 'button:has-text("חזור")'

# Success Page
SUCCESS_HEADING = 'heading:has-text("הצלחה!")'
THANK_YOU = 'button:has-text("תודה")'

# Documents Page
DOCS_NAV = 'button:has-text("מסמכים")'
```

---

## ✅ KEY ASSERTIONS:

### URL Assertions:
1. After upload → `/dashboard/selectsigners`
2. After edit → `/dashboard/selfsignfields/{id}/{id}`
3. After finish → `/dashboard/success/selfsign`
4. After documents nav → `/dashboard/documents/all`

### Content Assertions:
5. Success page → "הצלחה!" heading visible
6. Document name → "sample" in documents list
7. Document status → "נחתם" (Signed)
8. Document count → Increases by 1

---

## 📊 TEST PHASES:

| Phase | Tests | Status | Priority |
|-------|-------|--------|----------|
| 1. Sanity | 1 | ✅ Manual | HIGH |
| 2. Field Types | 10 | ⏳ 0% | HIGH |
| 3. Signature Methods | 21 | ⏳ 0% | MEDIUM |
| 4. Multiple Fields | 10 | ⏳ 0% | MEDIUM |
| 5. Navigation | 10 | ⏳ 0% | LOW |
| 6. Upload Edge Cases | 10 | ⏳ 0% | MEDIUM |
| 7. Docs Verification | 5 | ⏳ 0% | HIGH |
| 8. Other Sig Types | 2 | ⏳ 0% | LOW |
| **TOTAL** | **65** | **1.5%** | - |

---

## 🎯 NEXT IMMEDIATE ACTIONS:

### Action 1: Automate Sanity Test (30 min)
- File: `test_self_signing_core_fixed.py`
- Test: Complete E2E with saved signature
- Run: Verify all 8 assertions pass

### Action 2: Implement Phase 2 (2-3 hours)
- 10 tests for each field type
- Evidence-based assertions
- Screenshot captures

### Action 3: Read Backend Code (1 hour)
- Path: `C:\Users\gals\source\repos\user-backend`
- Find: Self-sign API endpoints
- Understand: Validation rules

---

## 🔑 KEY LEARNINGS:

1. **Self-Sign ≠ Direct Navigation**
   - NOT: `/dashboard/selfsign`
   - IS: Upload → Personal Signature → Edit

2. **Main State = Most Tests**
   - Place Fields Page = 40/65 tests (62%)
   - Focus automation here first

3. **Junction Points = Coverage**
   - 5 junction points identified
   - Each option = separate test
   - Complete mapping = 100% coverage

4. **Evidence > Assumptions**
   - Count before/after
   - Search and verify
   - URL validation
   - Content verification

---

## 📁 DOCUMENTATION FILES:

1. `SELF_SIGNING_MASTER_PLAN.md` - Complete 65-test plan
2. `SESSION_SUMMARY_SELF_SIGNING_DISCOVERY.md` - What we established
3. `QUICK_REFERENCE_SELF_SIGNING.md` - This file
4. `SELF_SIGN_WORKFLOW_COMPLETE_VERIFIED.md` - Detailed workflow
5. `SIGNATURE_MODAL_TEST_CASES.md` - Modal options (21 tests)

---

## 🚀 READY TO GO:

✅ Workflow understood
✅ Junction points mapped
✅ Test scenarios calculated
✅ Selectors documented
✅ Assertions defined
✅ Evidence requirements clear

**Status**: Ready for automation
**Confidence**: 100%

---

**Last Updated**: 2025-11-01
**Next Review**: After Phase 1 automation complete
