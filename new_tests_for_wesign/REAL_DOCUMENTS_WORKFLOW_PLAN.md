# REAL Documents Workflow - Understanding & Test Plan

## What I Learned

The **Documents page** is NOT for uploading files directly!

### Documents Page Purpose:
- Shows documents that are **in the signing workflow**
- Displays documents that have been:
  1. **Self-signed** (uploaded via self-signing feature)
  2. **Sent from templates** (templates sent to recipients)
  3. **Created through signing process**

### Real Workflow:
```
User Journey:
1. Go to "Self-Signing" page → Upload PDF → Add signature fields → Send/Sign
   → Document appears in "Documents" page

OR

2. Go to "Templates" page → Use template → Send to recipient
   → Document appears in "Documents" page
```

## Correct Test Strategy

### Module Organization:

**1. Self-Signing Module** (Primary - Creates documents)
- Test 1: Upload PDF for self-signing
- Test 2: Add signature field
- Test 3: Add text/date fields
- Test 4: Sign document
- Test 5: Send document
- **Result:** Document appears in Documents page

**2. Templates Module** (Secondary - Creates documents)
- Test 1: Create template
- Test 2: Use template to send
- **Result:** Document appears in Documents page

**3. Documents Module** (View/Manage - Passive)
- Test 1: Navigate to documents page
- Test 2: View document created from self-signing
- Test 3: Search/filter documents
- Test 4: View document status
- Test 5: Download/view signed document

## NEW Validation Plan

### Phase 1: Self-Signing Module (Create documents)
We need to validate self-signing first because it CREATES the documents that appear in documents page.

**Test 1: Upload PDF for self-signing**
- Navigate to self-signing page
- Upload PDF file
- Verify PDF loaded in viewer
- Evidence: Screenshot of PDF in viewer

**Test 2: Add signature field**
- Click "Add Signature" button
- Place signature field on document
- Verify field appears
- Evidence: Screenshot showing signature field

**Test 3: Sign the document**
- Fill in signature
- Click save/send
- Document sent
- Evidence: Success message

**Test 4: Verify document in Documents page**
- Navigate to Documents page
- Count BEFORE was 0
- Count AFTER should be 1
- New document appears in list
- Evidence: Count increased, document visible

### Phase 2: Documents Module (View/Manage)
After creating documents via self-signing, test documents page functionality:

**Test 1: Search documents**
- Document count before search
- Search for document name
- Filtered count
- Evidence: Search actually filters

**Test 2: View document details**
- Click on document
- View status (signed/pending/etc)
- Evidence: Details page opens

**Test 3: Download signed document**
- Click download
- Verify file downloads
- Evidence: File in downloads folder

## What This Means for Current Tests

### Current Documents Tests - WRONG APPROACH
Most current document tests try to:
- Upload files directly to documents page ❌ (Feature doesn't exist)
- Test file upload on documents page ❌ (Wrong page)

### Correct Approach
1. **Validate Self-Signing module FIRST** - this creates documents
2. **Then validate Documents page** - this views/manages those documents
3. **Then validate Templates module** - alternative way to create documents

## Execution Order

### TODAY: Validate Self-Signing Module
We should STOP validating documents module now and switch to self-signing module because:
- Self-signing is where documents are CREATED
- Can't properly test documents page without documents to view
- Need to follow the real user workflow

### Suggested Next Steps:

**Option A: Continue with Self-Signing (RECOMMENDED)**
1. Create 5 E2E self-signing tests
2. Upload PDF → Add fields → Sign → Send
3. Verify document appears in Documents page
4. THEN come back to test Documents page features

**Option B: Test Documents page with existing documents**
1. Manually create a document via self-signing
2. Then test search/filter/view on documents page
3. But this requires manual setup

## Question for User

**What would you like to do next?**

A) **Switch to Self-Signing module** - validate the full workflow (upload → sign → send → appears in documents)

B) **Manually create some documents** first, then test Documents page search/filter/view features

C) **Continue with current documents tests** but update them to match real workflow

**My recommendation: Option A** - Validate Self-Signing module because that's where the real work happens and documents are created.
