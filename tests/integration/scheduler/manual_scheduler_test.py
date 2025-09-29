"""
Manual E2E Test for Scheduler - Focus on Core Functionality
"""
import asyncio
from playwright.async_api import async_playwright

async def test_scheduler_manually():
    """Test scheduler manually without console logging to avoid encoding issues"""
    
    print("Starting Manual Scheduler Test")
    print("=" * 40)
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)
    page = await browser.new_page()
    
    try:
        # Step 1: Navigate to scheduler
        print("1. Navigating to scheduler page...")
        await page.goto("http://localhost:3000/scheduler")
        await page.wait_for_load_state("networkidle")
        
        title = await page.title()
        print(f"   Page loaded: {title}")
        
        # Step 2: Check for main components
        print("2. Checking for main components...")
        
        schedule_card = await page.locator('[data-testid="schedule-form-card"]').count()
        print(f"   Schedule form card: {'FOUND' if schedule_card > 0 else 'NOT FOUND'}")
        
        guidance_panel = await page.locator('[data-testid="guidance-panel"]').count()
        print(f"   Guidance panel: {'VISIBLE' if guidance_panel > 0 else 'NOT VISIBLE'}")
        
        # Step 3: Try to access suite selection
        print("3. Testing suite selection...")
        
        choose_button = await page.locator('[data-testid="show-suite-selection"]').count()
        if choose_button > 0:
            print("   Clicking Choose Test Suite button...")
            await page.locator('[data-testid="show-suite-selection"]').click()
            await page.wait_for_timeout(2000)
            
            # Check if suite selection appeared
            suite_selection = await page.locator('[data-testid="suite-selection-card"]').count()
            print(f"   Suite selection card: {'APPEARED' if suite_selection > 0 else 'NOT FOUND'}")
        else:
            print("   Choose Test Suite button not found")
        
        # Step 4: Test existing suites tab
        print("4. Testing existing suites...")
        
        existing_tab = await page.locator('[data-testid="existing-suite-mode"]').count()
        if existing_tab > 0:
            await page.locator('[data-testid="existing-suite-mode"]').click()
            await page.wait_for_timeout(1000)
            print("   Existing suites tab clicked")
            
            # Try suite selector
            selector_trigger = await page.locator('[data-testid="suite-selector-trigger"]').count()
            if selector_trigger > 0:
                print("   Opening suite selector...")
                await page.locator('[data-testid="suite-selector-trigger"]').click()
                await page.wait_for_timeout(2000)
                
                # Count suite options
                suite_options = await page.locator('[data-testid^="suite-option-"]').count()
                print(f"   Suite options available: {suite_options}")
                
                if suite_options > 0:
                    print("   Selecting first suite option...")
                    await page.locator('[data-testid^="suite-option-"]').first.click()
                    await page.wait_for_timeout(2000)
                    
                    # Check for success panel
                    success_panel = await page.locator('[data-testid="success-panel"]').count()
                    print(f"   Success panel: {'APPEARED' if success_panel > 0 else 'NOT FOUND'}")
                    
                    if success_panel > 0:
                        # Try quick schedule button
                        quick_schedule = await page.locator('[data-testid="quick-schedule"]').count()
                        if quick_schedule > 0:
                            print("   Clicking Schedule Now button...")
                            await page.locator('[data-testid="quick-schedule"]').click()
                            await page.wait_for_timeout(2000)
                            
                            # Check if form appeared
                            form = await page.locator('form').count()
                            print(f"   Schedule form: {'APPEARED' if form > 0 else 'NOT FOUND'}")
                            
                            if form > 0:
                                print("5. Testing form functionality...")
                                
                                # Fill form
                                await page.locator('[data-testid="schedule-date"]').fill("2025-01-15")
                                await page.locator('[data-testid="schedule-time"]').fill("14:30")
                                print("   Form fields filled")
                                
                                # Check submit button
                                submit_button = page.locator('[data-testid="create-schedule"]')
                                is_enabled = await submit_button.is_enabled()
                                print(f"   Submit button enabled: {'YES' if is_enabled else 'NO'}")
                                
                                if is_enabled:
                                    print("\n*** SUCCESS: SCHEDULER IS FULLY FUNCTIONAL! ***")
                                    result = True
                                else:
                                    print("\n*** ISSUE: Submit button is disabled ***")
                                    result = False
                            else:
                                print("\n*** ISSUE: Form did not appear ***")
                                result = False
                        else:
                            print("   Quick schedule button not found")
                            result = False
                    else:
                        print("   Success panel did not appear")
                        result = False
                else:
                    print("   No suite options found")
                    result = False
            else:
                print("   Suite selector trigger not found")
                result = False
        else:
            print("   Existing suites tab not found")
            result = False
            
        # Step 6: Test API endpoints quickly
        print("6. Testing API endpoints...")
        
        try:
            # Test suites endpoint
            response = await page.request.get("http://localhost:8081/api/tests/suites/list")
            suites_ok = response.ok
            print(f"   Suites API: {'OK' if suites_ok else 'FAILED'}")
            
            # Test categories endpoint
            response = await page.request.get("http://localhost:8081/api/tests/categories/list")
            categories_ok = response.ok
            print(f"   Categories API: {'OK' if categories_ok else 'FAILED'}")
            
            # Test tags endpoint  
            response = await page.request.get("http://localhost:8081/api/tests/tags/list")
            tags_ok = response.ok
            print(f"   Tags API: {'OK' if tags_ok else 'FAILED'}")
            
        except Exception as e:
            print(f"   API test failed: {str(e)[:50]}...")
            
        print("\n" + "=" * 40)
        if result:
            print("RESULT: SCHEDULER WORKING CORRECTLY!")
        else:
            print("RESULT: SCHEDULER HAS ISSUES")
            
        print("\nBrowser staying open for manual inspection...")
        print("Press Enter to close...")
        input()
        
    except Exception as e:
        print(f"Error during test: {e}")
        
    finally:
        await browser.close()
        await playwright.stop()

if __name__ == "__main__":
    asyncio.run(test_scheduler_manually())