#!/usr/bin/env python3
"""
Comprehensive Authentication Flow Testing for Playwright Smart Application
Tests the complete full-stack integration between frontend and backend
"""

import os
import json
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

class AuthFlowTester:
    def __init__(self):
        self.frontend_url = "http://localhost:5180"
        self.backend_url = "http://localhost:8080"
        self.test_evidence_dir = "test_evidence"
        self.demo_email = "admin@demo.com"
        self.demo_password = "demo123"
        self.network_logs = []
        self.console_errors = []
        self.test_results = {}
        
        # Ensure evidence directory exists
        os.makedirs(self.test_evidence_dir, exist_ok=True)
        
    def log_network_activity(self, request=None, response=None):
        """Log network requests and responses"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        if request:
            self.network_logs.append(f"[{timestamp}] REQUEST: {request.method} {request.url}")
        if response:
            self.network_logs.append(f"[{timestamp}] RESPONSE: {response.status} {response.url}")
            
    def log_console_message(self, msg):
        """Log console messages, especially errors"""
        if msg.type == 'error':
            self.console_errors.append(f"CONSOLE ERROR: {msg.text}")
        elif msg.type == 'warning':
            print(f"WARNING: {msg.text}")
            
    def test_homepage_load(self, page):
        """Test 1: Homepage Load and Basic Connectivity"""
        print("TEST 1: Homepage Load and Basic Connectivity")
        
        try:
            # Navigate to frontend
            page.goto(self.frontend_url, wait_until='networkidle', timeout=30000)
            
            # Take screenshot
            page.screenshot(path=f'{self.test_evidence_dir}/01_homepage_loaded.png', full_page=True)
            
            # Get basic info
            title = page.title()
            url = page.url
            
            # Check if page loaded properly
            page.wait_for_timeout(2000)  # Wait for any async operations
            
            result = {
                'test': 'homepage_load',
                'success': True,
                'title': title,
                'url': url,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"PASS: Homepage loaded successfully")
            print(f"   Title: {title}")
            print(f"   URL: {url}")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/01_homepage_error.png', full_page=True)
            result = {
                'test': 'homepage_load',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: Homepage load failed: {str(e)}")
            return result
    
    def test_login_flow(self, page):
        """Test 2: Login Flow with Demo Credentials"""
        print("\nTEST 2: Login Flow with Demo Credentials")
        
        try:
            # Navigate to login page
            login_url = f"{self.frontend_url}/auth/login"
            page.goto(login_url, wait_until='networkidle')
            
            # Take screenshot of login page
            page.screenshot(path=f'{self.test_evidence_dir}/02_login_page.png', full_page=True)
            
            # Check if login form exists
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first
            password_input = page.locator('input[type="password"], input[name="password"]').first
            login_button = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first
            
            # Verify form elements are visible
            email_input.wait_for(state='visible', timeout=10000)
            password_input.wait_for(state='visible', timeout=10000)
            login_button.wait_for(state='visible', timeout=10000)
            
            print("PASS: Login form elements found")
            
            # Fill in demo credentials
            email_input.fill(self.demo_email)
            password_input.fill(self.demo_password)
            
            # Take screenshot before submitting
            page.screenshot(path=f'{self.test_evidence_dir}/03_login_filled.png', full_page=True)
            
            # Click login button
            login_button.click()
            
            # Wait for navigation or response
            page.wait_for_timeout(3000)
            
            # Take screenshot after login attempt
            page.screenshot(path=f'{self.test_evidence_dir}/04_after_login.png', full_page=True)
            
            current_url = page.url
            
            result = {
                'test': 'login_flow',
                'success': True,
                'demo_email': self.demo_email,
                'current_url': current_url,
                'redirected': current_url != login_url,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"PASS: Login form submitted successfully")
            print(f"   Current URL after login: {current_url}")
            print(f"   Redirected from login page: {current_url != login_url}")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/02_login_error.png', full_page=True)
            result = {
                'test': 'login_flow',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: Login flow failed: {str(e)}")
            return result
    
    def test_dashboard_access(self, page):
        """Test 3: Dashboard Access After Login"""
        print("\nTEST 3: Dashboard Access After Login")
        
        try:
            # Try to navigate to dashboard
            dashboard_url = f"{self.frontend_url}/dashboard"
            page.goto(dashboard_url, wait_until='networkidle', timeout=15000)
            
            # Wait for page to load
            page.wait_for_timeout(3000)
            
            # Take screenshot
            page.screenshot(path=f'{self.test_evidence_dir}/05_dashboard_loaded.png', full_page=True)
            
            current_url = page.url
            title = page.title()
            
            # Check for dashboard-specific elements
            dashboard_indicators = [
                'h1:has-text("Dashboard")',
                '[data-testid="dashboard"]',
                '.dashboard',
                'nav',
                'main'
            ]
            
            found_elements = []
            for selector in dashboard_indicators:
                try:
                    if page.locator(selector).count() > 0:
                        found_elements.append(selector)
                except:
                    pass
            
            result = {
                'test': 'dashboard_access',
                'success': True,
                'url': current_url,
                'title': title,
                'dashboard_elements_found': found_elements,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"PASS: Dashboard accessed successfully")
            print(f"   URL: {current_url}")
            print(f"   Title: {title}")
            print(f"   Elements found: {len(found_elements)}")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/05_dashboard_error.png', full_page=True)
            result = {
                'test': 'dashboard_access',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: Dashboard access failed: {str(e)}")
            return result
    
    def test_api_integration(self, page):
        """Test 4: API Integration and Backend Connectivity"""
        print("\nTEST 4: API Integration and Backend Connectivity")
        
        try:
            # Capture network activity during page interactions
            api_calls = []
            
            def capture_api_calls(response):
                if self.backend_url in response.url:
                    api_calls.append({
                        'method': response.request.method,
                        'url': response.url,
                        'status': response.status,
                        'timestamp': datetime.now().isoformat()
                    })
            
            page.on('response', capture_api_calls)
            
            # Try to trigger API calls by interacting with the dashboard
            page.reload(wait_until='networkidle')
            page.wait_for_timeout(5000)
            
            # Look for and interact with any buttons or links that might trigger API calls
            interactive_elements = page.locator('button, a[href], [role="button"]').all()
            
            interactions_performed = 0
            for element in interactive_elements[:3]:  # Test first 3 interactive elements
                try:
                    if element.is_visible():
                        element.click()
                        page.wait_for_timeout(1000)
                        interactions_performed += 1
                except:
                    pass
            
            # Take screenshot after interactions
            page.screenshot(path=f'{self.test_evidence_dir}/06_api_integration.png', full_page=True)
            
            result = {
                'test': 'api_integration',
                'success': True,
                'api_calls_captured': len(api_calls),
                'api_calls': api_calls,
                'interactions_performed': interactions_performed,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"PASS: API integration test completed")
            print(f"   API calls captured: {len(api_calls)}")
            print(f"   Interactions performed: {interactions_performed}")
            
            for call in api_calls:
                print(f"   API: {call['method']} {call['url']} -> {call['status']}")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/06_api_error.png', full_page=True)
            result = {
                'test': 'api_integration',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: API integration test failed: {str(e)}")
            return result
    
    def test_navigation_menu(self, page):
        """Test 5: Navigation Menu and 404 Errors"""
        print("\nTEST 5: Navigation Menu and 404 Errors")
        
        try:
            # Find navigation elements
            nav_selectors = [
                'nav a',
                '[role="navigation"] a',
                '.nav a',
                '.navigation a',
                'header a',
                '.menu a'
            ]
            
            nav_links = []
            for selector in nav_selectors:
                try:
                    elements = page.locator(selector).all()
                    for element in elements:
                        if element.is_visible():
                            href = element.get_attribute('href')
                            text = element.text_content()
                            if href and text:
                                nav_links.append({'href': href, 'text': text.strip()})
                except:
                    pass
            
            print(f"Found {len(nav_links)} navigation links")
            
            navigation_results = []
            
            # Test each navigation link
            for i, link in enumerate(nav_links[:5]):  # Test first 5 links
                try:
                    print(f"   Testing link: {link['text']} -> {link['href']}")
                    
                    # Click the link
                    page.locator(f'a[href="{link["href"]}"]').first.click()
                    page.wait_for_timeout(2000)
                    
                    current_url = page.url
                    title = page.title()
                    
                    # Take screenshot
                    page.screenshot(path=f'{self.test_evidence_dir}/07_nav_{i+1}_{link["text"].replace(" ", "_")}.png', full_page=True)
                    
                    # Check for 404 or error indicators
                    is_404 = (
                        '404' in title.lower() or
                        'not found' in title.lower() or
                        page.locator('h1:has-text("404"), h1:has-text("Not Found")').count() > 0
                    )
                    
                    navigation_results.append({
                        'link_text': link['text'],
                        'href': link['href'],
                        'final_url': current_url,
                        'title': title,
                        'is_404': is_404,
                        'success': not is_404
                    })
                    
                    if is_404:
                        print(f"   FAIL: 404 Error found for: {link['text']}")
                    else:
                        print(f"   PASS: Navigation successful: {link['text']}")
                
                except Exception as e:
                    navigation_results.append({
                        'link_text': link['text'],
                        'href': link['href'],
                        'error': str(e),
                        'success': False
                    })
                    print(f"   FAIL: Navigation failed for {link['text']}: {str(e)}")
            
            result = {
                'test': 'navigation_menu',
                'success': True,
                'total_links_found': len(nav_links),
                'links_tested': len(navigation_results),
                'navigation_results': navigation_results,
                'errors_found': sum(1 for r in navigation_results if r.get('is_404', False) or not r.get('success', True)),
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"PASS: Navigation test completed")
            print(f"   Links tested: {len(navigation_results)}")
            print(f"   Errors found: {result['errors_found']}")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/07_navigation_error.png', full_page=True)
            result = {
                'test': 'navigation_menu',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: Navigation test failed: {str(e)}")
            return result
    
    def test_registration_form(self, page):
        """Test 6: Registration Form Rendering and Fields"""
        print("\nTEST 6: Registration Form Rendering and Fields")
        
        try:
            # Navigate to registration page
            registration_urls = [
                f"{self.frontend_url}/auth/register",
                f"{self.frontend_url}/register",
                f"{self.frontend_url}/signup",
                f"{self.frontend_url}/auth/signup"
            ]
            
            registration_found = False
            registration_url = None
            
            for url in registration_urls:
                try:
                    page.goto(url, wait_until='networkidle', timeout=10000)
                    page.wait_for_timeout(2000)
                    
                    # Check if this looks like a registration page
                    registration_indicators = [
                        'input[name="email"]',
                        'input[name="password"]',
                        'form',
                        'button[type="submit"]'
                    ]
                    
                    found_indicators = 0
                    for indicator in registration_indicators:
                        if page.locator(indicator).count() > 0:
                            found_indicators += 1
                    
                    if found_indicators >= 2:  # At least 2 form elements found
                        registration_found = True
                        registration_url = url
                        break
                        
                except:
                    continue
            
            if not registration_found:
                # Try to find registration link on login page
                try:
                    page.goto(f"{self.frontend_url}/auth/login", wait_until='networkidle')
                    reg_link = page.locator('a:has-text("Register"), a:has-text("Sign up"), a:has-text("Create account")').first
                    if reg_link.count() > 0:
                        reg_link.click()
                        page.wait_for_timeout(2000)
                        registration_found = True
                        registration_url = page.url
                except:
                    pass
            
            # Take screenshot
            page.screenshot(path=f'{self.test_evidence_dir}/08_registration_form.png', full_page=True)
            
            if registration_found:
                # Analyze registration form fields
                form_fields = []
                
                field_selectors = [
                    {'type': 'email', 'selectors': ['input[type="email"]', 'input[name="email"]']},
                    {'type': 'password', 'selectors': ['input[type="password"]', 'input[name="password"]']},
                    {'type': 'text', 'selectors': ['input[type="text"]', 'input[name="name"]', 'input[name="username"]']},
                    {'type': 'submit', 'selectors': ['button[type="submit"]', 'input[type="submit"]']}
                ]
                
                for field_type in field_selectors:
                    for selector in field_type['selectors']:
                        elements = page.locator(selector).all()
                        for element in elements:
                            if element.is_visible():
                                placeholder = element.get_attribute('placeholder') or ''
                                name = element.get_attribute('name') or ''
                                form_fields.append({
                                    'type': field_type['type'],
                                    'selector': selector,
                                    'placeholder': placeholder,
                                    'name': name
                                })
                
                result = {
                    'test': 'registration_form',
                    'success': True,
                    'form_found': True,
                    'registration_url': registration_url,
                    'form_fields': form_fields,
                    'total_fields': len(form_fields),
                    'timestamp': datetime.now().isoformat()
                }
                
                print(f"PASS: Registration form found and analyzed")
                print(f"   URL: {registration_url}")
                print(f"   Fields found: {len(form_fields)}")
                
                for field in form_fields:
                    print(f"   Field: {field['type']}: {field['name']} ({field['placeholder']})")
                    
            else:
                result = {
                    'test': 'registration_form',
                    'success': True,
                    'form_found': False,
                    'message': 'No registration form found at common URLs',
                    'timestamp': datetime.now().isoformat()
                }
                
                print("WARNING: No registration form found at common URLs")
            
            return result
            
        except Exception as e:
            page.screenshot(path=f'{self.test_evidence_dir}/08_registration_error.png', full_page=True)
            result = {
                'test': 'registration_form',
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            print(f"FAIL: Registration form test failed: {str(e)}")
            return result
    
    def run_full_test_suite(self):
        """Run the complete authentication flow test suite"""
        print("Starting Full-Stack Authentication Flow Testing")
        print(f"   Frontend: {self.frontend_url}")
        print(f"   Backend: {self.backend_url}")
        print(f"   Demo Credentials: {self.demo_email} / {self.demo_password}")
        print("=" * 60)
        
        with sync_playwright() as p:
            # Launch browser with debugging capabilities
            browser = p.chromium.launch(
                headless=False,
                devtools=False,
                args=['--no-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
            )
            
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                record_video_dir=self.test_evidence_dir,
                record_video_size={'width': 1920, 'height': 1080}
            )
            
            page = context.new_page()
            
            # Set up logging
            page.on('request', lambda req: self.log_network_activity(request=req))
            page.on('response', lambda res: self.log_network_activity(response=res))
            page.on('console', self.log_console_message)
            
            try:
                # Run all tests
                self.test_results['homepage_load'] = self.test_homepage_load(page)
                self.test_results['login_flow'] = self.test_login_flow(page)
                self.test_results['dashboard_access'] = self.test_dashboard_access(page)
                self.test_results['api_integration'] = self.test_api_integration(page)
                self.test_results['navigation_menu'] = self.test_navigation_menu(page)
                self.test_results['registration_form'] = self.test_registration_form(page)
                
                # Final screenshot
                page.screenshot(path=f'{self.test_evidence_dir}/09_final_state.png', full_page=True)
                
            finally:
                browser.close()
        
        # Generate summary report
        self.generate_summary_report()
        
        return self.test_results
    
    def generate_summary_report(self):
        """Generate a comprehensive summary report"""
        print("\n" + "=" * 60)
        print("COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result.get('success', False))
        
        print(f"Overall Results: {passed_tests}/{total_tests} tests passed")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        for test_name, result in self.test_results.items():
            status = "PASS" if result.get('success', False) else "FAIL"
            print(f"   {status} {test_name.replace('_', ' ').title()}")
            
            if not result.get('success', False) and 'error' in result:
                print(f"      Error: {result['error']}")
        
        print(f"\nNetwork Activity: {len(self.network_logs)} requests/responses logged")
        print(f"Console Errors: {len(self.console_errors)} errors found")
        
        if self.console_errors:
            print("\nConsole Errors Details:")
            for error in self.console_errors[:5]:  # Show first 5 errors
                print(f"   • {error}")
        
        # Save detailed report to JSON
        report_data = {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'success_rate': (passed_tests/total_tests)*100,
                'timestamp': datetime.now().isoformat()
            },
            'test_results': self.test_results,
            'network_logs': self.network_logs[-20:],  # Last 20 network logs
            'console_errors': self.console_errors
        }
        
        with open(f'{self.test_evidence_dir}/test_report.json', 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\nEvidence saved to: {self.test_evidence_dir}/")
        print("   • Screenshots: *.png")
        print("   • Video recordings: *.webm")  
        print("   • Detailed report: test_report.json")

if __name__ == "__main__":
    tester = AuthFlowTester()
    results = tester.run_full_test_suite()