# Login Page Test - Following CLAUDE System Prompt Guidelines
import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def test_login_page():
    """Test Login Page navigation, form fields, and demo credentials"""
    
    # Initialize results structure
    test_results = {
        "timestamp": datetime.now().isoformat(),
        "test_suite": "Login Page Validation",
        "base_url": "http://localhost:5180",
        "tests": {},
        "summary": {"total": 0, "passed": 0, "failed": 0, "warnings": 0},
        "evidence": {"screenshots": [], "console_logs": [], "network_logs": []}
    }
    
    # Ensure screenshots directory exists
    os.makedirs("artifacts/screenshots", exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        
        # Enable console and network monitoring
        console_logs = []
        network_logs = []
        
        def handle_console(msg):
            console_logs.append({
                "timestamp": datetime.now().isoformat(),
                "type": msg.type,
                "text": msg.text,
                "location": msg.location if hasattr(msg, 'location') else None
            })
            
        def handle_request(request):
            network_logs.append({
                "timestamp": datetime.now().isoformat(),
                "method": request.method,
                "url": request.url,
                "resource_type": request.resource_type,
                "type": "request"
            })
            
        def handle_response(response):
            network_logs.append({
                "timestamp": datetime.now().isoformat(),
                "status": response.status,
                "url": response.url,
                "status_text": response.status_text,
                "type": "response"
            })
        
        page = await context.new_page()
        page.on("console", handle_console)
        page.on("request", handle_request)
        page.on("response", handle_response)
        
        try:
            # TEST 1: Navigation to Login Page
            print("=== TEST 1: Navigation to Login Page ===")
            
            test_results["tests"]["login_navigation"] = {
                "name": "Login Page Navigation Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # First navigate to home page
            print("Navigating to home page...")
            await page.goto("http://localhost:5180", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            # Take screenshot of home page
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            await page.screenshot(path=f"artifacts/screenshots/login_test_01_home_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"login_test_01_home_{timestamp}")
            
            # Try different approaches to navigate to login
            login_navigation_success = False
            
            # Method 1: Direct navigation to /auth/login
            try:
                print("Attempting direct navigation to /auth/login...")
                response = await page.goto("http://localhost:5180/auth/login", wait_until="networkidle", timeout=15000)
                if response and response.status == 200:
                    login_navigation_success = True
                    test_results["tests"]["login_navigation"]["details"]["direct_navigation"] = {
                        "method": "Direct URL",
                        "url": "http://localhost:5180/auth/login",
                        "status": response.status,
                        "result": "PASS"
                    }
                    print(f"[PASS] Direct navigation successful: {response.status}")
            except Exception as e:
                print(f"[FAIL] Direct navigation failed: {e}")
                test_results["tests"]["login_navigation"]["details"]["direct_navigation"] = {
                    "method": "Direct URL",
                    "error": str(e),
                    "result": "FAIL"
                }
            
            # Method 2: Try clicking Sign In button if direct navigation failed
            if not login_navigation_success:
                try:
                    print("Attempting to click Sign In button...")
                    await page.goto("http://localhost:5180", wait_until="networkidle")
                    await page.wait_for_timeout(1000)
                    
                    # Try various Sign In button selectors
                    signin_selectors = [
                        'button:has-text("Sign In")',
                        'a:has-text("Sign In")',
                        'button:has-text("Login")',
                        'a:has-text("Login")',
                        '[data-testid="signin-button"]',
                        '[data-testid="login-button"]'
                    ]
                    
                    for selector in signin_selectors:
                        try:
                            button = await page.query_selector(selector)
                            if button and await button.is_visible():
                                await button.click()
                                await page.wait_for_timeout(2000)
                                
                                current_url = page.url
                                if "/login" in current_url or "/auth" in current_url:
                                    login_navigation_success = True
                                    test_results["tests"]["login_navigation"]["details"]["button_click"] = {
                                        "method": "Button Click",
                                        "selector": selector,
                                        "final_url": current_url,
                                        "result": "PASS"
                                    }
                                    print(f"[PASS] Button click navigation successful: {selector}")
                                    break
                        except:
                            continue
                    
                    if not login_navigation_success:
                        test_results["tests"]["login_navigation"]["details"]["button_click"] = {
                            "result": "FAIL",
                            "message": "No working Sign In button found"
                        }
                        
                except Exception as e:
                    print(f"[FAIL] Button click navigation failed: {e}")
                    test_results["tests"]["login_navigation"]["details"]["button_click"] = {
                        "error": str(e),
                        "result": "FAIL"
                    }
            
            # Wait and take screenshot after navigation attempt
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"artifacts/screenshots/login_test_02_after_nav_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"login_test_02_after_nav_{timestamp}")
            
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            # Overall navigation test result
            if login_navigation_success:
                test_results["tests"]["login_navigation"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            else:
                test_results["tests"]["login_navigation"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["login_navigation"]["status"] = "ERROR"
            test_results["tests"]["login_navigation"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in login navigation test: {e}")
        
        try:
            # TEST 2: Login Form Field Validation
            print("\n=== TEST 2: Login Form Field Validation ===")
            
            test_results["tests"]["login_form_validation"] = {
                "name": "Login Form Fields Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Ensure we're on a login page
            current_url = page.url
            if "/login" not in current_url and "/auth" not in current_url:
                print("Not on login page, attempting navigation...")
                await page.goto("http://localhost:5180/auth/login", wait_until="networkidle")
                await page.wait_for_timeout(2000)
            
            # Check for login form elements
            form_elements = {}
            
            # Email/Username field
            email_selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="username" i]',
                '[data-testid="email-input"]',
                '[data-testid="username-input"]'
            ]
            
            for selector in email_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element and await element.is_visible():
                        placeholder = await element.get_attribute('placeholder') or ""
                        name = await element.get_attribute('name') or ""
                        input_type = await element.get_attribute('type') or ""
                        
                        form_elements["email_field"] = {
                            "selector": selector,
                            "placeholder": placeholder,
                            "name": name,
                            "type": input_type,
                            "visible": True,
                            "result": "PASS"
                        }
                        print(f"[PASS] Email field found: {selector}")
                        break
                except:
                    continue
            
            if "email_field" not in form_elements:
                form_elements["email_field"] = {
                    "result": "FAIL",
                    "message": "No email/username field found"
                }
                print("[FAIL] No email/username field found")
            
            # Password field
            password_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                '[data-testid="password-input"]'
            ]
            
            for selector in password_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element and await element.is_visible():
                        placeholder = await element.get_attribute('placeholder') or ""
                        name = await element.get_attribute('name') or ""
                        
                        form_elements["password_field"] = {
                            "selector": selector,
                            "placeholder": placeholder,
                            "name": name,
                            "type": "password",
                            "visible": True,
                            "result": "PASS"
                        }
                        print(f"[PASS] Password field found: {selector}")
                        break
                except:
                    continue
            
            if "password_field" not in form_elements:
                form_elements["password_field"] = {
                    "result": "FAIL",
                    "message": "No password field found"
                }
                print("[FAIL] No password field found")
            
            # Submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Sign In")',
                'button:has-text("Login")',
                '[data-testid="login-submit"]',
                '[data-testid="signin-submit"]'
            ]
            
            for selector in submit_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element and await element.is_visible():
                        text = await element.text_content() or ""
                        button_type = await element.get_attribute('type') or ""
                        
                        form_elements["submit_button"] = {
                            "selector": selector,
                            "text": text,
                            "type": button_type,
                            "visible": True,
                            "result": "PASS"
                        }
                        print(f"[PASS] Submit button found: {selector} - '{text}'")
                        break
                except:
                    continue
            
            if "submit_button" not in form_elements:
                form_elements["submit_button"] = {
                    "result": "FAIL",
                    "message": "No submit button found"
                }
                print("[FAIL] No submit button found")
            
            test_results["tests"]["login_form_validation"]["details"] = form_elements
            
            # Take screenshot of form
            await page.screenshot(path=f"artifacts/screenshots/login_test_03_form_fields_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"login_test_03_form_fields_{timestamp}")
            
            # Overall form validation result
            failed_form_elements = [k for k, v in form_elements.items() if v.get("result") == "FAIL"]
            
            if failed_form_elements:
                test_results["tests"]["login_form_validation"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            else:
                test_results["tests"]["login_form_validation"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["login_form_validation"]["status"] = "ERROR"
            test_results["tests"]["login_form_validation"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in form validation test: {e}")
        
        try:
            # TEST 3: Demo Credentials Login Test
            print("\n=== TEST 3: Demo Credentials Login Test ===")
            
            test_results["tests"]["demo_login"] = {
                "name": "Demo Credentials Login Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Ensure we're on login page and form fields are available
            if form_elements.get("email_field", {}).get("result") == "PASS" and \
               form_elements.get("password_field", {}).get("result") == "PASS":
                
                # Clear any existing values and fill demo credentials
                email_selector = form_elements["email_field"]["selector"]
                password_selector = form_elements["password_field"]["selector"]
                
                print("Filling demo credentials...")
                await page.fill(email_selector, "admin@demo.com")
                await page.fill(password_selector, "demo123")
                
                # Take screenshot with filled credentials
                await page.screenshot(path=f"artifacts/screenshots/login_test_04_credentials_filled_{timestamp}.png")
                test_results["evidence"]["screenshots"].append(f"login_test_04_credentials_filled_{timestamp}")
                
                test_results["tests"]["demo_login"]["details"]["credentials_filled"] = {
                    "email": "admin@demo.com",
                    "password": "[HIDDEN]",
                    "result": "PASS"
                }
                print("[PASS] Demo credentials filled")
                
                # Submit the form
                if form_elements.get("submit_button", {}).get("result") == "PASS":
                    submit_selector = form_elements["submit_button"]["selector"]
                    
                    print("Attempting to submit login form...")
                    await page.click(submit_selector)
                    
                    # Wait for navigation or response
                    await page.wait_for_timeout(3000)
                    
                    # Check if login was successful
                    final_url = page.url
                    print(f"Final URL after login attempt: {final_url}")
                    
                    # Take screenshot after login attempt
                    await page.screenshot(path=f"artifacts/screenshots/login_test_05_after_login_{timestamp}.png")
                    test_results["evidence"]["screenshots"].append(f"login_test_05_after_login_{timestamp}")
                    
                    # Check for success indicators
                    success_indicators = [
                        "/dashboard",
                        "/home",
                        "/main"
                    ]
                    
                    login_successful = any(indicator in final_url for indicator in success_indicators)
                    
                    # Also check for dashboard elements
                    if not login_successful:
                        dashboard_selectors = [
                            '[data-testid="dashboard"]',
                            'nav:has-text("Dashboard")',
                            'h1:has-text("Dashboard")',
                            '.dashboard',
                            '[role="main"]'
                        ]
                        
                        for selector in dashboard_selectors:
                            try:
                                element = await page.query_selector(selector)
                                if element and await element.is_visible():
                                    login_successful = True
                                    print(f"[PASS] Dashboard element found: {selector}")
                                    break
                            except:
                                continue
                    
                    # Check for error messages
                    error_selectors = [
                        '.error',
                        '.alert',
                        '[role="alert"]',
                        '.text-red-500',
                        ':has-text("Invalid")',
                        ':has-text("Error")'
                    ]
                    
                    error_messages = []
                    for selector in error_selectors:
                        try:
                            elements = await page.query_selector_all(selector)
                            for element in elements:
                                if await element.is_visible():
                                    text = await element.text_content()
                                    if text and len(text.strip()) > 0:
                                        error_messages.append(text.strip())
                        except:
                            continue
                    
                    test_results["tests"]["demo_login"]["details"]["login_attempt"] = {
                        "final_url": final_url,
                        "success": login_successful,
                        "error_messages": error_messages,
                        "result": "PASS" if login_successful else "FAIL"
                    }
                    
                    if login_successful:
                        print("[PASS] Login successful - redirected to authenticated area")
                        test_results["tests"]["demo_login"]["status"] = "PASSED"
                        test_results["summary"]["passed"] += 1
                    else:
                        print("[FAIL] Login failed or no redirection")
                        if error_messages:
                            print(f"Error messages: {error_messages}")
                        test_results["tests"]["demo_login"]["status"] = "FAILED"
                        test_results["summary"]["failed"] += 1
                else:
                    test_results["tests"]["demo_login"]["details"]["submit_error"] = {
                        "message": "No submit button available",
                        "result": "FAIL"
                    }
                    test_results["tests"]["demo_login"]["status"] = "FAILED"
                    test_results["summary"]["failed"] += 1
                    print("[FAIL] Cannot submit - no submit button")
            else:
                test_results["tests"]["demo_login"]["details"]["form_error"] = {
                    "message": "Login form fields not available",
                    "result": "FAIL"
                }
                test_results["tests"]["demo_login"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
                print("[FAIL] Cannot test login - form fields not available")
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["demo_login"]["status"] = "ERROR"
            test_results["tests"]["demo_login"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in demo login test: {e}")
        
        # Store console and network logs
        test_results["evidence"]["console_logs"] = console_logs[-30:]  # Last 30 logs
        test_results["evidence"]["network_logs"] = network_logs[-30:]
        
        await browser.close()
    
    return test_results

async def main():
    result = await test_login_page()
    
    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = f"login_page_test_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("LOGIN PAGE TEST COMPLETED")
    print("="*60)
    print(f"Results saved to: {results_file}")
    print(f"Total Tests: {result['summary']['total']}")
    print(f"Passed: {result['summary']['passed']}")
    print(f"Failed: {result['summary']['failed']}")
    print(f"Warnings: {result['summary']['warnings']}")
    
    for test_name, test_data in result['tests'].items():
        print(f"\n{test_name}: {test_data['status']}")
        for detail_name, detail in test_data.get('details', {}).items():
            if isinstance(detail, dict) and 'result' in detail:
                print(f"  - {detail_name}: {detail['result']}")

if __name__ == "__main__":
    asyncio.run(main())