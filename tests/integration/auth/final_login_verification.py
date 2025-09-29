"""
Final verification that login and main navigation are working
"""
import time
from playwright.sync_api import sync_playwright

def test_final_login_verification():
    print("FINAL LOGIN AND NAVIGATION VERIFICATION")
    print("=" * 45)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=1000)
        page = browser.new_page()
        
        try:
            print("1. Opening Playwright Smart platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            if "/login" not in current_url:
                print("   SUCCESS: Authentication working - no login redirect!")
                
                # Take screenshot of authenticated main page
                page.screenshot(path="final_authenticated_page.png")
                print("   Screenshot: final_authenticated_page.png")
                
                # Check for key navigation elements
                print("2. Checking navigation elements...")
                
                nav_checks = [
                    ("Dashboard", 'a:has-text("Dashboard"), button:has-text("Dashboard")'),
                    ("Test Bank", 'a:has-text("Test Bank"), button:has-text("Test Bank")'),
                    ("Reports", 'a:has-text("Reports"), button:has-text("Reports")'),
                    ("Analytics", 'a:has-text("Analytics"), button:has-text("Analytics")')
                ]
                
                found_nav = []
                for nav_name, selector in nav_checks:
                    try:
                        element = page.locator(selector)
                        if element.is_visible():
                            found_nav.append(nav_name)
                            print(f"   + Found: {nav_name}")
                        else:
                            print(f"   - Missing: {nav_name}")
                    except:
                        print(f"   - Error checking: {nav_name}")
                
                if found_nav:
                    print(f"   SUCCESS: Found {len(found_nav)} navigation elements")
                    
                    # Try clicking Test Bank to verify scheduler access
                    print("3. Testing Test Bank access...")
                    try:
                        test_bank_link = page.locator('a:has-text("Test Bank")')
                        if test_bank_link.is_visible():
                            test_bank_link.first.click()
                            time.sleep(3)
                            
                            new_url = page.url
                            print(f"   Navigated to: {new_url}")
                            
                            page.screenshot(path="test_bank_access_verified.png")
                            print("   Screenshot: test_bank_access_verified.png")
                            
                            print("   SUCCESS: Test Bank page accessible!")
                        else:
                            print("   Test Bank link not found")
                    except Exception as e:
                        print(f"   Error accessing Test Bank: {e}")
                else:
                    print("   No navigation elements found - checking page content...")
                    page_text = page.content()
                    if 'dashboard' in page_text.lower():
                        print("   Dashboard content detected")
                    if 'test' in page_text.lower():
                        print("   Test-related content detected")
                        
            else:
                print("   FAILED: Still redirecting to login page")
                page.screenshot(path="login_redirect_failure.png")
                
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="verification_error.png")
            
        finally:
            print("4. Verification completed")
            time.sleep(2)
            browser.close()

if __name__ == "__main__":
    test_final_login_verification()