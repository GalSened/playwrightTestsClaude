# Templates Module - MCP Discovery Session
**Date**: 2025-11-04
**Goal**: Systematic exploration of ALL Templates features before writing tests
**Method**: Step-by-step MCP navigation and documentation

---

## Discovery Plan

### Phase 1: Page Navigation & Layout ✅ STARTED
1. ✅ Login to application
2. ✅ Navigate to Templates page
3. ✅ Document page structure
4. 🔄 Explore all visible elements

### Phase 2: Core Features (TO EXPLORE)
1. ⏳ Add New Template functionality
2. ⏳ Template table and data
3. ⏳ Search functionality
4. ⏳ Pagination controls
5. ⏳ Template action buttons
6. ⏳ Filters/sorting

### Phase 3: Template Operations (TO EXPLORE)
1. ⏳ Upload template (different file types)
2. ⏳ Edit template
3. ⏳ Delete template
4. ⏳ Duplicate template
5. ⏳ Share/Send template

### Phase 4: Advanced Features (TO EXPLORE)
1. ⏳ Bulk operations
2. ⏳ Template properties/metadata
3. ⏳ Field management
4. ⏳ Workflow settings

---

## MCP Discovery Results

### Session 1: Initial Navigation ✅

**Step 1: Login**
- URL: `https://devtest.comda.co.il/login`
- Credentials: nirk@comsign.co.il / Comsign1!
- Result: ✅ Successfully logged in
- Landing page: `/dashboard/main`

**Step 2: Navigate to Templates**
- Action: Clicked "תבניות" button (ref e63)
- Result: ✅ Successfully navigated
- Final URL: `https://devtest.comda.co.il/dashboard/templates`

**Step 3: Templates Page Structure**

**Page Header**:
- Heading: "תבניות" (Templates) - h1, ref e115
- Button "חזור" (Back) - ref e117
- Button "חתום" (Sign) - DISABLED, ref e118

**Sidebar**:
- List item: "הוסף תבנית חדשה" (Add New Template) - ref e124
  - This is a clickable link, NOT a button

**Main Content Area**:

1. **Search Box**:
   - Searchbox "חיפוש תבניות" (Search templates) - ref e127
   - Purpose: Search/filter templates by name

2. **Pagination Control**:
   - Label: "מספר שורות בכל עמוד:" (Rows per page)
   - Combobox with options: 10, 25, 50 - ref e131
   - Currently selected: 10

3. **Templates Table** (ref e133):
   - **Headers**:
     - Checkbox (for bulk selection)
     - כותרת (Title)
     - נוצר על ידי (Created by)
     - תאריך יצירה (Creation date)
     - Actions column (28 /)

   - **Current Data**: 10 templates visible
   - **Pagination**: Shows "28 /" meaning 28 total templates, page 1 of multiple
   - **Sample Template Names**:
     - "1234"
     - "Test Template 2 - API - Copy_uonY//82"
     - "Test Template - API - Copy_1GU5KWXe"
     - etc.

4. **Action Buttons** (per row):
   - Each template row has 5 icon buttons
   - Icons appear to be: View, Edit, Share, Download, Delete (need to verify)

### Session 2: Upload Modal Exploration ✅

**Action**: Clicked "הוסף תבנית חדשה" (ref e124)
**Result**: Upload modal appeared (overlay on same page)

**Upload Modal Structure**:

1. **Tab Navigation** (ref e487):
   - Button "ברירת מחדל" (Default) - ref e488
   - Button "שיוך ושליחה" (Assign and Send) - ref e489

2. **File Upload Area** (ref e493):
   - Text: "קבצים נתמכים: doc, docx, pdf, jpg, png"
     (Supported files: doc, docx, pdf, jpg, png)
   - Button "Choose File" - ref e494
   - Drag-and-drop text: "גרור קבצים לכאן, או" (Drag files here, or)
   - Button "העלאה" (Upload) - ref e495

3. **File Input Field**:
   - Textbox (disabled) - ref e497
   - Clear/Remove button - ref e499

4. **Modal Actions**:
   - Button "ביטול" (Cancel) - ref e505
   - Button "אישור" (Confirm) - DISABLED, ref e506
     - Likely enables when file is selected

**Key Insights**:
- Modal uses overlay, not separate page
- Supports multiple file types: doc, docx, pdf, jpg, png
- Has drag-and-drop functionality
- Has two modes: Default vs Assign and Send

### Session 3: Template Action Buttons Identified ✅

**Discovery Method**: Hover over each of the 5 action buttons on first template row

