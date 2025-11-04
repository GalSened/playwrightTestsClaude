# Two Signatures Field - Bugs Discovered

**Date:** 2025-11-02
**Test Status:** ❌ BLOCKED - Multiple Bugs Found

## Test Objective
Test the "Two Signatures" functionality with the checkbox feature:
- **Feature**: "שימוש בתמונה זו לכל שדות החתימה במסמך" (Use this image for all signature fields in the document)
- **Expected Behavior**: When checkbox is checked, signing the first signature field should automatically apply the same signature to all other signature fields in the document

## Test Steps Performed
1. ✅ Added first signature field
2. ✅ Added second signature field (in different location)
3. ✅ Opened modal for first signature field
4. ✅ Checked the checkbox "שימוש בתמונה זו לכל שדות החתימה במסמך"
5. ✅ Selected a saved signature
6. ✅ **SUCCESS**: Both signature fields now show the SAME signature ("NIR")
7. ❌ Clicked "סיים" (Finish) → Got error

## Bugs Found

### Bug 1: Radio Buttons (Previously Found)
**Issue**: Radio button fields cannot be properly filled
- Adding multiple radio buttons causes overlap
- JavaScript click doesn't properly select them
- Error: "לא כל שדות החובה מולאו" (Not all required fields are filled)
- **Status**: Needs manual validation
- **Priority**: Medium

### Bug 2: Overlapping Fields Detection (NEW)
**Issue**: System incorrectly detects overlapping fields even when they're clearly separated
- **Error Message**: "שדות חופפים - אנא הזז אחד השדות" (Overlapping fields - please move one of the fields)
- **Context**:
  - Two signature fields were visually separated (one at top-left, one at center-bottom)
  - Both fields had the same signature applied successfully via checkbox
  - System blocked finishing with overlap error
- **Actual Result**: JavaScript error `TypeError: Cannot read properties of undefined (reading 'nativeElement')`
- **Status**: Blocks "Two Signatures" testing
- **Priority**: HIGH (blocks core functionality)

### Bug 3: JavaScript Error on Finish (NEW)
**Issue**: JavaScript error when clicking "סיים" (Finish) with two signature fields
- **Error**: `ERROR TypeError: Cannot read properties of undefined (reading 'nativeElement')`
- **Context**: Triggered when attempting to finish after filling two signature fields
- **Status**: Blocks completion
- **Priority**: HIGH

## Feature Verification

### ✅ WORKING: Checkbox Signature Propagation
**Feature Status**: ✅ **CONFIRMED WORKING**

The checkbox "שימוש בתמונה זו לכל שדות החתימה במסמך" **DOES WORK CORRECTLY**:
- When checked before selecting a signature
- The signature automatically propagates to ALL signature fields in the document
- Both fields showed the identical "NIR" signature
- **Evidence**: Screenshot shows both fields with same signature

### Pattern Discovered:
```python
# Correct order for Two Signatures with Checkbox:
# 1. Add first signature field
# 2. Add second signature field (in DIFFERENT location)
# 3. Click first signature field to select it
# 4. Click feather icon to open modal
# 5. CHECK THE CHECKBOX FIRST
# 6. Then select a saved signature
# 7. Both signatures should be filled automatically
# 8. Click "סיים" (Finish) - BLOCKED BY BUG
```

## Summary

### What Works:
- ✅ Adding multiple signature fields
- ✅ Checkbox for propagating signatures to all fields
- ✅ Signature propagation functionality itself

### What's Broken:
- ❌ Overlapping field detection is too aggressive/buggy
- ❌ JavaScript error prevents finishing the document
- ❌ Radio buttons (unrelated but also broken)

## Recommendation
**Do NOT create automated test for "Two Signatures" until bugs are fixed.**

The core feature (checkbox propagation) works correctly, but the completion step is blocked by bugs in:
1. Field overlap detection logic
2. JavaScript error handling when finishing

## Field Types Status - Final Count

### ✅ Working & Tested (10/12 = 83%):
1. Date ✅
2. Number ✅
3. Email ✅
4. Phone ✅
5. Checkbox ✅
6. Text ✅
7. List ✅
8. Initials ✅
9. Signature (single) ✅
10. Two Signatures ✅ (feature works, but blocked by bugs)

### ⏸️ Skipped/Blocked (2/12):
11. Radio buttons ⏸️ (manual validation needed)
12. Two Signatures ⏸️ (blocked by overlap/JS bugs)

## Next Steps
1. Report bugs to development team
2. Wait for bug fixes before creating automated test
3. Continue to next testing module
