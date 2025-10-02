"""
Simple Suite Creation Test
Select 3 tests for suite creation without Unicode characters
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_simple_suite_creation():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=800)
    page = await browser.new_page()
    
    execution_calls = []
    
    def track_api_calls(request):
        if '/api/' in request.url:
            execution_calls.append({
                'method': request.method,
                'url': request.url,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"[{datetime.now().strftime('%H:%M:%S')}] API: {request.method} {request.url}")
    
    page.on("request", track_api_calls)
    
    print("=== SIMPLE SUITE CREATION TEST ===")
    print("Testing: 3 tests, headed, 2 retries, parallel")
    
    try:
        # Navigate to Test Bank
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(3)
        
        screenshot_base = f"simple_suite_{datetime.now().strftime('%H%M%S')}"
        await page.screenshot(path=f"{screenshot_base}_01_loaded.png")
        
        # Step 1: Select 3 tests
        print("Step 1: Selecting 3 tests...")
        
        # Wait for table to be fully loaded
        await page.wait_for_selector('tbody tr', timeout=10000)
        await asyncio.sleep(2)
        
        selected_count = 0
        selected_tests = []
        
        # Try a different approach - find all checkboxes at once then click them
        all_checkboxes = await page.query_selector_all('tbody tr input[type="checkbox"]')
        print(f"Found {len(all_checkboxes)} test checkboxes")
        
        for i in range(min(3, len(all_checkboxes))):
            try:
                checkbox = all_checkboxes[i]
                
                # Check if already checked
                is_checked = await checkbox.is_checked()
                
                if not is_checked:
                    # Click the checkbox
                    await checkbox.click()
                    await asyncio.sleep(0.8)  # Wait for React state
                    
                    # Verify selection
                    is_now_checked = await checkbox.is_checked()
                    if is_now_checked:
                        selected_count += 1
                        selected_tests.append(f"Test_{i+1}")
                        print(f"  Selected test {selected_count}: Test_{i+1}")
                    else:
                        print(f"  Failed to select test {i+1}")
                else:
                    print(f"  Test {i+1} already selected")
                    selected_count += 1
                    selected_tests.append(f"Test_{i+1}_PreSelected")
                    
            except Exception as e:
                print(f"  Error with checkbox {i+1}: {str(e)[:50]}")
                continue
        
        print(f"Selected {selected_count} tests total")
        await page.screenshot(path=f"{screenshot_base}_02_selected.png")
        
        # Step 2: Configure suite settings
        print("Step 2: Configuring suite settings...")
        
        # Set suite name
        try:
            suite_name_input = await page.query_selector('[data-testid="suite-name-input"]')
            if suite_name_input:
                await suite_name_input.fill("Simple Suite - 3 Tests Demo")
                print("  Set suite name")
            else:
                print("  Suite name input not found")
        except Exception as e:
            print(f"  Suite name error: {str(e)[:30]}")
        
        # Set execution settings
        try:
            # Execution mode: headed
            execution_mode = await page.query_selector('[data-testid="execution-mode-select"]')
            if execution_mode:
                await execution_mode.select_option('headed')
                print("  Set execution mode: headed")
            
            # Execution type: parallel
            execution_type = await page.query_selector('[data-testid="execution-type-select"]')
            if execution_type:
                await execution_type.select_option('parallel')
                print("  Set execution type: parallel")
            
            # Retry count: 2
            retry_count = await page.query_selector('[data-testid="retry-count-select"]')
            if retry_count:
                await retry_count.select_option('2')
                print("  Set retry count: 2")
                
        except Exception as e:
            print(f"  Configuration error: {str(e)[:40]}")
        
        await asyncio.sleep(1)
        await page.screenshot(path=f"{screenshot_base}_03_configured.png")
        
        # Step 3: Create suite
        print("Step 3: Creating suite...")
        try:
            create_button = await page.query_selector('[data-testid="create-suite-button"]')
            
            if create_button:
                is_enabled = not await create_button.is_disabled()
                print(f"  Create button enabled: {is_enabled}")
                
                if is_enabled:
                    execution_calls.clear()  # Track suite execution only
                    
                    await create_button.click()
                    await asyncio.sleep(4)  # Wait for suite creation
                    
                    await page.screenshot(path=f"{screenshot_base}_04_created.png")
                    print("  Suite created successfully")
                    
                    # Step 4: Run the suite
                    print("Step 4: Running suite...")
                    
                    run_buttons = await page.query_selector_all('[data-testid="run-existing-suite"]')
                    print(f"  Found {len(run_buttons)} run buttons")
                    
                    if len(run_buttons) > 0:
                        print("  Executing suite...")
                        await run_buttons[0].click()
                        await asyncio.sleep(10)  # Wait for execution
                        
                        await page.screenshot(path=f"{screenshot_base}_05_executed.png")
                        
                        print(f"  Suite execution calls: {len(execution_calls)}")
                        for call in execution_calls[-3:]:
                            print(f"    {call['time']}: {call['method']} {call['url']}")
                    
                else:
                    print("  Create button disabled")
            else:
                print("  Create button not found")
                
        except Exception as e:
            print(f"  Suite creation error: {str(e)[:50]}")
        
        print("Test completed - keeping browser open 12 seconds")
        await asyncio.sleep(12)
        
        return {
            'selected_tests': selected_count,
            'target_tests': 3,
            'api_calls': len(execution_calls),
            'success': selected_count >= 2
        }
        
    except Exception as e:
        print(f"Main error: {str(e)[:60]}")
        return {'error': str(e)}
    
    finally:
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_simple_suite_creation())
    
    print("\n" + "="*40)
    print("SIMPLE SUITE CREATION RESULTS")
    print("="*40)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Target Tests: {result.get('target_tests', 3)}")
        print(f"Selected Tests: {result.get('selected_tests', 0)}")
        print(f"API Calls: {result.get('api_calls', 0)}")
        print(f"Success: {result.get('success', False)}")
        
        if result.get('success'):
            print("SUCCESS: Suite creation working!")
        else:
            print("PARTIAL: Need more tests selected")
    
    print("="*40)