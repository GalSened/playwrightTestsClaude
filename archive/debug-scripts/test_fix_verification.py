"""
Test Fix Verification
Verify that the database error fix works for single test execution
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_database_fix():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)
    page = await browser.new_page()
    
    execution_calls = []
    
    def track_execution(request):
        if '/api/tests/run/' in request.url and request.method == 'POST':
            execution_calls.append({
                'url': request.url,
                'method': request.method,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] TEST EXECUTION: {request.method} {request.url}")
    
    def track_response(response):
        if '/api/tests/run/' in response.url and response.request.method == 'POST':
            print(f"[{datetime.now().strftime('%H:%M:%S')}] RESPONSE: {response.status} - {response.url}")
    
    page.on("request", track_execution)
    page.on("response", track_response)
    
    print("=== DATABASE FIX VERIFICATION ===")
    print("Testing single test execution after database fix...")
    
    # Navigate to Test Bank
    await page.goto("http://localhost:3000/test-bank")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)
    
    # Find and click a Run button
    run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
    print(f"Found {len(run_buttons)} Run buttons")
    
    if len(run_buttons) > 0:
        execution_calls.clear()
        print("Clicking Run button to test database fix...")
        
        await run_buttons[0].click()
        await asyncio.sleep(5)  # Wait for execution to complete
        
        screenshot = f"fix_test_{datetime.now().strftime('%H%M%S')}.png"
        await page.screenshot(path=screenshot)
        
        print(f"Results:")
        print(f"  - API calls made: {len(execution_calls)}")
        
        for call in execution_calls:
            print(f"  - {call['time']}: {call['method']} {call['url']}")
        
        if len(execution_calls) == 1:
            print("SUCCESS: Database fix working - single test execution completed!")
        else:
            print(f"ISSUE: Expected 1 call, got {len(execution_calls)}")
    else:
        print("ERROR: No run buttons found")
    
    # Keep browser open briefly for inspection
    await asyncio.sleep(10)
    await browser.close()
    
    return len(execution_calls) == 1

if __name__ == "__main__":
    success = asyncio.run(test_database_fix())
    print(f"\nDatabase fix verification: {'PASSED' if success else 'FAILED'}")