"""
Final Test Execution Verification
Test single test execution with proper Run button targeting
"""

import asyncio
import time
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FinalExecutionTest:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.browser = None
        self.page = None
        self.execution_requests = []
        
    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        
        # Track execution requests specifically
        self.page.on("request", self._track_execution_requests)
        logger.info("Browser setup completed")
        
    def _track_execution_requests(self, request):
        """Track test execution API calls"""
        if '/api/tests/run/' in request.url and request.method == 'POST':
            self.execution_requests.append({
                'url': request.url,
                'method': request.method,
                'timestamp': datetime.now().isoformat()
            })
            logger.info(f"TEST EXECUTION DETECTED: {request.method} {request.url}")
    
    async def teardown(self):
        if self.browser:
            await self.browser.close()
            
    async def test_single_run_button(self):
        """Test clicking a specific Run button in the table"""
        logger.info("Testing single Run button execution...")
        
        try:
            # Navigate to Test Bank
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.page.wait_for_load_state('networkidle')
            await asyncio.sleep(2)
            
            # Clear execution tracking
            self.execution_requests.clear()
            
            # Find Run buttons with testid
            run_buttons = await self.page.query_selector_all('[data-testid="run-single-test"]')
            logger.info(f"Found {len(run_buttons)} Run buttons with testid")
            
            if len(run_buttons) == 0:
                return {'error': 'No Run buttons found with testid'}
            
            # Click the first Run button
            logger.info("Clicking first Run button...")
            await run_buttons[0].click()
            
            # Wait for execution
            logger.info("Waiting for test execution...")
            await asyncio.sleep(3)
            
            # Check execution count
            execution_count = len(self.execution_requests)
            logger.info(f"Execution API calls detected: {execution_count}")
            
            # Log all execution requests
            for req in self.execution_requests:
                logger.info(f"  - {req['method']} {req['url']} at {req['timestamp']}")
            
            # Determine success
            success = execution_count == 1
            
            result = {
                'success': success,
                'execution_count': execution_count,
                'expected_count': 1,
                'execution_requests': self.execution_requests,
                'message': 'Single execution working correctly' if success else f'Expected 1 execution, got {execution_count}'
            }
            
            if success:
                logger.info("SUCCESS: Single test execution working correctly!")
            else:
                logger.warning(f"ISSUE: Expected 1 execution call, got {execution_count}")
            
            return result
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            return {'error': str(e), 'success': False}

async def main():
    tester = FinalExecutionTest()
    
    try:
        await tester.setup()
        result = await tester.test_single_run_button()
        
        print("\n" + "="*60)
        print("FINAL EXECUTION TEST RESULTS")
        print("="*60)
        
        if result.get('success'):
            print("SUCCESS: Single test execution fix is working correctly!")
            print(f"Execution count: {result['execution_count']} (expected: 1)")
        else:
            print("ISSUE DETECTED:")
            if 'error' in result:
                print(f"Error: {result['error']}")
            else:
                print(f"Message: {result.get('message', 'Unknown issue')}")
                print(f"Execution count: {result.get('execution_count', 'N/A')}")
        
        print("="*60)
        
        return result
        
    finally:
        await tester.teardown()

if __name__ == "__main__":
    asyncio.run(main())