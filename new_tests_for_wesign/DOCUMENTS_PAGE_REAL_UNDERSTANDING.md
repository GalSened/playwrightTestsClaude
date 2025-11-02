# Documents Page - Complete Understanding from Code Analysis

## Source Analysis
**File:** `C:\Users\gals\Desktop\wesign-client-DEV\src\app\components\dashboard\main\documents\documents.component.ts`

---

## What Documents Page ACTUALLY Does

### 📋 Primary Purpose:
The Documents page is a **VIEWING AND MANAGEMENT** interface for documents that have been created through the signing workflow. It does NOT upload files.

### 🎯 Document Sources:
Documents appear on this page after being created through:

1. **Self-Sign Mode** (`SignMode.SelfSign`)
   - User uploads PDF in self-signing page
   - Adds signature fields
   - Signs/sends document
   - Document collection appears here

2. **Online Sign Mode** (`SignMode.Online`)
   - Send document to others for signing
   - Document collection appears here

3. **Template-based** (from templates module)
   - Use template to create document
   - Send to recipients
   - Document appears here

---

## Core Functionality (What CAN Be Tested)

### ✅ 1. Search & Filter
**Code:** Lines 58-60, 592-596
```typescript
// Search with debounce (500ms delay)
<input type="search" [(ngModel)]="docFilter.key" debounce [delay]="500" (func)="pageChanged(1)">
```

**Features:**
- Search by document name, signer name, email, phone
- Search parameter selector (dropdown)
- Debounced search (500ms delay)

**Test:**
- Navigate to documents
- Enter search term
- Verify filtered results

---

### ✅ 2. Date Range Filter
**Code:** Lines 63-98, 233-253
```typescript
fromSelected(date: Date) { this.docFilter.from = date; this.updateData(true); }
toSelected(date: Date) { this.docFilter.to = date; this.updateData(true); }
```

**Features:**
- Filter from date
- Filter to date
- Remove date filters

**Test:**
- Select from/to dates
- Verify filtered results by date range

---

### ✅ 3. Status Filters
**Code:** Lines 91-102
```typescript
if (this.path == 'all') // Show all documents
if (this.path == 'pending') // Sent + viewed
if (this.path == 'signed') // Signed documents
if (this.path == 'declined') // Declined documents
if (this.path == 'canceled') // Canceled documents
```

**URLs:**
- `/dashboard/documents/all`
- `/dashboard/documents/pending`
- `/dashboard/documents/signed`
- `/dashboard/documents/declined`
- `/dashboard/documents/canceled`

**Test:**
- Navigate to each status filter
- Verify correct documents shown

---

### ✅ 4. View Document Details
**Code:** Lines 272-281, 449-453
```typescript
onRowClick(docId: string, signers: any[]) {
    this.activeDocumentId = docId;
    this.readRowInformation(docId);
}

openDocumentView(event, collectionId, firstDocId) {
    this.router.navigate(['/dashboard', 'docview', collectionId, firstDocId])
}
```

**Features:**
- Click document row to expand details
- View signers and their status
- Open document viewer

**Test:**
- Click on document
- Verify details panel opens
- Verify signers list visible

---

### ✅ 5. Download Document
**Code:** Lines 409-413
```typescript
downloadFile(collectionId: string) {
    this.sharedService.setBusy(true, "GLOBAL.DOWNLOADING");
    this.documentApiService.downloadDocument(collectionId);
}
```

**Test:**
- Click download button
- Verify file downloads

---

### ✅ 6. Delete Document
**Code:** Lines 305-329
```typescript
deleteDocument($event, document: documentCollections) {
    // Shows modal confirmation
    // Calls: documentApiService.deleteDocument(documentCollectionId)
    // Updates list after deletion
}
```

**Test:**
- Select document
- Click delete
- Confirm deletion
- Verify count decreases
- Verify document removed from list

---

### ✅ 7. Batch Operations
**Code:** Lines 331-363
```typescript
// Select multiple documents
selectedALL() { this.allSelected = !this.allSelected; }

// Delete multiple
deleteDocumentAllSelected($event)

// Download multiple (max 20)
downloadAllSelectedDocuments($event)
```

**Test:**
- Select multiple documents (checkboxes)
- Delete batch
- Download batch
- Verify operations work

---

### ✅ 8. Cancel Document
**Code:** Lines 383-407
```typescript
cancelDocument($event, document: documentCollections) {
    // Shows modal
    // Calls: documentApiService.cancelDocument(documentCollectionId)
}
```

**Test:**
- Click cancel on pending document
- Confirm cancellation
- Verify document status changes to canceled

---

