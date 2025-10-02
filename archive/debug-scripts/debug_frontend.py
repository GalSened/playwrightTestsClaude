# Debug the frontend navigation structure
from playwright.sync_api import sync_playwright
import time

def debug_frontend():
    """Debug the frontend to understand its structure"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=1000)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        try:
            print("DEBUGGING FRONTEND STRUCTURE")
            print("=" * 40)
            
            # Navigate to application
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            
            print("1. Page title:", page.title())
            print("2. Current URL:", page.url)
            
            # Get all navigation links
            print("3. Looking for navigation elements...")
            
            nav_selectors = [
                'nav a',
                '.nav-link',
                '[role="navigation"] a',
                'a[href]',
                'button'
            ]
            
            for selector in nav_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    print(f"Found {len(elements)} elements with selector '{selector}':")
                    for i, element in enumerate(elements[:10]):  # Limit to first 10
                        text = element.text_content() or ''
                        href = element.get_attribute('href') or 'no href'
                        print(f"  - {text.strip()[:30]} (href: {href})")
                    print()
            
            # Get all text content to see what's actually on the page
            print("4. Page text content (first 500 chars):")
            page_text = page.text_content()
            print(page_text[:500])
            print("...")
            
            # Take screenshot
            page.screenshot(path='test-results/debug-frontend.png', full_page=True)
            print("5. Screenshot saved as debug-frontend.png")
            
            # Keep browser open for manual inspection
            print("6. Browser staying open for manual inspection...")
            time.sleep(30)
            
        except Exception as e:
            print(f"Debug error: {str(e)}")
            
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    debug_frontend()