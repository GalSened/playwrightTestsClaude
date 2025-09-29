"""
Final login test after CORS fix
"""
import asyncio
from playwright.async_api import async_playwright

async def test_final_login():
    print("Final Login Test - After CORS Fix")
    print("=" * 40)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("1. Navigating to application...")
            await page.goto("http://localhost:3001", wait_until="networkidle")
            await page.screenshot(path="final_test_01_initial.png")
            
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            print("2. Waiting for page to load...")
            await page.wait_for_timeout(2000)
            
            print("3. Filling login form...")
            # Fill email
            await page.fill('input[name="email"]', "test@example.com")
            # Fill password  
            await page.fill('input[name="password"]', "password123")
            
            await page.screenshot(path="final_test_02_filled.png")
            print("   Form filled, screenshot saved")
            
            print("4. Submitting form...")
            await page.click('button[type="submit"]')
            
            print("5. Waiting for response...")
            # Wait for navigation or changes
            try:
                await page.wait_for_url("**/*", timeout=10000)
                print("   Navigation detected!")
            except:
                print("   No navigation detected, checking current state...")
            
            await page.screenshot(path="final_test_03_after_submit.png")
            
            new_url = page.url
            print(f"   URL after login: {new_url}")
            
            if new_url != current_url:
                print("SUCCESS: Login successful - URL changed!")
                # Check what page we're on
                page_title = await page.title()
                print(f"   Page title: {page_title}")
                
                # Check for logout or user indicators
                user_indicator = await page.locator('text=Logout, text=Profile, text=Dashboard, text=Welcome').count()
                if user_indicator > 0:
                    print("   Found user indicators on page")
                
                return True
            else:
                # Check if we're in a loading state or got an error
                error_count = await page.locator('.error, [class*="error"], text=/error/i').count()
                loading_count = await page.locator('[class*="loading"], [class*="spinner"]').count()
                
                print(f"   Error elements: {error_count}")
                print(f"   Loading elements: {loading_count}")
                
                if loading_count > 0:
                    print("   Page appears to be loading, waiting...")
                    await page.wait_for_timeout(5000)
                    final_url = page.url
                    print(f"   Final URL after wait: {final_url}")
                    
                    if final_url != current_url:
                        print("SUCCESS: Login successful after delay!")
                        return True
                
                if error_count > 0:
                    print("ERROR: Found error elements on page")
                    
                return False
                
        except Exception as e:
            print(f"ERROR: {e}")
            await page.screenshot(path="final_test_error.png")
            return False
        finally:
            await browser.close()

if __name__ == "__main__":
    success = asyncio.run(test_final_login())
    print("\n" + "=" * 40)
    if success:
        print("LOGIN TEST: SUCCESS!")
        print("The login functionality is now working correctly.")
    else:
        print("LOGIN TEST: FAILED")
        print("Login still has issues.")
    print("Check screenshots: final_test_01_initial.png, final_test_02_filled.png, final_test_03_after_submit.png")