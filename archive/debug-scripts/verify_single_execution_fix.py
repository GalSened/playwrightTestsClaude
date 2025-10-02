"""
Verify Single Test Execution Fix
Validates that the TestBank UI now executes tests only once
"""

import asyncio
import time
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SingleExecutionVerifier:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.browser = None
        self.page = None
        self.api_calls = []
        
    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        
        # Track all network requests
        self.page.on("request", self._track_requests)
        logger.info("Browser setup completed")
        
    def _track_requests(self, request):
        """Track API requests to detect double execution"""
        if any(path in request.url for path in ['/api/tests', '/execute', '/run']):
            self.api_calls.append({
                'url': request.url,
                'method': request.method,
                'timestamp': datetime.now().isoformat()
            })
            logger.info(f"API Call: {request.method} {request.url}")
    
    async def teardown(self):
        if self.browser:
            await self.browser.close()
            
    async def test_single_execution(self):
        """Test that clicking a run button only executes once"""
        logger.info("Testing single test execution fix...")
        
        try:
            # Navigate to Test Bank
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.page.wait_for_load_state('networkidle')
            
            # Take initial screenshot
            await self.page.screenshot(path=f"fix_verification_initial_{datetime.now().strftime('%H%M%S')}.png")
            
            # Clear previous API calls
            self.api_calls.clear()
            
            # Find and click first run button
            run_buttons = await self.page.query_selector_all('button:has-text("Run")')
            
            if not run_buttons:
                logger.error("No run buttons found")
                return False
                
            logger.info(f"Found {len(run_buttons)} run buttons")
            logger.info("Clicking first run button...")
            
            # Click the first run button
            await run_buttons[0].click()
            
            # Wait for execution to complete
            await asyncio.sleep(5)
            await self.page.wait_for_load_state('networkidle')
            
            # Take post-execution screenshot
            await self.page.screenshot(path=f"fix_verification_after_{datetime.now().strftime('%H%M%S')}.png")
            
            # Analyze API calls
            test_execution_calls = [call for call in self.api_calls 
                                  if '/run/' in call['url'] and call['method'] == 'POST']
            
            test_loading_calls = [call for call in self.api_calls 
                                if '/tests/all' in call['url'] and call['method'] == 'GET']
            
            logger.info(f"Test execution calls: {len(test_execution_calls)}")
            logger.info(f"Test loading calls: {len(test_loading_calls)}")
            
            # Print all API calls for analysis
            for call in self.api_calls:
                logger.info(f"  {call['method']} {call['url']}")
            
            # Validate fix
            success = True
            issues = []
            
            if len(test_execution_calls) == 0:
                issues.append("No test execution API calls detected")
                success = False
            elif len(test_execution_calls) > 1:
                issues.append(f"Multiple test execution calls: {len(test_execution_calls)} (expected 1)")
                success = False
            else:
                logger.info("✅ Single test execution detected - Fix working!")
                
            if len(test_loading_calls) > 1:
                issues.append(f"Multiple test loading calls: {len(test_loading_calls)}")
                success = False
                
            return {
                'success': success,
                'test_execution_calls': len(test_execution_calls),
                'test_loading_calls': len(test_loading_calls),
                'total_api_calls': len(self.api_calls),
                'issues': issues,
                'all_calls': self.api_calls
            }
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'issues': [f"Test execution failed: {str(e)}"]
            }

async def main():
    verifier = SingleExecutionVerifier()
    
    try:
        await verifier.setup()
        result = await verifier.test_single_execution()
        
        print("\n" + "="*60)
        print("SINGLE EXECUTION FIX VERIFICATION")
        print("="*60)
        
        if result['success']:
            print("✅ FIX SUCCESSFUL - Single execution working correctly!")
            print(f"Test execution calls: {result['test_execution_calls']}")
            print(f"Test loading calls: {result['test_loading_calls']}")
        else:
            print("❌ FIX INCOMPLETE - Issues detected:")
            for issue in result.get('issues', []):
                print(f"  - {issue}")
                
        print(f"\nTotal API calls: {result.get('total_api_calls', 'N/A')}")
        print("="*60)
        
        return result
        
    finally:
        await verifier.teardown()

if __name__ == "__main__":
    asyncio.run(main())