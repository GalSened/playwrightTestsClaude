# Comprehensive Frontend Validation - Following CLAUDE System Prompt Guidelines
import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def comprehensive_frontend_test():
    """Comprehensive test of Playwright Smart Frontend following CLAUDE system prompt guidelines"""
    
    # Initialize results structure
    test_results = {
        "timestamp": datetime.now().isoformat(),
        "test_suite": "Comprehensive Frontend Validation",
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
            # TEST 1: Home/Landing Page Load and Element Rendering
            print("=== TEST 1: Home/Landing Page Load and Element Rendering ===")
            
            test_results["tests"]["home_page_load"] = {
                "name": "Home/Landing Page Load Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Navigate to home page
            print("Navigating to http://localhost:5180...")
            response = await page.goto("http://localhost:5180", wait_until="networkidle", timeout=30000)
            
            # Basic load validation
            if response and response.status == 200:
                test_results["tests"]["home_page_load"]["details"]["navigation"] = {
                    "status": response.status,
                    "url": response.url,
                    "result": "PASS"
                }
                print(f"[PASS] Navigation successful: {response.status}")
            else:
                test_results["tests"]["home_page_load"]["details"]["navigation"] = {
                    "status": response.status if response else "No response",
                    "result": "FAIL"
                }
                print(f"[FAIL] Navigation failed: {response.status if response else 'No response'}")
            
            # Wait for page to stabilize
            await page.wait_for_timeout(3000)
            
            # Take initial screenshot
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            screenshot_path = f"artifacts/screenshots/home_01_initial_load_{timestamp}.png"
            await page.screenshot(path=screenshot_path)
            test_results["evidence"]["screenshots"].append(f"home_01_initial_load_{timestamp}")
            print(f"[PASS] Screenshot taken: {screenshot_path}")
            
            # Check page title
            title = await page.title()
            test_results["tests"]["home_page_load"]["details"]["title"] = {
                "value": title,
                "result": "PASS" if title else "FAIL"
            }
            print(f"Page title: '{title}'")
            
            # Check if main content is rendered
            main_content_selectors = [
                'main',
                '[data-testid="main-content"]',
                '.main-content',
                'body > div',
                '#root',
                '#app'
            ]
            
            main_content_found = False
            for selector in main_content_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        is_visible = await element.is_visible()
                        if is_visible:
                            main_content_found = True
                            test_results["tests"]["home_page_load"]["details"]["main_content"] = {
                                "selector": selector,
                                "visible": is_visible,
                                "result": "PASS"
                            }
                            print(f"[PASS] Main content found: {selector}")
                            break
                except Exception as e:
                    continue
            
            if not main_content_found:
                test_results["tests"]["home_page_load"]["details"]["main_content"] = {
                    "result": "FAIL",
                    "message": "No main content container found"
                }
                print("[FAIL] No main content container found")
            
            # Check for React app indicators
            react_indicators = [
                '#root',
                '[data-reactroot]',
                'script[src*="react"]',
                'div[id="app"]'
            ]
            
            react_found = False
            for selector in react_indicators:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        react_found = True
                        test_results["tests"]["home_page_load"]["details"]["react_app"] = {
                            "selector": selector,
                            "result": "PASS"
                        }
                        print(f"[PASS] React app indicator found: {selector}")
                        break
                except:
                    continue
            
            if not react_found:
                test_results["tests"]["home_page_load"]["details"]["react_app"] = {
                    "result": "WARN",
                    "message": "No obvious React app indicators found"
                }
                print("[WARN] No obvious React app indicators found")
            
            # Check for navigation elements
            nav_selectors = [
                'nav',
                '[role="navigation"]',
                '.nav',
                '.navigation',
                'header nav',
                '[data-testid="navigation"]',
                'a[href*="login"]',
                'a[href*="register"]'
            ]
            
            navigation_elements = []
            for selector in nav_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            text = await element.text_content()
                            navigation_elements.append({
                                "selector": selector,
                                "text": text,
                                "visible": True
                            })
                except:
                    continue
            
            if navigation_elements:
                test_results["tests"]["home_page_load"]["details"]["navigation_menu"] = {
                    "elements": navigation_elements[:5],  # Limit to first 5
                    "result": "PASS"
                }
                print(f"[PASS] Navigation elements found: {len(navigation_elements)}")
            else:
                test_results["tests"]["home_page_load"]["details"]["navigation_menu"] = {
                    "result": "WARN",
                    "message": "No navigation menu found"
                }
                print("[WARN] No navigation menu found")
            
            # Check for login/register links specifically
            login_selectors = [
                'a[href*="login"]',
                'a[href="/auth/login"]',
                'button:has-text("Login")',
                'button:has-text("Sign In")',
                '[data-testid*="login"]'
            ]
            
            login_links = []
            for selector in login_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            text = await element.text_content()
                            href = await element.get_attribute('href') if await element.get_attribute('href') else 'button'
                            login_links.append({
                                "selector": selector,
                                "text": text,
                                "href": href
                            })
                except:
                    continue
            
            test_results["tests"]["home_page_load"]["details"]["login_access"] = {
                "links": login_links,
                "result": "PASS" if login_links else "WARN"
            }
            
            if login_links:
                print(f"[PASS] Login links found: {len(login_links)}")
                for link in login_links[:3]:  # Show first 3
                    print(f"  - {link['text']}: {link['href']}")
            else:
                print("[WARN] No login links found")
            
            # Overall test status
            failed_checks = [k for k, v in test_results["tests"]["home_page_load"]["details"].items() 
                           if v.get("result") == "FAIL"]
            
            if failed_checks:
                test_results["tests"]["home_page_load"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            else:
                test_results["tests"]["home_page_load"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            
            test_results["summary"]["total"] += 1
            
            print(f"\nHome Page Test Status: {test_results['tests']['home_page_load']['status']}")
            
        except Exception as e:
            test_results["tests"]["home_page_load"]["status"] = "ERROR"
            test_results["tests"]["home_page_load"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Error in home page test: {e}")
        
        # Store console and network logs
        test_results["evidence"]["console_logs"] = console_logs[-20:] if console_logs else []  # Last 20 logs
        test_results["evidence"]["network_logs"] = network_logs[-20:] if network_logs else []
        
        await browser.close()
    
    return test_results

async def main():
    result = await comprehensive_frontend_test()
    
    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = f"comprehensive_frontend_test_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("HOME PAGE TEST COMPLETED")
    print("="*60)
    print(f"Results saved to: {results_file}")
    print(f"Status: {result['tests']['home_page_load']['status']}")
    print(f"Total Tests: {result['summary']['total']}")
    print(f"Passed: {result['summary']['passed']}")
    print(f"Failed: {result['summary']['failed']}")
    print(f"Warnings: {result['summary']['warnings']}")
    
    if result['evidence']['console_logs']:
        print(f"\nConsole Logs ({len(result['evidence']['console_logs'])}):")
        for log in result['evidence']['console_logs'][-5:]:  # Show last 5
            print(f"  [{log['type']}] {log['text']}")
    
    if result['evidence']['network_logs']:
        print(f"\nNetwork Activity ({len(result['evidence']['network_logs'])}):")
        for log in result['evidence']['network_logs'][-5:]:  # Show last 5
            if log['type'] == 'response':
                print(f"  {log['status']} {log['url']}")

if __name__ == "__main__":
    asyncio.run(main())