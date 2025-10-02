"""
Live Test Execution Demonstration
Real end-user navigation and test execution
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def live_test_execution():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=2000)  # Slow for visibility
    page = await browser.new_page()
    
    execution_calls = []
    
    def track_execution(request):
        if '/api/tests/run' in request.url:
            execution_calls.append({
                'url': request.url,
                'method': request.method,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] EXECUTION: {request.method} {request.url}")
    
    page.on("request", track_execution)
    
    print("=== LIVE TEST EXECUTION DEMONSTRATION ===")
    print("User navigating to Test Bank...")
    
    # Navigate to Test Bank
    await page.goto("http://localhost:3000/test-bank")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(3)
    
    # Take screenshot of initial state
    screenshot1 = f"live_demo_testbank_{datetime.now().strftime('%H%M%S')}.png"
    await page.screenshot(path=screenshot1, full_page=True)
    print(f"Screenshot saved: {screenshot1}")
    
    # TASK 1: Run single test (headed, once)
    print("\n--- TASK 1: Single Test Execution (headed, once) ---")
    
    run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
    print(f"Found {len(run_buttons)} Run buttons available")
    
    if len(run_buttons) > 0:
        # Get test name for the first test
        test_name_elem = await page.query_selector('[data-testid="test-name"]')
        if test_name_elem:
            test_name = await test_name_elem.text_content()
            print(f"Selected test: {test_name}")
        
        execution_calls.clear()
        print("User clicking Run button for single test...")
        
        await run_buttons[0].click()
        await asyncio.sleep(5)  # Wait for execution
        
        screenshot2 = f"live_demo_single_{datetime.now().strftime('%H%M%S')}.png"
        await page.screenshot(path=screenshot2, full_page=True)
        
        single_calls = len(execution_calls)
        print(f"Single test execution completed: {single_calls} API calls")
        
        for call in execution_calls:
            print(f"  - {call['time']}: {call['method']} {call['url']}")
    
    # Wait before next task
    await asyncio.sleep(3)
    
    # TASK 2: Create and run test suite (3 tests, headed, 2 retries, parallel)
    print("\n--- TASK 2: Suite Creation and Execution ---")
    print("User selecting 3 random tests for suite...")
    
    # Select 3 tests by clicking checkboxes
    test_checkboxes = await page.query_selector_all('[data-testid="test-checkbox"]')
    
    if len(test_checkboxes) >= 3:
        selected_tests = []
        for i in range(3):
            await test_checkboxes[i].click()
            await asyncio.sleep(1)  # Visual delay
            
            # Get test name
            test_row = test_checkboxes[i].locator('xpath=../../..')
            test_name_elem = await test_row.query_selector('[data-testid="test-name"]')
            if test_name_elem:
                test_name = await test_name_elem.text_content()
                selected_tests.append(test_name.split('::')[0] if '::' in test_name else test_name[:30])
        
        print(f"Selected tests: {selected_tests}")
        
        # Take screenshot of selections
        screenshot3 = f"live_demo_selection_{datetime.now().strftime('%H%M%S')}.png"
        await page.screenshot(path=screenshot3, full_page=True)
        
        # Configure suite settings
        print("User configuring suite settings...")
        
        # Set suite name
        suite_name_input = await page.query_selector('[data-testid="suite-name-input"]')
        if suite_name_input:
            await suite_name_input.fill("Live Demo Suite")
            await asyncio.sleep(1)
        
        # Set execution mode to headed
        execution_mode_select = await page.query_selector('[data-testid="execution-mode-select"]')
        if execution_mode_select:
            await execution_mode_select.select_option('headed')
            await asyncio.sleep(1)
        
        # Set execution type to parallel
        execution_type_select = await page.query_selector('[data-testid="execution-type-select"]')
        if execution_type_select:
            await execution_type_select.select_option('parallel')
            await asyncio.sleep(1)
        
        # Set retry count to 2
        retry_count_select = await page.query_selector('[data-testid="retry-count-select"]')
        if retry_count_select:
            await retry_count_select.select_option('2')
            await asyncio.sleep(1)
        
        print("Suite configured: headed, parallel, 2 retries")
        
        # Create suite
        create_suite_button = await page.query_selector('[data-testid="create-suite-button"]')
        if create_suite_button:
            print("User clicking Create Suite button...")
            await create_suite_button.click()
            await asyncio.sleep(3)
            
            screenshot4 = f"live_demo_suite_created_{datetime.now().strftime('%H%M%S')}.png"
            await page.screenshot(path=screenshot4, full_page=True)
            
            # Find and run the created suite
            suite_run_buttons = await page.query_selector_all('[data-testid="run-existing-suite"]')
            if suite_run_buttons:
                execution_calls.clear()
                print("User clicking Run Suite button...")
                
                await suite_run_buttons[0].click()  # Click first suite run button
                await asyncio.sleep(8)  # Wait longer for suite execution
                
                screenshot5 = f"live_demo_suite_run_{datetime.now().strftime('%H%M%S')}.png"
                await page.screenshot(path=screenshot5, full_page=True)
                
                suite_calls = len(execution_calls)
                print(f"Suite execution completed: {suite_calls} API calls")
                
                for call in execution_calls:
                    print(f"  - {call['time']}: {call['method']} {call['url']}")
    
    print("\n=== EXECUTION SUMMARY ===")
    print(f"Task 1 - Single test: {single_calls if 'single_calls' in locals() else 0} API calls")
    print(f"Task 2 - Suite execution: {suite_calls if 'suite_calls' in locals() else 0} API calls")
    
    print(f"\nScreenshots captured:")
    print(f"  - Initial interface: {screenshot1}")
    if 'screenshot2' in locals():
        print(f"  - Single test execution: {screenshot2}")
    if 'screenshot3' in locals():
        print(f"  - Test selection: {screenshot3}")
    if 'screenshot4' in locals():
        print(f"  - Suite created: {screenshot4}")
    if 'screenshot5' in locals():
        print(f"  - Suite execution: {screenshot5}")
    
    # Keep browser open for final inspection
    print("\nBrowser staying open for 20 seconds for final inspection...")
    await asyncio.sleep(20)
    
    await browser.close()
    print("Live demonstration completed!")

if __name__ == "__main__":
    asyncio.run(live_test_execution())