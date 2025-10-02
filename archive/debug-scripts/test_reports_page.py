import pytest
from playwright.sync_api import Page
import time

def test_reports_page_shows_execution_data(page: Page):
    """Test that Reports page shows execution data from backend"""
    
    print("="*60)
    print("TESTING REPORTS PAGE DATA")
    print("="*60)
    
    print("1. Navigating to Reports page...")
    page.goto("http://localhost:3001/reports")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Checking Reports page load...")
    page_title = page.locator('[data-testid="page-title"]')
    if page_title.is_visible():
        title_text = page_title.text_content()
        print(f"   Page title: {title_text}")
    
    print("3. Looking for test runs table...")
    runs_table = page.locator('[data-testid="runs-table"]')
    if runs_table.is_visible():
        print("   ✓ Runs table found!")
    else:
        print("   ✗ Runs table not found")
        return False
    
    print("4. Counting test run rows...")
    # Look for table rows (excluding header)
    run_rows = page.locator('[data-testid="runs-table"] tbody tr')
    row_count = run_rows.count()
    print(f"   Found {row_count} test run rows")
    
    if row_count > 0:
        print("5. Examining first run...")
        first_row = run_rows.first
        
        # Check run status
        status_badge = first_row.locator('[data-testid="run-status-badge"]')
        if status_badge.is_visible():
            status = status_badge.text_content()
            print(f"   First run status: {status}")
        
        # Check suite name 
        suite_name = first_row.locator('[data-testid="run-suite-name"]')
        if suite_name.is_visible():
            name = suite_name.text_content()
            print(f"   First run name: {name}")
            
        # Check environment
        environment = first_row.locator('[data-testid="run-environment"]')
        if environment.is_visible():
            env = environment.text_content()
            print(f"   Environment: {env}")
            
        print("   ✓ SUCCESS: Reports page is showing execution data!")
        return True
        
    else:
        print("   ✗ FAILED: No test runs found in Reports page")
        
        # Check if it's showing empty state
        empty_state = page.locator('[data-testid="empty-state"]')
        if empty_state.is_visible():
            print("   Reports page is showing empty state")
            
        return False
    
    print("="*60)