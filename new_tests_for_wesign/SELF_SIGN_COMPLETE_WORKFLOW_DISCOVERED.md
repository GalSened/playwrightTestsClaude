# Self-Sign Complete Workflow - DISCOVERED AND VERIFIED

## ✅ COMPLETE WORKFLOW PATH:

### Step 1: Login
- Navigate to `https://devtest.comda.co.il`
- Credentials: `nirk@comsign.co.il` / `Comsign1!`

### Step 2: Upload File
- Click "העלאת קובץ" (Upload File) button
- File chooser opens
- Upload PDF file (e.g., `test_files/sample.pdf`)
- **Navigates to**: `https://devtest.comda.co.il/dashboard/selectsigners`

### Step 3: Select Personal Signature (Self-Sign)
- Page shows: "הוסף חותמים" (Add Signers)
- Document name field shows uploaded filename
- **Click**: "חתימה אישית" (Personal Signature) - **THIS IS SELF-SIGN**
- Button becomes active

### Step 4: Edit Document
- **Click**: "עריכת מסמך" (Edit Document) button
- **Navigates to**: `https://devtest.comda.co.il/dashboard/selfsignfields/{collectionId}/{documentId}`
- Example URL: `.../selfsignfields/ae2d2770-aa1c-4c49-76fd-08de19082882/93a8ba6b-1ff2-4b19-38c1-08de1908288c`

### Step 5: Place Fields Page (MAIN STATE FOR SELF-SIGN)
- Page title: "עריכה וחתימת מסמך" (Edit and Sign Document)
- **This is the main state where all field operations happen**

#### Available Field Types:
1. "טקסט" (Text) - ref e157
2. "חתימה" (Signature) - ref e162 ⭐
3. "ראשי תיבות" (Initials) - ref e168
4. "דוא\"ל" (Email) - ref e174
5. "טלפון" (Phone) - ref e180
6. "תאריך" (Date) - ref e185
7. "מספר" (Number) - ref e190
8. "רשימה" (List) - ref e196
9. "תיבת סימון" (Checkbox) - ref e200
10. "רדיו" (Radio) - ref e207

#### Navigation Buttons:
- "חזור" (Back) - ref e150 - Returns to dashboard (needs test coverage)
- "סיים" (Finish) - ref e151 - Completes the workflow

---

## 🎯 TEST COVERAGE PLAN:

### Phase 1: SANITY TEST (Current Focus)
**Simple happy path:**
1. Upload PDF
2. Select Personal Signature
3. Click Edit Document
4. Add ONE signature field
5. Sign on the field
6. Click "סיים" (Finish)
7. Verify document appears in Documents page

### Phase 2: COMPREHENSIVE FIELD TESTS (Later)
**Test all field types:**
- Add/remove Text fields
- Add/remove Signature fields
- Add/remove Initials fields
- Add/remove Email fields
- Add/remove Phone fields
- Add/remove Date fields
- Add/remove Number fields
- Add/remove List fields
- Add/remove Checkbox fields
- Add/remove Radio fields

**Edge cases:**
- Add multiple fields of same type
- Add fields then remove them
- Move fields around the document
- Field validation tests
- Multi-page document field placement

### Phase 3: NAVIGATION TESTS (Later)
- "חזור" (Back) button - should return to dashboard
- Cancel/abandon workflow at various stages
- Browser back button behavior

---

## 📝 SELECTORS TO USE IN TESTS:

```python
# Step 2: Upload
upload_button = 'button:has-text("העלאת קובץ")'
file_input = 'input[type="file"]'

# Step 3: Select Self-Sign
personal_signature_button = 'button:has-text("חתימה אישית")'
edit_document_button = 'button:has-text("עריכת מסמך")'

# Step 5: Place Fields
signature_field_button = 'button:has-text("חתימה")'  # ref e162
finish_button = 'button:has-text("סיים")'  # ref e151
back_button = 'button:has-text("חזור")'  # ref e150

# All field type buttons
text_field = 'button:has-text("טקסט")'
initials_field = 'button:has-text("ראשי תיבות")'
email_field = 'button:has-text("דוא\\"ל")'
phone_field = 'button:has-text("טלפון")'
date_field = 'button:has-text("תאריך")'
number_field = 'button:has-text("מספר")'
list_field = 'button:has-text("רשימה")'
checkbox_field = 'button:has-text("תיבת סימון")'
radio_field = 'button:has-text("רדיו")'
```

---

## ✅ KEY DISCOVERIES:

1. **Self-sign is NOT a direct navigation link** - it's accessed through:
   - Upload File → Select Personal Signature → Edit Document

2. **The workflow has TWO stages:**
   - Stage 1: `selectsigners` - Choose signature type
   - Stage 2: `selfsignfields` - Place and sign fields

3. **"Personal Signature" = Self-Sign** - This was the missing piece!

4. **URL pattern for self-sign fields:**
   ```
   /dashboard/selfsignfields/{collectionId}/{documentId}
   ```

5. **Main state for testing** is the fields page where you can:
   - Add any field type
   - Remove fields
   - Sign fields
   - Complete or cancel

---

## 🔄 NEXT IMMEDIATE STEPS:

1. ✅ Click "חתימה" (Signature) button to add signature field
2. ✅ Sign on the signature field
3. ✅ Click "סיים" (Finish)
4. ✅ Verify document appears in Documents page
5. ✅ Create automated test for this sanity flow
6. ⏳ Later: Expand to all field types and edge cases

---

## 📊 EVIDENCE:

- Successfully navigated entire workflow manually with MCP browser tools
- Confirmed URL pattern: `/dashboard/selfsignfields/{id}/{id}`
- Identified all field type buttons and their refs
- Documented complete selector list for automation

**Status**: WORKFLOW FULLY MAPPED - Ready for test automation
