import pytest
from playwright.sync_api import Page
import time

def test_debug_test_object_structure(page: Page):
    """Debug test to see the test object structure and console logs"""
    
    print("="*60)
    print("DEBUGGING TEST OBJECT STRUCTURE")
    print("="*60)
    
    console_messages = []
    
    def handle_console_message(msg):
        console_messages.append(f"[{msg.type}] {msg.text}")
        print(f"CONSOLE: [{msg.type}] {msg.text}")
    
    page.on('console', handle_console_message)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Finding first Run button...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count > 0:
        print("3. Clicking first Run button to see test object...")
        run_buttons.first.click()
        
        print("4. Waiting for console logs...")
        time.sleep(5)
        
        print("\n=== CAPTURED CONSOLE MESSAGES ===")
        for msg in console_messages:
            if "TEST OBJECT" in msg or "Test object:" in msg or "Test file path:" in msg:
                print(msg)
        print("=== END CONSOLE MESSAGES ===\n")
        
        return True
    else:
        print("   No Run buttons found!")
        return False