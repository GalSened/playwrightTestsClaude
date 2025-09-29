"""
Test login functionality and fix any issues using Playwright
"""
import asyncio
import sys
from playwright.async_api import async_playwright

async def test_login_flow():
    print("🔍 Testing WeSign Login Flow with Playwright")
    print("=" * 50)
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            # Navigate to login page
            print("📍 Navigating to application...")
            await page.goto("http://localhost:3001", wait_until="networkidle")
            
            # Take screenshot of initial page
            await page.screenshot(path="login_test_01_initial.png")
            print("✅ Screenshot saved: login_test_01_initial.png")
            
            # Check if we're already on login page or need to navigate
            current_url = page.url
            print(f"📍 Current URL: {current_url}")
            
            # Look for login form elements
            login_inputs = await page.locator('input[type="email"], input[type="text"]').count()
            password_inputs = await page.locator('input[type="password"]').count()
            login_buttons = await page.locator('button:has-text("Login"), button:has-text("Sign In"), input[type="submit"]').count()
            
            print(f"🔍 Found {login_inputs} email/text inputs, {password_inputs} password inputs, {login_buttons} login buttons")
            
            # If we don't see login form, look for navigation to login
            if login_inputs == 0 or password_inputs == 0:
                print("🔍 Looking for login navigation...")
                
                # Look for login links/buttons
                login_links = page.locator('a:has-text("Login"), a:has-text("Sign In"), button:has-text("Login"), button:has-text("Sign In")')
                if await login_links.count() > 0:
                    print("📍 Clicking login link...")
                    await login_links.first.click()
                    await page.wait_for_load_state("networkidle")
                    await page.screenshot(path="login_test_02_login_page.png")
                    print("✅ Screenshot saved: login_test_02_login_page.png")
                else:
                    # Check if there's a login route we can navigate to directly
                    print("📍 Trying direct login route...")
                    await page.goto("http://localhost:3001/login", wait_until="networkidle")
                    await page.screenshot(path="login_test_03_direct_login.png")
                    print("✅ Screenshot saved: login_test_03_direct_login.png")
            
            # Re-check for login form elements after navigation
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first
            password_input = page.locator('input[type="password"], input[name="password"]').first
            login_button = page.locator('button:has-text("Login"), button:has-text("Sign In"), input[type="submit"]').first
            
            if await email_input.count() == 0:
                print("❌ No email input found")
                # Try to find any text inputs
                all_inputs = page.locator('input')
                input_count = await all_inputs.count()
                print(f"🔍 Found {input_count} total inputs on page")
                for i in range(min(input_count, 5)):
                    input_el = all_inputs.nth(i)
                    input_type = await input_el.get_attribute('type')
                    input_name = await input_el.get_attribute('name')
                    input_placeholder = await input_el.get_attribute('placeholder')
                    print(f"   Input {i}: type={input_type}, name={input_name}, placeholder={input_placeholder}")
                
                # Check page content for clues
                page_text = await page.text_content('body')
                if 'login' in page_text.lower() or 'sign in' in page_text.lower():
                    print("🔍 Page contains login-related text")
                else:
                    print("⚠️  Page doesn't seem to contain login form")
                    
                await page.screenshot(path="login_test_04_debug.png")
                print("✅ Debug screenshot saved: login_test_04_debug.png")
                return False
            
            if await password_input.count() == 0:
                print("❌ No password input found")
                return False
                
            if await login_button.count() == 0:
                print("❌ No login button found")
                return False
            
            print("✅ Login form elements found!")
            
            # Fill in test credentials
            print("📝 Filling in test credentials...")
            await email_input.fill("test@example.com")
            await password_input.fill("password123")
            
            await page.screenshot(path="login_test_05_filled_form.png")
            print("✅ Screenshot saved: login_test_05_filled_form.png")
            
            # Submit the form
            print("🚀 Submitting login form...")
            await login_button.click()
            
            # Wait for response and check for redirect or success
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except:
                print("⚠️  Timeout waiting for page load, continuing...")
            
            await page.screenshot(path="login_test_06_after_submit.png")
            print("✅ Screenshot saved: login_test_06_after_submit.png")
            
            # Check current URL for changes
            new_url = page.url
            print(f"📍 URL after login: {new_url}")
            
            # Check for success indicators
            success_indicators = [
                'dashboard', 'home', 'welcome', 'logout', 'profile'
            ]
            
            url_changed = new_url != current_url
            has_success_indicator = any(indicator in new_url.lower() for indicator in success_indicators)
            
            # Check page content for success/error messages
            page_content = await page.text_content('body')
            has_error_message = any(error in page_content.lower() for error in ['error', 'invalid', 'failed', 'incorrect'])
            has_success_content = any(success in page_content.lower() for success in ['dashboard', 'welcome', 'logout'])
            
            print(f"🔍 Analysis:")
            print(f"   URL changed: {url_changed}")
            print(f"   Has success indicator in URL: {has_success_indicator}")
            print(f"   Has error message: {has_error_message}")
            print(f"   Has success content: {has_success_content}")
            
            if has_error_message:
                print("❌ Login appears to have failed - error detected")
                # Look for specific error messages
                error_elements = page.locator('*:has-text("error"), *:has-text("invalid"), *:has-text("failed")')
                if await error_elements.count() > 0:
                    error_text = await error_elements.first.text_content()
                    print(f"   Error message: {error_text}")
                return False
            elif url_changed or has_success_indicator or has_success_content:
                print("✅ Login appears successful!")
                return True
            else:
                print("⚠️  Login result unclear - checking further...")
                
                # Wait a bit more for any delayed redirects
                await page.wait_for_timeout(3000)
                final_url = page.url
                
                if final_url != new_url:
                    print(f"📍 Final URL after delay: {final_url}")
                    await page.screenshot(path="login_test_07_final_state.png")
                    print("✅ Screenshot saved: login_test_07_final_state.png")
                    
                    if any(indicator in final_url.lower() for indicator in success_indicators):
                        print("✅ Login successful after delay!")
                        return True
                
                print("❓ Unable to determine login success")
                return False
                
        except Exception as e:
            print(f"❌ Error during login test: {e}")
            await page.screenshot(path="login_test_error.png")
            print("✅ Error screenshot saved: login_test_error.png")
            return False
        
        finally:
            await browser.close()

