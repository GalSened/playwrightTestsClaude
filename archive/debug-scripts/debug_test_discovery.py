# Debug test discovery directly
from playwright.sync_api import sync_playwright
import time

def debug_test_discovery():
    """Debug the test discovery process"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        # Listen to console logs
        def handle_console_msg(msg):
            if 'test' in msg.text.lower():
                print(f"CONSOLE LOG: {msg.text}")
        
        page.on('console', handle_console_msg)
        
        try:
            print("DEBUG: Test Discovery Process")
            print("=" * 40)
            
            # Navigate to frontend
            print("1. Loading frontend...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            
            # Open browser dev tools to see console
            print("2. Opening developer tools...")
            
            # Navigate to Test Bank
            print("3. Navigating to Test Bank...")
            page.click('text=Test Bank')
            page.wait_for_load_state('networkidle')
            
            # Wait and monitor console
            print("4. Waiting for test discovery (monitoring console)...")
            time.sleep(15)
            
            # Check for test elements
            print("5. Checking for test elements...")
            
            # Check for any table rows or list items
            rows = page.query_selector_all('tr, .test-item, li')
            print(f"Found {len(rows)} potential test rows/items")
            
            # Check page text for test-related content
            page_content = page.content()
            if 'WeSign' in page_content:
                print("✅ Found WeSign content in page")
            else:
                print("❌ No WeSign content found")
                
            if 'test' in page_content.lower():
                print("✅ Found test-related content")
            else:
                print("❌ No test-related content found")
            
            # Take screenshot
            page.screenshot(path='test-results/debug-test-discovery.png', full_page=True)
            print("6. Screenshot saved")
            
            # Keep browser open for inspection
            print("7. Keeping browser open for manual inspection...")
            time.sleep(60)
            
        except Exception as e:
            print(f"Error: {str(e)}")
            
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    debug_test_discovery()