"""
Complete Scheduler Test
Test suite creation and execution with 3 tests, headed, 2 retries, parallel
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_complete_suite_execution():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=1000)
    page = await browser.new_page()
    
    execution_calls = []
    suite_creation_calls = []
    
    def track_requests(request):
        url = request.url
        method = request.method
        
        if '/api/tests/run' in url or '/execute' in url:
            execution_calls.append({
                'url': url,
                'method': method,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] EXECUTION: {method} {url}")
        
        if '/api/suites' in url or '/create' in url:
            suite_creation_calls.append({
                'url': url,
                'method': method,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] SUITE API: {method} {url}")
    
    page.on("request", track_requests)
    
    print("=== COMPLETE SUITE EXECUTION TEST ===")
    print("Creating suite with 3 tests: headed, 2 retries, parallel")
    
    # Navigate to Test Bank
    await page.goto("http://localhost:3000/test-bank")
    await page.wait_for_load_state('networkidle')
    await asyncio.sleep(2)
    
    screenshot_base = f"suite_test_{datetime.now().strftime('%H%M%S')}"
    
    # Step 1: Select 3 tests
    print("Step 1: Selecting 3 random tests...")
    
    test_checkboxes = await page.query_selector_all('[data-testid="test-checkbox"]')
    print(f"Found {len(test_checkboxes)} test checkboxes")
    
    if len(test_checkboxes) >= 3:
        selected_tests = []
        for i in range(3):
            await test_checkboxes[i].click()
            await asyncio.sleep(0.5)
            
            # Get test name for this row
            row = test_checkboxes[i]
            try:
                # Navigate to parent row and find test name
                test_name_elem = await page.query_selector_all('[data-testid="test-name"]')
                if i < len(test_name_elem):
                    test_name = await test_name_elem[i].text_content()
                    selected_tests.append(test_name[:50] if test_name else f"Test_{i+1}")
            except:
                selected_tests.append(f"Test_{i+1}")
        
        print(f"Selected tests: {selected_tests}")
        await page.screenshot(path=f"{screenshot_base}_01_selected.png")
        
        # Step 2: Configure suite settings
        print("Step 2: Configuring suite settings...")
        
        # Set suite name
        suite_name_input = await page.query_selector('[data-testid="suite-name-input"]')
        if suite_name_input:
            await suite_name_input.fill("Live Test Suite - 3 Tests")
            await asyncio.sleep(0.5)
        
        # Set execution mode to headed
        execution_mode_select = await page.query_selector('[data-testid="execution-mode-select"]')
        if execution_mode_select:
            await execution_mode_select.select_option('headed')
            print("  - Set execution mode: headed")
            await asyncio.sleep(0.5)
        
        # Set execution type to parallel  
        execution_type_select = await page.query_selector('[data-testid="execution-type-select"]')
        if execution_type_select:
            await execution_type_select.select_option('parallel')
            print("  - Set execution type: parallel")
            await asyncio.sleep(0.5)
        
        # Set retry count to 2
        retry_count_select = await page.query_selector('[data-testid="retry-count-select"]')
        if retry_count_select:
            await retry_count_select.select_option('2')
            print("  - Set retry count: 2")
            await asyncio.sleep(0.5)
        
        await page.screenshot(path=f"{screenshot_base}_02_configured.png")
        
        # Step 3: Create suite
        print("Step 3: Creating suite...")
        suite_creation_calls.clear()
        
        create_suite_button = await page.query_selector('[data-testid="create-suite-button"]')
        if create_suite_button:
            await create_suite_button.click()
            await asyncio.sleep(3)
            print(f"Suite creation API calls: {len(suite_creation_calls)}")
            
            await page.screenshot(path=f"{screenshot_base}_03_created.png")
            
            # Step 4: Find and run the created suite
            print("Step 4: Finding and running the created suite...")
            
            # Look for the newly created suite in existing suites
            suite_run_buttons = await page.query_selector_all('[data-testid="run-existing-suite"]')
            print(f"Found {len(suite_run_buttons)} suite run buttons")
            
            if len(suite_run_buttons) > 0:
                execution_calls.clear()
                
                print("Running the suite...")
                await suite_run_buttons[0].click()  # Click first suite run button
                await asyncio.sleep(8)  # Wait for suite execution
                
                await page.screenshot(path=f"{screenshot_base}_04_executed.png")
                
                print(f"Suite execution API calls: {len(execution_calls)}")
                
                for call in execution_calls:
                    print(f"  - {call['time']}: {call['method']} {call['url']}")
                
                return {
                    'suite_created': len(suite_creation_calls) > 0,
                    'suite_executed': len(execution_calls) > 0,
                    'execution_count': len(execution_calls),
                    'selected_tests': len(selected_tests),
                    'screenshots': [
                        f"{screenshot_base}_01_selected.png",
                        f"{screenshot_base}_02_configured.png", 
                        f"{screenshot_base}_03_created.png",
                        f"{screenshot_base}_04_executed.png"
                    ]
                }
            else:
                print("ERROR: No suite run buttons found after creation")
                return {'error': 'No suite run buttons found'}
        else:
            print("ERROR: Create suite button not found")
            return {'error': 'Create suite button not found'}
    else:
        print("ERROR: Not enough test checkboxes found")
        return {'error': 'Not enough tests available'}
    
    # Keep browser open for inspection
    await asyncio.sleep(15)
    await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_complete_suite_execution())
    
    print("\n" + "="*60)
    print("COMPLETE SUITE EXECUTION RESULTS")
    print("="*60)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Suite Created: {result.get('suite_created', False)}")
        print(f"Suite Executed: {result.get('suite_executed', False)}")
        print(f"Tests Selected: {result.get('selected_tests', 0)}")
        print(f"Execution Calls: {result.get('execution_count', 0)}")
        print(f"Screenshots: {len(result.get('screenshots', []))}")
        
        if result.get('suite_created') and result.get('suite_executed'):
            print("SUCCESS: Complete suite workflow working!")
        else:
            print("PARTIAL: Some parts of suite workflow need fixes")
    
    print("="*60)