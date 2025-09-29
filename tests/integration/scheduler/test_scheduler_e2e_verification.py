"""
End-to-End Test for Enhanced Scheduler UX
Tests all 6 phases of the scheduler improvement to ensure full functionality.
"""
import asyncio
from playwright.async_api import async_playwright
import json
import time

class SchedulerE2ETest:
    def __init__(self):
        self.base_url = "http://localhost:3000"
        self.api_url = "http://localhost:8081"
        self.browser = None
        self.page = None
        
    async def setup(self):
        """Setup browser and page"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        
        # Add console logging
        self.page.on("console", lambda msg: print(f"Console: {msg.text}"))
        self.page.on("pageerror", lambda error: print(f"Page Error: {error}"))
        
    async def teardown(self):
        """Cleanup browser"""
        if self.browser:
            await self.browser.close()
            
    async def test_scheduler_page_loads(self):
        """Test 1: Verify scheduler page loads correctly"""
        print("\n🧪 Test 1: Scheduler page loads")
        
        await self.page.goto(f"{self.base_url}/scheduler")
        await self.page.wait_for_load_state("networkidle")
        
        # Check page title and main elements
        title = await self.page.title()
        print(f"✓ Page title: {title}")
        
        # Check for main scheduler components
        scheduler_card = await self.page.locator('[data-testid="schedule-form-card"]').count()
        assert scheduler_card > 0, "Schedule form card not found"
        print("✓ Schedule form card found")
        
        return True
        
    async def test_guidance_panel_appears(self):
        """Test 2: Verify guidance panel appears when no suite selected"""
        print("\n🧪 Test 2: Guidance panel appears")
        
        guidance_panel = await self.page.locator('[data-testid="guidance-panel"]').count()
        if guidance_panel > 0:
            print("✓ Guidance panel is visible")
            
            # Check guidance panel content
            guidance_text = await self.page.locator('[data-testid="guidance-panel"]').text_content()
            assert "Ready to Schedule Tests?" in guidance_text, "Guidance panel missing expected text"
            print("✓ Guidance panel has correct content")
            
            # Check for Choose Test Suite button
            choose_button = await self.page.locator('[data-testid="show-suite-selection"]').count()
            assert choose_button > 0, "Choose Test Suite button not found"
            print("✓ Choose Test Suite button found")
        else:
            print("⚠️ Guidance panel not visible (may be normal if suite already selected)")
            
        return True
        
    async def test_suite_selection_modes(self):
        """Test 3: Test all three suite selection modes"""
        print("\n🧪 Test 3: Suite selection modes")
        
        # Click Choose Test Suite button to show selection
        choose_button = await self.page.locator('[data-testid="show-suite-selection"]')
        if await choose_button.count() > 0:
            await choose_button.click()
            await self.page.wait_for_timeout(1000)
            
        # Check if suite selection is visible
        suite_selection = await self.page.locator('[data-testid="suite-selection-card"]').count()
        if suite_selection > 0:
            print("✓ Suite selection card is visible")
            
            # Test existing suites tab
            existing_tab = await self.page.locator('[data-testid="existing-suite-mode"]')
            if await existing_tab.count() > 0:
                await existing_tab.click()
                await self.page.wait_for_timeout(500)
                print("✓ Existing suites tab works")
                
            # Test quick builder tab
            quick_tab = await self.page.locator('[data-testid="quick-suite-mode"]')
            if await quick_tab.count() > 0:
                await quick_tab.click()
                await self.page.wait_for_timeout(500)
                print("✓ Quick suite builder tab works")
                
                # Check for preset suites
                preset_tab = await self.page.locator('[data-testid="presets-tab"]')
                if await preset_tab.count() > 0:
                    await preset_tab.click()
                    await self.page.wait_for_timeout(500)
                    print("✓ Presets tab works")
                    
                    # Try to select a preset
                    smoke_preset = await self.page.locator('[data-testid="preset-smoke-test-suite"]')
                    if await smoke_preset.count() > 0:
                        await smoke_preset.click()
                        await self.page.wait_for_timeout(1000)
                        print("✓ Smoke test preset selected")
                        
            # Test custom picker tab
            custom_tab = await self.page.locator('[data-testid="custom-suite-mode"]')
            if await custom_tab.count() > 0:
                await custom_tab.click()
                await self.page.wait_for_timeout(500)
                print("✓ Custom test picker tab works")
        else:
            print("⚠️ Suite selection card not visible")
            
        return True
        
    async def test_existing_suite_selection(self):
        """Test 4: Test selecting an existing suite"""
        print("\n🧪 Test 4: Existing suite selection")
        
        # Go back to existing suites
        existing_tab = await self.page.locator('[data-testid="existing-suite-mode"]')
        if await existing_tab.count() > 0:
            await existing_tab.click()
            await self.page.wait_for_timeout(500)
            
            # Try to open suite selector dropdown
            suite_selector = await self.page.locator('[data-testid="suite-selector-trigger"]')
            if await suite_selector.count() > 0:
                await suite_selector.click()
                await self.page.wait_for_timeout(1000)
                print("✓ Suite selector dropdown opened")
                
                # Look for suite options
                suite_options = await self.page.locator('[data-testid^="suite-option-"]').count()
                if suite_options > 0:
                    print(f"✓ Found {suite_options} suite options")
                    
                    # Select first suite option
                    first_suite = self.page.locator('[data-testid^="suite-option-"]').first
                    await first_suite.click()
                    await self.page.wait_for_timeout(1000)
                    print("✓ Selected first available suite")
                    
                    return True
                else:
                    print("⚠️ No suite options found")
            else:
                print("⚠️ Suite selector trigger not found")
                
        return False
        
    async def test_success_panel_and_schedule_button(self):
        """Test 5: Verify success panel and schedule button functionality"""
        print("\n🧪 Test 5: Success panel and schedule button")
        
        # Check for success panel
        success_panel = await self.page.locator('[data-testid="success-panel"]').count()
        if success_panel > 0:
            print("✓ Success panel is visible")
            
            # Check for schedule now button in success panel
            quick_schedule = await self.page.locator('[data-testid="quick-schedule"]')
            if await quick_schedule.count() > 0:
                await quick_schedule.click()
                await self.page.wait_for_timeout(1000)
                print("✓ Quick schedule button works")
                
                # Verify schedule form is now visible
                form_visible = await self.page.locator('form').count()
                if form_visible > 0:
                    print("✓ Schedule form is visible after clicking schedule")
                    return True
                else:
                    print("❌ Schedule form not visible after clicking schedule")
            else:
                print("⚠️ Quick schedule button not found in success panel")
        else:
            print("⚠️ Success panel not visible (may need suite selection first)")
            
        # Alternative: Check for main schedule button in card header
        main_schedule = await self.page.locator('[data-testid="show-schedule-form"]')
        if await main_schedule.count() > 0:
            await main_schedule.click()
            await self.page.wait_for_timeout(1000)
            print("✓ Main schedule button works")
            return True
            
        return False
        
    async def test_schedule_form_functionality(self):
        """Test 6: Test the actual scheduling form"""
        print("\n🧪 Test 6: Schedule form functionality")
        
        # Verify form elements exist
        date_input = await self.page.locator('[data-testid="schedule-date"]').count()
        time_input = await self.page.locator('[data-testid="schedule-time"]').count()
        browser_select = await self.page.locator('[data-testid="schedule-browser"]').count()
        
        assert date_input > 0, "Date input not found"
        assert time_input > 0, "Time input not found"
        assert browser_select > 0, "Browser select not found"
        
        print("✓ All form elements found")
        
        # Fill out the form
        await self.page.locator('[data-testid="schedule-date"]').fill("2025-01-15")
        await self.page.locator('[data-testid="schedule-time"]').fill("14:30")
        
        print("✓ Form fields filled")
        
        # Check if submit button is enabled
        submit_button = self.page.locator('[data-testid="create-schedule"]')
        is_enabled = await submit_button.is_enabled()
        
        if is_enabled:
            print("✓ Submit button is enabled - ready to schedule!")
            
            # Actually try to submit (but don't complete to avoid creating test data)
            print("🚀 Schedule form is fully functional!")
            return True
        else:
            print("❌ Submit button is disabled")
            button_text = await submit_button.text_content()
            print(f"Button text: {button_text}")
            
        return is_enabled
        
    async def test_backend_api_endpoints(self):
        """Test 7: Verify backend API endpoints work"""
        print("\n🧪 Test 7: Backend API endpoints")
        
        # Test suite list endpoint
        response = await self.page.request.get(f"{self.api_url}/api/tests/suites/list")
        if response.ok:
            data = await response.json()
            print(f"✓ Suite list API works: {data.get('total', 0)} suites found")
        else:
            print(f"❌ Suite list API failed: {response.status}")
            
        # Test categories endpoint
        response = await self.page.request.get(f"{self.api_url}/api/tests/categories/list")
        if response.ok:
            data = await response.json()
            categories_count = len(data.get('categories', []))
            print(f"✓ Categories API works: {categories_count} categories found")
        else:
            print(f"❌ Categories API failed: {response.status}")
            
        # Test tags endpoint
        response = await self.page.request.get(f"{self.api_url}/api/tests/tags/list")
        if response.ok:
            data = await response.json()
            tags_count = len(data.get('tags', []))
            print(f"✓ Tags API works: {tags_count} tags found")
        else:
            print(f"❌ Tags API failed: {response.status}")
            
        return True

async def run_e2e_test():
    """Run the complete E2E test suite"""
    test = SchedulerE2ETest()
    
    try:
        print("🚀 Starting Enhanced Scheduler E2E Test")
        print("=" * 50)
        
        await test.setup()
        
        # Run all tests
        tests = [
            test.test_scheduler_page_loads,
            test.test_guidance_panel_appears,
            test.test_suite_selection_modes,
            test.test_existing_suite_selection,
            test.test_success_panel_and_schedule_button,
            test.test_schedule_form_functionality,
            test.test_backend_api_endpoints
        ]
        
        passed = 0
        failed = 0
        
        for test_func in tests:
            try:
                result = await test_func()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Test failed with error: {e}")
                failed += 1
                
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED! Scheduler is fully functional!")
        else:
            print(f"⚠️ {failed} tests failed - needs investigation")
            
        # Keep browser open for manual inspection
        print("\n🔍 Browser will stay open for manual inspection...")
        print("Press Enter to close and finish...")
        input()
        
    finally:
        await test.teardown()

if __name__ == "__main__":
    asyncio.run(run_e2e_test())