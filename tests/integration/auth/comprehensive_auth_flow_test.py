"""
Comprehensive Frontend Authentication Flow Test

Tests the complete JWT authentication flow with real credentials:
- Login form validation
- Protected route access
- Authentication state persistence
- Logout functionality

Using Playwright MCP for real browser testing with evidence capture.
"""

from playwright.async_api import async_playwright
import json
import time
import os
from datetime import datetime
import sys
import asyncio

class AuthFlowTester:
    def __init__(self):
        self.frontend_url = "http://localhost:5173"
        self.backend_url = "http://localhost:8080"
        self.demo_email = "admin@demo.com"
        self.demo_password = "demo123"
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.screenshots_dir = "artifacts/screenshots"
        self.results = {
            "test_run_id": f"auth_flow_{self.timestamp}",
            "start_time": datetime.now().isoformat(),
            "frontend_url": self.frontend_url,
            "backend_url": self.backend_url,
            "demo_credentials": {"email": self.demo_email, "password": "***"},
            "tests": {},
            "evidence": {
                "screenshots": [],
                "videos": [],
                "network_logs": []
            },
            "summary": {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "critical_failures": []
            }
        }
        
        # Ensure screenshots directory exists
        os.makedirs(self.screenshots_dir, exist_ok=True)
        
    def log_test(self, test_name, status, details, screenshot_path=None):
        """Log test result with evidence"""
        self.results["tests"][test_name] = {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
            "screenshot": screenshot_path
        }
        
        self.results["summary"]["total_tests"] += 1
        if status == "PASS":
            self.results["summary"]["passed"] += 1
        else:
            self.results["summary"]["failed"] += 1
            if details.get("critical", False):
                self.results["summary"]["critical_failures"].append(test_name)
        
        print(f"[{status}] {test_name}: {details.get('message', 'No details')}")
        if screenshot_path:
            print(f"    Screenshot: {screenshot_path}")
            self.results["evidence"]["screenshots"].append(screenshot_path)

    async def take_screenshot(self, page, name):
        """Take screenshot and return path"""
        filename = f"auth_flow_{name}_{self.timestamp}.png"
        path = os.path.join(self.screenshots_dir, filename)
        await page.screenshot(path=path, full_page=True)
        return path

    async def test_frontend_accessibility(self, page):
        """Test that frontend is accessible"""
        try:
            page.goto(self.frontend_url, timeout=10000)
            page.wait_for_load_state("networkidle", timeout=5000)
            
            # Take initial screenshot
            screenshot = await self.take_screenshot(page, "01_initial_load")
            
            # Check if page loaded successfully
            title = page.title()
            
            if not title:
                raise Exception("Page title is empty - frontend may not have loaded")
            
            self.log_test(
                "frontend_accessibility",
                "PASS",
                {
                    "message": f"Frontend accessible at {self.frontend_url}",
                    "title": title,
                    "url": page.url
                },
                screenshot
            )
            return True
            
        except Exception as e:
            screenshot = await self.take_screenshot(page, "01_initial_load_error")
            self.log_test(
                "frontend_accessibility",
                "FAIL",
                {
                    "message": f"Frontend not accessible: {str(e)}",
                    "critical": True
                },
                screenshot
            )
            return False

    async def test_login_form(self, page):
        """Test login form with demo credentials"""
        try:
            # Look for login form elements
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
            password_input = page.locator('input[type="password"], input[name="password"]')
            login_button = page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"]')
            
            # Wait for form elements to be visible
            email_input.wait_for(state="visible", timeout=5000)
            password_input.wait_for(state="visible", timeout=5000)
            login_button.wait_for(state="visible", timeout=5000)
            
            # Fill credentials
            email_input.fill(self.demo_email)
            password_input.fill(self.demo_password)
            
            # Take screenshot before login
            screenshot_before = await self.take_screenshot(page, "02_credentials_filled")
            
            # Click login button
            login_button.click()
            
            # Wait for navigation or response
            page.wait_for_timeout(2000)
            
            # Take screenshot after login attempt
            screenshot_after = await self.take_screenshot(page, "03_after_login_attempt")
            
            # Check for successful login indicators
            current_url = page.url
            page_content = page.content()
            
            # Look for success indicators (using first() to avoid strict mode violations)
            success_indicators = [
                "dashboard" in current_url.lower(),
                "welcome" in page_content.lower(),
                page.locator('text="Dashboard"').first.is_visible() or page.locator('text="Test Bank"').first.is_visible(),
                page.locator('button:has-text("Logout"), a:has-text("Logout")').first.is_visible()
            ]
            
            if any(success_indicators):
                self.log_test(
                    "login_form_submission",
                    "PASS",
                    {
                        "message": "Login form submitted successfully with demo credentials",
                        "current_url": current_url,
                        "success_indicators": success_indicators
                    },
                    screenshot_after
                )
                return True
            else:
                # Check for error messages
                error_messages = []
                try:
                    error_elements = page.locator('text*="error", text*="invalid", text*="incorrect", .error, .alert-danger')
                    if error_elements.count() > 0:
                        for i in range(error_elements.count()):
                            error_messages.append(error_elements.nth(i).text_content())
                except:
                    pass
                
                self.log_test(
                    "login_form_submission",
                    "FAIL",
                    {
                        "message": "Login form submission failed - no success indicators found",
                        "current_url": current_url,
                        "error_messages": error_messages,
                        "critical": True
                    },
                    screenshot_after
                )
                return False
                
        except Exception as e:
            screenshot = await self.take_screenshot(page, "03_login_form_error")
            self.log_test(
                "login_form_submission",
                "FAIL",
                {
                    "message": f"Login form test failed: {str(e)}",
                    "critical": True
                },
                screenshot
            )
            return False

    async def test_dashboard_access(self, page):
        """Test access to dashboard after login"""
        try:
            # Navigate to dashboard or look for dashboard content
            dashboard_indicators = [
                page.locator('text="Dashboard"'),
                page.locator('[href*="dashboard"]'),
                page.locator('.dashboard'),
                page.locator('h1:has-text("Dashboard"), h2:has-text("Dashboard")')
            ]
            
            # Check if we're already on dashboard or navigate to it
            current_url = page.url
            if "dashboard" not in current_url.lower():
                # Try to navigate to dashboard
                try:
                    dashboard_link = page.locator('a[href*="dashboard"], button:has-text("Dashboard")').first
                    if dashboard_link.is_visible():
                        dashboard_link.click()
                        page.wait_for_timeout(2000)
                except:
                    # Try direct navigation
                    page.goto(f"{self.frontend_url}/dashboard")
                    page.wait_for_timeout(2000)
            
            screenshot = await self.take_screenshot(page, "04_dashboard_access")
            
            # Check for dashboard content
            dashboard_present = False
            for indicator in dashboard_indicators:
                try:
                    if indicator.count() > 0 and indicator.first.is_visible():
                        dashboard_present = True
                        break
                except:
                    continue
            
            if dashboard_present:
                self.log_test(
                    "dashboard_access",
                    "PASS",
                    {
                        "message": "Dashboard accessible after login",
                        "current_url": page.url
                    },
                    screenshot
                )
                return True
            else:
                self.log_test(
                    "dashboard_access",
                    "FAIL",
                    {
                        "message": "Dashboard not accessible - protected route may not be working",
                        "current_url": page.url
                    },
                    screenshot
                )
                return False
                
        except Exception as e:
            screenshot = await self.take_screenshot(page, "04_dashboard_error")
            self.log_test(
                "dashboard_access",
                "FAIL",
                {
                    "message": f"Dashboard access test failed: {str(e)}"
                },
                screenshot
            )
            return False

    async def test_protected_routes_navigation(self, page):
        """Test navigation to all protected routes"""
        protected_routes = [
            ("test-bank", ["Test Bank", "test bank"]),
            ("analytics", ["Analytics", "analytics"]),
            ("reports", ["Reports", "reports"]),
            ("schedules", ["Schedules", "schedules"])
        ]
        
        navigation_results = {}
        
        for route_name, text_indicators in protected_routes:
            try:
                # Try to navigate to the route
                route_url = f"{self.frontend_url}/{route_name}"
                page.goto(route_url, timeout=10000)
                page.wait_for_timeout(2000)
                
                screenshot = await self.take_screenshot(page, f"05_route_{route_name}")
                
                # Check if route is accessible (not redirected to login)
                current_url = page.url
                is_accessible = not ("login" in current_url.lower() or "signin" in current_url.lower())
                
                # Check for route-specific content
                content_present = False
                for indicator in text_indicators:
                    try:
                        if page.locator(f'text="{indicator}"').first.is_visible():
                            content_present = True
                            break
                    except:
                        continue
                
                navigation_results[route_name] = {
                    "accessible": is_accessible,
                    "content_present": content_present,
                    "final_url": current_url,
                    "screenshot": screenshot
                }
                
            except Exception as e:
                screenshot = await self.take_screenshot(page, f"05_route_{route_name}_error")
                navigation_results[route_name] = {
                    "accessible": False,
                    "content_present": False,
                    "error": str(e),
                    "screenshot": screenshot
                }
        
        # Determine overall result
        accessible_count = sum(1 for result in navigation_results.values() if result.get("accessible", False))
        total_routes = len(protected_routes)
        
        if accessible_count >= total_routes * 0.75:  # 75% success threshold
            self.log_test(
                "protected_routes_navigation",
                "PASS",
                {
                    "message": f"Successfully navigated to {accessible_count}/{total_routes} protected routes",
                    "route_results": navigation_results
                }
            )
            return True
        else:
            self.log_test(
                "protected_routes_navigation",
                "FAIL",
                {
                    "message": f"Only {accessible_count}/{total_routes} protected routes accessible",
                    "route_results": navigation_results
                }
            )
            return False

    async def test_authentication_persistence(self, page):
        """Test that authentication persists across page refreshes"""
        try:
            # Get current authenticated state
            current_url = page.url
            
            # Refresh the page
            page.reload()
            page.wait_for_load_state("networkidle", timeout=10000)
            
            screenshot = await self.take_screenshot(page, "06_after_page_refresh")
            
            # Check if still authenticated (not redirected to login)
            new_url = page.url
            is_still_authenticated = not ("login" in new_url.lower() or "signin" in new_url.lower())
            
            # Check for authenticated user indicators
            auth_indicators = [
                page.locator('button:has-text("Logout"), a:has-text("Logout")').first.is_visible(),
                page.locator('text="Dashboard"').first.is_visible(),
                page.locator('.user-menu, .profile').first.is_visible()
            ]
            
            has_auth_indicators = any(auth_indicators)
            
            if is_still_authenticated and has_auth_indicators:
                self.log_test(
                    "authentication_persistence",
                    "PASS",
                    {
                        "message": "Authentication state persisted after page refresh",
                        "url_before_refresh": current_url,
                        "url_after_refresh": new_url
                    },
                    screenshot
                )
                return True
            else:
                self.log_test(
                    "authentication_persistence",
                    "FAIL",
                    {
                        "message": "Authentication state lost after page refresh",
                        "url_before_refresh": current_url,
                        "url_after_refresh": new_url,
                        "auth_indicators": has_auth_indicators
                    },
                    screenshot
                )
                return False
                
        except Exception as e:
            screenshot = await self.take_screenshot(page, "06_auth_persistence_error")
            self.log_test(
                "authentication_persistence",
                "FAIL",
                {
                    "message": f"Authentication persistence test failed: {str(e)}"
                },
                screenshot
            )
            return False

    async def test_logout_functionality(self, page):
        """Test logout functionality"""
        try:
            # Look for logout button/link
            logout_selectors = [
                'button:has-text("Logout")',
                'a:has-text("Logout")',
                'button:has-text("Sign Out")',
                'a:has-text("Sign Out")',
                '[data-testid="logout"]',
                '.logout-button'
            ]
            
            logout_element = None
            for selector in logout_selectors:
                elements = page.locator(selector)
                if elements.count() > 0 and elements.first.is_visible():
                    logout_element = elements.first
                    break
            
            if not logout_element:
                # Take screenshot showing no logout button found
                screenshot = await self.take_screenshot(page, "07_logout_button_not_found")
                self.log_test(
                    "logout_functionality",
                    "FAIL",
                    {
                        "message": "Logout button/link not found",
                        "tried_selectors": logout_selectors
                    },
                    screenshot
                )
                return False
            
            # Click logout
            logout_element.click()
            page.wait_for_timeout(2000)
            
            screenshot = await self.take_screenshot(page, "07_after_logout")
            
            # Check if redirected to login page
            current_url = page.url
            is_logged_out = "login" in current_url.lower() or "signin" in current_url.lower()
            
            # Check for login form presence
            has_login_form = (
                page.locator('input[type="email"], input[name="email"]').is_visible() and
                page.locator('input[type="password"]').is_visible()
            )
            
            if is_logged_out or has_login_form:
                self.log_test(
                    "logout_functionality",
                    "PASS",
                    {
                        "message": "Logout functionality working - redirected to login",
                        "final_url": current_url
                    },
                    screenshot
                )
                return True
            else:
                self.log_test(
                    "logout_functionality",
                    "FAIL",
                    {
                        "message": "Logout failed - still appears to be authenticated",
                        "final_url": current_url
                    },
                    screenshot
                )
                return False
                
        except Exception as e:
            screenshot = await self.take_screenshot(page, "07_logout_error")
            self.log_test(
                "logout_functionality",
                "FAIL",
                {
                    "message": f"Logout functionality test failed: {str(e)}"
                },
                screenshot
            )
            return False

    def generate_report(self):
        """Generate final test report"""
        self.results["end_time"] = datetime.now().isoformat()
        
        # Calculate test duration
        start_time = datetime.fromisoformat(self.results["start_time"])
        end_time = datetime.fromisoformat(self.results["end_time"])
        duration = (end_time - start_time).total_seconds()
        self.results["duration_seconds"] = duration
        
        # Save results to JSON
        report_file = f"auth_flow_test_results_{self.timestamp}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"COMPREHENSIVE AUTHENTICATION FLOW TEST RESULTS")
        print(f"{'='*60}")
        print(f"Test Run ID: {self.results['test_run_id']}")
        print(f"Duration: {duration:.1f} seconds")
        print(f"Frontend URL: {self.frontend_url}")
        print(f"Backend URL: {self.backend_url}")
        print(f"\nSUMMARY:")
        print(f"  Total Tests: {self.results['summary']['total_tests']}")
        print(f"  Passed: {self.results['summary']['passed']}")
        print(f"  Failed: {self.results['summary']['failed']}")
        print(f"  Success Rate: {(self.results['summary']['passed']/self.results['summary']['total_tests']*100):.1f}%")
        
        if self.results['summary']['critical_failures']:
            print(f"\nCRITICAL FAILURES:")
            for failure in self.results['summary']['critical_failures']:
                print(f"  - {failure}")
        
        print(f"\nTEST DETAILS:")
        for test_name, test_data in self.results['tests'].items():
            status_icon = "PASS" if test_data['status'] == "PASS" else "FAIL"
            print(f"  [{status_icon}] {test_name}: {test_data['details']['message']}")
            if test_data.get('screenshot'):
                print(f"    Screenshot: {test_data['screenshot']}")
        
        print(f"\nEVIDENCE:")
        print(f"  Screenshots: {len(self.results['evidence']['screenshots'])}")
        print(f"  Report File: {report_file}")
        
        print(f"\n{'='*60}")
        
        return report_file

    async def run_complete_test_suite(self):
        """Run the complete authentication flow test suite"""
        print(f"Starting Comprehensive Authentication Flow Test")
        print(f"Frontend: {self.frontend_url}")
        print(f"Backend: {self.backend_url}")
        print(f"Demo Credentials: {self.demo_email} / ***")
        print("-" * 60)
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)  # Run in headed mode for debugging
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                ignore_https_errors=True
            )
            page = await context.new_page()
            
            try:
                # Test 1: Frontend Accessibility
                if not await self.test_frontend_accessibility(page):
                    print("CRITICAL: Frontend not accessible - stopping test suite")
                    return self.generate_report()
                
                # Test 2: Login Form
                if not await self.test_login_form(page):
                    print("CRITICAL: Login failed - stopping test suite")
                    return self.generate_report()
                
                # Test 3: Dashboard Access
                await self.test_dashboard_access(page)
                
                # Test 4: Protected Routes Navigation
                await self.test_protected_routes_navigation(page)
                
                # Test 5: Authentication Persistence
                await self.test_authentication_persistence(page)
                
                # Test 6: Logout Functionality
                await self.test_logout_functionality(page)
                
            finally:
                await browser.close()
        
        return self.generate_report()

async def main():
    """Main execution function"""
    tester = AuthFlowTester()
    report_file = await tester.run_complete_test_suite()
    
    # Return exit code based on results
    if tester.results['summary']['critical_failures']:
        sys.exit(1)  # Exit with error if critical failures
    else:
        sys.exit(0)  # Exit successfully

if __name__ == "__main__":
    asyncio.run(main())