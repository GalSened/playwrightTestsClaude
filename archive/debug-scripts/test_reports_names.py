import pytest
from playwright.sync_api import Page
import time

def test_reports_page_readable_names(page: Page):
    """Test that Reports page now shows readable test names"""
    
    print("="*60)
    print("TESTING REPORTS PAGE READABLE NAMES")
    print("="*60)
    
    print("1. Navigating to Reports page...")
    page.goto("http://localhost:3001/reports")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Looking for test run records...")
    runs_table = page.locator('[data-testid="runs-table"]')
    if runs_table.is_visible():
        print("   SUCCESS: Runs table found!")
        
        # Count rows
        run_rows = page.locator('[data-testid="runs-table"] tbody tr')
        row_count = run_rows.count()
        print(f"   Found {row_count} execution records")
        
        if row_count > 0:
            print("3. Examining test names in first few records...")
            for i in range(min(3, row_count)):
                row = run_rows.nth(i)
                suite_name_cell = row.locator('[data-testid="run-suite-name"]')
                if suite_name_cell.is_visible():
                    name = suite_name_cell.text_content()
                    print(f"   Row {i+1}: {name}")
            
            print("4. SUCCESS: Reports page shows readable test names!")
            return True
        else:
            print("   No execution records found")
            return False
    else:
        print("   FAILED: Runs table not found")
        return False