async def test_api_endpoints():
    """Test backend API endpoints"""
    import aiohttp
    
    print("\n🔍 Testing Backend API Endpoints")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test health endpoint
            print("📡 Testing health endpoint...")
            async with session.get('http://localhost:8081/health') as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Health check: {data['status']}")
                else:
                    print(f"❌ Health check failed: {resp.status}")
            
            # Test login endpoint
            print("📡 Testing login API...")
            login_data = {
                "email": "test@example.com",
                "password": "password123"
            }
            async with session.post('http://localhost:8081/api/auth/login', json=login_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Login API successful: {data.get('success', False)}")
                    print(f"   User: {data.get('user', {}).get('email', 'Unknown')}")
                else:
                    print(f"❌ Login API failed: {resp.status}")
                    error_text = await resp.text()
                    print(f"   Response: {error_text}")
                    
    except Exception as e:
        print(f"❌ API test error: {e}")

async def main():
    """Run all tests"""
    print("🧪 WeSign Login Test Suite")
    print("=" * 60)
    
    # Test API first
    await test_api_endpoints()
    
    # Test UI login flow
    login_success = await test_login_flow()
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    
    if login_success:
        print("✅ LOGIN TEST: PASSED")
        print("   The login functionality is working correctly")
    else:
        print("❌ LOGIN TEST: FAILED")
        print("   Issues found with login functionality")
        print("   Check screenshots for details:")
        print("   - login_test_01_initial.png")
        print("   - login_test_02_login_page.png")
        print("   - login_test_03_direct_login.png")
        print("   - login_test_04_debug.png")
        print("   - login_test_05_filled_form.png")
        print("   - login_test_06_after_submit.png")
    
    return login_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)