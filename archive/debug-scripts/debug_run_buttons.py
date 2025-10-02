"""
Debug Run Buttons Visibility
Check why Run buttons are not appearing in the Test Bank table
"""

import asyncio
import time
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RunButtonsDebugger:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.browser = None
        self.page = None
        
    async def setup(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False)
        self.page = await self.browser.new_page()
        
        # Enable console logging
        self.page.on("console", self._log_console)
        self.page.on("pageerror", self._log_error)
        
        logger.info("Browser setup completed")
        
    def _log_console(self, msg):
        logger.info(f"CONSOLE: {msg.type}: {msg.text}")
        
    def _log_error(self, error):
        logger.error(f"PAGE ERROR: {error}")
    
    async def teardown(self):
        if self.browser:
            await self.browser.close()
            
    async def debug_run_buttons(self):
        """Debug why run buttons are not visible"""
        logger.info("Debugging Run buttons visibility...")
        
        try:
            # Navigate to Test Bank
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.page.wait_for_load_state('networkidle')
            
            # Wait for table to load
            await asyncio.sleep(3)
            
            # Take screenshot
            await self.page.screenshot(path=f"debug_run_buttons_{datetime.now().strftime('%H%M%S')}.png")
            
            # Check if table exists
            table_exists = await self.page.query_selector('[data-testid="tests-table"]')
            logger.info(f"Tests table exists: {table_exists is not None}")
            
            # Check table rows
            table_rows = await self.page.query_selector_all('tbody tr')
            logger.info(f"Table rows found: {len(table_rows)}")
            
            # Check for run buttons in different ways
            run_buttons_testid = await self.page.query_selector_all('[data-testid="run-single-test"]')
            run_buttons_text = await self.page.query_selector_all('button:has-text("Run")')
            run_buttons_play = await self.page.query_selector_all('button:has([data-lucide="play"])')
            
            logger.info(f"Run buttons by testid: {len(run_buttons_testid)}")
            logger.info(f"Run buttons by text: {len(run_buttons_text)}")
            logger.info(f"Run buttons with play icon: {len(run_buttons_play)}")
            
            # Check if Actions column exists
            actions_headers = await self.page.query_selector_all('th:has-text("Actions")')
            logger.info(f"Actions column headers: {len(actions_headers)}")
            
            # Check all buttons on page
            all_buttons = await self.page.query_selector_all('button')
            logger.info(f"Total buttons on page: {len(all_buttons)}")
            
            # Get text of all buttons
            button_texts = []
            for button in all_buttons[:10]:  # First 10 buttons
                try:
                    text = await button.text_content()
                    if text and text.strip():
                        button_texts.append(text.strip())
                except:
                    pass
                    
            logger.info(f"Sample button texts: {button_texts}")
            
            # Check if table is actually rendered with data
            test_names = await self.page.query_selector_all('[data-testid="test-name"]')
            logger.info(f"Test name elements: {len(test_names)}")
            
            if test_names:
                first_test_name = await test_names[0].text_content()
                logger.info(f"First test name: {first_test_name}")
                
            # Check if we're on the right tab
            active_tab = await self.page.query_selector('[data-testid="tests-tab"][class*="bg-primary"]')
            logger.info(f"Tests tab is active: {active_tab is not None}")
            
            # Look for any error messages
            error_messages = await self.page.query_selector_all('.error, [role="alert"], .text-red-500')
            logger.info(f"Error messages found: {len(error_messages)}")
            
            for error in error_messages[:3]:
                try:
                    error_text = await error.text_content()
                    logger.info(f"Error message: {error_text}")
                except:
                    pass
                    
            return {
                'table_exists': table_exists is not None,
                'table_rows': len(table_rows),
                'run_buttons_testid': len(run_buttons_testid),
                'run_buttons_text': len(run_buttons_text),
                'actions_headers': len(actions_headers),
                'total_buttons': len(all_buttons),
                'test_names': len(test_names),
                'tests_tab_active': active_tab is not None
            }
            
        except Exception as e:
            logger.error(f"Debug failed: {e}")
            return {'error': str(e)}

async def main():
    debugger = RunButtonsDebugger()
    
    try:
        await debugger.setup()
        result = await debugger.debug_run_buttons()
        
        print("\n" + "="*60)
        print("RUN BUTTONS DEBUG RESULTS")
        print("="*60)
        
        for key, value in result.items():
            print(f"{key}: {value}")
        
        print("="*60)
        
        return result
        
    finally:
        await debugger.teardown()

if __name__ == "__main__":
    asyncio.run(main())