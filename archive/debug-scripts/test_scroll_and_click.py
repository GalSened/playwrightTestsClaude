import pytest
from playwright.sync_api import Page
import time

def test_scroll_and_click(page: Page):
    """Test scrolling to button before clicking"""
    
    # Monitor console for handler execution
    handler_called = False
    
    def capture_console(msg):
        nonlocal handler_called
        if 'BUTTON CLICKED' in msg.text or 'SINGLE TEST RUN CLICKED' in msg.text:
            print(f"SUCCESS: Handler triggered - {msg.text}")
            handler_called = True
        elif 'Starting test execution' in msg.text:
            print(f"SUCCESS: Execution started - {msg.text}")
    
    page.on('console', capture_console)
    
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
        
        # Scroll the button into view
        print("Scrolling button into view...")
        first_button.scroll_into_view_if_needed()
        time.sleep(1)
        
        # Wait for button to be visible and stable
        print("Waiting for button to be actionable...")
        first_button.wait_for(state='visible')
        
        try:
            # Try clicking with different approaches
            print("Attempting click with hover first...")
            first_button.hover()
            time.sleep(0.5)
            first_button.click()
            print("Click succeeded!")
            
            # Wait to see if handler was called
            time.sleep(2)
            
            if handler_called:
                print("SUCCESS: Button click handler was executed!")
                return True
            else:
                print("Button clicked but handler not called")
                return False
                
        except Exception as e:
            print(f"Click failed: {str(e)[:200]}...")
            
            # Try dispatch event as backup
            try:
                print("Trying dispatch click event...")
                first_button.dispatch_event('click')
                time.sleep(2)
                
                if handler_called:
                    print("SUCCESS: Dispatch event worked!")
                    return True
                else:
                    print("Dispatch event didn't trigger handler")
                    return False
            except Exception as de:
                print(f"Dispatch event failed: {de}")
                return False
    else:
        print("No Run buttons found")
        return False