**5 Action Buttons (per template row)**:
1. **"ערוך"** (Edit) - First button
   - Opens template editor page
   - Navigate to: `/dashboard/template/edit/{template-id}`
2. **"שכפל"** (Duplicate) - Second button
   - Duplicates the template
3. **"URL"** (Share/Generate URL) - Third button
   - Share template via URL
4. **"הורדת תבנית"** (Download Template) - Fourth button
   - Downloads the template file
5. **"מחיקה"** (Delete) - Fifth button
   - Deletes the template (confirmation needed - not yet explored)

**Key Insight**: All 5 buttons have Hebrew text tooltips that appear on hover!

---

### Session 4: Edit Template & Field Management - COMPLETE DISCOVERY ✅✅✅

**This is the CRITICAL discovery you requested!**

**Action**: Clicked "ערוך" (Edit) button on template "1234"
**Result**: Navigated to Template Editor page

#### Template Editor Page Structure

**URL Pattern**: `/dashboard/template/edit/{template-id}`
- Example: `https://devtest.comda.co.il/dashboard/template/edit/539a33bf-49db-4095-7999-08de1b67c395`

**Page Header**:
- Heading: "עריכת תבנית" (Edit Template) - h1, ref e514
- Button "חזור" (Back) - ref e516
- Button "שמור" (Save) - ref e517

**Left Sidebar**:

1. **Template Name Field**:
   - Textbox "Name" - ref e521
   - Current value: "1234"
   - Can rename template here

2. **Field Type Buttons** (10 field types available):
   1. "טקסט" (Text) - ref e524
   2. "חתימה" (Signature) - ref e529
   3. "ראשי תיבות" (Initials) - ref e535
   4. "דוא\"ל" (Email) - ref e541
   5. "טלפון" (Phone) - ref e547
   6. "תאריך" (Date) - ref e552
   7. "מספר" (Number) - ref e557
   8. "רשימה" (List) - ref e563
   9. "תיבת סימון" (Checkbox) - ref e567
   10. "רדיו" (Radio) - ref e574

**Main Canvas Area**:
- PDF/document preview
- Page navigation (1 / 1 pages shown)
- Zoom controls (+/- buttons)
- Fields overlaid on the document

#### FIELD MANAGEMENT - Add/Duplicate/Delete Fields

**How to ADD a field**:
1. Click any field type button in sidebar (e.g., "טקסט")
2. Field immediately appears on the canvas
3. Field is highlighted with yellow border
4. Field has 3 control buttons

**Field Control Buttons** (3 buttons per field):
1. **Properties Button** (first button):
   - Opens field settings modal
   - Modal contains:
     - Heading: Field type name (e.g., "טקסט")
     - Textbox: "שם השדה" (Field Name) with generated name (e.g., "Multiline_X2nex")
     - Checkbox: "שדה חובה" (Required Field)
     - Buttons: "ביטול" (Cancel), "אישור" (Confirm)

2. **Duplicate Button** (second button, plus icon):
   - Creates an exact copy of the field
   - New field appears next to original
   - Validated: Clicked on text field → second text field appeared

3. **Delete Button** (third button, prohibited icon):
   - Removes field from template
   - No confirmation dialog (instant delete)
   - Validated: Clicked on duplicated field → field disappeared immediately

**Screenshot Evidence**: [templates_field_added.png](.playwright-mcp/templates_field_added.png)
- Shows yellow-highlighted text field
- Shows 3 control buttons (properties, duplicate, delete)
- Shows additional fields (email, signature) on canvas

**CRITICAL VALIDATION**:
- ✅ Field added successfully (text field appeared)
- ✅ Field duplicated successfully (second text field created)
- ✅ Field deleted successfully (duplicated field removed)
- ✅ Field properties modal opened (name + required checkbox visible)

---

## Discovery Status Summary

### ✅ COMPLETED Discoveries:

1. **Templates List Page**:
   - ✅ Page structure (header, sidebar, table)
   - ✅ Search box identified
   - ✅ Pagination controls identified
   - ✅ All 5 action buttons identified with exact labels
   - ✅ Table structure (checkbox, title, creator, date, actions)

2. **Upload Modal**:
   - ✅ Modal structure documented
   - ✅ File types supported (doc, docx, pdf, jpg, png)
   - ✅ Two tabs: Default vs Assign and Send
   - ✅ Drag-and-drop capability noted

3. **Edit Template Functionality** ✅ COMPLETE:
   - ✅ Template editor page URL pattern
   - ✅ Template name editing (textbox in sidebar)
   - ✅ Save and Back buttons

