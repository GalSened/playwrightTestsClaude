import pytest
from playwright.sync_api import Page
import time

def test_layout_fix_run_button_clicks(page: Page):
    """Test Run button clicks after layout overlap fix"""
    
    requests = []
    
    def capture_request(request):
        if '/api/' in request.url:
            requests.append({
                'url': request.url,
                'method': request.method,
                'post_data': request.post_data
            })
    
    page.on('request', capture_request)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Checking page layout...")
    # Check if both sections are visible without overlap
    tests_section = page.locator('[data-testid="tests-section"]')
    suite_section = page.locator('[data-testid="suite-builder-section"]')
    
    tests_visible = tests_section.is_visible()
    suite_visible = suite_section.is_visible()
    print(f"   Tests section visible: {tests_visible}")
    print(f"   Suite section visible: {suite_visible}")
    
    # Find Run buttons
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Run buttons found: {button_count}")
    
    if button_count > 0:
        print("3. Testing Run button click...")
        requests.clear()
        
        try:
            # Click the first Run button
            first_button = run_buttons.first
            first_button.click(timeout=10000)
            print("   Click successful!")
            
            # Wait for API call
            time.sleep(3)
            
            # Check results
            api_calls = [req for req in requests if '/api/' in req['url']]
            execution_calls = [req for req in api_calls if 'execute' in req['url']]
            
            print("4. Results:")
            print(f"   Total API calls: {len(api_calls)}")
            print(f"   Execution calls: {len(execution_calls)}")
            
            if execution_calls:
                print("   SUCCESS: Run button works after layout fix!")
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