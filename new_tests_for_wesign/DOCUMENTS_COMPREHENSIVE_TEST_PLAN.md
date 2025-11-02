# Documents Module - Comprehensive Test Plan
**Date:** 2025-11-02
**Status:** Implementation Phase
**Total Tests:** 70 tests across 10 test suites

## Executive Summary

This test plan covers comprehensive testing of the WeSign Documents management page. Based on thorough codebase analysis, we've identified that the Documents page is a **management interface** for viewing, organizing, and managing documents created through other workflows (Self-Signing, Templates).

### Key Understanding
**Documents are NOT created on the Documents page directly**. They are created via:
1. Self-Signing workflow → Document appears in Documents page
2. Template-based creation → Document appears in Documents page
3. Online signing workflow → Document appears in Documents page

---

## Test Suite Structure

### Phase 1: Test Data Setup
**File:** `utils/document_test_data_creator.py`
**Purpose:** Create test documents via Self-Signing API for testing

**Functions:**
- `create_test_document(name, status)` - Create document with specific status
- `create_multiple_documents(count)` - Create bulk test data
- `cleanup_test_documents()` - Remove all test documents

---

### Phase 2: Navigation & Document Listing (8 tests)
**File:** `tests/documents/test_documents_navigation.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-NAV-001 | test_navigate_to_documents_from_main_menu | Navigate to Documents page | URL contains "/documents", page loads |
| DOC-NAV-002 | test_navigate_to_all_documents_view | Navigate to "All" documents | URL: /documents/all |
| DOC-NAV-003 | test_navigate_to_pending_documents_view | Navigate to "Pending" status | URL: /documents/pending |
| DOC-NAV-004 | test_navigate_to_signed_documents_view | Navigate to "Signed" status | URL: /documents/signed |
| DOC-NAV-005 | test_navigate_to_declined_documents_view | Navigate to "Declined" status | URL: /documents/declined |
| DOC-NAV-006 | test_navigate_to_canceled_documents_view | Navigate to "Canceled" status | URL: /documents/canceled |
| DOC-NAV-007 | test_document_list_displays_with_correct_count | Verify list shows documents | Count matches actual documents |
| DOC-NAV-008 | test_document_metadata_columns_display | Verify all columns display | Name, date, status, signers visible |

---

### Phase 3: Search & Filter (10 tests)
**File:** `tests/documents/test_documents_search_filter.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-SEARCH-001 | test_search_by_document_name | Search for specific document | Matching documents displayed |
| DOC-SEARCH-002 | test_search_by_signer_name | Search by signer name | Documents with matching signer shown |
| DOC-SEARCH-003 | test_search_by_email | Search by signer email | Matching documents displayed |
| DOC-SEARCH-004 | test_search_debounce_delay | Verify 500ms debounce | Search executes after delay |
| DOC-SEARCH-005 | test_filter_by_date_range | Filter from-to dates | Only documents in range shown |
| DOC-SEARCH-006 | test_clear_date_filters | Clear date filters | All documents shown again |
| DOC-SEARCH-007 | test_sort_by_creation_date_asc | Sort by date ascending | Oldest first |
| DOC-SEARCH-008 | test_sort_by_creation_date_desc | Sort by date descending | Newest first |
| DOC-SEARCH-009 | test_sort_by_document_name | Sort alphabetically | A-Z order |
| DOC-SEARCH-010 | test_combined_search_filter_sort | Combine all filters | Correct results |

---

### Phase 4: Pagination (6 tests)
**File:** `tests/documents/test_documents_pagination.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-PAGE-001 | test_change_page_size_to_10 | Set page size to 10 | Shows 10 items |
| DOC-PAGE-002 | test_change_page_size_to_20 | Set page size to 20 | Shows 20 items |
| DOC-PAGE-003 | test_change_page_size_to_50 | Set page size to 50 | Shows 50 items |
| DOC-PAGE-004 | test_navigate_to_next_page | Click next page | Shows next 10/20/50 items |
| DOC-PAGE-005 | test_navigate_to_previous_page | Click previous page | Shows previous items |
| DOC-PAGE-006 | test_page_indicator_displays_correctly | Verify page numbers | Current page highlighted |

---

### Phase 5: Single Document Actions (12 tests)
**File:** `tests/documents/test_documents_actions.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-ACT-001 | test_download_single_document | Download document | File downloaded successfully |
| DOC-ACT-002 | test_delete_single_document | Delete document | Count decreases by 1 |
| DOC-ACT-003 | test_delete_confirmation_modal_appears | Verify delete confirmation | Modal appears before delete |
| DOC-ACT-004 | test_view_document_details_panel | Click document row | Details panel expands |
| DOC-ACT-005 | test_view_signers_list | View signers for document | Signers displayed with status |
| DOC-ACT-006 | test_resend_notification_to_signer | Resend to specific signer | Success message appears |
| DOC-ACT-007 | test_cancel_pending_document | Cancel distribution | Status changes to "canceled" |
| DOC-ACT-008 | test_edit_draft_document | Edit draft document | Navigates to editor |
| DOC-ACT-009 | test_share_document_modal_opens | Click share button | Share modal opens |
| DOC-ACT-010 | test_action_buttons_visibility_by_status | Check button visibility | Correct buttons per status |
| DOC-ACT-011 | test_download_completion_certificate | Download certificate (signed) | Certificate PDF downloaded |
| DOC-ACT-012 | test_reactivate_canceled_document | Reactivate canceled doc | Status changes back |

