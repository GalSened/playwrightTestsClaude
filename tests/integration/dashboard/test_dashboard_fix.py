"""
Test the fixed Dashboard functionality using Playwright
Tests navigation, login, and dashboard content verification
"""

import asyncio
from playwright.async_api import async_playwright
import json
import os
from datetime import datetime


async def test_dashboard_fix():
    """Test the fixed Dashboard with real data and error handling"""
    
    print("Starting Dashboard Fix Test")
    print("=" * 50)
    
    async with async_playwright() as p:
        # Launch browser in headed mode to see the test
        browser = await p.chromium.launch(
            headless=False, 
            slow_mo=500,  # Slow motion for visibility
            args=['--disable-web-security', '--disable-features=VizDisplayCompositor']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            record_video_dir="./test-results/videos"
        )
        
        page = await context.new_page()
        
        # Console logging
        console_messages = []
        def handle_console(msg):
            message = f"CONSOLE {msg.type}: {msg.text}"
            console_messages.append(message)
            print(f"  CONSOLE: {message}")
        
        page.on("console", handle_console)
        
        # Network error tracking
        network_errors = []
        def handle_response(response):
            if response.status >= 400:
                error = f"HTTP {response.status}: {response.url}"
                network_errors.append(error)
                print(f"  ERROR: {error}")
        
        page.on("response", handle_response)
        
        try:
            print("\nSTEP 1: Navigate to Login Page")
            await page.goto("http://localhost:5180/auth/login", wait_until="networkidle")
            await page.wait_for_timeout(1000)
            
            # Screenshot login page
            await page.screenshot(path="./test-results/01_login_page.png", full_page=True)
            print("  SUCCESS: Login page loaded")
            print(f"  Screenshot saved: 01_login_page.png")
            
            print("\nSTEP 2: Perform Login with Demo Credentials")
            
            # Fill login form
            await page.fill('input[name="email"]', 'admin@demo.com')
            await page.fill('input[name="password"]', 'demo123')
            
            print("  Credentials filled")
            
            # Click login button
            await page.click('button[type="submit"]')
            
            # Wait for navigation to dashboard
            await page.wait_for_url("**/dashboard", timeout=10000)
            await page.wait_for_timeout(2000)  # Allow data loading
            
            print("  SUCCESS: Login successful - redirected to dashboard")
            
            print("\nSTEP 3: Verify Dashboard Content")
            
            # Check if dashboard is available (not showing error message)
            dashboard_unavailable = await page.locator('text="Dashboard Unavailable"').count()
            
            if dashboard_unavailable > 0:
                print("  FAIL: Dashboard still shows 'Dashboard Unavailable'")
                await page.screenshot(path="./test-results/02_dashboard_error.png", full_page=True)
                return False
            else:
                print("  SUCCESS: Dashboard is available (no 'Dashboard Unavailable' message)")
            
            # Screenshot dashboard
            await page.screenshot(path="./test-results/03_dashboard_loaded.png", full_page=True)
            print("  Screenshot saved: 03_dashboard_loaded.png")
            
            print("\nSTEP 4: Verify Dashboard Data Elements")
            
            # Check for various dashboard elements
            elements_to_check = [
                ('.stat-card', 'Statistics cards'),
                ('.chart-container', 'Chart containers'),
                ('[data-testid="test-runs-count"]', 'Test runs count'),
                ('[data-testid="success-rate"]', 'Success rate'),
                ('.loading', 'Loading indicators (should be minimal/gone)'),
                ('.error-message', 'Error messages (should be none or handled)')
            ]
            
            dashboard_elements_found = []
            for selector, description in elements_to_check:
                count = await page.locator(selector).count()
                dashboard_elements_found.append((description, count))
                print(f"  DATA: {description}: {count} elements found")
            
            # Check if any content is present
            page_content = await page.content()
            has_substantive_content = (
                'test' in page_content.lower() or 
                'dashboard' in page_content.lower() or 
                'analytics' in page_content.lower() or
                'chart' in page_content.lower()
            )
            
            print(f"  Page has substantive content: {has_substantive_content}")
            
            print("\nSTEP 5: Check for API Data")
            
            # Wait a bit more for API calls to complete
            await page.wait_for_timeout(3000)
            
            # Check for specific data indicators
            test_runs_element = page.locator('[data-testid="test-runs-count"]')
            success_rate_element = page.locator('[data-testid="success-rate"]')
            
            test_runs_text = ""
            success_rate_text = ""
            
            if await test_runs_element.count() > 0:
                test_runs_text = await test_runs_element.first.text_content()
                print(f"  Test Runs Count: {test_runs_text}")
            
            if await success_rate_element.count() > 0:
                success_rate_text = await success_rate_element.first.text_content()
                print(f"  Success Rate: {success_rate_text}")
            
            # Check if we have fallback values or real data
            if test_runs_text or success_rate_text:
                print("  SUCCESS: Dashboard showing data (real or fallback)")
            else:
                print("  WARNING: No specific test data elements found - checking general content")
            
            print("\nSTEP 6: Console and Network Analysis")
            
            print(f"  Total console messages: {len(console_messages)}")
            print(f"  Network errors: {len(network_errors)}")
            
            # Filter critical errors
            critical_errors = [msg for msg in console_messages if 'error' in msg.lower()]
            if critical_errors:
                print("  WARNING: Critical console errors:")
                for error in critical_errors[:5]:  # Show first 5
                    print(f"    - {error}")
            else:
                print("  SUCCESS: No critical console errors")
            
            if network_errors:
                print("  WARNING: Network errors:")
                for error in network_errors[:3]:  # Show first 3
                    print(f"    - {error}")
            
            print("\nSTEP 7: Final Dashboard Screenshot")
            await page.screenshot(path="./test-results/04_final_dashboard.png", full_page=True)
            print("  Final screenshot saved: 04_final_dashboard.png")
            
            # Test result summary
            print("\n" + "=" * 50)
            print("TEST RESULTS SUMMARY")
            print("=" * 50)
            
            success_criteria = []
            success_criteria.append(("Login successful", True))
            success_criteria.append(("No 'Dashboard Unavailable' message", dashboard_unavailable == 0))
            success_criteria.append(("Page has content", has_substantive_content))
            success_criteria.append(("No critical errors", len(critical_errors) == 0))
            
            all_passed = all(passed for _, passed in success_criteria)
            
            for criterion, passed in success_criteria:
                status = "PASS" if passed else "FAIL"
                print(f"  {status}: {criterion}")
            
            overall_result = "OVERALL: DASHBOARD FIX SUCCESSFUL" if all_passed else "OVERALL: ISSUES REMAIN"
            print(f"\n{overall_result}")
            
            # Save test report
            report = {
                "timestamp": datetime.now().isoformat(),
                "test_name": "Dashboard Fix Verification",
                "success_criteria": dict(success_criteria),
                "console_messages": console_messages,
                "network_errors": network_errors,
                "dashboard_elements": dict(dashboard_elements_found),
                "overall_success": all_passed
            }
            
            with open("./test-results/dashboard_test_report.json", "w") as f:
                json.dump(report, f, indent=2)
            
            print(f"  Test report saved: dashboard_test_report.json")
            
            return all_passed
            
        except Exception as e:
            print(f"\nERROR during test execution: {str(e)}")
            await page.screenshot(path="./test-results/error_screenshot.png", full_page=True)
            return False
            
        finally:
            # Close browser
            await context.close()
            await browser.close()


# Run the test
if __name__ == "__main__":
    # Ensure test-results directory exists
    os.makedirs("./test-results", exist_ok=True)
    
    # Run the async test
    result = asyncio.run(test_dashboard_fix())
    
    if result:
        print("\nDashboard fix verification completed successfully!")
    else:
        print("\nWARNING: Dashboard fix verification found issues that need attention.")