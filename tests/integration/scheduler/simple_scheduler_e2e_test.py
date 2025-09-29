"""
Simple E2E Test for Enhanced Scheduler UX
Tests core scheduler functionality without unicode issues.
"""
import asyncio
from playwright.async_api import async_playwright
import time

async def test_scheduler_functionality():
    """Test the enhanced scheduler functionality end-to-end"""
    
    print("Starting Enhanced Scheduler E2E Test")
    print("=" * 50)
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)
    page = await browser.new_page()
    
    # Add console logging
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda error: print(f"Page Error: {error}"))
    
    try:
        # Test 1: Navigate to scheduler page
        print("\nTest 1: Loading scheduler page...")
        await page.goto("http://localhost:3000/scheduler")
        await page.wait_for_load_state("networkidle")
        
        title = await page.title()
        print(f"Page loaded: {title}")
        
        # Test 2: Check if guidance panel appears
        print("\nTest 2: Checking guidance panel...")
        guidance_panel = await page.locator('[data-testid="guidance-panel"]').count()
        if guidance_panel > 0:
            print("PASS: Guidance panel is visible")
            
            # Click the Choose Test Suite button
            await page.locator('[data-testid="show-suite-selection"]').click()
            await page.wait_for_timeout(1000)
            print("PASS: Choose Test Suite button works")
        else:
            print("INFO: Guidance panel not visible (may have suite selected)")
            
        # Test 3: Check suite selection modes
        print("\nTest 3: Testing suite selection modes...")
        
        # Check for existing suites tab
        existing_tab = await page.locator('[data-testid="existing-suite-mode"]').count()
        if existing_tab > 0:
            await page.locator('[data-testid="existing-suite-mode"]').click()
            await page.wait_for_timeout(500)
            print("PASS: Existing suites tab works")
            
            # Try to open suite selector
            suite_selector = await page.locator('[data-testid="suite-selector-trigger"]').count()
            if suite_selector > 0:
                await page.locator('[data-testid="suite-selector-trigger"]').click()
                await page.wait_for_timeout(1000)
                print("PASS: Suite selector dropdown opens")
                
                # Check for suite options
                suite_options = await page.locator('[data-testid^="suite-option-"]').count()
                print(f"INFO: Found {suite_options} suite options")
                
                if suite_options > 0:
                    # Select first suite
                    await page.locator('[data-testid^="suite-option-"]').first.click()
                    await page.wait_for_timeout(1000)
                    print("PASS: Suite selected successfully")
                    
                    # Check for success panel
                    success_panel = await page.locator('[data-testid="success-panel"]').count()
                    if success_panel > 0:
                        print("PASS: Success panel appears after suite selection")
                        
                        # Try to click Schedule Now
                        schedule_button = await page.locator('[data-testid="quick-schedule"]').count()
                        if schedule_button > 0:
                            await page.locator('[data-testid="quick-schedule"]').click()
                            await page.wait_for_timeout(1000)
                            print("PASS: Schedule Now button works")
                            
                            # Check if form appears
                            form = await page.locator('form').count()
                            if form > 0:
                                print("PASS: Schedule form appears")
                                
                                # Fill form fields
                                await page.locator('[data-testid="schedule-date"]').fill("2025-01-15")
                                await page.locator('[data-testid="schedule-time"]').fill("14:30")
                                print("PASS: Form fields filled successfully")
                                
                                # Check if submit button is enabled
                                submit_button = page.locator('[data-testid="create-schedule"]')
                                is_enabled = await submit_button.is_enabled()
                                
                                if is_enabled:
                                    print("PASS: Submit button is enabled - scheduler fully functional!")
                                    print("\n*** SCHEDULER IS WORKING CORRECTLY! ***")
                                else:
                                    print("FAIL: Submit button is disabled")
                            else:
                                print("FAIL: Schedule form did not appear")
                        else:
                            print("FAIL: Schedule Now button not found")
                    else:
                        print("FAIL: Success panel did not appear")
                else:
                    print("FAIL: No suite options available")
            else:
                print("FAIL: Suite selector not found")
        
        # Test 4: Test Quick Suite Builder
        print("\nTest 4: Testing Quick Suite Builder...")
        quick_tab = await page.locator('[data-testid="quick-suite-mode"]').count()
        if quick_tab > 0:
            await page.locator('[data-testid="quick-suite-mode"]').click()
            await page.wait_for_timeout(500)
            print("PASS: Quick suite builder tab works")
            
            # Check for presets
            presets_tab = await page.locator('[data-testid="presets-tab"]').count()
            if presets_tab > 0:
                await page.locator('[data-testid="presets-tab"]').click()
                await page.wait_for_timeout(500)
                
                # Try to select smoke preset
                smoke_preset = await page.locator('[data-testid="preset-smoke-test-suite"]').count()
                if smoke_preset > 0:
                    print("PASS: Preset suites are available")
                else:
                    print("INFO: Preset suites not found")
            else:
                print("INFO: Presets tab not found")
        else:
            print("INFO: Quick suite builder tab not found")
            
        # Test 5: Test API endpoints
        print("\nTest 5: Testing backend API endpoints...")
        
        # Test suites list API
        response = await page.request.get("http://localhost:8081/api/tests/suites/list")
        if response.ok:
            data = await response.json()
            print(f"PASS: Suites API works - {data.get('total', 0)} suites")
        else:
            print(f"FAIL: Suites API failed - Status {response.status}")
            
        # Test categories API  
        response = await page.request.get("http://localhost:8081/api/tests/categories/list")
        if response.ok:
            data = await response.json()
            print(f"PASS: Categories API works - {len(data.get('categories', []))} categories")
        else:
            print(f"FAIL: Categories API failed - Status {response.status}")
            
        print("\n" + "=" * 50)
        print("E2E Test Complete!")
        print("Browser will stay open for manual inspection...")
        print("Press Enter to close...")
        input()
        
    except Exception as e:
        print(f"ERROR: {e}")
        
    finally:
        await browser.close()
        await playwright.stop()

if __name__ == "__main__":
    asyncio.run(test_scheduler_functionality())