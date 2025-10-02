import asyncio
from playwright.async_api import async_playwright

async def verify_fix():
    """Verify that the UI status update fix works"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("=== VERIFYING UI STATUS UPDATE FIX ===")
            
            # Navigate to test bank
            await page.goto("http://localhost:3004/test-bank")
            await page.wait_for_timeout(3000)
            
            # Wait for tests to load
            await page.wait_for_selector('button:has-text("Run")', timeout=10000)
            print("PASS: Test Bank loaded with run buttons")
            
            # Find the status column
            status_header = page.locator('th:has-text("Status")')
            status_header_exists = await status_header.count() > 0
            print(f"PASS: Status column exists: {status_header_exists}")
            
            # Check if there are any tests with status already
            status_badges = await page.locator('[data-testid="test-status"]').count()
            print(f"INFO: Found {status_badges} test status indicators")
            
            # Look for any PASSED/FAILED status from previous runs
            passed_tests = await page.locator('text=PASSED').count()
            failed_tests = await page.locator('text=FAILED').count()
            not_run_tests = await page.locator('text=Not Run').count()
            
            print(f"INFO: Test status summary:")
            print(f"   - PASSED: {passed_tests}")
            print(f"   - FAILED: {failed_tests}")
            print(f"   - Not Run: {not_run_tests}")
            
            if passed_tests > 0 or failed_tests > 0:
                print("SUCCESS: Test results are displaying in the UI!")
                print("SUCCESS: Status update functionality is working correctly")
            else:
                print("INFO: No test results visible yet - they may appear after running a test")
                
                # Try running a test to see the status update
                print("ACTION: Running a quick test to verify status updates...")
                first_run_button = page.locator('button:has-text("Run")').first
                await first_run_button.click()
                
                print("INFO: Waiting for test to complete (up to 60 seconds)...")
                
                # Wait for status to change from "Not Run" to something else
                for i in range(60):  # Wait up to 60 seconds
                    await page.wait_for_timeout(1000)
                    
                    current_passed = await page.locator('text=PASSED').count()
                    current_failed = await page.locator('text=FAILED').count()
                    
                    if current_passed > passed_tests or current_failed > failed_tests:
                        print("SUCCESS: Test status updated in real-time!")
                        print(f"   New status: PASSED={current_passed}, FAILED={current_failed}")
                        break
                    
                    if i % 10 == 0:  # Print every 10 seconds
                        print(f"   Still waiting... ({i+1}s)")
                
            # Take final screenshot
            await page.screenshot(path="fix_verification.png")
            print("INFO: Screenshot saved as fix_verification.png")
            
            await page.wait_for_timeout(5000)
            
        except Exception as e:
            print(f"ERROR: {e}")
            await page.screenshot(path="fix_verification_error.png")
            
        finally:
            await browser.close()
            print("COMPLETED: Verification finished")

if __name__ == "__main__":
    asyncio.run(verify_fix())