---

### Phase 6: Batch Operations (6 tests)
**File:** `tests/documents/test_documents_batch_operations.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-BATCH-001 | test_select_multiple_documents | Check multiple boxes | Documents selected |
| DOC-BATCH-002 | test_select_all_documents | Click "Select All" | All visible docs selected |
| DOC-BATCH-003 | test_batch_delete_selected | Delete selected documents | Count decreases correctly |
| DOC-BATCH-004 | test_batch_download_under_limit | Download <20 documents | ZIP file downloaded |
| DOC-BATCH-005 | test_batch_download_over_limit | Try download >20 documents | Error message shown |
| DOC-BATCH-006 | test_unselect_all_documents | Uncheck "Select All" | All deselected |

---

### Phase 7: Toolbar Actions (3 tests)
**File:** `tests/documents/test_documents_toolbar.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-TOOL-001 | test_export_to_excel | Click export button | Excel file downloaded |
| DOC-TOOL-002 | test_refresh_document_list | Click refresh button | List reloads |
| DOC-TOOL-003 | test_export_disabled_when_empty | No documents | Export button disabled |

---

### Phase 8: Individual Document Viewer (8 tests)
**File:** `tests/documents/test_documents_viewer.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-VIEW-001 | test_open_document_in_viewer | Open document viewer | URL: /docview/{id} |
| DOC-VIEW-002 | test_pdf_viewer_displays | View PDF content | PDF rendered correctly |
| DOC-VIEW-003 | test_zoom_controls_work | Zoom in/out | Content scales |
| DOC-VIEW-004 | test_page_navigation_controls | Next/previous/jump page | Page changes |
| DOC-VIEW-005 | test_document_details_panel_in_viewer | View details panel | All metadata shown |
| DOC-VIEW-006 | test_signers_panel_in_viewer | View signers panel | Status for each signer |
| DOC-VIEW-007 | test_audit_trail_displays | View audit log | All events shown |
| DOC-VIEW-008 | test_fullscreen_mode_toggle | Toggle fullscreen | Enters/exits fullscreen |

---

### Phase 9: Edge Cases & Validation (12 tests)
**File:** `tests/documents/test_documents_edge_cases.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-EDGE-001 | test_empty_documents_list | No documents exist | "No documents" message |
| DOC-EDGE-002 | test_search_with_no_results | Search returns nothing | "No results" message |
| DOC-EDGE-003 | test_invalid_date_range | To date < From date | Error or no results |
| DOC-EDGE-004 | test_special_characters_in_search | Search with @#$% | Handles gracefully |
| DOC-EDGE-005 | test_very_long_document_name | Name >100 characters | Truncates or wraps |
| DOC-EDGE-006 | test_delete_last_document_on_page | Delete last on page 2 | Returns to page 1 |
| DOC-EDGE-007 | test_concurrent_delete_operations | Delete while loading | No errors |
| DOC-EDGE-008 | test_network_timeout_during_download | Simulate timeout | Error handled |
| DOC-EDGE-009 | test_very_old_dates_in_filter | Dates from 2010 | Works correctly |
| DOC-EDGE-010 | test_future_dates_in_filter | Dates in 2030 | Works correctly |
| DOC-EDGE-011 | test_same_date_from_and_to | Same date range | Shows that day only |
| DOC-EDGE-012 | test_delete_document_with_active_signers | Delete while signing | Confirmation or error |

---

### Phase 10: Status Transitions (5 tests)
**File:** `tests/documents/test_documents_status_transitions.py`

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DOC-STATUS-001 | test_create_draft_appears_in_drafts | Create draft via API | Appears in drafts view |
| DOC-STATUS-002 | test_distribute_moves_to_pending | Distribute document | Moves to pending view |
| DOC-STATUS-003 | test_sign_moves_to_signed | Complete signing | Moves to signed view |
| DOC-STATUS-004 | test_cancel_moves_to_canceled | Cancel document | Moves to canceled view |
| DOC-STATUS-005 | test_reactivate_returns_to_pending | Reactivate canceled | Returns to pending view |

---

## Test Execution Strategy

### 1. Pre-Test Setup
```python
@pytest.fixture(scope="session", autouse=True)
async def setup_test_data():
    """Create test documents via Self-Signing API"""
    creator = DocumentTestDataCreator()
    await creator.create_test_documents(count=25)
    yield
    await creator.cleanup_test_documents()
```

