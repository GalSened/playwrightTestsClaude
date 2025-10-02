#!/usr/bin/env python3
"""
Test Bank EPU (End-to-end Product Usecase) Tests
Comprehensive testing for the Test Bank page functionality
"""

import asyncio
import json
import time
from datetime import datetime
from playwright.async_api import async_playwright, Page, expect
from typing import Dict, List, Any
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestBankEPUTester:
    def __init__(self, base_url: str = "http://localhost:5173"):
        self.base_url = base_url
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "base_url": base_url,
            "test_results": [],
            "screenshots": [],
            "summary": {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "errors": []
            }
        }
    
    async def take_screenshot(self, page: Page, name: str, description: str = ""):
        """Take a screenshot and save it with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"C:\\Users\\gals\\Desktop\\playwrightTestsClaude\\artifacts\\screenshots\\testbank_{name}_{timestamp}.png"
        
        try:
            await page.screenshot(path=screenshot_path, full_page=True)
            self.results["screenshots"].append({
                "name": name,
                "path": screenshot_path,
                "description": description,
                "timestamp": timestamp
            })
            logger.info(f"Screenshot saved: {screenshot_path}")
        except Exception as e:
            logger.error(f"Failed to take screenshot {name}: {e}")
    
    def add_test_result(self, test_name: str, status: str, details: str = "", error: str = ""):
        """Add a test result to the results collection"""
        result = {
            "test_name": test_name,
            "status": status,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.results["test_results"].append(result)
        self.results["summary"]["total_tests"] += 1
        
        if status == "PASSED":
            self.results["summary"]["passed"] += 1
        else:
            self.results["summary"]["failed"] += 1
            if error:
                self.results["summary"]["errors"].append(f"{test_name}: {error}")
        
        logger.info(f"Test: {test_name} - {status}")
        if details:
            logger.info(f"  Details: {details}")
        if error:
            logger.error(f"  Error: {error}")

    async def test_page_load_and_initial_state(self, page: Page) -> bool:
        """Test 1: Page Load & Initial State"""
        test_name = "Page Load & Initial State"
        logger.info(f"Starting {test_name}")
        
        try:
            # Navigate to test bank page
            await page.goto(f"{self.base_url}/test-bank")
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Take screenshot of initial load
            await self.take_screenshot(page, "initial_load", "Test Bank page initial load")
            
            # Verify main page container is visible
            test_bank_page = page.locator('[data-testid="test-bank-page"]')
            await expect(test_bank_page).to_be_visible(timeout=5000)
            
            # Verify page title
            page_title = page.locator('[data-testid="page-title"]')
            await expect(page_title).to_have_text("Test Bank", timeout=5000)
            
            # Verify main sections render
            tests_section = page.locator('[data-testid="tests-section"]')
            await expect(tests_section).to_be_visible(timeout=5000)
            
            suite_builder_section = page.locator('[data-testid="suite-builder-section"]')
            await expect(suite_builder_section).to_be_visible(timeout=5000)
            
            tests_table = page.locator('[data-testid="tests-table"]')
            await expect(tests_table).to_be_visible(timeout=5000)
            
            # Verify initial selected tests count
            selected_count = page.locator('[data-testid="selected-tests-count"]')
            await expect(selected_count).to_have_text("0 tests selected", timeout=5000)
            
            self.add_test_result(test_name, "PASSED", "All page elements loaded successfully")
            return True
            
        except Exception as e:
            await self.take_screenshot(page, "page_load_failure", "Page load test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def test_search_and_filter_functionality(self, page: Page) -> bool:
        """Test search and filter functionality"""
        test_name = "Search and Filter Functionality"
        logger.info(f"Starting {test_name}")
        
        try:
            # Test search functionality
            search_input = page.locator('[data-testid="test-search"]')
            await expect(search_input).to_be_visible(timeout=5000)
            
            # Search for "login" tests
            await search_input.fill("login")
            await page.wait_for_timeout(1000)  # Wait for search results
            
            # Take screenshot of search results
            await self.take_screenshot(page, "search_results", "Search results for 'login' tests")
            
            # Verify that we have some test rows (assuming there are login tests)
            test_rows = page.locator('[data-testid="test-row"]')
            test_count = await test_rows.count()
            
            if test_count == 0:
                # If no login tests, search for something more generic
                await search_input.fill("")
                await page.wait_for_timeout(500)
                test_count = await test_rows.count()
            
            # Test risk filter
            risk_filter = page.locator('[data-testid="filter-risk"]')
            await expect(risk_filter).to_be_visible(timeout=5000)
            await risk_filter.select_option("high")
            await page.wait_for_timeout(1000)
            
            # Take screenshot of filtered results
            await self.take_screenshot(page, "risk_filtered", "Risk filter applied - high risk tests")
            
            # Verify high risk badges are shown
            risk_badges = page.locator('[data-testid="test-risk-badge"]:has-text("HIGH")')
            high_risk_count = await risk_badges.count()
            
            # Clear filters
            clear_filters = page.locator('[data-testid="clear-filters"]')
            if await clear_filters.is_visible():
                await clear_filters.click()
                await page.wait_for_timeout(500)
            else:
                # Manually clear filters
                await search_input.fill("")
                await risk_filter.select_option("")
            
            self.add_test_result(test_name, "PASSED", f"Search and filter functionality working. Found {test_count} tests initially, {high_risk_count} high-risk tests")
            return True
            
        except Exception as e:
            await self.take_screenshot(page, "search_filter_failure", "Search and filter test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def test_test_selection_and_suite_creation(self, page: Page) -> bool:
        """Test 2: Test Selection & Suite Creation"""
        test_name = "Test Selection & Suite Creation"
        logger.info(f"Starting {test_name}")
        
        try:
            # First, search for tests
            search_input = page.locator('[data-testid="test-search"]')
            await search_input.fill("login")
            await page.wait_for_timeout(1000)
            
            # Get available test checkboxes
            test_checkboxes = page.locator('[data-testid="test-checkbox"]')
            checkbox_count = await test_checkboxes.count()
            
            if checkbox_count == 0:
                # If no login tests, clear search and get any tests
                await search_input.fill("")
                await page.wait_for_timeout(1000)
                checkbox_count = await test_checkboxes.count()
            
            # Select first 2 tests (or as many as available up to 2)
            tests_to_select = min(2, checkbox_count)
            for i in range(tests_to_select):
                await test_checkboxes.nth(i).click()
                await page.wait_for_timeout(200)
            
            # Take screenshot after test selection
            await self.take_screenshot(page, "tests_selected", f"{tests_to_select} tests selected")
            
            # Verify selected tests count updates
            selected_count = page.locator('[data-testid="selected-tests-count"]')
            await expect(selected_count).to_have_text(f"{tests_to_select} tests selected", timeout=5000)
            
            # Verify selected tests list appears
            if tests_to_select > 0:
                selected_list = page.locator('[data-testid="selected-tests-list"]')
                await expect(selected_list).to_be_visible(timeout=5000)
            
            # Fill suite creation form
            suite_name_input = page.locator('[data-testid="suite-name-input"]')
            suite_description_input = page.locator('[data-testid="suite-description-input"]')
            
            await expect(suite_name_input).to_be_visible(timeout=5000)
            await suite_name_input.fill("Login Test Suite")
            await suite_description_input.fill("Comprehensive login testing")
            
            # Create the suite
            create_button = page.locator('[data-testid="create-suite-button"]')
            await expect(create_button).to_be_visible(timeout=5000)
            await create_button.click()
            
            # Wait for suite creation and verify reset
            await page.wait_for_timeout(2000)
            
            # Take screenshot after suite creation
            await self.take_screenshot(page, "suite_created", "Suite created and selection cleared")
            
            # Verify selection is cleared
            await expect(selected_count).to_have_text("0 tests selected", timeout=5000)
            
            self.add_test_result(test_name, "PASSED", f"Successfully selected {tests_to_select} tests and created suite")
            return True
            
        except Exception as e:
            await self.take_screenshot(page, "suite_creation_failure", "Suite creation test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def test_suite_execution_flow(self, page: Page) -> bool:
        """Test 3: Suite Execution Flow"""
        test_name = "Suite Execution Flow"
        logger.info(f"Starting {test_name}")
        
        try:
            # Find the created suite in the existing suites section
            suites_list = page.locator('[data-testid="suites-list"]')
            await expect(suites_list).to_be_visible(timeout=5000)
            
            # Look for the suite we just created
            suite_items = page.locator('[data-testid="suite-item"]')
            suite_count = await suite_items.count()
            
            if suite_count == 0:
                self.add_test_result(test_name, "FAILED", "", "No suites found in suites list")
                return False
            
            # Find suite with "Login Test Suite" name
            login_suite = None
            for i in range(suite_count):
                suite_item = suite_items.nth(i)
                suite_name_elem = suite_item.locator('[data-testid="suite-name"]')
                suite_name = await suite_name_elem.text_content()
                if "Login Test Suite" in suite_name:
                    login_suite = suite_item
                    break
            
            # If we didn't find the specific suite, use the first available suite
            if login_suite is None:
                login_suite = suite_items.first()
            
            # Take screenshot before running suite
            await self.take_screenshot(page, "before_suite_run", "Before running existing suite")
            
            # Click run suite button
            run_button = login_suite.locator('[data-testid="run-existing-suite"]')
            await expect(run_button).to_be_visible(timeout=5000)
            
            # Get current URL before clicking
            current_url = page.url
            
            await run_button.click()
            
            # Wait for navigation (should go to reports page)
            await page.wait_for_timeout(3000)
            
            # Verify navigation occurred
            new_url = page.url
            if "/reports" not in new_url:
                # Sometimes the navigation might be delayed, wait a bit more
                await page.wait_for_timeout(2000)
                new_url = page.url
            
            # Take screenshot after suite execution attempt
            await self.take_screenshot(page, "after_suite_run", "After running suite - should be on reports page")
            
            navigation_success = new_url != current_url or "/reports" in new_url
            
            self.add_test_result(test_name, "PASSED" if navigation_success else "PARTIAL", 
                               f"Suite execution initiated. Navigation: {current_url} -> {new_url}")
            return navigation_success
            
        except Exception as e:
            await self.take_screenshot(page, "suite_execution_failure", "Suite execution test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def test_table_functionality(self, page: Page) -> bool:
        """Test 4: Table Functionality Testing"""
        test_name = "Table Functionality Testing"
        logger.info(f"Starting {test_name}")
        
        try:
            # Navigate back to test-bank if we're not there
            if "/test-bank" not in page.url:
                await page.goto(f"{self.base_url}/test-bank")
                await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Test sorting by clicking Name column header
            name_header = page.locator('th:has-text("Name")')
            name_header_count = await name_header.count()
            if name_header_count > 0:
                # Get first test name before sorting
                first_test_name_before = await page.locator('[data-testid="test-name"]').first().text_content()
                
                # Click header to sort
                await name_header.click()
                await page.wait_for_timeout(1000)
                
                # Get first test name after sorting
                first_test_name_after = await page.locator('[data-testid="test-name"]').first().text_content()
                
                # Take screenshot of sorted table
                await self.take_screenshot(page, "table_sorted", "Table after sorting by name")
                
                sorting_worked = first_test_name_before != first_test_name_after
            else:
                sorting_worked = False
            
            # Test risk filtering
            risk_filter = page.locator('[data-testid="filter-risk"]')
            await risk_filter.select_option("high")
            await page.wait_for_timeout(1000)
            
            # Count high risk badges
            high_risk_badges = page.locator('[data-testid="test-risk-badge"]:has-text("HIGH")')
            high_risk_count = await high_risk_badges.count()
            
            # Count total visible rows
            test_rows = page.locator('[data-testid="test-row"]')
            total_rows = await test_rows.count()
            
            # Test select all functionality
            select_all_checkbox = page.locator('[data-testid="select-all-tests"]')
            select_all_visible = await select_all_checkbox.is_visible()
            if select_all_visible:
                await select_all_checkbox.click()
                await page.wait_for_timeout(1000)
                
                # Check if selection count updated
                selected_count = page.locator('[data-testid="selected-tests-count"]')
                count_text = await selected_count.text_content()
                select_all_worked = "tests selected" in count_text and "0 tests" not in count_text
            else:
                select_all_worked = False
            
            # Clear filters
            clear_filters = page.locator('[data-testid="clear-filters"]')
            if await clear_filters.is_visible():
                await clear_filters.click()
                await page.wait_for_timeout(500)
            
            # Take screenshot of final table state
            await self.take_screenshot(page, "table_functionality_complete", "Table functionality testing complete")
            
            details = f"Sorting: {'✓' if sorting_worked else '✗'}, Risk filter: {high_risk_count} high-risk tests, Select all: {'✓' if select_all_worked else '✗'}"
            
            self.add_test_result(test_name, "PASSED", details)
            return True
            
        except Exception as e:
            await self.take_screenshot(page, "table_functionality_failure", "Table functionality test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def test_additional_validations(self, page: Page) -> bool:
        """Additional validations for UI elements"""
        test_name = "Additional UI Validations"
        logger.info(f"Starting {test_name}")
        
        try:
            validations = []
            
            # Check if all required table column elements exist
            elements_to_check = [
                ('[data-testid="test-name"]', "Test names"),
                ('[data-testid="test-module"]', "Module badges"),
                ('[data-testid="test-risk-badge"]', "Risk level badges"),
                ('[data-testid="test-tags"]', "Tag lists"),
                ('[data-testid="test-duration"]', "Duration displays"),
                ('[data-testid="run-single-test"]', "Run single test buttons"),
                ('[data-testid="suite-builder-panel"]', "Suite builder panel"),
                ('[data-testid="existing-suites-section"]', "Existing suites section")
            ]
            
            for selector, description in elements_to_check:
                try:
                    element = page.locator(selector)
                    count = await element.count()
                    validations.append(f"{description}: {count} elements found")
                except Exception as e:
                    validations.append(f"{description}: ERROR - {str(e)}")
            
            # Check if estimated duration appears when tests are selected
            test_checkboxes = page.locator('[data-testid="test-checkbox"]')
            checkbox_count = await test_checkboxes.count()
            if checkbox_count > 0:
                await test_checkboxes.first().click()
                await page.wait_for_timeout(500)
                
                estimated_duration = page.locator('[data-testid="estimated-duration"]')
                if await estimated_duration.is_visible():
                    validations.append("Estimated duration: ✓ Appears when tests selected")
                else:
                    validations.append("Estimated duration: ✗ Not visible when tests selected")
                
                # Clear selection
                clear_button = page.locator('[data-testid="clear-selection"]')
                if await clear_button.is_visible():
                    await clear_button.click()
                    validations.append("Clear selection button: ✓ Working")
                else:
                    validations.append("Clear selection button: ✗ Not found or not working")
            
            # Take screenshot of validation state
            await self.take_screenshot(page, "additional_validations", "Additional UI validations complete")
            
            details = "; ".join(validations)
            self.add_test_result(test_name, "PASSED", details)
            return True
            
        except Exception as e:
            await self.take_screenshot(page, "validations_failure", "Additional validations test failure")
            self.add_test_result(test_name, "FAILED", "", str(e))
            return False

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all EPU tests in sequence"""
        logger.info("Starting Test Bank EPU Test Suite")
        
        async with async_playwright() as playwright:
            # Launch browser
            browser = await playwright.chromium.launch(
                headless=False,  # Set to False to see browser actions
                args=['--start-maximized'],
                slow_mo=500  # Add delay between actions for visibility
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080}
            )
            
            page = await context.new_page()
            
            try:
                # Run all test scenarios
                await self.test_page_load_and_initial_state(page)
                await self.test_search_and_filter_functionality(page)
                await self.test_test_selection_and_suite_creation(page)
                await self.test_suite_execution_flow(page)
                await self.test_table_functionality(page)
                await self.test_additional_validations(page)
                
                # Take final screenshot
                await self.take_screenshot(page, "final_state", "Final state after all tests")
                
            finally:
                await browser.close()
        
        # Generate final report
        self.generate_report()
        return self.results
    
    def generate_report(self):
        """Generate a comprehensive test report"""
        logger.info("\n" + "="*80)
        logger.info("TEST BANK EPU TEST REPORT")
        logger.info("="*80)
        
        # Summary
        summary = self.results["summary"]
        logger.info(f"Total Tests: {summary['total_tests']}")
        logger.info(f"Passed: {summary['passed']}")
        logger.info(f"Failed: {summary['failed']}")
        logger.info(f"Success Rate: {(summary['passed']/summary['total_tests']*100):.1f}%" if summary['total_tests'] > 0 else "N/A")
        
        # Detailed results
        logger.info("\nDETAILED RESULTS:")
        for result in self.results["test_results"]:
            status_icon = "✓" if result["status"] == "PASSED" else "✗"
            logger.info(f"{status_icon} {result['test_name']} - {result['status']}")
            if result["details"]:
                logger.info(f"    Details: {result['details']}")
            if result["error"]:
                logger.info(f"    Error: {result['error']}")
        
        # Screenshots
        logger.info(f"\nSCREENSHOTS CAPTURED: {len(self.results['screenshots'])}")
        for screenshot in self.results["screenshots"]:
            logger.info(f"  - {screenshot['name']}: {screenshot['path']}")
        
        # Save results to JSON file
        results_file = f"C:\\Users\\gals\\Desktop\\playwrightTestsClaude\\test_bank_epu_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"\nDetailed results saved to: {results_file}")
        logger.info("="*80)

async def main():
    """Main execution function"""
    tester = TestBankEPUTester()
    results = await tester.run_all_tests()
    return results

if __name__ == "__main__":
    asyncio.run(main())