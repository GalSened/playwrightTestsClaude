import asyncio
from playwright.async_api import async_playwright

async def test_ui_login():
    """Test login functionality through the UI"""
    async with async_playwright() as p:
        # Launch browser in headed mode to see what's happening
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("Starting UI login test...")
            
            # Navigate to the frontend
            print("Navigating to http://localhost:3004")
            await page.goto("http://localhost:3004")
            await page.wait_for_timeout(2000)
            
            # Check if we're already on dashboard or need to login
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            # Look for login form elements
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
            password_input = page.locator('input[type="password"], input[name="password"]')
            login_button = page.locator('button:has-text("Login"), button:has-text("Sign"), button[type="submit"]')
            
            # Check if login elements exist
            email_exists = await email_input.count() > 0
            password_exists = await password_input.count() > 0
            login_button_exists = await login_button.count() > 0
            
            print(f"Login form elements found:")
            print(f"   Email field: {email_exists}")
            print(f"   Password field: {password_exists}")
            print(f"   Login button: {login_button_exists}")
            
            if email_exists and password_exists and login_button_exists:
                print("Filling login form...")
                
                # Use test credentials
                await email_input.fill("admin@demo.com")
                await password_input.fill("demo123")
                
                print("Submitting login form...")
                await login_button.click()
                
                # Wait for navigation or response
                await page.wait_for_timeout(3000)
                
                # Check if login was successful
                new_url = page.url
                print(f"URL after login: {new_url}")
                
                # Look for indicators of successful login
                dashboard_indicators = [
                    'text="Dashboard"',
                    'text="Tests"', 
                    'text="Analytics"',
                    '.dashboard',
                    '[class*="dashboard"]'
                ]
                
                login_success = False
                for indicator in dashboard_indicators:
                    if await page.locator(indicator).count() > 0:
                        login_success = True
                        print(f"SUCCESS: Login successful! Found indicator: {indicator}")
                        break
                
                if not login_success:
                    print("FAILED: Login may have failed - no dashboard indicators found")
                    
                    # Check for error messages
                    error_messages = await page.locator('.error, [class*="error"], .alert-danger').all_text_contents()
                    if error_messages:
                        print(f"ERROR MESSAGES: {error_messages}")
                
                # Take a screenshot for verification
                await page.screenshot(path="login_test_result.png")
                print("Screenshot saved as login_test_result.png")
                
            else:
                print("NOTICE: Login form not found - user might already be logged in")
                
                # Check if we're already on dashboard
                page_content = await page.content()
                if "dashboard" in page_content.lower() or "test" in page_content.lower():
                    print("SUCCESS: Already logged in - on dashboard/main page")
                else:
                    print("UNKNOWN: Unknown page state")
            
            # Keep browser open for inspection
            print("Keeping browser open for 10 seconds for inspection...")
            await page.wait_for_timeout(10000)
            
        except Exception as e:
            print(f"ERROR: Error during login test: {e}")
            await page.screenshot(path="login_test_error.png")
        
        finally:
            await browser.close()
            print("Login test completed")

# Run the test
if __name__ == "__main__":
    asyncio.run(test_ui_login())