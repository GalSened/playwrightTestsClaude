"""
Simple scheduler UI test
"""
import time
from playwright.sync_api import sync_playwright

def test_scheduler_ui():
    print("SCHEDULER UI VERIFICATION TEST")
    print("=" * 50)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=800)
        page = browser.new_page()
        
        try:
            print("1. Opening frontend at localhost:3000...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            # Take screenshot
            page.screenshot(path="scheduler_ui_main.png")
            print("   Screenshot saved: scheduler_ui_main.png")
            
            # Get page title and content
            title = page.title()
            print(f"   Page title: {title}")
            
            # Look for any scheduler-related text or buttons
            page_content = page.content()
            scheduler_keywords = ['schedule', 'Schedule', 'test bank', 'Test Bank', 'run', 'Run']
            
            found_keywords = []
            for keyword in scheduler_keywords:
                if keyword in page_content:
                    found_keywords.append(keyword)
            
            print(f"   Found scheduler keywords: {found_keywords}")
            
            # Try to navigate to potential scheduler pages
            test_urls = [
                "http://localhost:3000/test-bank",
                "http://localhost:3000/scheduler", 
                "http://localhost:3000/dashboard"
            ]
            
            for url in test_urls:
                print(f"2. Testing URL: {url}")
                try:
                    page.goto(url)
                    page.wait_for_load_state('networkidle')
                    time.sleep(2)
                    
                    # Check if page loaded successfully
                    current_url = page.url
                    page_title = page.title()
                    print(f"   Current URL: {current_url}")
                    print(f"   Page title: {page_title}")
                    
                    # Look for scheduler components
                    scheduler_selectors = [
                        'button:has-text("Schedule")',
                        '[data-testid*="schedule"]',
                        'input[type="date"]',
                        'select',
                        'form'
                    ]
                    
                    for selector in scheduler_selectors:
                        try:
                            elements = page.locator(selector)
                            count = elements.count()
                            if count > 0:
                                print(f"   Found {count} elements matching: {selector}")
                        except:
                            pass
                    
                    # Take screenshot
                    screenshot_name = f"scheduler_ui_{url.split('/')[-1] or 'root'}.png"
                    page.screenshot(path=screenshot_name)
                    print(f"   Screenshot saved: {screenshot_name}")
                    
                except Exception as e:
                    print(f"   Error loading {url}: {str(e)[:100]}")
            
            # Test API connectivity
            print("3. Testing API connectivity...")
            try:
                response = page.evaluate("""
                    fetch('http://localhost:8081/api/schedules')
                        .then(r => r.json())
                        .then(data => JSON.stringify(data))
                        .catch(err => 'Error: ' + err.message)
                """)
                print(f"   API Response: {response}")
            except Exception as e:
                print(f"   API Test error: {e}")
            
        except Exception as e:
            print(f"Test failed: {e}")
            
        finally:
            print("4. Test completed")
            browser.close()

if __name__ == "__main__":
    test_scheduler_ui()