### 2. Parallel Execution
- Run test suites in parallel using `pytest-xdist`
- Each suite operates on different test data
- Use test markers for grouping:
  - `@pytest.mark.navigation`
  - `@pytest.mark.search`
  - `@pytest.mark.actions`
  - etc.

### 3. Evidence Collection
- Screenshot before/after each action
- Save to Allure report
- Capture network logs for API calls
- Record page state on failures

### 4. Cleanup Strategy
- Delete test documents after each test
- Restore database state if needed
- Clear browser cache between suites

---

## Success Criteria

### Must Pass:
✅ All 70 tests passing
✅ Evidence screenshots for all key actions
✅ No false positives/negatives
✅ Execution time < 15 minutes

### Coverage:
✅ 100% of discovered features tested
✅ All status transitions verified
✅ All edge cases handled
✅ All batch operations tested

---

## API Endpoints Used

### Document Management
- `GET /v3/documentcollections` - Get documents list
- `GET /v3/documentcollections/{id}` - Get specific document
- `DELETE /v3/documentcollections/{id}` - Delete document
- `PUT /v3/documentcollections/deletebatch` - Batch delete
- `GET /v3/documentcollections/{id}/file` - Download document
- `POST /v3/documentcollections/downloadbatch` - Batch download
- `GET /v3/documentcollections/export` - Export to Excel

### Workflow Operations
- `POST /v3/documentcollections/{id}/distribute` - Distribute for signing
- `PUT /v3/documentcollections/{id}/cancel` - Cancel document
- `GET /v3/documentcollections/{id}/reactivate` - Reactivate
- `POST /v3/documentcollections/share` - Share document

### Signer Operations
- `GET /v3/documentcollections/{id}/signers/{signerId}/method/{method}` - Resend
- `PUT /v3/documentcollections/{id}/signer/{signerId}/replace` - Replace signer

### Advanced
- `GET /v3/documentcollections/{id}/audit/{offset}` - Audit trail
- `GET /v3/documentcollections/{id}/certificate` - Completion certificate

---

## Key Selectors Reference

### Hebrew (RTL) Interface
```python
documents_nav = 'text=מסמכים'  # Documents
upload_button = 'text=העלאת קובץ'  # Upload File
download_button = 'text=הורד'  # Download
delete_button = 'text=מחק'  # Delete
search_placeholder = 'חפש'  # Search
filter_button = 'text=סינון'  # Filter
signed_status = 'text=חתום'  # Signed
pending_status = 'text=ממתין'  # Pending
```

### English/Generic Selectors
```python
document_items = '.document-item, .document-card'
search_input = 'input[placeholder*="Search"]'
page_size_select = 'select[name*="pageSize"]'
next_page_btn = 'button:has-text("Next")'
select_all_checkbox = 'input[type="checkbox"][name="selectAll"]'
```

---

## Pytest Configuration

```ini
[pytest]
markers =
    navigation: Tests for navigation and page loading
    search: Tests for search and filter functionality
    pagination: Tests for pagination controls
    actions: Tests for single document actions
    batch: Tests for batch operations
    toolbar: Tests for toolbar actions
    viewer: Tests for document viewer
    edge: Tests for edge cases
    status: Tests for status transitions
    smoke: Critical smoke tests
```

---

## Execution Commands

```bash
# Run all documents tests
pytest tests/documents/ -v --alluredir=allure-results

# Run specific suite
pytest tests/documents/test_documents_navigation.py -v

# Run by marker
pytest tests/documents/ -m navigation -v

# Run smoke tests only
pytest tests/documents/ -m smoke -v

# Parallel execution
pytest tests/documents/ -n 4 -v

# Generate Allure report
allure generate allure-results -o allure-report --clean
allure open allure-report
```

---

## Dependencies

```python
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-playwright>=0.3.0
playwright>=1.40.0
allure-pytest>=2.13.0
pytest-xdist>=3.0.0  # For parallel execution
```

---

## Timeline

- **Phase 1 (Setup):** 1 hour
- **Phase 2-10 (Implementation):** 8 hours
- **Testing & Debugging:** 2 hours
- **Documentation:** 1 hour
- **Total:** 12 hours

---

## Known Limitations

1. **Document Creation:** Cannot create documents directly on Documents page - must use Self-Signing workflow
2. **Batch Download Limit:** Maximum 20 documents at once
3. **Status Transitions:** Some transitions require specific conditions (e.g., all signers must sign)
4. **Permissions:** Some features may be role-based (admin vs user)

---

## Future Enhancements

1. Performance testing (load 1000+ documents)
2. Concurrent user operations testing
3. Mobile responsive testing
4. Accessibility (A11y) testing
5. Cross-browser testing (Chrome, Firefox, Safari, Edge)
6. API-only test suite for faster execution
7. Visual regression testing

---

**Document Version:** 1.0
**Last Updated:** 2025-11-02
**Next Review:** After implementation completion
