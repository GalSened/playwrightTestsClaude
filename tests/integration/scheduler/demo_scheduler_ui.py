"""
Demo Scheduler UI Test
Simple test to demonstrate suite creation workflow
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def demo_scheduler_workflow():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=2000)
    page = await browser.new_page()
    
    requests_log = []
    
    def log_request(request):
        if '/api/' in request.url:
            requests_log.append(f"{request.method} {request.url}")
            print(f"API: {request.method} {request.url}")
    
    page.on("request", log_request)
    
    print("Demo: Testing suite creation workflow")
    
    try:
        # Navigate to Test Bank
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)
        
        print("1. Loaded Test Bank page")
        
        # Take screenshot of initial state
        await page.screenshot(path=f"demo_scheduler_01_{datetime.now().strftime('%H%M%S')}.png")
        
        # Try to select a few tests by clicking in the table area
        print("2. Attempting to select tests...")
        
        # Use a more reliable selector approach
        checkboxes = await page.query_selector_all('input[type="checkbox"]')
        print(f"   Found {len(checkboxes)} checkboxes")
        
        # Select first 3 checkboxes (skip the header checkbox)
        selected_count = 0
        for i, checkbox in enumerate(checkboxes):
            if selected_count >= 3:
                break
            
            try:
                # Check if this is not the header checkbox
                is_header = await checkbox.get_attribute('data-testid') == 'select-all-tests'
                if not is_header:
                    await checkbox.click()
                    selected_count += 1
                    print(f"   Selected test {selected_count}")
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"   Skipped checkbox {i}: {e}")
                continue
        
        await page.screenshot(path=f"demo_scheduler_02_{datetime.now().strftime('%H%M%S')}.png")
        
        # Try to configure suite settings
        print("3. Configuring suite settings...")
        
        # Look for suite configuration elements
        suite_name_input = await page.query_selector('input[data-testid="suite-name-input"]')
        if suite_name_input:
            await suite_name_input.fill("Demo Suite - 3 Tests")
            print("   Set suite name")
        
        # Try to set execution options
        execution_mode = await page.query_selector('select[data-testid="execution-mode-select"]')
        if execution_mode:
            await execution_mode.select_option('headed')
            print("   Set execution mode: headed")
        
        execution_type = await page.query_selector('select[data-testid="execution-type-select"]')
        if execution_type:
            await execution_type.select_option('parallel')
            print("   Set execution type: parallel")
        
        retry_count = await page.query_selector('select[data-testid="retry-count-select"]')
        if retry_count:
            await retry_count.select_option('2')
            print("   Set retry count: 2")
        
        await page.screenshot(path=f"demo_scheduler_03_{datetime.now().strftime('%H%M%S')}.png")
        
        # Try to create the suite
        print("4. Creating suite...")
        create_button = await page.query_selector('button[data-testid="create-suite-button"]')
        if create_button:
            is_disabled = await create_button.get_attribute('disabled')
            if not is_disabled:
                await create_button.click()
                print("   Clicked Create Suite button")
                await asyncio.sleep(3)
            else:
                print("   Create Suite button is disabled")
        else:
            print("   Create Suite button not found")
        
        await page.screenshot(path=f"demo_scheduler_04_{datetime.now().strftime('%H%M%S')}.png")
        
        # Look for existing suites and run buttons
        print("5. Looking for suite run options...")
        run_buttons = await page.query_selector_all('button[data-testid="run-existing-suite"]')
        print(f"   Found {len(run_buttons)} suite run buttons")
        
        # Also check for preset suite buttons
        preset_buttons = await page.query_selector_all('button:has-text("Create Suite")')
        print(f"   Found {len(preset_buttons)} preset suite buttons")
        
        # Try running a preset suite if available
        if len(preset_buttons) > 0:
            print("   Trying to run a preset suite...")
            await preset_buttons[0].click()
            await asyncio.sleep(3)
            
            # Look again for run buttons
            run_buttons = await page.query_selector_all('button[data-testid="run-existing-suite"]')
            if len(run_buttons) > 0:
                print("   Found suite to run, executing...")
                await run_buttons[0].click()
                await asyncio.sleep(5)
            
        await page.screenshot(path=f"demo_scheduler_05_{datetime.now().strftime('%H%M%S')}.png")
        
        print("Demo completed - browser will stay open for 20 seconds")
        await asyncio.sleep(20)
        
        return {
            'selected_tests': selected_count,
            'api_calls': len(requests_log),
            'requests': requests_log[:10]  # First 10 requests
        }
        
    except Exception as e:
        print(f"Demo error: {e}")
        return {'error': str(e)}
    finally:
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(demo_scheduler_workflow())
    
    print("\nDemo Results:")
    print(f"Selected tests: {result.get('selected_tests', 0)}")
    print(f"API calls made: {result.get('api_calls', 0)}")
    
    if 'requests' in result:
        print("API requests:")
        for req in result['requests']:
            print(f"  - {req}")
    
    if 'error' in result:
        print(f"Error: {result['error']}")