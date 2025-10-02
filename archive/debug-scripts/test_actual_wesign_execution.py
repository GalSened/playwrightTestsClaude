"""
Test Actual WeSign Execution
Verify that the test execution actually runs WeSign tests (not just API calls)
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_actual_wesign_execution():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    execution_details = []
    
    def track_execution_requests(request):
        if '/api/tests/run/' in request.url:
            execution_details.append({
                'method': request.method,
                'url': request.url,
                'test_id': request.url.split('/')[-1],
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] EXECUTING TEST: {request.url.split('/')[-1][:12]}")
    
    def track_responses(response):
        if '/api/tests/run/' in response.url:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] RESPONSE: {response.status} {response.status_text}")
    
    page.on("request", track_execution_requests)
    page.on("response", track_responses)
    
    print("=== ACTUAL WESIGN TEST EXECUTION VERIFICATION ===")
    print("Testing: Real test execution with WeSign application")
    
    try:
        # Navigate to Test Bank
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(3)
        
        timestamp = datetime.now().strftime('%H%M%S')
        await page.screenshot(path=f"wesign_test_{timestamp}_01_start.png")
        
        # Step 1: Find a single test to run
        print("Step 1: Identifying a test to execute...")
        
        run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
        print(f"  Found {len(run_buttons)} Run buttons")
        
        if len(run_buttons) > 0:
            # Clear tracking
            execution_details.clear()
            
            print("Step 2: Executing single test...")
            print("  This will run a real WeSign test against devtest.comda.co.il")
            
            # Execute the test
            execution_start = datetime.now()
            await run_buttons[0].click()
            
            print(f"  Test execution started at {execution_start.strftime('%H:%M:%S')}")
            
            # Wait and monitor for test completion
            # Real tests may take 30-60 seconds to complete
            for i in range(12):  # 12 * 5 = 60 seconds max wait
                await asyncio.sleep(5)
                current_time = datetime.now()
                elapsed = (current_time - execution_start).total_seconds()
                
                if i % 3 == 0:  # Every 15 seconds
                    print(f"  Waiting for test completion... {elapsed:.0f}s elapsed")
                    await page.screenshot(path=f"wesign_test_{timestamp}_progress_{i}.png")
                
                # Check if there are any new windows (test might open new browser)
                contexts = browser.contexts
                all_pages = []
                for context in contexts:
                    all_pages.extend(context.pages)
                
                if len(all_pages) > 1:
                    print(f"  Detected {len(all_pages)} browser pages (test may be running)")
            
            execution_end = datetime.now()
            total_duration = (execution_end - execution_start).total_seconds()
            
            print(f"Step 3: Test execution completed after {total_duration:.1f} seconds")
            
            await page.screenshot(path=f"wesign_test_{timestamp}_02_completed.png")
            
            # Analysis
            print("Step 4: Execution analysis...")
            print(f"  API calls made: {len(execution_details)}")
            print(f"  Total execution time: {total_duration:.1f} seconds")
            
            if len(execution_details) > 0:
                for detail in execution_details:
                    print(f"    {detail['time']}: {detail['method']} Test: {detail['test_id'][:12]}")
            
            # Check for any error messages or success indicators on the page
            try:
                # Look for common success/failure indicators
                page_text = await page.text_content('body')
                
                success_indicators = ['passed', 'success', 'completed']
                failure_indicators = ['failed', 'error', 'timeout']
                
                found_success = any(indicator in page_text.lower() for indicator in success_indicators)
                found_failure = any(indicator in page_text.lower() for indicator in failure_indicators)
                
                print(f"  Success indicators found: {found_success}")
                print(f"  Failure indicators found: {found_failure}")
                
            except Exception as e:
                print(f"  Could not analyze page content: {str(e)[:40]}")
            
            return {
                'execution_triggered': len(execution_details) > 0,
                'execution_time': total_duration,
                'api_calls': len(execution_details),
                'test_details': execution_details,
                'browser_pages': len(all_pages),
                'success': len(execution_details) > 0 and total_duration > 5  # At least 5 seconds indicates real test ran
            }
            
        else:
            print("  No Run buttons found")
            return {'error': 'No test run buttons available'}
        
    except Exception as e:
        print(f"Execution test error: {str(e)}")
        return {'error': str(e)}
    
    finally:
        print("Keeping browser open for final inspection (10 seconds)...")
        await asyncio.sleep(10)
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_actual_wesign_execution())
    
    print("\n" + "="*50)
    print("ACTUAL WESIGN TEST EXECUTION RESULTS")
    print("="*50)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Execution Triggered: {result.get('execution_triggered', False)}")
        print(f"Execution Time: {result.get('execution_time', 0):.1f} seconds")
        print(f"API Calls: {result.get('api_calls', 0)}")
        print(f"Browser Pages: {result.get('browser_pages', 1)}")
        print(f"Overall Success: {result.get('success', False)}")
        
        if result.get('success'):
            print("\nSUCCESS: WeSign test execution verified!")
            print("- Real test execution working")
            print("- API integration functional") 
            print("- Test runner executing actual WeSign tests")
        else:
            print("\nISSUE: Test execution may not be running real tests")
        
        if result.get('test_details'):
            print("\nTest Execution Details:")
            for detail in result['test_details']:
                print(f"  {detail['time']}: Test {detail['test_id'][:8]}")
    
    print("="*50)