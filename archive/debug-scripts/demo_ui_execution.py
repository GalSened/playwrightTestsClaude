"""
Demo UI Test Execution
Shows test execution from the QA Intelligence UI with visual feedback
"""

import asyncio
import time
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class UIExecutionDemo:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.browser = None
        self.page = None
        self.execution_requests = []
        
    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False, slow_mo=1000)  # Slow for demo
        self.page = await self.browser.new_page()
        
        # Track execution requests
        self.page.on("request", self._track_execution_requests)
        self.page.on("response", self._track_responses)
        logger.info("Browser setup completed with slow motion for demonstration")
        
    def _track_execution_requests(self, request):
        """Track test execution API calls"""
        if '/api/tests/run/' in request.url and request.method == 'POST':
            self.execution_requests.append({
                'url': request.url,
                'method': request.method,
                'timestamp': datetime.now().isoformat()
            })
            logger.info(f"🚀 TEST EXECUTION STARTED: {request.url}")
    
    def _track_responses(self, response):
        """Track execution responses"""
        if '/api/tests/run/' in response.url and response.request.method == 'POST':
            logger.info(f"✅ TEST EXECUTION RESPONSE: {response.status} - {response.url}")
    
    async def teardown(self):
        if self.browser:
            await self.browser.close()
            
    async def demonstrate_test_execution(self):
        """Demonstrate test execution from UI step by step"""
        logger.info("🎬 Starting UI Test Execution Demonstration...")
        
        try:
            print("\n" + "="*70)
            print("🎬 QA INTELLIGENCE UI TEST EXECUTION DEMONSTRATION")
            print("="*70)
            
            # Step 1: Navigate to Test Bank
            print("📍 Step 1: Navigating to Test Bank...")
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.page.wait_for_load_state('networkidle')
            await asyncio.sleep(2)
            
            # Take initial screenshot
            screenshot1 = f"demo_testbank_{datetime.now().strftime('%H%M%S')}.png"
            await self.page.screenshot(path=screenshot1)
            print(f"📸 Screenshot saved: {screenshot1}")
            
            # Step 2: Show available tests
            test_rows = await self.page.query_selector_all('tbody tr')
            run_buttons = await self.page.query_selector_all('[data-testid="run-single-test"]')
            
            print(f"🔍 Step 2: Found {len(test_rows)} WeSign tests available")
            print(f"🎯 Found {len(run_buttons)} Run buttons ready for execution")
            
            if len(run_buttons) == 0:
                print("❌ No run buttons found!")
                return
                
            # Step 3: Get test name for the first test
            first_test_name_element = await self.page.query_selector('[data-testid="test-name"]')
            if first_test_name_element:
                test_name = await first_test_name_element.text_content()
                print(f"🧪 Step 3: Selected test - {test_name.split()[0]}")
            
            # Clear execution tracking
            self.execution_requests.clear()
            
            # Step 4: Execute the test
            print("🚀 Step 4: Executing single WeSign test...")
            print("   → Clicking Run button...")
            
            await run_buttons[0].click()
            
            # Wait and show execution progress
            await asyncio.sleep(1)
            print("   → Test execution initiated...")
            
            await asyncio.sleep(3)
            print("   → Waiting for test completion...")
            
            # Take execution screenshot
            screenshot2 = f"demo_execution_{datetime.now().strftime('%H%M%S')}.png"
            await self.page.screenshot(path=screenshot2)
            print(f"📸 Execution screenshot: {screenshot2}")
            
            # Step 5: Show results
            execution_count = len(self.execution_requests)
            
            print(f"📊 Step 5: Execution Results:")
            print(f"   → API calls made: {execution_count}")
            
            if execution_count == 1:
                print("   ✅ SUCCESS: Single execution confirmed!")
                print("   ✅ No double execution detected!")
                
                for req in self.execution_requests:
                    test_id = req['url'].split('/')[-1]
                    print(f"   → Test ID executed: {test_id[:8]}...")
                    print(f"   → Execution time: {req['timestamp']}")
                    
            elif execution_count == 0:
                print("   ❌ No execution detected")
            else:
                print(f"   ⚠️  Multiple executions detected: {execution_count}")
                
            # Step 6: Check test status update
            await asyncio.sleep(2)
            print("🔄 Step 6: Checking test status update...")
            
            # Look for status indicators
            status_elements = await self.page.query_selector_all('[data-testid="test-status"]')
            if status_elements:
                first_status = await status_elements[0].text_content()
                print(f"   → Test status: {first_status}")
                
            print("\n🎉 UI Test Execution Demonstration Complete!")
            print("="*70)
            
            return {
                'success': execution_count == 1,
                'execution_count': execution_count,
                'test_name': test_name if 'test_name' in locals() else 'Unknown',
                'screenshots': [screenshot1, screenshot2]
            }
            
        except Exception as e:
            print(f"❌ Demo failed: {e}")
            logger.error(f"Demo failed: {e}")
            return {'error': str(e)}

async def main():
    demo = UIExecutionDemo()
    
    try:
        await demo.setup()
        
        # Keep browser open for a while to show results
        result = await demo.demonstrate_test_execution()
        
        if not result.get('error'):
            print(f"\n🎯 Demo completed successfully!")
            print(f"   Screenshots available: {', '.join(result.get('screenshots', []))}")
            
            # Keep browser open for manual inspection
            print("\n⏸️  Browser will stay open for 30 seconds for manual inspection...")
            await asyncio.sleep(30)
        
        return result
        
    finally:
        print("\n🔚 Closing demo browser...")
        await demo.teardown()

if __name__ == "__main__":
    asyncio.run(main())