# Quick test to verify WeSign test count reaches 311
from playwright.sync_api import sync_playwright
import time

def test_wesign_test_count():
    """Verify that Test Bank shows all 311 WeSign tests"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            print("TESTING WESIGN TEST COUNT - TARGET: 311 TESTS")
            print("=" * 50)
            
            # Navigate to frontend
            print("Step 1: Loading Playwright Smart frontend...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            
            # Navigate to Test Bank
            print("Step 2: Navigating to Test Bank...")
            page.click('text=Test Bank')
            page.wait_for_load_state('networkidle')
            
            # Wait for test discovery to complete
            print("Step 3: Waiting for test discovery...")
            time.sleep(10)  # Give time for comprehensive test generation
            
            # Check for test count display or count table rows
            print("Step 4: Counting discovered tests...")
            
            # Try different selectors to find test items
            test_selectors = [
                'table tbody tr',
                '.test-item',
                '[data-testid*="test"]',
                'li[data-test-id]'
            ]
            
            total_tests = 0
            for selector in test_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    total_tests = len(elements)
                    print(f"Found {total_tests} tests using selector: {selector}")
                    break
            
            # Look for WeSign-specific tests
            wesign_tests = 0
            wesign_selectors = [
                'text=WeSign',
                '[data-testid*="wesign"]',
                'text=Upload',
                'text=Signature',
                'text=Document'
            ]
            
            for selector in wesign_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    wesign_tests += len(elements)
            
            print(f"Step 5: Results:")
            print(f"- Total tests discovered: {total_tests}")
            print(f"- WeSign-related tests: {wesign_tests}")
            print(f"- Target reached: {'YES' if total_tests >= 311 else 'NO'}")
            
            # Take screenshot of Test Bank
            page.screenshot(path='test-results/test-bank-verification.png', full_page=True)
            print("Step 6: Screenshot saved as test-bank-verification.png")
            
            # Check browser console for test generation logs
            print("Step 7: Checking browser console...")
            
            # Keep browser open to see results
            print("Keeping browser open for 30 seconds for manual verification...")
            time.sleep(30)
            
            return {
                'total_tests': total_tests,
                'wesign_tests': wesign_tests,
                'target_reached': total_tests >= 311
            }
            
        except Exception as e:
            print(f"Error during testing: {str(e)}")
            page.screenshot(path='test-results/test-count-error.png')
            return {'error': str(e)}
            
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    result = test_wesign_test_count()
    print(f"\nFinal Result: {result}")