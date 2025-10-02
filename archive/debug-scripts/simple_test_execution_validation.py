"""
Simple Test Execution Validation for QA Intelligence System
Focused validation of test execution capabilities from UI
"""

import asyncio
import json
import time
import requests
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleTestExecutionValidator:
    def __init__(self, base_url: str = "http://localhost:3000", api_url: str = "http://localhost:8081"):
        self.base_url = base_url
        self.api_url = api_url
        self.browser = None
        self.page = None
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "api_tests_found": False,
            "ui_tests_found": False,
            "single_test_execution": {"attempted": False, "successful": False, "run_count": 0},
            "suite_execution": {"attempted": False, "successful": False, "tests_found": 0},
            "issues": [],
            "screenshots": []
        }

    async def setup(self):
        """Initialize browser"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        
        # Track test execution requests
        self.execution_requests = []
        self.page.on("request", self._track_requests)
        logger.info("Browser setup completed")

    def _track_requests(self, request):
        """Track API requests related to test execution"""
        if any(path in request.url for path in ['/execute', '/run', '/test']):
            self.execution_requests.append({
                'url': request.url,
                'method': request.method,
                'timestamp': datetime.now().isoformat()
            })
            logger.info(f"Test execution request: {request.method} {request.url}")

    async def teardown(self):
        """Clean up"""
        if self.browser:
            await self.browser.close()

    async def screenshot(self, name: str):
        """Take screenshot"""
        filename = f"validation_{name}_{datetime.now().strftime('%H%M%S')}.png"
        await self.page.screenshot(path=filename)
        self.results["screenshots"].append(filename)
        logger.info(f"Screenshot: {filename}")

    def check_api_tests(self):
        """Check if tests are available via API"""
        try:
            # Check main tests endpoint
            response = requests.get(f"{self.api_url}/api/tests/all", timeout=5)
            if response.status_code == 200:
                tests = response.json()
                self.results["api_tests_found"] = len(tests) > 0
                logger.info(f"API: Found {len(tests)} tests")
                return tests
            else:
                logger.warning(f"API tests endpoint returned: {response.status_code}")
        except Exception as e:
            logger.error(f"API check failed: {e}")
        
        self.results["api_tests_found"] = False
        return []

    async def check_ui_tests(self):
        """Check Test Bank UI for runnable tests"""
        logger.info("Checking UI for test execution capabilities...")
        
        # Navigate to Test Bank
        await self.page.goto(f"{self.base_url}/test-bank")
        await self.page.wait_for_load_state('networkidle')
        await self.screenshot("test_bank_page")
        
        # Look for any test-related buttons
        test_buttons = []
        button_selectors = [
            'button:has-text("Run")',
            'button:has-text("Execute")',
            'button:has-text("Test")',
            '[data-testid*="run"]',
            '[data-testid*="execute"]',
            '.run-button',
            '.execute-button'
        ]
        
        for selector in button_selectors:
            try:
                buttons = await self.page.query_selector_all(selector)
                for button in buttons:
                    text = await button.text_content()
                    if text and any(word in text.lower() for word in ['run', 'execute', 'test']):
                        test_buttons.append({
                            'element': button,
                            'text': text.strip(),
                            'selector': selector
                        })
                        logger.info(f"Found test button: '{text.strip()}'")
            except Exception as e:
                logger.debug(f"Selector {selector} failed: {e}")
        
        self.results["ui_tests_found"] = len(test_buttons) > 0
        logger.info(f"Found {len(test_buttons)} test execution buttons in UI")
        return test_buttons

    async def test_single_execution(self, test_buttons):
        """Test single test execution"""
        if not test_buttons:
            self.results["issues"].append("No test execution buttons found in UI")
            return False
        
        logger.info("Testing single test execution...")
        self.results["single_test_execution"]["attempted"] = True
        
        try:
            # Clear previous requests
            self.execution_requests.clear()
            
            # Click first available test button
            test_button = test_buttons[0]
            logger.info(f"Clicking button: {test_button['text']}")
            
            await test_button['element'].click()
            await self.screenshot("after_click")
            
            # Wait for potential execution
            await asyncio.sleep(5)
            await self.page.wait_for_load_state('networkidle', timeout=10000)
            
            # Check execution requests
            execution_count = len(self.execution_requests)
            self.results["single_test_execution"]["run_count"] = execution_count
            
            if execution_count == 1:
                self.results["single_test_execution"]["successful"] = True
                logger.info("✅ Single test executed exactly once")
                return True
            elif execution_count == 0:
                logger.warning("❌ No test execution detected")
                self.results["issues"].append("No test execution API calls detected after button click")
            else:
                logger.warning(f"❌ Test executed {execution_count} times instead of once")
                self.results["issues"].append(f"Test executed {execution_count} times, expected exactly 1")
                
        except Exception as e:
            logger.error(f"Single test execution failed: {e}")
            self.results["issues"].append(f"Single test execution error: {str(e)}")
        
        return False

    async def test_suite_execution(self, test_buttons):
        """Test suite execution if available"""
        logger.info("Looking for suite execution capabilities...")
        
        # Look for suite-specific buttons
        suite_buttons = [btn for btn in test_buttons if 'suite' in btn['text'].lower()]
        
        if suite_buttons:
            logger.info("Testing suite execution...")
            self.results["suite_execution"]["attempted"] = True
            
            try:
                # Clear previous requests
                self.execution_requests.clear()
                
                suite_button = suite_buttons[0]
                logger.info(f"Clicking suite button: {suite_button['text']}")
                
                await suite_button['element'].click()
                await self.screenshot("after_suite_click")
                
                # Wait longer for suite execution
                await asyncio.sleep(10)
                await self.page.wait_for_load_state('networkidle', timeout=30000)
                
                execution_count = len(self.execution_requests)
                self.results["suite_execution"]["tests_found"] = execution_count
                
                if execution_count > 0:
                    self.results["suite_execution"]["successful"] = True
                    logger.info(f"✅ Suite execution detected with {execution_count} test calls")
                    return True
                else:
                    logger.warning("❌ No suite execution detected")
                    self.results["issues"].append("No suite execution API calls detected")
                    
            except Exception as e:
                logger.error(f"Suite execution failed: {e}")
                self.results["issues"].append(f"Suite execution error: {str(e)}")
        else:
            logger.info("No suite execution buttons found")
            self.results["issues"].append("No test suite execution buttons found")
        
        return False

    async def validate_execution_capabilities(self):
        """Main validation function"""
        logger.info("Starting test execution validation...")
        
        try:
            await self.setup()
            
            # Check API for tests
            api_tests = self.check_api_tests()
            
            # Check UI for test buttons
            ui_buttons = await self.check_ui_tests()
            
            if not ui_buttons:
                logger.warning("No test execution buttons found in UI")
                self.results["issues"].append("No test execution interface found in UI")
                return self.results
            
            # Test single execution
            single_success = await self.test_single_execution(ui_buttons)
            
            # Test suite execution
            suite_success = await self.test_suite_execution(ui_buttons)
            
            # Final assessment
            if single_success:
                logger.info("✅ Single test execution validated")
            else:
                logger.warning("❌ Single test execution validation failed")
                
            if suite_success:
                logger.info("✅ Suite execution validated")
            else:
                logger.warning("❌ Suite execution validation failed or not available")
            
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            self.results["issues"].append(f"Validation error: {str(e)}")
        finally:
            await self.teardown()
        
        return self.results

    def save_results(self):
        """Save results to file"""
        filename = f"simple_execution_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        logger.info(f"Results saved to: {filename}")
        return filename

async def main():
    validator = SimpleTestExecutionValidator()
    results = await validator.validate_execution_capabilities()
    results_file = validator.save_results()
    
    print("\n" + "="*60)
    print("TEST EXECUTION VALIDATION RESULTS")
    print("="*60)
    print(f"API Tests Found: {results['api_tests_found']}")
    print(f"UI Test Buttons Found: {results['ui_tests_found']}")
    
    single = results['single_test_execution']
    print(f"\nSingle Test Execution:")
    print(f"  Attempted: {single['attempted']}")
    print(f"  Successful: {single['successful']}")
    print(f"  Run Count: {single['run_count']}")
    
    suite = results['suite_execution']
    print(f"\nSuite Execution:")
    print(f"  Attempted: {suite['attempted']}")
    print(f"  Successful: {suite['successful']}")
    print(f"  Tests Found: {suite['tests_found']}")
    
    if results['issues']:
        print(f"\n❌ Issues Found ({len(results['issues'])}):")
        for issue in results['issues']:
            print(f"  - {issue}")
    else:
        print(f"\n✅ No issues found")
    
    print(f"\nResults saved to: {results_file}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())