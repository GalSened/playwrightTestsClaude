"""
Detailed login test with console monitoring
"""
import asyncio
from playwright.async_api import async_playwright

async def test_login_with_console():
    print("Detailed Login Test with Console Monitoring")
    print("=" * 50)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Monitor console messages
        console_messages = []
        def handle_console(msg):
            console_messages.append(f"[{msg.type}] {msg.text}")
            print(f"Console [{msg.type}]: {msg.text}")
            
        page.on("console", handle_console)
        
        # Monitor page errors
        def handle_page_error(error):
            print(f"Page error: {error}")
            
        page.on("pageerror", handle_page_error)
        
        try:
            print("1. Navigating to application...")
            await page.goto("http://localhost:3001", wait_until="networkidle")
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            print("2. Filling login form...")
            # Wait for and fill email
            email_input = page.locator('input[name="email"]')
            await email_input.wait_for()
            await email_input.fill("test@example.com")
            
            # Wait for and fill password
            password_input = page.locator('input[name="password"]')
            await password_input.wait_for()
            await password_input.fill("password123")
            
            print("3. Submitting form...")
            # Find and click the submit button
            submit_button = page.locator('button[type="submit"]')
            await submit_button.click()
            
            print("4. Waiting for response...")
            # Wait a bit to see what happens
            await page.wait_for_timeout(3000)
            
            print("5. Checking for navigation...")
            new_url = page.url
            print(f"   URL after submit: {new_url}")
            
            if new_url != current_url:
                print("SUCCESS: URL changed, login appears successful!")
                await page.screenshot(path="login_success.png")
                return True
            else:
                print("WARNING: URL did not change")
                
                # Check for any error messages on the page
                error_elements = await page.locator('.error, [class*="error"], [class*="invalid"]').count()
                if error_elements > 0:
                    print(f"   Found {error_elements} error elements")
                    for i in range(error_elements):
                        error_text = await page.locator('.error, [class*="error"], [class*="invalid"]').nth(i).text_content()
                        print(f"   Error {i+1}: {error_text}")
                
                # Check if we're still loading
                loading_elements = await page.locator('[class*="loading"], [class*="spinner"]').count()
                if loading_elements > 0:
                    print(f"   Found {loading_elements} loading elements, waiting longer...")
                    await page.wait_for_timeout(5000)
                    final_url = page.url
                    print(f"   Final URL: {final_url}")
                    if final_url != new_url:
                        print("SUCCESS: Navigation completed after delay!")
                        return True
                
                # Take a screenshot for debugging
                await page.screenshot(path="login_debug.png")
                print("   Debug screenshot saved: login_debug.png")
                
                return False
                
        except Exception as e:
            print(f"ERROR: {e}")
            await page.screenshot(path="login_error.png")
            return False
        finally:
            print(f"\nConsole messages captured: {len(console_messages)}")
            for msg in console_messages[-10:]:  # Show last 10 messages
                print(f"   {msg}")
                
            await browser.close()

if __name__ == "__main__":
    success = asyncio.run(test_login_with_console())
    if success:
        print("\nLOGIN TEST: PASSED")
    else:
        print("\nLOGIN TEST: FAILED")