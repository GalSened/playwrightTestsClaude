"""
Simple verification that login is working
"""
import time
from playwright.sync_api import sync_playwright

def test_simple_login_verification():
    print("SIMPLE LOGIN VERIFICATION")
    print("=" * 30)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=800)
        page = browser.new_page()
        
        try:
            print("1. Opening platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            if "/login" not in current_url:
                print("SUCCESS: Authentication working!")
                
                # Take screenshot
                page.screenshot(path="authenticated_main_page.png")
                print("Screenshot saved: authenticated_main_page.png")
                
                # Check page content
                page_content = page.content()
                if 'test' in page_content.lower() or 'schedule' in page_content.lower():
                    print("SUCCESS: Test/Schedule content found!")
                else:
                    print("Page loaded but no test content visible")
                    
            else:
                print("FAILED: Still redirecting to login")
                page.screenshot(path="login_redirect.png")
                
        except Exception as e:
            print(f"Error: {e}")
            
        finally:
            browser.close()

if __name__ == "__main__":
    test_simple_login_verification()