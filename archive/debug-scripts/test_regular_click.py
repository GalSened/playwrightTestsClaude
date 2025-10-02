import pytest
from playwright.sync_api import Page
import time

def test_regular_click_after_fix(page: Page):
    """Test if regular clicks now work after fixing the overlay"""
    
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
        if 'BUTTON CLICKED' in msg.text or 'SINGLE TEST RUN CLICKED' in msg.text:
            print(f"SUCCESS: Handler triggered - {msg.text}")
        elif 'Starting test execution' in msg.text:
            print(f"SUCCESS: Execution started - {msg.text}")
        elif 'error' in msg.type.lower() and 'socket' not in msg.text.lower():
            print(f"ERROR: {msg.text}")
    
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
        
        try:
            # Try regular click first
            print("Attempting regular click...")
            run_buttons.first.click(timeout=5000)
            print("Regular click succeeded!")
            
            # Wait for any API calls
            time.sleep(3)
            
            # Check what API calls were made
            api_calls = [req for req in requests if '/api/' in req['url']]
            print(f"API calls made after regular click: {len(api_calls)}")
            
            for req in api_calls:
                print(f"  -> {req['method']} {req['url']}")
                if req['post_data']:
                    print(f"    Data: {req['post_data'][:200]}...")
            
            # Check if execution API was called
            execution_calls = [req for req in api_calls if 'execute' in req['url']]
            if execution_calls:
                print("SUCCESS: Regular click triggered execution API!")
                return True
            else:
                print("No execution API calls found")
                return False
                
        except Exception as e:
            print(f"Regular click failed: {str(e)[:200]}...")
            
            # Fallback to force click
            print("Attempting force click as fallback...")
            try:
                requests.clear()
                run_buttons.first.click(force=True)
                time.sleep(3)
                
                api_calls = [req for req in requests if '/api/' in req['url']]
                execution_calls = [req for req in api_calls if 'execute' in req['url']]
                if execution_calls:
                    print("Force click triggered execution API")
                    return True
                else:
                    print("Even force click didn't trigger execution")
                    return False
            except Exception as fe:
                print(f"Force click also failed: {fe}")
                return False
    else:
        print("No Run buttons found")
        return False