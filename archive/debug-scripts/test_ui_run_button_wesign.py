import pytest
from playwright.sync_api import Page
import time
import json

def test_ui_run_button_executes_wesign_test(page: Page):
    """Test clicking Run button on WeSign test through UI"""
    
    print("="*80)
    print("TESTING UI RUN BUTTON WITH WESIGN TEST")
    print("="*80)
    
    requests = []
    
    def capture_request(request):
        if '/api/' in request.url:
            requests.append({
                'timestamp': time.strftime('%H:%M:%S'),
                'url': request.url,
                'method': request.method,
                'post_data': request.post_data
            })
            print(f"API REQUEST: {request.method} {request.url}")
    
    page.on('request', capture_request)
    
    print("1. Loading Test Bank page...")
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    
    print("2. Looking for login test...")
    # Search for the login test
    search_input = page.locator('input[placeholder*="Search"]')
    if search_input.is_visible():
        search_input.fill("test_login_with_email_success")
        time.sleep(1)
    
    print("3. Finding Run buttons after search...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count > 0:
        print("4. Looking at execution mode dropdown...")
        mode_select = page.locator('[data-testid="execution-mode-select"]')
        if mode_select.is_visible():
            current_mode = mode_select.input_value()
            print(f"   Current mode: {current_mode}")
            if current_mode != 'headed':
                print("   Changing to headed mode...")
                mode_select.select_option('headed')
        
        print("5. Clicking Run button for WeSign login test...")
        requests.clear()
        start_time = time.time()
        
        # Click the first Run button
        run_buttons.first.click()
        print("   Run button clicked!")
        
        print("6. Waiting for execution to start...")
        time.sleep(3)
        
        # Check for execution API call
        execution_calls = [req for req in requests if 'execute' in req['url']]
        if execution_calls:
            exec_call = execution_calls[0]
            print(f"   Execution API called: {exec_call['method']} {exec_call['url']}")
            if exec_call['post_data']:
                try:
                    payload = json.loads(exec_call['post_data'])
                    print(f"   Mode in payload: {payload.get('mode', 'not found')}")
                    print(f"   Test files: {payload.get('testFiles', [])}")
                except:
                    print(f"   Raw payload: {exec_call['post_data'][:100]}...")
        
        print("7. Waiting for test to complete...")
        print("   (If in headed mode, you should see Chromium browser window)")
        
        # Wait longer for test completion
        time.sleep(15)
        
        execution_time = time.time() - start_time
        print(f"8. Total time waited: {execution_time:.2f} seconds")
        
        return True
    else:
        print("   No Run buttons found!")
        return False