import pytest
from playwright.sync_api import Page
import time

def test_simple_reports_check(page: Page):
    """Simple check of Reports page without Unicode issues"""
    
    print("="*60)
    print("CHECKING REPORTS PAGE")
    print("="*60)
    
    print("1. Navigating to Reports page...")
    page.goto("http://localhost:3001/reports")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Checking page title...")
    page_title = page.locator('[data-testid="page-title"]')
    if page_title.is_visible():
        title_text = page_title.text_content()
        print(f"   Page title: {title_text}")
    
    print("3. Looking for runs table...")
    runs_table = page.locator('[data-testid="runs-table"]')
    if runs_table.is_visible():
        print("   SUCCESS: Runs table found!")
        
        # Count rows
        run_rows = page.locator('[data-testid="runs-table"] tbody tr')
        row_count = run_rows.count()
        print(f"   Found {row_count} execution records")
        
        if row_count > 0:
            # Check first row details
            first_row = run_rows.first
            print("   Examining first execution record:")
            
            # Status
            status_badge = first_row.locator('[data-testid="run-status-badge"]')
            if status_badge.is_visible():
                status = status_badge.text_content()
                print(f"   - Status: {status}")
            
            # Suite name
            suite_name = first_row.locator('[data-testid="run-suite-name"]')
            if suite_name.is_visible():
                name = suite_name.text_content()
                print(f"   - Test: {name}")
            
            # Environment
            environment = first_row.locator('[data-testid="run-environment"]')
            if environment.is_visible():
                env = environment.text_content()
                print(f"   - Environment: {env}")
                
            print("   REPORTS PAGE IS WORKING - Shows backend execution data!")
            return True
        else:
            print("   No execution records found")
            return False
    else:
        print("   FAILED: Runs table not found")
        
        # Check for empty state
        empty_state = page.locator('[data-testid="empty-state"]')
        if empty_state.is_visible():
            print("   Reports page showing empty state")
        
        return False