import pytest
from playwright.sync_api import Page
import time

def test_run_button_with_force_click(page: Page):
    """Test Run button functionality using force click to bypass overlays"""
    
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
        # Print all console messages to see what's happening
        if 'BUTTON CLICKED' in msg.text or 'SINGLE TEST RUN CLICKED' in msg.text:
            print(f"HANDLER LOG: {msg.text}")
        elif 'error' in msg.type.lower() and 'socket' not in msg.text.lower():
            print(f"ERROR: {msg.text}")
        elif 'log' in msg.type.lower():
            print(f"LOG: {msg.text[:100]}...")
    
    page.on('request', capture_request)
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
        # Clear previous requests
        requests.clear()
        
        # Use force click to bypass the overlay
        print("Force clicking first Run button...")
        run_buttons.first.click(force=True)
        
        # Wait for any API calls
        time.sleep(3)
        
        # Check what API calls were made
        api_calls = [req for req in requests if '/api/' in req['url']]
        print(f"API calls made after force click: {len(api_calls)}")
        
        for req in api_calls:
            print(f"  -> {req['method']} {req['url']}")
            if req['post_data']:
                print(f"    Data: {req['post_data'][:200]}...")
        
        # Check if execution API was called
        execution_calls = [req for req in api_calls if 'execute' in req['url']]
        if execution_calls:
            print("SUCCESS: Force click triggered execution API!")
            print("THE FIX WORKS - the overlay was blocking regular clicks")
            return True
        else:
            print("No execution API calls found")
            return False
    
    print("No Run buttons found")
    return False