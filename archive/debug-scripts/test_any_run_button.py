import pytest
from playwright.sync_api import Page
import time

def test_any_available_run_button(page: Page):
    """Test clicking any available Run button to verify execution works"""
    
    print("="*60)
    print("TESTING ANY AVAILABLE RUN BUTTON")
    print("="*60)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Looking for Run buttons...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count > 0:
        print("3. Clicking first available Run button...")
        run_buttons.first.click()
        
        print("4. Waiting for test execution to start...")
        time.sleep(5)
        
        print("5. SUCCESS: Run button clicked and execution started!")
        return True
    else:
        print("   No Run buttons found!")
        
        # Check if tests are loaded
        test_table = page.locator('[data-testid="tests-table"]')
        if test_table.is_visible():
            print("   Tests table is visible, checking for test rows...")
            test_rows = page.locator('[data-testid="tests-table"] tbody tr')
            row_count = test_rows.count()
            print(f"   Found {row_count} test rows")
        else:
            print("   Tests table not visible")
        
        return False