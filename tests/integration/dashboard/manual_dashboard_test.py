"""
Manual Dashboard Test - Step by step with manual navigation
"""

from playwright.sync_api import sync_playwright
import time


def manual_dashboard_test():
    print("Manual Dashboard Test")
    print("=" * 40)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=2000)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        console_messages = []
        def handle_console(msg):
            try:
                message = f"{msg.type}: {msg.text[:100]}"
                console_messages.append(message)
                print(f"  CONSOLE: {message}")
            except:
                pass
        
        page.on("console", handle_console)
        
        try:
            print("\n1. Going to login page...")
            page.goto("http://localhost:5180/auth/login")
            time.sleep(3)
            
            print("2. Filling login form...")
            page.fill('input[name="email"]', 'admin@demo.com')
            page.fill('input[name="password"]', 'demo123')
            time.sleep(1)
            
            print("3. Clicking login...")
            page.click('button[type="submit"]')
            
            # Wait and check multiple times for navigation
            print("4. Waiting for navigation...")
            for i in range(10):  # Wait up to 20 seconds
                current_url = page.url
                print(f"   Current URL ({i+1}): {current_url}")
                
                if "dashboard" in current_url:
                    print("   SUCCESS: Reached dashboard!")
                    break
                    
                time.sleep(2)
            else:
                print("   WARNING: Did not reach dashboard URL")
            
            # Give dashboard time to load data
            print("5. Waiting for dashboard to load data...")
            time.sleep(5)
            
            # Check dashboard content
            print("6. Checking dashboard content...")
            
            # Take screenshot
            page.screenshot(path="./test-results/manual_dashboard.png", full_page=True)
            print("   Screenshot saved: manual_dashboard.png")
            
            # Check for error messages
            error_elements = page.locator('text="Dashboard Unavailable"').count()
            print(f"   'Dashboard Unavailable' messages: {error_elements}")
            
            # Check for any content
            body_text = page.text_content('body')
            has_dashboard_content = any(word in body_text.lower() for word in ['dashboard', 'test', 'analytics', 'chart'])
            print(f"   Has dashboard-related content: {has_dashboard_content}")
            
            # Look for specific elements
            test_runs = page.locator('[data-testid*="test"]').count()
            charts = page.locator('[class*="chart"], [id*="chart"]').count()
            stats = page.locator('[class*="stat"], [data-testid*="stat"]').count()
            
            print(f"   Test-related elements: {test_runs}")
            print(f"   Chart elements: {charts}")
            print(f"   Stat elements: {stats}")
            
            # Check for any numerical data
            has_numbers = any(char.isdigit() for char in body_text[:1000])
            print(f"   Contains numerical data: {has_numbers}")
            
            # Summary
            print("\n" + "=" * 40)
            print("DASHBOARD TEST RESULTS:")
            print("=" * 40)
            
            if error_elements == 0:
                print("  SUCCESS: No 'Dashboard Unavailable' error")
            else:
                print("  FAIL: Dashboard still shows unavailable")
            
            if has_dashboard_content:
                print("  SUCCESS: Dashboard has relevant content")
            else:
                print("  FAIL: No dashboard content found")
            
            if test_runs > 0 or charts > 0 or stats > 0:
                print("  SUCCESS: Dashboard components found")
            else:
                print("  WARNING: No specific dashboard components")
            
            if has_numbers:
                print("  SUCCESS: Dashboard shows data/numbers")
            else:
                print("  WARNING: No numerical data visible")
            
            # Console error summary
            errors = [msg for msg in console_messages if 'error' in msg.lower()]
            non_socket_errors = [err for err in errors if 'socket' not in err.lower() and 'devtools' not in err.lower()]
            
            print(f"  Console errors (total): {len(errors)}")
            print(f"  Critical errors (non-socket): {len(non_socket_errors)}")
            
            # Overall assessment
            major_issues = error_elements > 0 or not has_dashboard_content
            if major_issues:
                print("\n  OVERALL: DASHBOARD NEEDS MORE WORK")
            else:
                print("\n  OVERALL: DASHBOARD APPEARS TO BE WORKING")
            
            # Keep browser open for manual inspection
            print(f"\nBrowser staying open for 30 seconds for manual inspection...")
            print("Check the dashboard visually in the browser window.")
            time.sleep(30)
            
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="./test-results/error_manual.png")
        
        finally:
            browser.close()


if __name__ == "__main__":
    import os
    os.makedirs("./test-results", exist_ok=True)
    manual_dashboard_test()