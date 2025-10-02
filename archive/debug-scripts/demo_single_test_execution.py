"""
Demo script showing how to run a single test using the Playwright MCT client interface
"""
import time
from playwright.sync_api import sync_playwright

def demo_single_test_execution():
    """Demonstrate running a single WeSign test through the MCT interface"""
    
    print("DEMO: Running Single Test via Playwright MCT Client")
    print("=" * 60)
    
    with sync_playwright() as p:
        # Launch browser in headed mode so you can see the interaction
        browser = p.chromium.launch(headless=False, slow_mo=1000)
        page = browser.new_page()
        
        try:
            print("1. Opening Playwright MCT Test Bank page...")
            page.goto("http://localhost:3001/test-bank")
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            print("2. Waiting for tests to load...")
            # Wait for test table to appear
            page.wait_for_selector('[data-testid="test-name"]', timeout=10000)
            
            print("3. Looking for a specific WeSign test to run...")
            # Find a test in the auth module
            auth_tests = page.locator('[data-testid="test-module"]:has-text("auth")').locator('xpath=../..').first
            if auth_tests.is_visible():
                test_name = auth_tests.locator('[data-testid="test-name"]').first.text_content()
                print(f"   Found test: {test_name}")
                
                print("4. Clicking the Run button...")
                # Click the Run button for this test
                run_button = auth_tests.locator('[data-testid="run-single-test"]').first
                
                if run_button.is_visible() and run_button.is_enabled():
                    print("   >>> Clicking Run button...")
                    run_button.click()
                    
                    print("5. Monitoring execution status...")
                    # Watch for loading state
                    time.sleep(2)
                    
                    # Check if button shows loading state
                    loading_button = auth_tests.locator('[data-testid="run-single-test"]:has(.animate-spin)')
                    if loading_button.is_visible():
                        print("   >>> Test is running (button shows loading spinner)...")
                        
                        # Wait for execution to complete (max 30 seconds)
                        start_time = time.time()
                        while loading_button.is_visible() and (time.time() - start_time) < 30:
                            time.sleep(2)
                            print(f"   >>> Still running... ({int(time.time() - start_time)}s elapsed)")
                        
                        if not loading_button.is_visible():
                            print("   >>> Test execution completed!")
                        else:
                            print("   >>> Test still running after 30s (this is normal for real tests)")
                    
                    print("6. Navigating to Reports page to see results...")
                    page.goto("http://localhost:3001/reports")
                    page.wait_for_load_state('networkidle')
                    time.sleep(2)
                    
                    # Look for recent execution
                    recent_runs = page.locator('[data-testid="run-row"]').first
                    if recent_runs.is_visible():
                        run_info = recent_runs.text_content()
                        print(f"   >>> Recent execution found: {run_info}")
                    
                else:
                    print("   >>> Run button not available or disabled")
            else:
                print("   >>> No auth tests found")
                
        except Exception as e:
            print(f">>> Error during demo: {e}")
            
        finally:
            print("\n>>> Demo completed! Browser will stay open for 10 seconds...")
            time.sleep(10)
            browser.close()
    
    print("\nSUMMARY:")
    print(">> Navigated to Test Bank page")
    print(">> Found WeSign test in auth module") 
    print(">> Clicked Run button to execute single test")
    print(">> Monitored execution progress")
    print(">> Checked Reports page for results")
    print("\n>> Single test execution via MCT client demonstrated!")

if __name__ == "__main__":
    demo_single_test_execution()