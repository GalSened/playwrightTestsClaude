# Self-Signing Workflow - Complete Understanding from Code

## Code Analysis Sources
1. **Upload Component:** `wesign-client-DEV/src/app/components/dashboard/selfsign/self-sign-upload.component.ts`
2. **Place Fields Component:** `wesign-client-DEV/src/app/components/dashboard/selfsign/self-sign-place-fields.component.ts`

---

## Complete Self-Signing Workflow

### Step 1: Navigate to Self-Signing Upload Page
**URL:** `/dashboard/selfsign` (upload page)

**What User Sees:**
- File upload area with drag-and-drop
- Accept: PDF, DOCX, JPG, PNG
- Cancel button
- Next button (disabled until file selected)

**Code:**
```typescript
// File input
<input #fileInput type="file" (change)="fileDropped()" accept="image/*,.pdf,.docx">

// Upload button
<button [disabled]="fileInput.files.length < 1 || busy" (click)="upload()">
```

**Selectors for Testing:**
- File input: `input[type="file"]`
- Next button: `button:has-text("הבא")` or `button:has-text("NEXT")`
- Cancel button: `button:has-text("ביטול")` or `button:has-text("CANCEL")`

---

### Step 2: Upload File
**Action:** Select PDF/DOCX/Image file

**What Happens:**
1. File is selected via file input
2. `fileDropped()` method called
3. File type detected:
   - PDF: `application/pdf`
   - DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - Image: starts with `image/`
4. Next button becomes enabled

**Code:**
```typescript
fileDropped() {
    this.file = this.el.nativeElement.files[0];
    if (this.file.type === "application/pdf") {
        this.fileType = FileType.PDF;
    }
    else if (this.file.type.startsWith("image")) {
        this.fileType = FileType.IMAGE;
    }
    else if (this.file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        this.fileType = FileType.DOCX;
    }
}
```

---

### Step 3: Click "Next" Button
**Action:** Click Next button to upload

**What Happens:**
1. `upload()` method called
2. File read as Base64
3. API call: `selfSignApiService.createSelfSignDocument(uploadRequest)`
4. Response contains:
   - `documentCollectionId`
   - `documentId`
5. Navigate to place fields page

**Code:**
```typescript
upload() {
    const reader = new FileReader();
    reader.readAsDataURL(this.file);
    reader.onload = () => {
        uploadRequest.Name = this.file.name;
        uploadRequest.Base64File = reader.result.toString()

        this.selfSignApiService.createSelfSignDocument(uploadRequest)
            .subscribe((doc) => {
                // Navigate to place fields page
                this.router.navigate([
                    "dashboard", "selfsignfields",
                    `${doc.documentCollectionId}`,
                    `${doc.documentId}`
                ]);
            });
    };
}
```

**New URL:** `/dashboard/selfsignfields/{collectionId}/{docId}`

---

### Step 4: Place Fields Page Loads
**URL:** `/dashboard/selfsignfields/{collectionId}/{docId}`

**What User Sees:**
- PDF/Document viewer with pages
- Toolbar with field buttons:
  - Signature field button
  - Text field button
  - Checkbox field button
  - Radio button
  - Choice field (dropdown)
- Zoom controls
- Page navigation
- Document name input
- Next/Done button

**Code:**
```typescript
ngOnInit() {
    // Get collection ID and document ID from route
    this.collectionId = params.colid;
    this.documentId = params.docid;

    // Load document pages
    return this.documentApi.pageCount(this.collectionId, this.documentId);

    // Load pages with OCR data
    return this.documentApi.getPages(this.collectionId, this.documentId, offset, limit, false)
}
```

---

### Step 5: Add Signature Field
**Action:** Click "Add Signature" button, then click on document to place field

**What Happens:**
1. Click signature button in toolbar
2. Click location on document page
3. Signature field appears at clicked position
4. Field stored in state/document

**Field Types Available:**
- `SignatureField` - Signature
- `TextField` - Text input
- `CheckBoxField` - Checkbox
- `RadioFieldGroup` - Radio buttons
- `ChoiceField` - Dropdown