4. **Field Management** ✅ COMPLETE:
   - ✅ All 10 field types identified
   - ✅ Add field workflow (click button → field appears)
   - ✅ Duplicate field workflow (click duplicate → copy appears)
   - ✅ Delete field workflow (click delete → field removed)
   - ✅ Field properties modal (name, required checkbox)

### ⏳ PENDING Discoveries:

1. **Delete Template**:
   - Action button identified ("מחיקה")
   - Need to click and observe confirmation dialog
   - **Note**: Server 503 errors prevented completion

2. **Duplicate Template**:
   - Action button identified ("שכפל")
   - Need to validate duplication creates new template in list

3. **Share Template (URL)**:
   - Action button identified ("URL")
   - Need to see URL generation modal/flow

4. **Download Template**:
   - Action button identified ("הורדת תבנית")
   - Need to validate file download

5. **Search Functionality**:
   - Search box exists
   - Need to test: immediate filter vs Enter key
   - Need to test: what fields it searches

6. **Pagination**:
   - Controls exist (10/25/50 rows per page)
   - Need to test navigation to page 2+

7. **Upload Modal - Assign and Send Tab**:
   - Tab exists
   - Need to explore what's different from Default tab

8. **Bulk Operations**:
   - Checkboxes exist
   - Need to select multiple and see what actions appear

---

## Key Insights for Test Planning

### Strong Assertions Needed:

1. **Navigation Tests**:
   ```python
   # STRONG assertion
   assert page.url == "https://devtest.comda.co.il/dashboard/templates"
   assert await page.locator('h1:has-text("תבניות")').is_visible()
   ```

2. **Edit Template Tests**:
   ```python
   # STRONG assertion - verify URL pattern
   assert "/dashboard/template/edit/" in page.url
   assert await page.locator('h1:has-text("עריכת תבנית")').is_visible()

   # STRONG assertion - verify template name field exists and has value
   name_field = page.locator('textbox[ref="e521"]')
   assert await name_field.input_value() == "1234"
   ```

3. **Field Management Tests**:
   ```python
   # BEFORE adding field
   fields_before = await page.locator('.ct-c-field').count()

   # Add text field
   await page.locator('button:has-text("טקסט")').click()

   # STRONG assertion - field count increased
   fields_after = await page.locator('.ct-c-field').count()
   assert fields_after == fields_before + 1, f"Expected {fields_before + 1} fields, got {fields_after}"

   # STRONG assertion - field is visible
   assert await page.locator('.ct-c-field').last.is_visible()
   ```

4. **Delete Field Tests**:
   ```python
   # BEFORE deleting
   fields_before = await page.locator('.ct-c-field').count()

   # Delete last field (third button)
   await page.locator('.ct-c-field > nav > button:nth-child(3)').last.click()

   # STRONG assertion - field count decreased
   fields_after = await page.locator('.ct-c-field').count()
   assert fields_after == fields_before - 1, f"Expected {fields_before - 1} fields, got {fields_after}"
   ```

### Real Locators Discovered:

**Templates List Page**:
- Search: `searchbox[ref="e127"]` or `searchbox:has-text("חיפוש תבניות")`
- Pagination: `combobox[ref="e131"]`
- Table: `table[ref="e133"]`
- Add Template: `listitem:has-text("הוסף תבנית חדשה")`

**Action Buttons** (use text-based selectors):
- Edit: `button:has-text("ערוך")`
- Duplicate: `button:has-text("שכפל")`
- URL: `button:has-text("URL")`
- Download: `button:has-text("הורדת תבנית")`
- Delete: `button:has-text("מחיקה")`

**Template Editor**:
- Template Name: `textbox[name="Name"]`
- Save Button: `button:has-text("שמור")`
- Back Button: `button:has-text("חזור")`
- Field Type Buttons: `button:has-text("טקסט")`, `button:has-text("חתימה")`, etc.
- Field Container: `.ct-c-field`
- Field Controls: `.ct-c-field > nav > button:nth-child(1|2|3)`

---

## Next Session Tasks

1. **Resume after server issues resolved**:
   - Test Delete template with confirmation
   - Complete remaining action buttons (Duplicate, URL, Download)

2. **Complete remaining discoveries**:
   - Search functionality (type → filter behavior)
   - Pagination (navigate pages, change rows per page)
   - Upload file flow (select PDF → upload → verify in table)
   - Bulk selection and operations

3. **Create comprehensive test plan** based on all discoveries

4. **Write tests with STRONG assertions** using real locators found via MCP

