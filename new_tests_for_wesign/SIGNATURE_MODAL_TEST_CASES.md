# Signature Modal - Complete Test Coverage Plan

## 📋 SIGNATURE MODAL OPTIONS DISCOVERED:

### Signature Type Tabs:
1. **"ציור" (Draw)** - Draw signature with mouse/touch
2. **"גרפית" (Graphic/Type)** - Type signature
3. **"ראשי תיבות" (Initials)** - Add initials

### Signature Method Radio Buttons:
1. **"ללא" (None)** - No certificate (default/checked)
2. **"שרת" (Server)** - Server certificate
3. **"כרטיס" (Card)** - Card/Smart card certificate

### Options Checkboxes:
1. **"שימוש בתמונה זו לכל שדות החתימה במסמך"**
   - Translation: "Use this image for all signature fields in document"
   - Use case: Apply same signature to multiple fields

2. **"שמירת חתימה זאת לשימוש עתידי"**
   - Translation: "Save this signature for future use"
   - Use case: Store signature for reuse

### Saved Signatures:
- 6 saved signature buttons available
- Can select pre-saved signatures

### Action Buttons:
- **"נקה" (Clear)** - Clear drawn signature
- **"ביטול" (Cancel)** - Cancel signature dialog
- **"חתום" (Sign)** - Confirm and apply signature (disabled until signature selected/drawn)

---

## 🧪 COMPREHENSIVE TEST CASES TO ADD LATER:

### Test Group 1: Signature Type Tests
- [ ] Test 1: Draw signature with mouse
- [ ] Test 2: Use typed/graphic signature
- [ ] Test 3: Use initials tab
- [ ] Test 4: Clear drawn signature
- [ ] Test 5: Cancel signature dialog

### Test Group 2: Certificate Method Tests
- [ ] Test 6: Sign with "ללא" (None) - no certificate
- [ ] Test 7: Sign with "שרת" (Server) certificate
- [ ] Test 8: Sign with "כרטיס" (Card) certificate

### Test Group 3: Saved Signatures Tests
- [ ] Test 9: Select saved signature #1
- [ ] Test 10: Select saved signature #2
- [ ] Test 11: Select saved signature #3
- [ ] Test 12: Select saved signature #4
- [ ] Test 13: Select saved signature #5
- [ ] Test 14: Select saved signature #6

### Test Group 4: Options Tests
- [ ] Test 15: Apply signature to all fields in document
- [ ] Test 16: Save new signature for future use
- [ ] Test 17: Apply to all fields + save for future

### Test Group 5: Edge Cases
- [ ] Test 18: Try to sign without drawing/selecting signature (button should be disabled)
- [ ] Test 19: Draw signature, then clear, then draw again
- [ ] Test 20: Switch between tabs (Draw → Graphic → Initials)
- [ ] Test 21: Cancel dialog and verify signature not applied

---

## ✅ CURRENT SANITY TEST (Phase 1):

**Simple path:**
1. Click feather button to open signature modal ✅
2. **Select one saved signature** ⏳ (NEXT STEP)
3. Click "חתום" (Sign) button
4. Verify signature applied to field
5. Click "סיים" (Finish) to complete document
6. Verify document in Documents page

---

## 📝 SELECTORS FOR TESTS:

```python
# Signature Modal Tabs
draw_tab = 'button:has-text("ציור")'
graphic_tab = 'button:has-text("גרפית")'
initials_tab = 'button:has-text("ראשי תיבות")'

# Certificate Method Radio Buttons
cert_none = 'radio[value="ללא"]'  # or by label
cert_server = 'radio[value="שרת"]'
cert_card = 'radio[value="כרטיס"]'

# Options Checkboxes
apply_to_all_fields_checkbox = 'checkbox' # by label text
save_for_future_checkbox = 'checkbox'  # by label text

# Saved Signatures (6 buttons)
saved_signature_1 = # ref e316
saved_signature_2 = # ref e318
saved_signature_3 = # ref e320
saved_signature_4 = # ref e322
saved_signature_5 = # ref e324
saved_signature_6 = # ref e326

# Action Buttons
clear_button = 'text=נקה'
cancel_button = 'button:has-text("ביטול")'
sign_confirm_button = 'button:has-text("חתום")'  # in modal
```

---

## 🎯 PRIORITY:

**Phase 1 (Now):** Sanity test - Select saved signature #1
**Phase 2 (Later):** All 21 test cases above

**Status:** Options documented - Ready to proceed with sanity test
