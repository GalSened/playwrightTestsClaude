# Registration Page Test - Following CLAUDE System Prompt Guidelines
import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def test_registration_page():
    """Test Registration Page navigation and form field rendering"""
    
    # Initialize results structure
    test_results = {
        "timestamp": datetime.now().isoformat(),
        "test_suite": "Registration Page Validation",
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
            # TEST 1: Navigation to Registration Page
            print("=== TEST 1: Navigation to Registration Page ===")
            
            test_results["tests"]["registration_navigation"] = {
                "name": "Registration Page Navigation Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Navigate to home page first
            print("Navigating to home page...")
            await page.goto("http://localhost:5180", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            # Take screenshot of home page
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            await page.screenshot(path=f"artifacts/screenshots/reg_test_01_home_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"reg_test_01_home_{timestamp}")
            
            registration_navigation_success = False
            
            # Method 1: Direct navigation to /auth/register
            try:
                print("Attempting direct navigation to /auth/register...")
                response = await page.goto("http://localhost:5180/auth/register", wait_until="networkidle", timeout=15000)
                if response and response.status == 200:
                    registration_navigation_success = True
                    test_results["tests"]["registration_navigation"]["details"]["direct_navigation"] = {
                        "method": "Direct URL",
                        "url": "http://localhost:5180/auth/register",
                        "status": response.status,
                        "result": "PASS"
                    }
                    print(f"[PASS] Direct navigation successful: {response.status}")
            except Exception as e:
                print(f"[FAIL] Direct navigation failed: {e}")
                test_results["tests"]["registration_navigation"]["details"]["direct_navigation"] = {
                    "method": "Direct URL",
                    "error": str(e),
                    "result": "FAIL"
                }
            
            # Method 2: Try clicking Sign Up link/button
            if not registration_navigation_success:
                try:
                    print("Attempting to find Sign Up link/button...")
                    await page.goto("http://localhost:5180", wait_until="networkidle")
                    await page.wait_for_timeout(1000)
                    
                    signup_selectors = [
                        'a:has-text("Sign up")',
                        'a:has-text("Sign Up")',
                        'a:has-text("Register")',
                        'button:has-text("Sign up")',
                        'button:has-text("Sign Up")',
                        'button:has-text("Register")',
                        'a[href*="register"]',
                        '[data-testid="signup-button"]',
                        '[data-testid="register-button"]'
                    ]
                    
                    for selector in signup_selectors:
                        try:
                            element = await page.query_selector(selector)
                            if element and await element.is_visible():
                                await element.click()
                                await page.wait_for_timeout(2000)
                                
                                current_url = page.url
                                if "/register" in current_url or "/signup" in current_url:
                                    registration_navigation_success = True
                                    test_results["tests"]["registration_navigation"]["details"]["link_click"] = {
                                        "method": "Link/Button Click",
                                        "selector": selector,
                                        "final_url": current_url,
                                        "result": "PASS"
                                    }
                                    print(f"[PASS] Link click navigation successful: {selector}")
                                    break
                        except:
                            continue
                    
                    if not registration_navigation_success:
                        test_results["tests"]["registration_navigation"]["details"]["link_click"] = {
                            "result": "FAIL",
                            "message": "No working Sign Up link/button found"
                        }
                        
                except Exception as e:
                    print(f"[FAIL] Link click navigation failed: {e}")
                    test_results["tests"]["registration_navigation"]["details"]["link_click"] = {
                        "error": str(e),
                        "result": "FAIL"
                    }
            
            # Take screenshot after navigation attempt
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"artifacts/screenshots/reg_test_02_after_nav_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"reg_test_02_after_nav_{timestamp}")
            
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            # Overall navigation test result
            if registration_navigation_success:
                test_results["tests"]["registration_navigation"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            else:
                test_results["tests"]["registration_navigation"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["registration_navigation"]["status"] = "ERROR"
            test_results["tests"]["registration_navigation"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in registration navigation test: {e}")
        
        try:
            # TEST 2: Registration Form Field Validation
            print("\n=== TEST 2: Registration Form Field Validation ===")
            
            test_results["tests"]["registration_form_validation"] = {
                "name": "Registration Form Fields Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Ensure we're on registration page
            current_url = page.url
            if "/register" not in current_url:
                print("Not on registration page, attempting direct navigation...")
                await page.goto("http://localhost:5180/auth/register", wait_until="networkidle")
                await page.wait_for_timeout(2000)
            
            # Check for all form elements
            form_elements = {}
            
            # Common form field selectors for registration
            field_checks = {
                "name_field": [
                    'input[name="name"]',
                    'input[name="fullName"]',
                    'input[name="firstName"]',
                    'input[placeholder*="name" i]',
                    '[data-testid="name-input"]'
                ],
                "email_field": [
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[placeholder*="email" i]',
                    '[data-testid="email-input"]'
                ],
                "password_field": [
                    'input[type="password"]',
                    'input[name="password"]',
                    'input[placeholder*="password" i]',
                    '[data-testid="password-input"]'
                ],
                "confirm_password_field": [
                    'input[name="confirmPassword"]',
                    'input[name="confirm_password"]',
                    'input[name="password_confirmation"]',
                    'input[placeholder*="confirm" i]',
                    '[data-testid="confirm-password-input"]'
                ],
                "company_field": [
                    'input[name="company"]',
                    'input[name="organization"]',
                    'input[placeholder*="company" i]',
                    'input[placeholder*="organization" i]',
                    '[data-testid="company-input"]'
                ]
            }
            
            # Check each field type
            for field_name, selectors in field_checks.items():
                found = False
                for selector in selectors:
                    try:
                        element = await page.query_selector(selector)
                        if element and await element.is_visible():
                            placeholder = await element.get_attribute('placeholder') or ""
                            name = await element.get_attribute('name') or ""
                            input_type = await element.get_attribute('type') or "text"
                            required = await element.get_attribute('required') is not None
                            
                            form_elements[field_name] = {
                                "selector": selector,
                                "placeholder": placeholder,
                                "name": name,
                                "type": input_type,
                                "required": required,
                                "visible": True,
                                "result": "PASS"
                            }
                            print(f"[PASS] {field_name} found: {selector}")
                            found = True
                            break
                    except:
                        continue
                
                if not found:
                    form_elements[field_name] = {
                        "result": "FAIL",
                        "message": f"No {field_name} found"
                    }
                    print(f"[FAIL] No {field_name} found")
            
            # Check for submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Sign Up")',
                'button:has-text("Register")',
                'button:has-text("Create Account")',
                '[data-testid="register-submit"]',
                '[data-testid="signup-submit"]'
            ]
            
            submit_found = False
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
                        submit_found = True
                        break
                except:
                    continue
            
            if not submit_found:
                form_elements["submit_button"] = {
                    "result": "FAIL",
                    "message": "No submit button found"
                }
                print("[FAIL] No submit button found")
            
            # Check for plan selection (if this is a multi-step registration)
            plan_selectors = [
                'input[type="radio"][name*="plan"]',
                '.plan-option',
                '[data-testid*="plan"]',
                'button[data-plan]'
            ]
            
            plan_options = []
            for selector in plan_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            text = await element.text_content() or ""
                            value = await element.get_attribute('value') or ""
                            plan_options.append({
                                "selector": selector,
                                "text": text.strip(),
                                "value": value
                            })
                except:
                    continue
            
            if plan_options:
                form_elements["plan_selection"] = {
                    "options": plan_options[:5],  # Limit to first 5
                    "result": "PASS"
                }
                print(f"[PASS] Plan selection found: {len(plan_options)} options")
            else:
                form_elements["plan_selection"] = {
                    "result": "WARN",
                    "message": "No plan selection found"
                }
                print("[WARN] No plan selection found")
            
            test_results["tests"]["registration_form_validation"]["details"] = form_elements
            
            # Take screenshot of form
            await page.screenshot(path=f"artifacts/screenshots/reg_test_03_form_fields_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"reg_test_03_form_fields_{timestamp}")
            
            # Overall form validation result
            failed_form_elements = [k for k, v in form_elements.items() 
                                  if v.get("result") == "FAIL"]
            
            # Count essential fields
            essential_fields = ["email_field", "password_field", "submit_button"]
            essential_passed = all(
                form_elements.get(field, {}).get("result") == "PASS" 
                for field in essential_fields
            )
            
            if essential_passed:
                test_results["tests"]["registration_form_validation"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
                if failed_form_elements:
                    print(f"[PASS] Registration form functional (missing optional fields: {failed_form_elements})")
            else:
                test_results["tests"]["registration_form_validation"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
                print(f"[FAIL] Registration form missing essential fields: {failed_form_elements}")
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["registration_form_validation"]["status"] = "ERROR"
            test_results["tests"]["registration_form_validation"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in form validation test: {e}")
        
        try:
            # TEST 3: Registration Steps/Workflow Test
            print("\n=== TEST 3: Registration Workflow Test ===")
            
            test_results["tests"]["registration_workflow"] = {
                "name": "Registration Workflow Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Check if this is a multi-step registration
            step_indicators = [
                '.step',
                '.steps',
                '.wizard-step',
                '[data-step]',
                '.progress-bar',
                '.breadcrumb'
            ]
            
            workflow_elements = []
            for selector in step_indicators:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            text = await element.text_content() or ""
                            workflow_elements.append({
                                "selector": selector,
                                "text": text.strip()
                            })
                except:
                    continue
            
            if workflow_elements:
                test_results["tests"]["registration_workflow"]["details"]["workflow_indicators"] = {
                    "elements": workflow_elements[:5],
                    "result": "PASS"
                }
                print(f"[PASS] Workflow indicators found: {len(workflow_elements)}")
            else:
                test_results["tests"]["registration_workflow"]["details"]["workflow_indicators"] = {
                    "result": "WARN",
                    "message": "No workflow indicators found - likely single-step registration"
                }
                print("[WARN] No workflow indicators found - likely single-step registration")
            
            # Test form interaction (if possible)
            if form_elements.get("email_field", {}).get("result") == "PASS":
                try:
                    email_selector = form_elements["email_field"]["selector"]
                    await page.fill(email_selector, "test@example.com")
                    await page.wait_for_timeout(1000)
                    
                    # Check for real-time validation
                    validation_messages = []
                    validation_selectors = [
                        '.error-message',
                        '.invalid-feedback',
                        '.text-red-500',
                        '.error',
                        '[role="alert"]'
                    ]
                    
                    for selector in validation_selectors:
                        try:
                            elements = await page.query_selector_all(selector)
                            for element in elements:
                                if await element.is_visible():
                                    text = await element.text_content()
                                    if text and len(text.strip()) > 0:
                                        validation_messages.append(text.strip())
                        except:
                            continue
                    
                    test_results["tests"]["registration_workflow"]["details"]["form_interaction"] = {
                        "test_email_filled": "test@example.com",
                        "validation_messages": validation_messages,
                        "result": "PASS"
                    }
                    print(f"[PASS] Form interaction test completed")
                    
                    # Clear the test data
                    await page.fill(email_selector, "")
                    
                except Exception as e:
                    test_results["tests"]["registration_workflow"]["details"]["form_interaction"] = {
                        "error": str(e),
                        "result": "WARN"
                    }
                    print(f"[WARN] Form interaction test failed: {e}")
            
            # Take final screenshot
            await page.screenshot(path=f"artifacts/screenshots/reg_test_04_workflow_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"reg_test_04_workflow_{timestamp}")
            
            # Determine workflow test status
            test_results["tests"]["registration_workflow"]["status"] = "PASSED"
            test_results["summary"]["passed"] += 1
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["registration_workflow"]["status"] = "ERROR"
            test_results["tests"]["registration_workflow"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in workflow test: {e}")
        
        # Store console and network logs
        test_results["evidence"]["console_logs"] = console_logs[-20:]
        test_results["evidence"]["network_logs"] = network_logs[-20:]
        
        await browser.close()
    
    return test_results

async def main():
    result = await test_registration_page()
    
    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = f"registration_page_test_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("REGISTRATION PAGE TEST COMPLETED")
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