import pytest
from playwright.sync_api import Page
import time

def test_headed_mode_verification(page: Page):
    """Test that should run in headed mode so browser is visible"""
    
    print("="*60)
    print("HEADED MODE TEST - Browser should be VISIBLE!")
    print("="*60)
    
    # Navigate to Test Bank
    print("1. Navigating to Test Bank...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    
    print("2. Test Bank page loaded - browser should be visible!")
    print("3. Checking execution mode dropdown...")
    
    # Check if execution mode is set to headed
    mode_select = page.locator('[data-testid="execution-mode-select"]')
    if mode_select.is_visible():
        current_mode = mode_select.input_value()
        print(f"   Current execution mode: {current_mode}")
        if current_mode == 'headed':
            print("   ✅ Mode is set to HEADED - browser should be visible!")
        else:
            print("   ⚠️ Mode is set to HEADLESS - browser might not be visible")
    
    print("4. Looking for Run buttons...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    print("5. Browser should remain visible for 10 seconds...")
    time.sleep(10)
    
    print("✅ HEADED MODE TEST COMPLETED!")
    print("If you saw the browser window, headed mode is working!")
    print("="*60)
    
    return True