import pytest
from playwright.sync_api import Page
import time
import json

def test_comprehensive_single_test_execution_evidence(page: Page):
    """Comprehensive test with complete evidence collection for single test execution"""
    
    requests = []
    console_logs = []
    
    def capture_request(request):
        if '/api/' in request.url:
            request_data = {
                'timestamp': time.strftime('%H:%M:%S'),
                'url': request.url,
                'method': request.method,
                'headers': dict(request.headers) if request.headers else {},
                'post_data': request.post_data
            }
            requests.append(request_data)
            print(f"API REQUEST CAPTURED: {request.method} {request.url}")
    
    def capture_console(msg):
        console_entry = f"[{time.strftime('%H:%M:%S')}] {msg.type}: {msg.text}"
        console_logs.append(console_entry)
        print(f"CONSOLE: {msg.type} - {msg.text}")
    
    def capture_response(response):
        if '/api/' in response.url:
            print(f"API RESPONSE: {response.status} {response.url}")
            print(f"RESPONSE HEADERS: {dict(response.headers)}")
    
    # Set up all listeners
    page.on('request', capture_request)
    page.on('console', capture_console)  
    page.on('response', capture_response)
    
    print("\n" + "="*80)
    print("COMPREHENSIVE SINGLE TEST EXECUTION EVIDENCE REPORT")
    print("="*80)
    
    # STEP 1: Load Test Bank page and take screenshot
    print("\n1. LOADING TEST BANK PAGE...")
    start_time = time.time()
    page.goto("http://localhost:3001/test-bank")
    page.wait_for_load_state('networkidle')
    load_time = time.time() - start_time
    print(f"   Page loaded in {load_time:.2f} seconds")
    
    # Take screenshot BEFORE clicking
    page.screenshot(path="evidence_before_click.png", full_page=True)
    print("   Screenshot saved: evidence_before_click.png")
    
    time.sleep(2)  # Allow page to settle
    
    # STEP 2: Find test to execute
    print("\n2. FINDING TESTS TO EXECUTE...")
    run_buttons = page.locator('[data-testid="run-single-test"]')
    button_count = run_buttons.count()
    print(f"   Found {button_count} Run buttons")
    
    if button_count == 0:
        print("   ERROR: No Run buttons found!")
        return False
        
    # Find a specific simple test
    test_rows = page.locator('[data-testid="tests-table"] tr')
    test_count = test_rows.count()
    print(f"   Found {test_count} test rows")
    
    # Look for a simple test (prefer login tests)
    target_test = None
    for i in range(min(10, test_count)):  # Check first 10 tests
        row = test_rows.nth(i)
        test_name = row.locator('td').first.text_content()
        if test_name and ('login' in test_name.lower() or 'auth' in test_name.lower()):
            target_test = {'name': test_name, 'index': i}
            break
    
    if not target_test:
        # Just use the first test
        first_row = test_rows.first
        test_name = first_row.locator('td').first.text_content()
        target_test = {'name': test_name, 'index': 0}
    
    print(f"   Selected test: {target_test['name']}")
    
    # STEP 3: Execute the test
    print(f"\n3. EXECUTING TEST: {target_test['name']}")
    requests.clear()  # Clear previous requests
    
    execution_start_time = time.time()
    
    try:
        # Click the Run button for the selected test
        run_button = run_buttons.nth(target_test['index'])
        run_button.click(timeout=10000)
        print("   ✓ Run button clicked successfully!")
        
        # Wait for API call and execution
        print("   Waiting for API call and execution...")
        time.sleep(5)
        
        execution_end_time = time.time()
        execution_duration = execution_end_time - execution_start_time
        
        # Take screenshot AFTER clicking
        page.screenshot(path="evidence_after_click.png", full_page=True)
        print("   Screenshot saved: evidence_after_click.png")
        
    except Exception as e:
        print(f"   ❌ FAILED: Click error - {str(e)}")
        page.screenshot(path="evidence_error.png", full_page=True)
        return False
    
    # STEP 4: Analyze results
    print(f"\n4. ANALYZING EXECUTION RESULTS...")
    print(f"   Execution duration: {execution_duration:.2f} seconds")
    
    # Filter API calls
    api_calls = [req for req in requests if '/api/' in req['url']]
    execution_calls = [req for req in api_calls if 'execute' in req['url']]
    
    print(f"   Total API calls captured: {len(api_calls)}")
    print(f"   Test execution calls: {len(execution_calls)}")
    
    # STEP 5: Detailed evidence collection
    print(f"\n5. DETAILED EVIDENCE COLLECTION:")
    print(f"   Console logs captured: {len(console_logs)}")
    
    if execution_calls:
        exec_call = execution_calls[0]
        print(f"\n   ✅ EXECUTION API CALL SUCCESSFUL:")
        print(f"   → Method: {exec_call['method']}")
        print(f"   → URL: {exec_call['url']}")
        print(f"   → Timestamp: {exec_call['timestamp']}")
        if exec_call['post_data']:
            try:
                payload = json.loads(exec_call['post_data'])
                print(f"   → Request payload:")
                for key, value in payload.items():
                    print(f"     - {key}: {value}")
            except:
                print(f"   → Raw payload: {exec_call['post_data'][:200]}...")
                
        success = True
    else:
        print(f"\n   ❌ NO EXECUTION API CALLS DETECTED")
        success = False
    
    # Show all API calls for reference
    if api_calls:
        print(f"\n   All API calls made during test:")
        for i, call in enumerate(api_calls, 1):
            print(f"   {i}. {call['timestamp']} - {call['method']} {call['url']}")
    
    # Show recent console logs
    if console_logs:
        print(f"\n   Recent console activity:")
        for log in console_logs[-10:]:  # Show last 10 logs
            print(f"   {log}")
    
    print(f"\n" + "="*80)
    print(f"FINAL RESULT: {'SUCCESS' if success else 'FAILED'}")
    print(f"Run button functionality: {'WORKING' if success else 'NOT WORKING'}")
    print("="*80)
    
    return success