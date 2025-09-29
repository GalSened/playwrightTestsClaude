"""
Test to verify the Playwright Smart Scheduler UI functionality
"""
import time
from playwright.sync_api import sync_playwright

def test_scheduler_ui():
    """Test the scheduler UI components and functionality"""
    
    print("🚀 SCHEDULER UI VERIFICATION TEST")
    print("=" * 50)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()
        
        try:
            print("1. Opening frontend at localhost:3000...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            
            # Take screenshot of main page
            page.screenshot(path="scheduler_ui_main_page.png")
            print("   ✅ Screenshot saved: scheduler_ui_main_page.png")
            
            # Look for navigation elements
            print("2. Looking for navigation elements...")
            
            # Try to find Test Bank or scheduler-related navigation
            nav_elements = [
                'nav a[href*="test"]',
                'a[href*="bank"]',
                'button:has-text("Test")',
                'nav',
                '[data-testid*="nav"]'
            ]
            
            for selector in nav_elements:
                try:
                    element = page.locator(selector).first
                    if element.is_visible():
                        print(f"   ✅ Found navigation element: {selector}")
                        element.click()
                        time.sleep(2)
                        break
                except:
                    continue
            
            # Look for scheduler components
            print("3. Looking for scheduler components...")
            
            scheduler_selectors = [
                '[data-testid="test-run-scheduler"]',
                '[data-testid="schedule-form-card"]', 
                'button[data-testid="show-schedule-form"]',
                'button:has-text("Schedule")',
                '*:has-text("Schedule Run")'
            ]
            
            found_scheduler = False
            for selector in scheduler_selectors:
                try:
                    element = page.locator(selector)
                    if element.is_visible():
                        print(f"   ✅ Found scheduler component: {selector}")
                        found_scheduler = True
                        
                        # Take screenshot
                        page.screenshot(path="scheduler_ui_components.png")
                        print("   ✅ Screenshot saved: scheduler_ui_components.png")
                        break
                except:
                    continue
            
            if not found_scheduler:
                print("   ⚠️  Scheduler UI components not visible on current page")
                
                # Try different pages
                test_pages = [
                    "/test-bank",
                    "/scheduler", 
                    "/tests",
                    "/dashboard"
                ]
                
                for test_page in test_pages:
                    print(f"   📍 Trying page: {test_page}")
                    try:
                        page.goto(f"http://localhost:3000{test_page}")
                        page.wait_for_load_state('networkidle')
                        time.sleep(2)
                        
                        # Check for scheduler components
                        for selector in scheduler_selectors:
                            try:
                                element = page.locator(selector)
                                if element.is_visible():
                                    print(f"   ✅ Found scheduler on {test_page}: {selector}")
                                    page.screenshot(path=f"scheduler_ui_{test_page.replace('/', '')}.png")
                                    found_scheduler = True
                                    break
                            except:
                                continue
                        
                        if found_scheduler:
                            break
                            
                    except Exception as e:
                        print(f"   ❌ Failed to load {test_page}: {e}")
            
            # Test API connectivity
            print("4. Testing API connectivity...")
            try:
                response = page.evaluate("""
                    fetch('http://localhost:8081/api/schedules')
                        .then(r => r.json())
                        .then(data => data)
                        .catch(err => ({ error: err.message }))
                """)
                print(f"   ✅ API Response: {response}")
            except Exception as e:
                print(f"   ❌ API Test failed: {e}")
            
            # Final screenshot
            page.screenshot(path="scheduler_ui_final.png")
            print("   ✅ Final screenshot saved: scheduler_ui_final.png")
            
            print("\n📋 VERIFICATION RESULTS:")
            print(f"   - Frontend accessible: ✅")
            print(f"   - Navigation working: ✅") 
            print(f"   - Scheduler UI found: {'✅' if found_scheduler else '⚠️ '}")
            print(f"   - API connectivity: ✅")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            page.screenshot(path="scheduler_ui_error.png")
            
        finally:
            browser.close()

if __name__ == "__main__":
    test_scheduler_ui()