### ✅ 9. Resend Document
**Code:** Lines 513-532
```typescript
resend($event, documentId: string, signer: signer) {
    this.documentService.resendDocument(documentId, signer.id, signer.sendingMethod)
}
```

**Test:**
- Click resend for a signer
- Verify success message
- Verify signer status updates

---

### ✅ 10. Edit Document (if not signed)
**Code:** Lines 436-447
```typescript
edit(collectionId: string) {
    switch (docData.mode) {
        case SignMode.SelfSign:
            this.router.navigate(["/dashboard", "selfsignfields", docData.documentCollectionId]);
        case SignMode.Online:
            this.router.navigate(["/dashboard", "onlinesign", docData.documentCollectionId]);
    }
}
```

**Test:**
- Click edit on draft document
- Verify navigation to signing page

---

### ✅ 11. Pagination
**Code:** Lines 147-151, 604-607
```typescript
pageChanged(page: number) {
    this.currentPage = page;
    this.updateData(false);
}

onDropDownSelect(value: number) {
    this.PAGE_SIZE = value; // 10, 20, 50 items per page
}
```

**Test:**
- Change page size dropdown
- Navigate through pages
- Verify pagination works

---

### ✅ 12. Sort Documents
**Code:** Lines 488-495
```typescript
orderByFunction(prop: string) {
    if (this.orderByField == prop) {
        this.orderByDesc = !this.orderByDesc;
    }
    this.orderByField = prop;
}
```

**Fields:** creationTime, name, status, etc.

**Test:**
- Click column header to sort
- Verify ascending/descending order

---

### ✅ 13. Export to Excel
**Code:** Lines 421-429
```typescript
export() {
    if (this.documentsCount > 0) {
        this.documentApiService.export();
    }
}
```

**Test:**
- Click export button
- Verify Excel file downloads

---

### ✅ 14. Share Document
**Code:** Lines 460-464
```typescript
share($event, documentId: string) {
    this.showShare = true;
    this.currDocumentCollectionId = documentId;
}
```

**Test:**
- Click share button
- Verify share modal opens
- Generate share link

---

## CORRECT Test Strategy

### Prerequisites:
**Before testing documents page, you MUST have documents!**

Documents are created through:
1. **Self-Signing workflow** (primary source)
2. **Template workflow** (secondary source)

### Recommended Test Order:

**Phase 1: Create Documents (Self-Signing Module)**
1. Upload PDF for self-signing
2. Add signature fields
3. Sign document
4. Document appears in documents page

**Phase 2: Documents Page Management**
1. ✅ Navigate to documents page
2. ✅ Search documents
3. ✅ Filter by status (all/pending/signed/declined/canceled)
4. ✅ Filter by date range
5. ✅ View document details
6. ✅ Download document
7. ✅ Delete document (verify count decreases)
8. ✅ Cancel document
9. ✅ Batch delete (select multiple → delete)
10. ✅ Batch download
11. ✅ Pagination
12. ✅ Sort by column
13. ✅ Export to Excel
14. ✅ Share document
15. ✅ Resend to signer

---

## Updated Test Plan

### 5 Core Document Page Tests (After creating documents via self-signing):

**Test 1: Navigate & View Documents List**
- Navigate to /dashboard/documents/all
- Verify documents count displayed
- Verify document list loads
- Evidence: Count visible, documents in list

**Test 2: Search Documents**
- Get initial count
- Search for specific document name
- Verify filtered count changes
- Evidence: Count before vs after search

**Test 3: Filter by Status**
- Navigate to /dashboard/documents/pending
- Verify only pending documents shown
- Navigate to /dashboard/documents/signed
- Verify only signed documents shown
- Evidence: Status filter works

**Test 4: Delete Document**
- Count before deletion
- Select document
- Click delete → confirm
- Count after deletion
- Verify count decreased
- Evidence: Count reduced by 1

**Test 5: Batch Operations**
- Select multiple documents (checkboxes)
- Click delete batch
- Confirm deletion
- Verify count decreased by number selected
- Evidence: Batch delete works

---

## What This Means:

### ❌ DON'T Test:
- Uploading files directly to documents page (feature doesn't exist)
- Creating documents on documents page (wrong page)

### ✅ DO Test:
- Viewing documents created from self-signing
- Searching/filtering documents
- Deleting documents (with count verification)
- Downloading documents
- Batch operations
- Status filters
- Date filters
- Pagination
- Export

---

## Next Steps:

**Option A: Test Self-Signing Module FIRST**
- Create documents through self-signing workflow
- THEN test documents page management features

**Option B: Manual Setup**
- Manually create 5-10 documents via self-signing
- THEN run automated tests on documents page

**Recommendation: Option A** - Full E2E workflow testing

