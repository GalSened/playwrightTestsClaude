"""
Test complete login and scheduler access flow
"""
import time
from playwright.sync_api import sync_playwright

def test_login_and_scheduler_access():
    print("TESTING COMPLETE LOGIN AND SCHEDULER ACCESS")
    print("=" * 50)
    
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
                print("   SUCCESS: No login redirect - authentication working!")
                
                # Take screenshot of main page
                page.screenshot(path="main_page_authenticated.png")
                print("   Screenshot: main_page_authenticated.png")
                
                # Look for navigation elements
                print("2. Looking for navigation elements...")
                nav_elements = [
                    'Test Bank',
                    'Tests', 
                    'Dashboard',
                    'Scheduler',
                    'Reports',
                    'Settings'
                ]
                
                found_nav = []
                for nav_text in nav_elements:
                    nav_element = page.locator(f'nav a:has-text("{nav_text}"), a:has-text("{nav_text}"), button:has-text("{nav_text}")')
                    if nav_element.is_visible():
                        found_nav.append(nav_text)
                        print(f"   ✓ Found: {nav_text}")
                
                print(f"   Found navigation items: {found_nav}")
                
                # Try to navigate to Test Bank
                print("3. Attempting to navigate to Test Bank...")
                test_bank_nav = page.locator('a:has-text("Test Bank"), button:has-text("Test Bank"), [href*="test"]')
                if test_bank_nav.is_visible():
                    print("   Clicking Test Bank navigation...")
                    test_bank_nav.first.click()
                    time.sleep(3)
                    
                    new_url = page.url 
                    print(f"   New URL: {new_url}")
                    
                    # Take screenshot
                    page.screenshot(path="test_bank_page.png")
                    print("   Screenshot: test_bank_page.png")
                    
                    # Look for scheduler elements
                    print("4. Looking for scheduler components...")
                    scheduler_elements = [
                        '[data-testid="test-run-scheduler"]',
                        '[data-testid="schedule-form-card"]',
                        'button:has-text("Schedule")',
                        'button:has-text("Schedule Run")',
                        'input[type="date"]',
                        'select'
                    ]
                    
                    found_scheduler = []
                    for selector in scheduler_elements:
                        try:
                            elements = page.locator(selector)
                            count = elements.count()
                            if count > 0:
                                found_scheduler.append(f"{selector} ({count})")
                                print(f"   ✓ Found: {selector} ({count} elements)")
                        except:
                            pass
                    
                    if found_scheduler:
                        print("   SUCCESS: Scheduler components found!")
                        
                        # Try to interact with schedule form
                        schedule_button = page.locator('button:has-text("Schedule")')
                        if schedule_button.is_visible():
                            print("5. Testing schedule form interaction...")
                            schedule_button.first.click()
                            time.sleep(2)
                            
                            # Take screenshot of form
                            page.screenshot(path="scheduler_form_opened.png")
                            print("   Screenshot: scheduler_form_opened.png")
                            
                            print("   SUCCESS: Scheduler form accessible!")
                        else:
                            print("5. Schedule button not immediately visible")
                    else:
                        print("   No scheduler components visible yet")
                        
                else:
                    print("   Test Bank navigation not found, trying alternative paths...")
                    # Try direct URL
                    page.goto("http://localhost:3000/test-bank")
                    time.sleep(3)
                    page.screenshot(path="test_bank_direct.png")
                    
            else:
                print("   FAILED: Still being redirected to login")
                page.screenshot(path="still_on_login.png")
                
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="test_error.png")
            
        finally:
            print("6. Test completed")
            time.sleep(2)  # Allow final screenshot
            browser.close()

if __name__ == "__main__":
    test_login_and_scheduler_access()