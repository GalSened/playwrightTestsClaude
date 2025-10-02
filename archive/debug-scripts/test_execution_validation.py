"""
Test Execution Validation for QA Intelligence System
Validates both single test execution and test suite execution from UI
Ensures single tests run only once and test suites execute completely
"""

import asyncio
import json
import time
import requests
from datetime import datetime, timedelta
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import logging
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TestExecutionValidator:
    def __init__(self, base_url: str = "http://localhost:3000", api_url: str = "http://localhost:8081"):
        self.base_url = base_url
        self.api_url = api_url
        self.browser = None
        self.context = None
        self.page = None
        self.validation_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": base_url,
            "api_url": api_url,
            "single_test_executions": [],
            "test_suite_executions": [],
            "execution_artifacts": [],
            "issues_found": [],
            "summary": {}
        }

    async def setup(self):
        """Initialize browser and context"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False, args=['--start-maximized'])
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="QA Intelligence Test Execution Validator"
        )
        self.page = await self.context.new_page()
        
        # Enable request/response logging for test execution monitoring
        self.page.on("request", self._log_request)
        self.page.on("response", self._log_response)
        
        logger.info("Browser setup completed for test execution validation")

    def _log_request(self, request):
        if "/api/execute" in request.url or "/api/test" in request.url:
            logger.info(f"TEST EXECUTION REQUEST: {request.method} {request.url}")

    def _log_response(self, response):
        if "/api/execute" in response.url or "/api/test" in response.url:
            logger.info(f"TEST EXECUTION RESPONSE: {response.status} {response.url}")

    async def teardown(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()
        logger.info("Browser teardown completed")

    async def take_screenshot(self, name: str):
        """Take a screenshot for documentation"""
        filename = f"test_execution_{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        await self.page.screenshot(path=filename, full_page=True)
        logger.info(f"Screenshot saved: {filename}")
        return filename

    async def wait_for_loading(self, timeout: int = 30000):
        """Wait for page loading to complete"""
        try:
            await self.page.wait_for_load_state('networkidle', timeout=timeout)
            
            # Wait for any loading spinners
            loading_selectors = [
                '[data-testid="loading"]',
                '.loading',
                '.spinner',
                '[role="progressbar"]',
                '.test-executing',
                '.execution-in-progress'
            ]
            
            for selector in loading_selectors:
                try:
                    await self.page.wait_for_selector(selector, state='detached', timeout=2000)
                except:
                    pass
                    
        except Exception as e:
            logger.warning(f"Loading wait timeout: {e}")

    def get_available_tests_api(self) -> List[Dict]:
        """Get available tests from backend API"""
        try:
            response = requests.get(f"{self.api_url}/api/tests", timeout=10)
            if response.status_code == 200:
                tests = response.json()
                logger.info(f"Found {len(tests)} tests via API")
                return tests
            else:
                logger.warning(f"API call failed: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching tests from API: {e}")
            return []

    def get_test_suites_api(self) -> List[Dict]:
        """Get available test suites from backend API"""
        try:
            response = requests.get(f"{self.api_url}/api/test-suites", timeout=10)
            if response.status_code == 200:
                suites = response.json()
                logger.info(f"Found {len(suites)} test suites via API")
                return suites
            else:
                logger.warning(f"Test suites API call failed: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error fetching test suites from API: {e}")
            return []

    async def navigate_to_test_bank(self):
        """Navigate to Test Bank page and wait for loading"""
        logger.info("Navigating to Test Bank...")
        await self.page.goto(f"{self.base_url}/test-bank")
        await self.wait_for_loading()
        await self.take_screenshot("test_bank_loaded")

    async def find_runnable_tests(self) -> List[Dict]:
        """Find tests that can be executed from the UI"""
        tests = []
        
        # Look for test items with run buttons
        test_selectors = [
            '[data-testid="test-item"]',
            '.test-item',
            '.test-card',
            '.test-row',
            'tr[data-test-id]'
        ]
        
        for selector in test_selectors:
            try:
                test_elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(test_elements[:5]):  # Limit to first 5 for testing
                    try:
                        # Look for run button within the test element
                        run_button = await element.query_selector('button:has-text("Run"), button:has-text("Execute"), [data-testid="run-test"]')
                        if run_button:
                            test_name = await element.text_content()
                            tests.append({
                                'element': element,
                                'run_button': run_button,
                                'name': test_name.strip()[:100] if test_name else f"Test {i+1}",
                                'selector': selector
                            })
                            logger.info(f"Found runnable test: {tests[-1]['name']}")
                    except Exception as e:
                        logger.debug(f"Error checking test element {i}: {e}")
            except Exception as e:
                logger.debug(f"No elements found for selector {selector}: {e}")
        
        logger.info(f"Total runnable tests found: {len(tests)}")
        return tests

    async def execute_single_test(self, test: Dict) -> Dict:
        """Execute a single test and validate it runs only once"""
        logger.info(f"Executing single test: {test['name']}")
        
        execution_result = {
            "test_name": test['name'],
            "start_time": datetime.now().isoformat(),
            "execution_count": 0,
            "duration": None,
            "status": "unknown",
            "artifacts": [],
            "issues": [],
            "screenshots": []
        }

        try:
            # Take screenshot before execution
            screenshot = await self.take_screenshot("before_single_test_execution")
            execution_result["screenshots"].append(screenshot)
            
            # Monitor network requests for test execution
            execution_requests = []
            
            def track_execution_requests(request):
                if any(path in request.url for path in ['/api/execute', '/api/test/run', '/api/playwright']):
                    execution_requests.append({
                        'url': request.url,
                        'method': request.method,
                        'timestamp': datetime.now().isoformat()
                    })
                    logger.info(f"Test execution request: {request.method} {request.url}")
            
            self.page.on("request", track_execution_requests)
            
            start_time = time.time()
            
            # Click the run button
            await test['run_button'].click()
            logger.info("Clicked run button for single test")
            
            # Wait for execution to start
            await self.wait_for_loading(timeout=10000)
            
            # Look for execution status indicators
            status_indicators = [
                '[data-testid="test-running"]',
                '[data-testid="test-status"]',
                '.test-executing',
                '.test-completed',
                '.test-failed',
                '.execution-status'
            ]
            
            execution_detected = False
            for indicator in status_indicators:
                try:
                    status_element = await self.page.wait_for_selector(indicator, timeout=5000)
                    if status_element:
                        status_text = await status_element.text_content()
                        logger.info(f"Execution status: {status_text}")
                        execution_detected = True
                        break
                except:
                    continue
            
            if not execution_detected:
                logger.warning("No execution status indicators found")
            
            # Wait for execution completion (max 60 seconds for single test)
            completion_timeout = 60000
            try:
                # Wait for either success or failure indicators
                await self.page.wait_for_selector(
                    '.test-completed, .test-passed, .test-failed, [data-testid="execution-complete"]',
                    timeout=completion_timeout
                )
                execution_result["status"] = "completed"
                logger.info("Test execution completed")
            except:
                logger.warning("Test execution timeout or completion not detected")
                execution_result["status"] = "timeout"
            
            end_time = time.time()
            execution_result["duration"] = end_time - start_time
            execution_result["execution_count"] = len(execution_requests)
            
            # Validate single execution (should be exactly 1 execution request)
            if len(execution_requests) == 0:
                execution_result["issues"].append({
                    "type": "no_execution_detected",
                    "message": "No test execution API calls detected"
                })
            elif len(execution_requests) == 1:
                execution_result["status"] = "success_single_execution"
                logger.info("✅ Single test executed exactly once as expected")
            elif len(execution_requests) > 1:
                execution_result["issues"].append({
                    "type": "multiple_executions",
                    "message": f"Test executed {len(execution_requests)} times, should be exactly 1",
                    "executions": execution_requests
                })
                logger.warning(f"❌ Test executed {len(execution_requests)} times instead of once")
            
            # Take screenshot after execution
            screenshot = await self.take_screenshot("after_single_test_execution")
            execution_result["screenshots"].append(screenshot)
            
            # Clean up event listener
            self.page.remove_listener("request", track_execution_requests)
            
        except Exception as e:
            execution_result["issues"].append({
                "type": "execution_error",
                "message": str(e)
            })
            logger.error(f"Error during single test execution: {e}")
        
        execution_result["end_time"] = datetime.now().isoformat()
        self.validation_results["single_test_executions"].append(execution_result)
        return execution_result

    async def find_test_suites(self) -> List[Dict]:
        """Find test suites that can be executed"""
        suites = []
        
        # Look for test suite elements
        suite_selectors = [
            '[data-testid="test-suite"]',
            '.test-suite',
            '.test-suite-card',
            '.suite-item',
            '[data-suite-id]'
        ]
        
        for selector in suite_selectors:
            try:
                suite_elements = await self.page.query_selector_all(selector)
                for i, element in enumerate(suite_elements[:3]):  # Limit to first 3 for testing
                    try:
                        # Look for suite run button
                        run_button = await element.query_selector('button:has-text("Run Suite"), button:has-text("Execute Suite"), [data-testid="run-suite"]')
                        if run_button:
                            suite_name = await element.text_content()
                            suites.append({
                                'element': element,
                                'run_button': run_button,
                                'name': suite_name.strip()[:100] if suite_name else f"Suite {i+1}",
                                'selector': selector
                            })
                            logger.info(f"Found runnable test suite: {suites[-1]['name']}")
                    except Exception as e:
                        logger.debug(f"Error checking suite element {i}: {e}")
            except Exception as e:
                logger.debug(f"No suite elements found for selector {selector}: {e}")
        
        logger.info(f"Total runnable test suites found: {len(suites)}")
        return suites

    async def execute_test_suite(self, suite: Dict) -> Dict:
        """Execute a test suite and validate complete execution"""
        logger.info(f"Executing test suite: {suite['name']}")
        
        execution_result = {
            "suite_name": suite['name'],
            "start_time": datetime.now().isoformat(),
            "total_tests": 0,
            "executed_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "duration": None,
            "status": "unknown",
            "artifacts": [],
            "issues": [],
            "screenshots": []
        }

        try:
            # Take screenshot before execution
            screenshot = await self.take_screenshot("before_suite_execution")
            execution_result["screenshots"].append(screenshot)
            
            # Monitor suite execution
            suite_requests = []
            
            def track_suite_requests(request):
                if any(path in request.url for path in ['/api/execute/suite', '/api/test-suite/run', '/api/suite']):
                    suite_requests.append({
                        'url': request.url,
                        'method': request.method,
                        'timestamp': datetime.now().isoformat()
                    })
                    logger.info(f"Suite execution request: {request.method} {request.url}")
            
            self.page.on("request", track_suite_requests)
            
            start_time = time.time()
            
            # Click the suite run button
            await suite['run_button'].click()
            logger.info("Clicked run button for test suite")
            
            # Wait for suite execution to start
            await self.wait_for_loading(timeout=15000)
            
            # Look for suite execution progress indicators
            progress_selectors = [
                '[data-testid="suite-progress"]',
                '.suite-execution-progress',
                '.progress-bar',
                '[role="progressbar"]'
            ]
            
            progress_detected = False
            for selector in progress_selectors:
                try:
                    progress_element = await self.page.wait_for_selector(selector, timeout=10000)
                    if progress_element:
                        logger.info("Suite execution progress detected")
                        progress_detected = True
                        break
                except:
                    continue
            
            # Wait for suite completion (max 300 seconds for suite)
            completion_timeout = 300000
            try:
                # Wait for suite completion indicators
                await self.page.wait_for_selector(
                    '.suite-completed, .suite-finished, [data-testid="suite-complete"]',
                    timeout=completion_timeout
                )
                execution_result["status"] = "completed"
                logger.info("Test suite execution completed")
            except:
                logger.warning("Test suite execution timeout")
                execution_result["status"] = "timeout"
            
            end_time = time.time()
            execution_result["duration"] = end_time - start_time
            
            # Try to extract test results from UI
            try:
                # Look for test results summary
                results_selectors = [
                    '[data-testid="test-results"]',
                    '.test-results',
                    '.suite-results',
                    '.execution-summary'
                ]
                
                for selector in results_selectors:
                    results_element = await self.page.query_selector(selector)
                    if results_element:
                        results_text = await results_element.text_content()
                        logger.info(f"Test results found: {results_text}")
                        
                        # Try to parse numbers from results text
                        import re
                        numbers = re.findall(r'\d+', results_text)
                        if len(numbers) >= 3:
                            execution_result["total_tests"] = int(numbers[0])
                            execution_result["passed_tests"] = int(numbers[1])
                            execution_result["failed_tests"] = int(numbers[2])
                        break
                        
            except Exception as e:
                logger.debug(f"Could not extract test results: {e}")
            
            # Validate suite execution
            if len(suite_requests) == 0:
                execution_result["issues"].append({
                    "type": "no_suite_execution",
                    "message": "No test suite execution API calls detected"
                })
            else:
                execution_result["executed_tests"] = len(suite_requests)
                logger.info(f"✅ Test suite executed with {len(suite_requests)} API calls")
            
            # Take screenshot after execution
            screenshot = await self.take_screenshot("after_suite_execution")
            execution_result["screenshots"].append(screenshot)
            
            # Clean up event listener
            self.page.remove_listener("request", track_suite_requests)
            
        except Exception as e:
            execution_result["issues"].append({
                "type": "suite_execution_error",
                "message": str(e)
            })
            logger.error(f"Error during test suite execution: {e}")
        
        execution_result["end_time"] = datetime.now().isoformat()
        self.validation_results["test_suite_executions"].append(execution_result)
        return execution_result

    async def validate_test_executions(self) -> Dict:
        """Main validation function for test executions"""
        logger.info("Starting test execution validation...")
        
        try:
            # Navigate to Test Bank
            await self.navigate_to_test_bank()
            
            # Find and validate single test execution
            logger.info("=== SINGLE TEST EXECUTION VALIDATION ===")
            runnable_tests = await self.find_runnable_tests()
            
            if runnable_tests:
                # Execute first available test
                single_test_result = await self.execute_single_test(runnable_tests[0])
                logger.info(f"Single test validation: {single_test_result['status']}")
            else:
                logger.warning("No runnable individual tests found in UI")
                self.validation_results["issues"].append({
                    "type": "no_runnable_tests",
                    "message": "No individual tests found with run buttons in the UI"
                })
            
            # Find and validate test suite execution
            logger.info("=== TEST SUITE EXECUTION VALIDATION ===")
            runnable_suites = await self.find_test_suites()
            
            if runnable_suites:
                # Execute first available suite
                suite_result = await self.execute_test_suite(runnable_suites[0])
                logger.info(f"Test suite validation: {suite_result['status']}")
            else:
                logger.warning("No runnable test suites found in UI")
                self.validation_results["issues"].append({
                    "type": "no_runnable_suites",
                    "message": "No test suites found with run buttons in the UI"
                })
            
            # Generate summary
            self.generate_summary()
            
        except Exception as e:
            logger.error(f"Test execution validation failed: {e}")
            self.validation_results["issues"].append({
                "type": "validation_error",
                "message": str(e)
            })
        
        return self.validation_results

    def generate_summary(self):
        """Generate validation summary"""
        single_executions = len(self.validation_results["single_test_executions"])
        suite_executions = len(self.validation_results["test_suite_executions"])
        total_issues = len(self.validation_results["issues"])
        
        # Count successful single executions (exactly 1 run)
        successful_single = sum(1 for exec in self.validation_results["single_test_executions"] 
                              if exec.get("status") == "success_single_execution")
        
        # Count successful suite executions  
        successful_suites = sum(1 for exec in self.validation_results["test_suite_executions"]
                               if exec.get("status") == "completed")
        
        self.validation_results["summary"] = {
            "single_tests_attempted": single_executions,
            "single_tests_successful": successful_single,
            "suites_attempted": suite_executions,
            "suites_successful": successful_suites,
            "total_issues": total_issues,
            "single_execution_validated": successful_single > 0,
            "suite_execution_validated": successful_suites > 0,
            "overall_status": "PASS" if (successful_single > 0 and successful_suites > 0 and total_issues == 0) else "ISSUES_FOUND"
        }

    def save_results(self):
        """Save validation results to file"""
        filename = f"test_execution_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.validation_results, f, indent=2, ensure_ascii=False)
        logger.info(f"Test execution validation results saved to: {filename}")
        return filename

async def main():
    """Main execution function"""
    validator = TestExecutionValidator()
    
    try:
        await validator.setup()
        results = await validator.validate_test_executions()
        results_file = validator.save_results()
        
        # Print summary
        print("\n" + "="*80)
        print("TEST EXECUTION VALIDATION RESULTS")
        print("="*80)
        print(f"Overall Status: {results['summary']['overall_status']}")
        print(f"Single Tests Attempted: {results['summary']['single_tests_attempted']}")
        print(f"Single Tests Successful (1x execution): {results['summary']['single_tests_successful']}")
        print(f"Test Suites Attempted: {results['summary']['suites_attempted']}")
        print(f"Test Suites Successful: {results['summary']['suites_successful']}")
        print(f"Total Issues: {results['summary']['total_issues']}")
        
        if results['summary']['single_execution_validated']:
            print("✅ Single test execution validated (runs exactly once)")
        else:
            print("❌ Single test execution validation failed")
            
        if results['summary']['suite_execution_validated']:
            print("✅ Test suite execution validated")
        else:
            print("❌ Test suite execution validation failed")
        
        if results['issues']:
            print("\n⚠️  ISSUES FOUND:")
            for issue in results['issues']:
                print(f"  - {issue.get('type', 'Unknown')}: {issue.get('message', 'No message')}")
        
        print(f"\n📄 Detailed results saved to: {results_file}")
        print("="*80)
        
    except Exception as e:
        print(f"Validation failed: {e}")
    finally:
        await validator.teardown()

if __name__ == "__main__":
    asyncio.run(main())