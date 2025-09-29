"""
Test login credentials for Playwright Smart Test Management Platform
"""
import time
from playwright.sync_api import sync_playwright

def test_login_credentials():
    print("TESTING LOGIN CREDENTIALS")
    print("=" * 40)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=800)
        page = browser.new_page()
        
        try:
            print("1. Opening Playwright Smart platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            # Should redirect to login
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            if "/login" in current_url:
                print("2. On login page, testing credentials...")
                
                # Fill login form
                email_input = page.locator('input[type="email"], input[name="email"], #email')
                password_input = page.locator('input[type="password"], input[name="password"], #password')
                
                if email_input.is_visible():
                    print("   Filling email: admin@demo.com")
                    email_input.fill("admin@demo.com")
                    
                if password_input.is_visible():
                    print("   Filling password: demo123")
                    password_input.fill("demo123")
                
                # Take screenshot before login
                page.screenshot(path="login_before_attempt.png")
                print("   Screenshot: login_before_attempt.png")
                
                # Find and click login button
                login_button = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")')
                
                if login_button.is_visible():
                    print("   Clicking login button...")
                    login_button.click()
                    time.sleep(3)
                    
                    # Check if login successful
                    new_url = page.url
                    print(f"   After login URL: {new_url}")
                    
                    # Take screenshot after login attempt
                    page.screenshot(path="login_after_attempt.png")
                    print("   Screenshot: login_after_attempt.png")
                    
                    if "/login" not in new_url:
                        print("   SUCCESS: Login successful, redirected!")
                        
                        # Try to navigate to test bank or scheduler
                        time.sleep(2)
                        try:
                            # Try clicking on navigation items
                            nav_items = ['Test Bank', 'Tests', 'Dashboard', 'Scheduler']
                            for item in nav_items:
                                nav_link = page.locator(f'a:has-text("{item}"), button:has-text("{item}")')
                                if nav_link.is_visible():
                                    print(f"   Found navigation: {item}")
                                    nav_link.click()
                                    time.sleep(2)
                                    page.screenshot(path=f"after_nav_{item.lower().replace(' ', '_')}.png")
                                    break
                        except Exception as e:
                            print(f"   Navigation error: {e}")
                            
                    else:
                        print("   FAILED: Still on login page")
                else:
                    print("   ERROR: Login button not found")
            else:
                print("2. Not redirected to login - checking current page...")
                page.screenshot(path="not_on_login_page.png")
                
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="login_test_error.png")
            
        finally:
            print("3. Test completed")
            browser.close()

if __name__ == "__main__":
    test_login_credentials()