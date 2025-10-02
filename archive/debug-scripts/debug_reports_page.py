import pytest
from playwright.sync_api import Page
import time

def test_debug_reports_page_step_by_step(page: Page):
    """Debug Reports page step by step to find the issue"""
    
    print("="*60)
    print("DEBUGGING REPORTS PAGE STEP BY STEP")
    print("="*60)
    
    print("1. Navigating to Reports page...")
    page.goto("http://localhost:3001/reports")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Checking page title...")
    page_title = page.locator('[data-testid="page-title"]')
    if page_title.is_visible():
        title_text = page_title.text_content()
        print(f"   Page title found: {title_text}")
    else:
        print("   Page title not found!")
    
    print("3. Looking for reports page container...")
    reports_page = page.locator('[data-testid="reports-page"]')
    if reports_page.is_visible():
        print("   Reports page container found!")
    else:
        print("   Reports page container NOT found!")
    
    print("4. Looking for runs-table-section...")
    table_section = page.locator('[data-testid="runs-table-section"]')
    if table_section.is_visible():
        print("   Runs table section found!")
    else:
        print("   Runs table section NOT found!")
    
    print("5. Looking for runs-table...")
    runs_table = page.locator('[data-testid="runs-table"]')
    if runs_table.is_visible():
        print("   Runs table found!")
        
        # Check table body
        table_body = page.locator('[data-testid="runs-table"] tbody')
        if table_body.is_visible():
            print("   Table body found!")
            
            # Count rows
            rows = table_body.locator('tr')
            row_count = rows.count()
            print(f"   Found {row_count} rows in table")
        else:
            print("   Table body NOT found!")
    else:
        print("   Runs table NOT found!")
    
    print("6. Looking for empty state...")
    empty_state = page.locator('[data-testid="empty-state"]')
    if empty_state.is_visible():
        empty_text = empty_state.text_content()
        print(f"   Empty state found: {empty_text}")
    else:
        print("   Empty state not found")
    
    print("7. Looking for loading indicators...")
    loading = page.locator('text=Loading')
    if loading.is_visible():
        print("   Loading indicator found!")
    else:
        print("   No loading indicator")
    
    print("8. Checking console for errors...")
    # Take a screenshot for debugging
    page.screenshot(path="reports_debug.png")
    print("   Screenshot saved as reports_debug.png")
    
    return True