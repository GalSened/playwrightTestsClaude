import pytest
from playwright.sync_api import Page
import time

def test_debug_button_properties(page: Page):
    """Debug the properties of single-test Run buttons"""
    
    # Navigate to Test Bank
    print("Navigating to Test Bank...")
    page.goto("http://localhost:3001/test-bank")
    
    # Wait for page to load
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    # Find single-test Run buttons
    run_buttons = page.locator('[data-testid="run-single-test"]')
    count = run_buttons.count()
    print(f"Found {count} single-test Run buttons")
    
    if count > 0:
        first_button = run_buttons.first
        
        # Check button properties
        is_visible = first_button.is_visible()
        is_enabled = first_button.is_enabled()
        is_disabled = first_button.is_disabled()
        
        print(f"First button - Visible: {is_visible}, Enabled: {is_enabled}, Disabled: {is_disabled}")
        
        # Get button attributes
        try:
            button_class = first_button.get_attribute('class')
            button_disabled = first_button.get_attribute('disabled')
            button_text = first_button.text_content()
            
            print(f"Button class: {button_class}")
            print(f"Button disabled attr: {button_disabled}")  
            print(f"Button text: {button_text}")
        except Exception as e:
            print(f"Error getting button attributes: {e}")
        
        # Try different click methods
        print("\nTrying different click approaches...")
        
        # Method 1: Regular click
        try:
            print("Attempting regular click...")
            first_button.click(timeout=5000)
            print("Regular click succeeded")
        except Exception as e:
            print(f"Regular click failed: {e}")
        
        # Method 2: Force click (ignores actionability checks)
        try:
            print("Attempting force click...")
            first_button.click(force=True, timeout=5000)
            print("Force click succeeded")
        except Exception as e:
            print(f"Force click failed: {e}")
        
        # Method 3: Dispatch click event
        try:
            print("Attempting dispatch click event...")
            first_button.dispatch_event('click')
            print("Dispatch click succeeded")
        except Exception as e:
            print(f"Dispatch click failed: {e}")
        
        # Method 4: Focus and press Enter
        try:
            print("Attempting focus and Enter...")
            first_button.focus()
            page.keyboard.press('Enter')
            print("Focus+Enter succeeded")
        except Exception as e:
            print(f"Focus+Enter failed: {e}")
        
        time.sleep(2)
        
    # Take screenshot for manual inspection
    page.screenshot(path="button_debug.png")
    print("Screenshot saved: button_debug.png")