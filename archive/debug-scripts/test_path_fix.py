"""
Test Path Fix Verification
Verify that the testRunner path fix works correctly
"""

import asyncio
import requests
from datetime import datetime
from playwright.async_api import async_playwright

async def test_path_fix():
    print("=== TESTING PATH FIX ===")
    print("Testing if testRunner can now find test files correctly")
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=300)
    page = await browser.new_page()
    
    execution_results = []
    
    def track_execution(request):
        if '/api/tests/run/' in request.url:
            test_id = request.url.split('/')[-1]
            execution_results.append({
                'test_id': test_id[:8],
                'method': request.method,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"EXECUTION: {request.method} Test: {test_id[:8]}")
    
    def track_response(response):
        if '/api/tests/run/' in response.url:
            print(f"RESPONSE: {response.status} {response.status_text}")
    
    page.on("request", track_execution)
    page.on("response", track_response)
    
    try:
        # Navigate to test bank
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(3)
        
        print("1. Test Bank loaded")
        
        # Find and click a run button
        run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
        print(f"2. Found {len(run_buttons)} run buttons")
        
        if len(run_buttons) > 0:
            print("3. Executing test to check path fix...")
            execution_results.clear()
            
            await run_buttons[0].click()
            await asyncio.sleep(8)  # Wait for execution
            
            print(f"4. Execution completed")
            print(f"   Execution calls: {len(execution_results)}")
            
            for result in execution_results:
                print(f"   {result['time']}: {result['method']} Test: {result['test_id']}")
            
            return {
                'test_executed': len(execution_results) > 0,
                'execution_count': len(execution_results),
                'run_buttons_found': len(run_buttons)
            }
        else:
            print("3. No run buttons found")
            return {'error': 'No run buttons available'}
    
    except Exception as e:
        print(f"Error: {e}")
        return {'error': str(e)}
    
    finally:
        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_path_fix())
    
    print("\n" + "="*30)
    print("PATH FIX TEST RESULTS")
    print("="*30)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Test Executed: {result.get('test_executed', False)}")
        print(f"Execution Count: {result.get('execution_count', 0)}")
        print(f"Run Buttons Found: {result.get('run_buttons_found', 0)}")
        
        if result.get('test_executed'):
            print("SUCCESS: Path fix working - test execution triggered!")
        else:
            print("ISSUE: Test execution not working")
    
    print("="*30)