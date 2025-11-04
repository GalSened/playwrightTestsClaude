# REAL Document Validation Plan - Evidence-Based Testing

## Problem with Current Approach
❌ Running all 20 tests together proves nothing
❌ Tests might pass but not actually do anything (fake pass)
❌ No evidence collected (screenshots, counts, verification)
❌ Need to validate ONE BY ONE with proof

## NEW Approach: 5 Core E2E Tests with Evidence

### Test #1: Navigate to Documents Page
**What it CLAIMS:** Navigate from dashboard to documents page
**How to PROVE it works:**
1. Run test with full screen browser
2. Screenshot BEFORE: Show dashboard URL
3. Screenshot AFTER: Show documents page URL (should be /dashboard/documents/all)
4. Verify: URL changed, documents page elements visible
**Evidence Required:** 2 screenshots showing URL change

### Test #2: Upload PDF Document (COUNT VERIFICATION)
**What it CLAIMS:** Upload PDF and document appears in list
**How to PROVE it works:**
1. Screenshot BEFORE: Show document count (e.g., "5 documents")
2. Run upload action
3. Screenshot AFTER: Show document count (should be "6 documents")
4. Screenshot: New document visible in list with correct name
**Evidence Required:**
- Count before (number)
- Count after (number + 1)
- New document visible in list

### Test #3: Search Documents
**What it CLAIMS:** Search filters document list
**How to PROVE it works:**
1. Screenshot BEFORE: Show all documents (e.g., 6 documents visible)
2. Type search term (e.g., "test")
3. Screenshot AFTER: Show filtered results (e.g., only 2 documents with "test" in name)
4. Verify: Only matching documents shown
**Evidence Required:**
- Total count before search
- Filtered count after search
- Only matching documents visible

### Test #4: Delete Document (COUNT VERIFICATION)
**What it CLAIMS:** Delete document and it disappears
**How to PROVE it works:**
1. Screenshot BEFORE: Show document count (e.g., "6 documents")
2. Select document to delete
3. Click delete button
4. Confirm deletion
5. Screenshot AFTER: Show document count (should be "5 documents")
6. Verify: Deleted document no longer in list
**Evidence Required:**
- Count before (number)
- Count after (number - 1)
- Specific document no longer visible

### Test #5: Edit Document Name
**What it CLAIMS:** Change document name
**How to PROVE it works:**
1. Screenshot BEFORE: Document name is "Original Name"
2. Click edit/rename
3. Change name to "New Name {timestamp}"
4. Save
5. Screenshot AFTER: Document name is "New Name {timestamp}"
**Evidence Required:**
- Original name visible
- New name visible
- Name changed in document list

---

## Execution Method: ONE BY ONE

### For EACH test:

**Step 1: Read Test Code**
- Understand what test claims to do
- Identify the action (upload, delete, edit, etc.)
- Note what should change (count, name, visibility)

**Step 2: Run Test ALONE**
- Run ONLY this single test
- Full screen browser
- Slow motion (1500ms)
- YOU watch the browser

**Step 3: Collect Evidence**
- Take screenshot BEFORE action
- Take screenshot AFTER action
- Record counts, names, or whatever changes
- Save screenshots with descriptive names

**Step 4: Analyze Results**
- Did the count change? (for create/delete)
- Did the name change? (for edit)
- Did the search filter? (for search)
- Is there PROOF the action worked?

**Step 5: Document Verdict**
- ✅ REAL PASS: Test works, have evidence
- ❌ FAKE PASS: Test passed but nothing happened
- 🔧 NEEDS FIX: Test broken, fix it now

**Step 6: Move to Next Test**
- Only after confirming current test works
- No batch processing
- One at a time with verification

---

## Tests to Create/Validate

I will create 5 comprehensive E2E tests:

1. **test_e2e_1_navigate_to_documents** - Basic navigation
2. **test_e2e_2_upload_pdf_with_count_verification** - Upload with proof
3. **test_e2e_3_search_documents_filter_verification** - Search with proof
4. **test_e2e_4_delete_document_with_count_verification** - Delete with proof
5. **test_e2e_5_edit_document_name_verification** - Edit with proof

Each test will:
- Print counts/status BEFORE
- Perform action
- Print counts/status AFTER
- Take screenshots at key points
- Verify change actually happened

---

## Next Steps

1. Create 5 E2E document tests (new file)
2. Run Test #1 alone - YOU watch
3. Collect evidence (screenshots)
4. Get YOUR verdict: Real pass or fake pass?
5. Fix if needed
6. Move to Test #2
7. Repeat for all 5 tests

**Ready to create the 5 real E2E tests?**
