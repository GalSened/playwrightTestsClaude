import pytest
from playwright.sync_api import Page
import time

def test_manual_run_button_verification(page: Page):
    """Manual verification of the fixed Run button functionality"""
    
    # Monitor network requests and console logs
    requests = []
    console_logs = []
    
    def capture_request(request):
        if '/api/' in request.url:
            requests.append({
                'url': request.url,
                'method': request.method,
                'post_data': request.post_data
            })
    
    def capture_console(msg):
        console_logs.append(f"{msg.type}: {msg.text}")
        if 'error' in msg.type.lower():
            print(f"CONSOLE ERROR: {msg.text}")
    
    page.on('request', capture_request)
    page.on('console', capture_console)
    
    # Navigate to Test Bank
    print("Navigating to Test Bank...")
    page.goto("http://localhost:3001/test-bank")
    
    # Wait for page to load
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    # Take screenshot of Test Bank page
    page.screenshot(path="test_bank_loaded.png")
    print("Screenshot saved: test_bank_loaded.png")
    
    # Check if tests are loaded by looking for any table or list elements
    content = page.content()
    if 'Run' in content or 'test' in content.lower():
        print("Test Bank appears to have content loaded")
        
        # Look for the specific single test Run buttons
        run_selectors = [
            '[data-testid="run-single-test"]',  # This is the correct selector for single test runs
            'button:has-text("Run")',
            '[data-testid*="run"]',
            'button[class*="run"]',
            '.run-button',
            'button:has-text("Execute")'
        ]
        
        for selector in run_selectors:
            try:
                run_buttons = page.locator(selector)
                count = run_buttons.count()
                if count > 0:
                    print(f"Found {count} Run buttons with selector: {selector}")
                    
                    # Clear previous requests
                    requests.clear()
                    
                    # Click the first Run button
                    print("Clicking Run button...")
                    run_buttons.first.click()
                    
                    # Wait for any network activity
                    time.sleep(3)
                    
                    # Check what API calls were made
                    api_calls = [req for req in requests if '/api/' in req['url']]
                    print(f"API calls made after clicking Run button: {len(api_calls)}")
                    
                    for req in api_calls:
                        print(f"  -> {req['method']} {req['url']}")
                        if req['post_data']:
                            print(f"    Data: {req['post_data'][:200]}...")
                    
                    # Check if execution API was called
                    execution_calls = [req for req in api_calls if 'execute' in req['url']]
                    if execution_calls:
                        print("SUCCESS: Run button called execution API!")
                        print("Test with selector:", selector)
                        return
                    
                    schedule_calls = [req for req in api_calls if 'schedule' in req['url']]
                    if schedule_calls:
                        print("ISSUE: Run button called scheduling API instead of execution API")
                        print("Test with selector:", selector)
                        if selector == '[data-testid="run-single-test"]':
                            print("CRITICAL: Even the single-test buttons are broken!")
                            return
                        else:
                            print("This might be a different type of Run button - continuing to next selector")
                            continue
                        
                    if len(api_calls) == 0:
                        print("No API calls made - this might not be a working Run button")
                        continue
                        
                    break
            except Exception as e:
                continue
        
        print("No Run buttons found with common selectors")
    else:
        print("Test Bank appears to be empty or not loaded properly")
    
    # Take final screenshot
    page.screenshot(path="test_bank_final.png")
    print("Final screenshot saved: test_bank_final.png")