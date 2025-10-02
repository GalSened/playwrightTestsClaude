"""
Direct Test Execution Validation for WeSign Tests in QA Intelligence
Tests direct API calls and UI execution for WeSign test suites
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

class WeSignTestExecutionValidator:
    def __init__(self, base_url: str = "http://localhost:3000", api_url: str = "http://localhost:8081"):
        self.base_url = base_url
        self.api_url = api_url
        self.browser = None
        self.page = None

    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        logger.info("Browser setup completed")

    async def teardown(self):
        if self.browser:
            await self.browser.close()

    def test_api_endpoints(self):
        """Test all available API endpoints for WeSign test execution"""
        logger.info("Testing API endpoints for WeSign test execution...")
        
        endpoints_to_test = [
            "/api/tests/all",
            "/api/tests/wesign",
            "/api/execute/test",
            "/api/execute/suite", 
            "/api/test-runner/execute",
            "/api/playwright/run",
            "/api/tests/run",
            "/api/schedules",
            "/api/test-suites"
        ]
        
        available_endpoints = []
        
        for endpoint in endpoints_to_test:
            try:
                url = f"{self.api_url}{endpoint}"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 200:
                    logger.info(f"✅ {endpoint} - Available (200)")
                    data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                    available_endpoints.append({
                        "endpoint": endpoint,
                        "status": 200,
                        "data_type": type(data).__name__,
                        "data_sample": str(data)[:200] if isinstance(data, (dict, list)) else data[:200]
                    })
                elif response.status_code == 404:
                    logger.info(f"❌ {endpoint} - Not Found (404)")
                else:
                    logger.info(f"⚠️  {endpoint} - Status: {response.status_code}")
                    available_endpoints.append({
                        "endpoint": endpoint,
                        "status": response.status_code,
                        "message": response.text[:200]
                    })
                    
            except Exception as e:
                logger.debug(f"❌ {endpoint} - Error: {e}")
        
        return available_endpoints

    def test_direct_execution_api(self):
        """Test direct test execution via API"""
        logger.info("Testing direct WeSign test execution via API...")
        
        execution_results = []
        
        # Try to execute a single WeSign test directly
        execution_endpoints = [
            "/api/execute/test",
            "/api/tests/run",
            "/api/playwright/execute"
        ]
        
        test_payload = {
            "test_name": "wesign_login_test",
            "test_file": "test_login_positive.py",
            "suite": "auth",
            "single_run": True
        }
        
        for endpoint in execution_endpoints:
            try:
                url = f"{self.api_url}{endpoint}"
                logger.info(f"Attempting test execution at {endpoint}")
                
                response = requests.post(url, json=test_payload, timeout=10)
                
                result = {
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "response": response.text[:500],
                    "success": response.status_code in [200, 201, 202]
                }
                
                if result["success"]:
                    logger.info(f"✅ Test execution successful via {endpoint}")
                else:
                    logger.info(f"❌ Test execution failed via {endpoint}: {response.status_code}")
                
                execution_results.append(result)
                
            except Exception as e:
                logger.error(f"❌ Execution failed for {endpoint}: {e}")
                execution_results.append({
                    "endpoint": endpoint,
                    "error": str(e),
                    "success": False
                })
        
        return execution_results

    async def test_ui_real_execution(self):
        """Test actual test execution through the UI with real WeSign tests"""
        logger.info("Testing real WeSign test execution through UI...")
        
        execution_results = {
            "navigation_successful": False,
            "tests_found": False,
            "execution_triggered": False,
            "execution_count": 0,
            "execution_requests": [],
            "screenshots": []
        }
        
        try:
            # Monitor all requests
            requests_captured = []
            
            def capture_request(request):
                requests_captured.append({
                    'url': request.url,
                    'method': request.method,
                    'timestamp': datetime.now().isoformat()
                })
                if any(keyword in request.url.lower() for keyword in ['execute', 'run', 'test', 'playwright']):
                    logger.info(f"🔍 Execution request: {request.method} {request.url}")
                    execution_results["execution_requests"].append({
                        'url': request.url,
                        'method': request.method,
                        'timestamp': datetime.now().isoformat()
                    })
            
            self.page.on("request", capture_request)
            
            # Navigate to Test Bank
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.page.wait_for_load_state('networkidle')
            execution_results["navigation_successful"] = True
            
            # Take initial screenshot
            screenshot1 = f"ui_execution_test_bank_{datetime.now().strftime('%H%M%S')}.png"
            await self.page.screenshot(path=screenshot1)
            execution_results["screenshots"].append(screenshot1)
            
            # Look for WeSign-specific tests
            wesign_test_selectors = [
                'text=wesign',
                'text=login',
                'text=auth', 
                'text=dashboard',
                'text=WeSign',
                '[data-test*="wesign"]',
                '[data-testid*="wesign"]'
            ]
            
            wesign_tests_found = []
            for selector in wesign_test_selectors:
                try:
                    elements = await self.page.query_selector_all(selector)
                    for element in elements:
                        text = await element.text_content()
                        if text and any(keyword.lower() in text.lower() for keyword in ['wesign', 'login', 'test', 'auth']):
                            wesign_tests_found.append({
                                'element': element,
                                'text': text.strip(),
                                'selector': selector
                            })
                            logger.info(f"Found WeSign test: {text.strip()}")
                except:
                    continue
            
            execution_results["tests_found"] = len(wesign_tests_found) > 0
            
            if not wesign_tests_found:
                logger.warning("No WeSign-specific tests found, trying generic run buttons")
                
                # Try generic run buttons
                run_buttons = await self.page.query_selector_all('button:has-text("Run")')
                logger.info(f"Found {len(run_buttons)} generic run buttons")
                
                if run_buttons and len(run_buttons) > 0:
                    # Clear request tracking
                    execution_results["execution_requests"].clear()
                    
                    # Click first run button  
                    logger.info("Clicking first available run button...")
                    await run_buttons[0].click()
                    execution_results["execution_triggered"] = True
                    
                    # Wait and monitor
                    await asyncio.sleep(3)
                    await self.page.wait_for_load_state('networkidle', timeout=10000)
                    
                    # Take post-click screenshot
                    screenshot2 = f"ui_execution_after_click_{datetime.now().strftime('%H%M%S')}.png"
                    await self.page.screenshot(path=screenshot2)
                    execution_results["screenshots"].append(screenshot2)
                    
                    execution_results["execution_count"] = len(execution_results["execution_requests"])
                    
                    if execution_results["execution_count"] > 0:
                        logger.info(f"✅ Execution detected: {execution_results['execution_count']} requests")
                    else:
                        logger.warning("❌ No execution requests detected after button click")
            else:
                logger.info(f"Found {len(wesign_tests_found)} WeSign-specific tests")
                # Could implement WeSign-specific test execution here
            
        except Exception as e:
            logger.error(f"UI execution test failed: {e}")
            execution_results["error"] = str(e)
        
        return execution_results

    async def run_comprehensive_validation(self):
        """Run complete validation of WeSign test execution capabilities"""
        logger.info("Starting comprehensive WeSign test execution validation...")
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "api_endpoints": [],
            "direct_execution": [],
            "ui_execution": {},
            "summary": {}
        }
        
        try:
            # Test API endpoints
            results["api_endpoints"] = self.test_api_endpoints()
            
            # Test direct API execution
            results["direct_execution"] = self.test_direct_execution_api()
            
            # Setup browser and test UI execution
            await self.setup()
            results["ui_execution"] = await self.test_ui_real_execution()
            
            # Generate summary
            api_available = len([ep for ep in results["api_endpoints"] if ep.get("status") == 200])
            execution_working = any(ex.get("success", False) for ex in results["direct_execution"])
            ui_working = results["ui_execution"].get("execution_triggered", False)
            
            results["summary"] = {
                "api_endpoints_available": api_available,
                "direct_execution_working": execution_working,
                "ui_execution_working": ui_working,
                "wesign_tests_found": results["ui_execution"].get("tests_found", False),
                "overall_status": "WORKING" if (execution_working or ui_working) else "NEEDS_IMPLEMENTATION"
            }
            
        except Exception as e:
            logger.error(f"Comprehensive validation failed: {e}")
            results["error"] = str(e)
        finally:
            await self.teardown()
        
        return results

def main():
    async def run_validation():
        validator = WeSignTestExecutionValidator()
        results = await validator.run_comprehensive_validation()
        
        # Save results
        filename = f"wesign_execution_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        # Print summary
        print("\n" + "="*70)
        print("WESIGN TEST EXECUTION VALIDATION RESULTS")
        print("="*70)
        print(f"API Endpoints Available: {results['summary']['api_endpoints_available']}")
        print(f"Direct Execution Working: {results['summary']['direct_execution_working']}")
        print(f"UI Execution Working: {results['summary']['ui_execution_working']}")
        print(f"WeSign Tests Found: {results['summary']['wesign_tests_found']}")
        print(f"Overall Status: {results['summary']['overall_status']}")
        
        if results["summary"]["overall_status"] == "WORKING":
            print("\n✅ WeSign test execution capabilities are functional!")
        else:
            print("\n❌ WeSign test execution needs implementation or fixes")
        
        print(f"\nDetailed results saved to: {filename}")
        print("="*70)
        
        return results
    
    return asyncio.run(run_validation())

if __name__ == "__main__":
    main()