"""
Simple UI Execution Demo - No Unicode characters
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def show_ui_execution():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)
    page = await browser.new_page()
    
    execution_calls = []
    
    def track_execution(request):
        if '/api/tests/run/' in request.url and request.method == 'POST':
            execution_calls.append(request.url)
            print(f"EXECUTION DETECTED: {request.url}")
    
    page.on("request", track_execution)
    
    print("=== QA Intelligence UI Test Execution Demo ===")
    print("Step 1: Loading Test Bank page...")
    
    await page.goto("http://localhost:3000/test-bank")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)
    
    # Take screenshot of the interface
    screenshot1 = f"ui_demo_interface_{datetime.now().strftime('%H%M%S')}.png"
    await page.screenshot(path=screenshot1, full_page=True)
    print(f"Screenshot saved: {screenshot1}")
    
    # Count run buttons
    run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
    print(f"Step 2: Found {len(run_buttons)} Run buttons")
    
    if run_buttons:
        print("Step 3: Clicking first Run button...")
        
        # Clear tracking
        execution_calls.clear()
        
        # Click the button
        await run_buttons[0].click()
        await asyncio.sleep(3)
        
        # Take screenshot after execution
        screenshot2 = f"ui_demo_execution_{datetime.now().strftime('%H%M%S')}.png"
        await page.screenshot(path=screenshot2, full_page=True)
        print(f"Execution screenshot saved: {screenshot2}")
        
        # Show results
        print(f"Step 4: Execution results:")
        print(f"  - API calls made: {len(execution_calls)}")
        
        if len(execution_calls) == 1:
            print("  - SUCCESS: Single execution confirmed!")
            test_id = execution_calls[0].split('/')[-1][:8]
            print(f"  - Test ID: {test_id}...")
        else:
            print(f"  - WARNING: Expected 1 call, got {len(execution_calls)}")
        
        # Keep browser open for inspection
        print("Browser staying open for 15 seconds...")
        await asyncio.sleep(15)
    
    await browser.close()
    print("Demo completed!")

if __name__ == "__main__":
    asyncio.run(show_ui_execution())