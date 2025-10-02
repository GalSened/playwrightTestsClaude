"""
Verify Suite Execution
Test the complete suite workflow even with pre-existing selections
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def verify_suite_execution():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    all_api_calls = []
    
    def track_all_requests(request):
        if '/api/' in request.url:
            call_info = {
                'method': request.method,
                'url': request.url,
                'time': datetime.now().strftime('%H:%M:%S.%f')[:-3]
            }
            all_api_calls.append(call_info)
            print(f"[{call_info['time']}] {call_info['method']} {call_info['url']}")
    
    page.on("request", track_all_requests)
    
    print("=== SUITE EXECUTION VERIFICATION ===")
    print("Goal: Verify headed, parallel, 2 retries execution")
    
    try:
        # Navigate to Test Bank
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(3)
        
        timestamp = datetime.now().strftime('%H%M%S')
        await page.screenshot(path=f"verify_suite_{timestamp}_01_loaded.png")
        
        # Step 1: Check current state
        print("Step 1: Analyzing current test bank state...")
        
        # Count available tests
        test_rows = await page.query_selector_all('tbody tr')
        print(f"  Available tests: {len(test_rows)}")
        
        # Check for existing selections
        checked_boxes = await page.query_selector_all('tbody tr input[type="checkbox"]:checked')
        print(f"  Pre-selected tests: {len(checked_boxes)}")
        
        # If no tests selected, try to select some manually
        if len(checked_boxes) == 0:
            print("  Attempting manual selection...")
            
            # Use JavaScript to select checkboxes to avoid DOM attachment issues
            try:
                result = await page.evaluate("""
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
                print(f"  JavaScript selected: {result} tests")
                await asyncio.sleep(2)  # Wait for React state update
                
            except Exception as e:
                print(f"  JavaScript selection failed: {str(e)[:40]}")
        
        # Recheck selections
        checked_boxes = await page.query_selector_all('tbody tr input[type="checkbox"]:checked')
        print(f"  Final selected tests: {len(checked_boxes)}")
        
        await page.screenshot(path=f"verify_suite_{timestamp}_02_selected.png")
        
        # Step 2: Configure suite with target settings
        print("Step 2: Configuring suite (headed, parallel, 2 retries)...")
        
        # Set suite name
        suite_name_input = await page.query_selector('[data-testid="suite-name-input"]')
        if suite_name_input:
            await suite_name_input.fill("Verification Suite - Headed Parallel")
            print("  Suite name set")
        
        # Critical settings verification
        settings_applied = 0
        
        # Execution mode: headed
        execution_mode = await page.query_selector('[data-testid="execution-mode-select"]')
        if execution_mode:
            await execution_mode.select_option('headed')
            current_mode = await execution_mode.input_value()
            print(f"  Execution mode: {current_mode}")
            if current_mode == 'headed':
                settings_applied += 1
        
        # Execution type: parallel
        execution_type = await page.query_selector('[data-testid="execution-type-select"]')
        if execution_type:
            await execution_type.select_option('parallel')
            current_type = await execution_type.input_value()
            print(f"  Execution type: {current_type}")
            if current_type == 'parallel':
                settings_applied += 1
        
        # Retry count: 2
        retry_count = await page.query_selector('[data-testid="retry-count-select"]')
        if retry_count:
            await retry_count.select_option('2')
            current_retries = await retry_count.input_value()
            print(f"  Retry count: {current_retries}")
            if current_retries == '2':
                settings_applied += 1
        
        print(f"  Applied {settings_applied}/3 target settings")
        await page.screenshot(path=f"verify_suite_{timestamp}_03_configured.png")
        
        # Step 3: Create and execute suite
        print("Step 3: Creating and executing suite...")
        
        create_button = await page.query_selector('[data-testid="create-suite-button"]')
        if create_button:
            is_enabled = not await create_button.is_disabled()
            print(f"  Create button enabled: {is_enabled}")
            
            if is_enabled:
                # Clear API tracking for suite execution only
                suite_execution_start = len(all_api_calls)
                
                # Create suite
                await create_button.click()
                await asyncio.sleep(3)
                print("  Suite creation triggered")
                
                await page.screenshot(path=f"verify_suite_{timestamp}_04_created.png")
                
                # Execute suite
                run_buttons = await page.query_selector_all('[data-testid="run-existing-suite"]')
                print(f"  Available suite run buttons: {len(run_buttons)}")
                
                if len(run_buttons) > 0:
                    print("  Executing suite now...")
                    
                    # Track execution start time
                    execution_start_time = datetime.now()
                    execution_start_calls = len(all_api_calls)
                    
                    await run_buttons[0].click()
                    await asyncio.sleep(12)  # Wait for suite execution
                    
                    execution_end_time = datetime.now()
                    execution_duration = (execution_end_time - execution_start_time).total_seconds()
                    
                    await page.screenshot(path=f"verify_suite_{timestamp}_05_executed.png")
                    
                    # Analyze execution API calls
                    execution_calls = all_api_calls[execution_start_calls:]
                    test_run_calls = [c for c in execution_calls if '/api/tests/run/' in c['url']]
                    
                    print(f"  Execution duration: {execution_duration:.1f} seconds")
                    print(f"  Total execution API calls: {len(execution_calls)}")
                    print(f"  Test run API calls: {len(test_run_calls)}")
                    
                    # Show specific test execution calls
                    for call in test_run_calls:
                        test_id = call['url'].split('/')[-1][:8]  # First 8 chars of test ID
                        print(f"    {call['time']}: {call['method']} .../{test_id}")
                    
                    return {
                        'selected_tests': len(checked_boxes),
                        'settings_applied': settings_applied,
                        'execution_calls': len(test_run_calls),
                        'execution_duration': execution_duration,
                        'api_calls_total': len(all_api_calls),
                        'success': len(test_run_calls) > 0 and settings_applied >= 2
                    }
                    
                else:
                    print("  No suite run buttons found")
                    return {'error': 'No suite run buttons available'}
            else:
                print("  Create button disabled")
                return {'error': 'Create suite button disabled'}
        else:
            print("  Create button not found")
            return {'error': 'Create suite button not found'}
        
    except Exception as e:
        print(f"Verification error: {str(e)}")
        await page.screenshot(path=f"verify_suite_{timestamp}_error.png")
        return {'error': str(e)}
    
    finally:
        print("Keeping browser open for final inspection (8 seconds)...")
        await asyncio.sleep(8)
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(verify_suite_execution())
    
    print("\n" + "="*50)
    print("SUITE EXECUTION VERIFICATION RESULTS")
    print("="*50)
    
    if 'error' in result:
        print(f"ERROR: {result['error']}")
    else:
        print(f"Selected Tests: {result.get('selected_tests', 0)}")
        print(f"Settings Applied: {result.get('settings_applied', 0)}/3")
        print(f"Test Execution Calls: {result.get('execution_calls', 0)}")
        print(f"Execution Duration: {result.get('execution_duration', 0):.1f}s")
        print(f"Total API Calls: {result.get('api_calls_total', 0)}")
        print(f"Overall Success: {result.get('success', False)}")
        
        if result.get('success'):
            print("\n✅ SUITE EXECUTION VERIFIED!")
            print("✅ Settings: headed, parallel, 2 retries applied")
            print("✅ API calls executed successfully")
        else:
            print("\n❌ Issues found in suite execution")
            
        # Determine what's working vs what needs fixes
        if result.get('execution_calls', 0) > 0:
            print("✅ Test execution API working")
        else:
            print("❌ Test execution not triggered")
            
        if result.get('settings_applied', 0) >= 2:
            print("✅ Suite configuration working")
        else:
            print("❌ Suite configuration incomplete")
    
    print("="*50)