import asyncio
from playwright.async_api import async_playwright

async def test_run_single_test():
    """Test running a single test from the UI"""
    async with async_playwright() as p:
        # Launch browser in headed mode to see what's happening
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("Starting single test run investigation...")
            
            # Navigate to the Test Bank page
            print("Navigating to Test Bank page...")
            await page.goto("http://localhost:3004/test-bank")
            await page.wait_for_timeout(3000)
            
            # Wait for tests to load
            print("Waiting for tests to load...")
            await page.wait_for_selector('button:has-text("Run"), [data-testid*="run"], .run-button', timeout=10000)
            
            # Get all run buttons
            run_buttons = page.locator('button:has-text("Run")')
            button_count = await run_buttons.count()
            print(f"Found {button_count} run buttons on the page")
            
            if button_count > 0:
                # Get the first test info
                first_button = run_buttons.first
                
                # Try to find the test name associated with this button
                test_row = first_button.locator('xpath=ancestor::tr | xpath=ancestor::div[contains(@class, "test")]').first
                test_name = "Unknown Test"
                
                try:
                    # Try different ways to get test name
                    test_name_element = test_row.locator('td:first-child, .test-name, [data-testid="test-name"]').first
                    if await test_name_element.count() > 0:
                        test_name = await test_name_element.text_content()
                        test_name = test_name.strip() if test_name else "Unknown Test"
                except:
                    print("Could not extract test name")
                
                print(f"Attempting to run test: {test_name}")
                
                # Click the first run button
                print("Clicking run button...")
                await first_button.click()
                
                # Wait for any loading indicators or responses
                await page.wait_for_timeout(2000)
                
                # Check for loading states
                loading_indicators = await page.locator('[class*="loading"], .spinner, [data-testid="loading"]').count()
                print(f"Loading indicators visible: {loading_indicators}")
                
                # Wait a bit more for test execution
                print("Waiting for test execution...")
                await page.wait_for_timeout(5000)
                
                # Check for success/failure indicators
                success_indicators = await page.locator('.success, [class*="success"], .passed, [class*="passed"]').count()
                error_indicators = await page.locator('.error, [class*="error"], .failed, [class*="failed"]').count()
                
                print(f"Success indicators: {success_indicators}")
                print(f"Error indicators: {error_indicators}")
                
                # Check for any status changes in the test row
                try:
                    status_element = test_row.locator('.status, [data-testid="status"], td:last-child').first
                    if await status_element.count() > 0:
                        status_text = await status_element.text_content()
                        print(f"Test status: {status_text}")
                except:
                    print("Could not read test status")
                
                # Check for any modal dialogs or notifications
                modal_count = await page.locator('.modal, [role="dialog"], .notification').count()
                if modal_count > 0:
                    print("Modal or notification detected")
                    modal_text = await page.locator('.modal, [role="dialog"], .notification').first.text_content()
                    print(f"Modal content: {modal_text}")
                
                # Check browser console for errors
                console_messages = []
                page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
                
                await page.wait_for_timeout(2000)
                
                # Print any console errors
                error_messages = [msg for msg in console_messages if "error" in msg.lower()]
                if error_messages:
                    print("Console errors detected:")
                    for msg in error_messages[-5:]:  # Show last 5 errors
                        print(f"  {msg}")
                
                # Take a screenshot
                await page.screenshot(path="test_run_result.png")
                print("Screenshot saved as test_run_result.png")
                
            else:
                print("No run buttons found - tests may not have loaded")
                
                # Check page content for debugging
                page_content = await page.content()
                if "test" in page_content.lower():
                    print("Page contains test-related content")
                else:
                    print("Page does not seem to contain test content")
                
                await page.screenshot(path="test_bank_no_buttons.png")
            
            # Keep browser open for inspection
            print("Keeping browser open for 15 seconds for inspection...")
            await page.wait_for_timeout(15000)
            
        except Exception as e:
            print(f"ERROR: {e}")
            await page.screenshot(path="test_run_error.png")
            
        finally:
            await browser.close()
            print("Test run investigation completed")

# Run the test
if __name__ == "__main__":
    asyncio.run(test_run_single_test())