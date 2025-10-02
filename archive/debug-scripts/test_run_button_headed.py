import pytest
from playwright.sync_api import Page
import time

def test_run_button_in_headed_mode(page: Page):
    """Test clicking Run button and verify it executes in headed mode"""
    
    print("="*60)
    print("TESTING RUN BUTTON IN HEADED MODE")
    print("="*60)
    
    # Navigate to Test Bank
    print("1. Loading Test Bank...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    print("2. Checking execution mode...")
    mode_select = page.locator('[data-testid="execution-mode-select"]')
    if mode_select.is_visible():
        current_mode = mode_select.input_value()
        print(f"   Execution mode: {current_mode}")
    
    print("3. Finding Run buttons...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count > 0:
        print("4. Clicking first Run button...")
        run_buttons.first.click()
        print("   Run button clicked!")
        
        print("5. Waiting 5 seconds to see if a new browser window opens...")
        print("   (If headed mode works, you should see a second browser window)")
        time.sleep(5)
        
        print("6. Browser should remain visible for another 5 seconds...")
        time.sleep(5)
        
    print("TEST COMPLETED!")
    print("If you saw two browser windows, headed mode is working!")
    print("="*60)