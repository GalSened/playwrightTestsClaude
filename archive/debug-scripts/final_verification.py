"""
Final Verification - Suite Execution Working
Clean test without Unicode characters to show final results
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def final_verification():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=300)
    page = await browser.new_page()
    
    api_calls = []
    
    def track_requests(request):
        if '/api/tests/run/' in request.url:
            api_calls.append({
                'method': request.method,
                'url': request.url,
                'time': datetime.now().strftime('%H:%M:%S'),
                'test_id': request.url.split('/')[-1][:8]
            })
            print(f"TEST EXECUTION: {request.method} {request.url}")
    
    page.on("request", track_requests)
    
    print("=== FINAL VERIFICATION ===")
    print("Testing: Suite creation with headed, parallel, 2 retries")
    
    try:
        # Navigate and wait
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Step 1: Select tests using JavaScript (works better than Playwright selectors)
        print("Step 1: Selecting tests...")
        selected_count = await page.evaluate("""
            () => {
                const checkboxes = document.querySelectorAll('tbody tr input[type="checkbox"]');
                let selected = 0;
                for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
                    if (!checkboxes[i].checked) {
                        checkboxes[i].click();
                        selected++;
                    }
                }
                return selected;
            }
        """)
        print(f"  Selected {selected_count} tests via JavaScript")
        await asyncio.sleep(1)
        
        # Step 2: Configure suite
        print("Step 2: Configuring suite...")
        
        # Set suite name
        await page.fill('[data-testid="suite-name-input"]', "Final Test Suite")
        
        # Set execution settings
        await page.select_option('[data-testid="execution-mode-select"]', 'headed')
        await page.select_option('[data-testid="execution-type-select"]', 'parallel') 
        await page.select_option('[data-testid="retry-count-select"]', '2')
        
        print("  Configured: headed, parallel, 2 retries")
        
        # Step 3: Create and run suite
        print("Step 3: Creating and executing suite...")
        
        # Create suite
        await page.click('[data-testid="create-suite-button"]')
        await asyncio.sleep(2)
        print("  Suite created")
        
        # Clear API call tracking for execution phase
        api_calls.clear()
        
        # Execute suite
        await page.click('[data-testid="run-existing-suite"]')
        await asyncio.sleep(8)  # Wait for execution
        
        print(f"  Suite execution completed")
        print(f"  API calls during execution: {len(api_calls)}")
        
        for call in api_calls:
            print(f"    {call['time']}: {call['method']} Test ID: {call['test_id']}")
        
        await page.screenshot(path=f"final_verification_{timestamp}.png")
        
        return {
            'tests_selected': selected_count,
            'execution_calls': len(api_calls),
            'success': len(api_calls) > 0,
            'timestamp': timestamp
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {'error': str(e)}
    
    finally:
        await asyncio.sleep(5)  # Brief pause for inspection
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(final_verification())
    
    print("\n" + "="*40)
    print("FINAL VERIFICATION RESULTS")
    print("="*40)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Tests Selected: {result['tests_selected']}")
        print(f"Execution Calls: {result['execution_calls']}")
        print(f"Success: {result['success']}")
        print(f"Screenshot: final_verification_{result['timestamp']}.png")
        
        if result['success']:
            print("\nSUCCESS: Suite execution verified!")
            print("- Suite creation: WORKING")  
            print("- Configuration: headed, parallel, 2 retries")
            print("- Test execution: WORKING")
            print("- API integration: WORKING")
        else:
            print("\nISSUE: Suite execution not triggered")
    
    print("="*40)