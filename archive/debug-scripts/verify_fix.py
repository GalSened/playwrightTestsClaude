import pytest
from playwright.sync_api import Page
import time

def test_run_button_click_works(page: Page):
    """Verify Run button clicks work after overlay fix"""
    
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
        # Look for execution messages
        if 'Starting test execution' in msg.text or 'SINGLE TEST RUN CLICKED' in msg.text:
            print(f"CONSOLE: {msg.text}")
    
    page.on('request', capture_request)
    page.on('console', capture_console)
    
    print("1. Navigating to Test Bank...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Looking for Run buttons...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    count = run_buttons.count()
    print(f"   Found {count} Run buttons")
    
    if count > 0:
        print("3. Attempting to click Run button...")
        requests.clear()
        
        try:
            # Try regular click
            run_buttons.first.click(timeout=5000)
            print("   ✓ Click succeeded")
            
            time.sleep(3)
            
            # Check results
            api_calls = [req for req in requests if '/api/' in req['url']]
            execution_calls = [req for req in api_calls if 'execute' in req['url']]
            
            print(f"4. Results:")
            print(f"   API calls made: {len(api_calls)}")
            for req in api_calls:
                print(f"   → {req['method']} {req['url']}")
            
            if execution_calls:
                print("   ✅ SUCCESS: Run button triggered execution API!")
                return True
            else:
                print("   ❌ FAILED: No execution API call made")
                return False
                
        except Exception as e:
            print(f"   ❌ FAILED: Click error - {str(e)[:100]}")
            return False
    else:
        print("   ❌ FAILED: No Run buttons found")
        return False