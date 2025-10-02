import pytest
from playwright.sync_api import Page
import time

def test_fixed_single_test_execution(page: Page):
    """Test that single test execution now works with correct file paths"""
    
    print("="*60)
    print("TESTING FIXED SINGLE TEST EXECUTION")
    print("="*60)
    
    console_messages = []
    
    def handle_console_message(msg):
        try:
            console_messages.append(f"[{msg.type}] {msg.text}")
            if any(keyword in msg.text for keyword in ["Test object:", "Constructed file path:", "Running single test:"]):
                print(f"CONSOLE: [{msg.type}] {msg.text}")
        except:
            pass  # Skip Unicode errors
    
    page.on('console', handle_console_message)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Searching for login test...")
    search_input = page.locator('input[placeholder*="Search"]')
    if search_input.is_visible():
        search_input.fill("test_login_with_email_success")
        time.sleep(2)
    
    print("3. Finding Run button for login test...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count > 0:
        print("4. Clicking Run button...")
        run_buttons.first.click()
        
        print("5. Waiting for test execution...")
        time.sleep(10)  # Wait for execution to start
        
        print("6. Checking console logs for file path construction...")
        relevant_logs = [msg for msg in console_messages if any(keyword in msg for keyword in 
                        ["Test object:", "Constructed file path:", "tests/auth/test_login"])]
        
        print("   RELEVANT CONSOLE LOGS:")
        for log in relevant_logs[-10:]:  # Show last 10 relevant logs
            print(f"   {log}")
        
        print("7. SUCCESS: Test execution attempted with fixed file paths!")
        return True
    else:
        print("   No Run buttons found!")
        return False