---

### Step 6: Name Document & Click Next
**Action:** Enter document name and click Next/Done

**What Happens:**
1. Validate inputs: `isValidInputs()`
2. Check document name not empty
3. Update self-sign document with fields
4. Navigate to sign/send step

**Code:**
```typescript
next() {
    if (!this.currentDocumentName || this.currentDocumentName.length === 0) {
        this.sharedService.setTranslateAlert("DOCUMENT.NAME_EMPTY", AlertLevel.ERROR);
        return;
    }

    let isValid = this.isValidInputs();
    if (isValid) {
        // Proceed to signing step
    }
}
```

---

### Step 7: Sign & Send Document
**What Happens:**
1. Document signed (various signature types)
2. Document sent/saved
3. **Document appears in Documents page!**
4. Navigate back to dashboard or documents page

**Result:**
- Document collection created
- Visible in `/dashboard/documents/all`
- Can be searched, filtered, downloaded, deleted

---

## Complete Test Strategy

### Test Workflow: Self-Signing → Documents Page

**Test 1: Upload PDF for Self-Signing**
1. Navigate to `/dashboard/selfsign`
2. Verify file upload area visible
3. Upload test PDF file
4. Verify file name displayed
5. Verify Next button enabled
6. Evidence: Screenshot showing file selected

**Test 2: Navigate to Place Fields Page**
1. Click Next button after upload
2. Verify navigation to `/dashboard/selfsignfields/{colId}/{docId}`
3. Verify document loads in viewer
4. Verify toolbar with field buttons visible
5. Evidence: URL changed, document visible

**Test 3: Add Signature Field**
1. Click "Add Signature" button in toolbar
2. Click on document to place field
3. Verify signature field appears on document
4. Evidence: Screenshot showing signature field placed

**Test 4: Name Document & Complete**
1. Enter document name in input field
2. Click Next/Done button
3. Verify navigation proceeds
4. Evidence: Document named and saved

**Test 5: Verify Document in Documents Page**
1. Navigate to `/dashboard/documents/all`
2. Count documents BEFORE self-signing workflow
3. Complete self-signing workflow (Tests 1-4)
4. Return to `/dashboard/documents/all`
5. Count documents AFTER
6. Verify count increased by 1
7. Search for document by name
8. Verify document appears in list
9. **Evidence: COUNT INCREASED, DOCUMENT VISIBLE**

---

## Key Selectors for Testing

### Upload Page (`/dashboard/selfsign`)
- File input: `input[type="file"]`
- File accepts: `accept="image/*,.pdf,.docx"`
- Next button: `button:has-text("הבא")` (Hebrew) or check for disabled attribute
- Cancel button: `button:has-text("ביטול")`
- File name display: `span` containing filename

### Place Fields Page (`/dashboard/selfsignfields/{colId}/{docId}`)
- Document viewer: `.document-viewer` or similar
- Add signature button: Look for signature icon/button
- Add text field button: Look for text icon/button
- Document name input: `input` for document name
- Next/Done button: Final action button
- Page navigation: Page number controls
- Zoom controls: Zoom in/out buttons

---

## Real E2E Test Flow

```
1. Login
   ↓
2. Navigate to /dashboard/selfsign
   ↓
3. Upload PDF (test_files/sample.pdf)
   ↓
4. Click Next
   ↓
5. Wait for /dashboard/selfsignfields/{id}/{id}
   ↓
6. Add signature field (optional - might auto-complete)
   ↓
7. Enter document name
   ↓
8. Click Done/Next
   ↓
9. Document processing...
   ↓
10. Navigate to /dashboard/documents/all
    ↓
11. VERIFY: Document count increased
12. VERIFY: New document visible in list
13. VERIFY: Can search for document by name
```

---

## Next Steps

Create 5 E2E Tests:
1. Upload PDF to self-signing
2. Navigate through place fields page
3. Complete self-signing workflow
4. Verify document in documents page (COUNT + SEARCH)
5. Delete self-signed document from documents page

**This proves the COMPLETE workflow works end-to-end!**
