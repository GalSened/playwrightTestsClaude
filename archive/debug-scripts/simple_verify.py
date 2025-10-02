import pytest
from playwright.sync_api import Page
import time

def test_run_button_fix_verification(page: Page):
    """Simple verification that Run button clicks work after layout fix"""
    
    requests = []
    
    def capture_request(request):
        if '/api/' in request.url:
            requests.append({
                'url': request.url,
                'method': request.method
            })
    
    page.on('request', capture_request)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    print("2. Finding Run buttons...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    count = run_buttons.count()
    print(f"   Found {count} Run buttons")
    
    if count > 0:
        print("3. Testing Run button click...")
        requests.clear()
        
        try:
            # Click first Run button
            run_buttons.first.click(timeout=5000)
            print("   Click successful!")
            
            # Wait for API call
            time.sleep(3)
            
            # Check for execution API calls
            api_calls = [req for req in requests if '/api/' in req['url']]
            execution_calls = [req for req in api_calls if 'execute' in req['url']]
            
            print("4. Results:")
            print(f"   Total API calls: {len(api_calls)}")
            print(f"   Execution calls: {len(execution_calls)}")
            
            if execution_calls:
                print("   SUCCESS: Run button works!")
                for call in execution_calls:
                    print(f"   -> {call['method']} {call['url']}")
                return True
            else:
                print("   No execution API calls detected")
                return False
                
        except Exception as e:
            print(f"   Click failed: {str(e)}")
            return False
    else:
        print("   No Run buttons found")
        return False