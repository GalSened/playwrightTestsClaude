"""
Simple Dashboard Test - Windows compatible
Tests the fixed Dashboard functionality
"""

from playwright.sync_api import sync_playwright
import json
import os
from datetime import datetime


def test_dashboard_fix():
    """Test the fixed Dashboard with error handling"""
    
    print("Starting Dashboard Fix Test")
    print("=" * 50)
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(
            headless=False, 
            slow_mo=1000  # Visible and slow for observation
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        
        page = context.new_page()
        
        # Simple console logging without special characters
        console_messages = []
        def handle_console(msg):
            try:
                message = f"CONSOLE {msg.type}: {msg.text[:100]}"  # Truncate long messages
                console_messages.append(message)
                print(f"  {message}")
            except:
                console_messages.append("CONSOLE: [encoding error]")
        
        page.on("console", handle_console)
        
        # Network error tracking
        network_errors = []
        def handle_response(response):
            try:
                if response.status >= 400:
                    error = f"HTTP {response.status}: {response.url[:50]}"  # Truncate URL
                    network_errors.append(error)
                    print(f"  ERROR: {error}")
            except:
                network_errors.append("Network error - encoding issue")
        
        page.on("response", handle_response)
        
        try:
            print("\nSTEP 1: Navigate to Login Page")
            page.goto("http://localhost:5180/auth/login", wait_until="networkidle")
            page.wait_for_timeout(2000)
            
            # Create test results directory
            os.makedirs("./test-results", exist_ok=True)
            
            # Screenshot login page
            page.screenshot(path="./test-results/01_login_page.png", full_page=True)
            print("  SUCCESS: Login page loaded and screenshot taken")
            
            print("\nSTEP 2: Perform Login with Demo Credentials")
            
            # Fill login form
            page.fill('input[name="email"]', 'admin@demo.com')
            page.fill('input[name="password"]', 'demo123')
            print("  Credentials filled")
            
            # Click login button and wait for navigation
            page.click('button[type="submit"]')
            page.wait_for_url("**/dashboard", timeout=15000)
            page.wait_for_timeout(3000)  # Allow data loading
            
            print("  SUCCESS: Login successful - redirected to dashboard")
            
            print("\nSTEP 3: Verify Dashboard Content")
            
            # Check if dashboard shows error
            dashboard_unavailable = page.locator('text="Dashboard Unavailable"').count()
            
            if dashboard_unavailable > 0:
                print("  FAIL: Dashboard still shows 'Dashboard Unavailable'")
                page.screenshot(path="./test-results/02_dashboard_error.png", full_page=True)
                dashboard_working = False
            else:
                print("  SUCCESS: Dashboard is available (no error message)")
                dashboard_working = True
            
            # Screenshot current state
            page.screenshot(path="./test-results/03_dashboard_loaded.png", full_page=True)
            print("  Screenshot saved: dashboard state captured")
            
            print("\nSTEP 4: Check Dashboard Data Elements")
            
            # Check for common dashboard elements
            elements_found = {}
            
            # Test for various dashboard components
            test_elements = [
                ("test-runs-count", "Test runs counter"),
                ("success-rate", "Success rate display"),
                ("chart", "Charts"),
                ("stat", "Statistics"),
                ("loading", "Loading indicators"),
                ("error", "Error messages")
            ]
            
            for test_id, description in test_elements:
                count = page.locator(f'[data-testid*="{test_id}"], [class*="{test_id}"], text={test_id}').count()
                elements_found[description] = count
                print(f"  DATA: {description}: {count} found")
            
            # Check page content
            page_text = page.text_content('body')
            has_content = any(keyword in page_text.lower() for keyword in ['dashboard', 'test', 'analytics', 'chart', 'data'])
            print(f"  Page has dashboard-related content: {has_content}")
            
            print("\nSTEP 5: Wait for API Data Loading")
            
            # Give more time for API calls
            page.wait_for_timeout(5000)
            
            # Try to find specific data elements
            test_runs_visible = page.locator('[data-testid="test-runs-count"]').count() > 0
            success_rate_visible = page.locator('[data-testid="success-rate"]').count() > 0
            
            print(f"  Test runs data visible: {test_runs_visible}")
            print(f"  Success rate data visible: {success_rate_visible}")
            
            # Check if any numbers/data are displayed
            has_numbers = any(char.isdigit() for char in page_text[:500])  # Check first 500 chars
            print(f"  Page contains numerical data: {has_numbers}")
            
            print("\nSTEP 6: Error Analysis")
            print(f"  Total console messages: {len(console_messages)}")
            print(f"  Network errors: {len(network_errors)}")
            
            # Count critical errors
            critical_errors = [msg for msg in console_messages if 'error' in msg.lower() and 'devtools' not in msg.lower()]
            print(f"  Critical console errors: {len(critical_errors)}")
            
            if critical_errors:
                print("  Sample critical errors:")
                for error in critical_errors[:3]:
                    print(f"    - {error[:80]}")  # Truncate for safety
            
            if network_errors:
                print("  Network errors found:")
                for error in network_errors[:3]:
                    print(f"    - {error}")
            
            print("\nSTEP 7: Final Screenshot")
            page.screenshot(path="./test-results/04_final_dashboard.png", full_page=True)
            print("  Final screenshot saved")
            
            # Test Results Summary
            print("\n" + "=" * 50)
            print("TEST RESULTS SUMMARY")
            print("=" * 50)
            
            success_criteria = [
                ("Login successful", True),
                ("Dashboard loads without error message", dashboard_working),
                ("Dashboard has content", has_content),
                ("No critical console errors", len(critical_errors) == 0),
                ("No network errors", len(network_errors) == 0)
            ]
            
            all_passed = all(passed for _, passed in success_criteria)
            
            for criterion, passed in success_criteria:
                status = "PASS" if passed else "FAIL"
                print(f"  {status}: {criterion}")
            
            overall_result = "OVERALL: DASHBOARD FIX SUCCESSFUL" if all_passed else "OVERALL: SOME ISSUES REMAIN"
            print(f"\n{overall_result}")
            
            # Save test report
            report = {
                "timestamp": datetime.now().isoformat(),
                "test_name": "Dashboard Fix Verification",
                "success_criteria": dict(success_criteria),
                "console_message_count": len(console_messages),
                "network_error_count": len(network_errors),
                "critical_error_count": len(critical_errors),
                "dashboard_elements": elements_found,
                "overall_success": all_passed
            }
            
            with open("./test-results/dashboard_test_report.json", "w", encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=True)
            
            print("  Test report saved: dashboard_test_report.json")
            
            return all_passed
            
        except Exception as e:
            print(f"\nERROR during test execution: {str(e)[:100]}")  # Truncate error
            try:
                page.screenshot(path="./test-results/error_screenshot.png", full_page=True)
            except:
                print("  Could not capture error screenshot")
            return False
            
        finally:
            # Close browser
            try:
                context.close()
                browser.close()
            except:
                pass  # Ignore cleanup errors


if __name__ == "__main__":
    # Run the test
    result = test_dashboard_fix()
    
    if result:
        print("\nDashboard fix verification completed successfully!")
    else:
        print("\nDashboard fix verification found issues that need attention.")
    
    # Keep browser open for a moment to see results
    import time
    time.sleep(2)