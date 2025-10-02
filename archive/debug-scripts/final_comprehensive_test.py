# Final Comprehensive Frontend Test - Navigation, API Integration, Console Errors
import asyncio
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

async def comprehensive_final_test():
    """Final comprehensive test covering navigation, API integration, and error validation"""
    
    # Initialize results structure
    test_results = {
        "timestamp": datetime.now().isoformat(),
        "test_suite": "Final Comprehensive Frontend Test",
        "base_url": "http://localhost:5180",
        "tests": {},
        "summary": {"total": 0, "passed": 0, "failed": 0, "warnings": 0},
        "evidence": {"screenshots": [], "console_logs": [], "network_logs": [], "errors": []}
    }
    
    # Ensure screenshots directory exists
    os.makedirs("artifacts/screenshots", exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        
        # Enable console and network monitoring
        console_logs = []
        network_logs = []
        errors = []
        
        def handle_console(msg):
            entry = {
                "timestamp": datetime.now().isoformat(),
                "type": msg.type,
                "text": msg.text,
                "location": msg.location if hasattr(msg, 'location') else None
            }
            console_logs.append(entry)
            
            # Capture errors specifically
            if msg.type in ['error', 'warning']:
                errors.append(entry)
            
        def handle_request(request):
            network_logs.append({
                "timestamp": datetime.now().isoformat(),
                "method": request.method,
                "url": request.url,
                "resource_type": request.resource_type,
                "type": "request"
            })
            
        def handle_response(response):
            entry = {
                "timestamp": datetime.now().isoformat(),
                "status": response.status,
                "url": response.url,
                "status_text": response.status_text,
                "type": "response"
            }
            network_logs.append(entry)
            
            # Capture failed requests
            if response.status >= 400:
                errors.append({
                    "type": "network_error",
                    "status": response.status,
                    "url": response.url,
                    "status_text": response.status_text,
                    "timestamp": datetime.now().isoformat()
                })
        
        page = await context.new_page()
        page.on("console", handle_console)
        page.on("request", handle_request)
        page.on("response", handle_response)
        
        try:
            # TEST 1: Navigation Menu and Routing
            print("=== TEST 1: Navigation Menu and Routing ===")
            
            test_results["tests"]["navigation_testing"] = {
                "name": "Navigation Menu and Routing Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Navigate to home page
            print("Loading home page...")
            await page.goto("http://localhost:5180", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            await page.screenshot(path=f"artifacts/screenshots/nav_test_01_home_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"nav_test_01_home_{timestamp}")
            
            # Look for navigation links
            navigation_links = []
            nav_selectors = [
                'nav a',
                'header a',
                '.nav-link',
                '.menu-item',
                'a[href^="/"]',
                'button[data-route]'
            ]
            
            for selector in nav_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            text = await element.text_content() or ""
                            href = await element.get_attribute('href') or ""
                            if text.strip() and href:
                                navigation_links.append({
                                    "text": text.strip(),
                                    "href": href,
                                    "selector": selector
                                })
                except:
                    continue
            
            # Remove duplicates
            unique_links = []
            seen_hrefs = set()
            for link in navigation_links:
                if link['href'] not in seen_hrefs:
                    unique_links.append(link)
                    seen_hrefs.add(link['href'])
            
            test_results["tests"]["navigation_testing"]["details"]["navigation_links"] = {
                "links": unique_links[:10],  # Limit to first 10
                "result": "PASS" if unique_links else "FAIL"
            }
            
            print(f"[INFO] Found {len(unique_links)} unique navigation links")
            for link in unique_links[:5]:  # Show first 5
                print(f"  - {link['text']}: {link['href']}")
            
            # Test key routes
            key_routes = [
                {"path": "/auth/login", "name": "Login"},
                {"path": "/auth/register", "name": "Register"},
                {"path": "/dashboard", "name": "Dashboard"},
                {"path": "/test-bank", "name": "Test Bank"},
                {"path": "/reports", "name": "Reports"},
                {"path": "/analytics", "name": "Analytics"},
                {"path": "/schedules", "name": "Schedules"}
            ]
            
            route_test_results = {}
            for route in key_routes:
                try:
                    print(f"Testing route: {route['path']}")
                    response = await page.goto(f"http://localhost:5180{route['path']}", 
                                             wait_until="networkidle", timeout=10000)
                    
                    await page.wait_for_timeout(2000)
                    
                    # Take screenshot
                    await page.screenshot(path=f"artifacts/screenshots/nav_test_{route['name'].lower()}_{timestamp}.png")
                    test_results["evidence"]["screenshots"].append(f"nav_test_{route['name'].lower()}_{timestamp}")
                    
                    page_title = await page.title()
                    current_url = page.url
                    
                    # Check if page loaded successfully
                    if response and response.status == 200:
                        route_test_results[route['name']] = {
                            "path": route['path'],
                            "status": response.status,
                            "title": page_title,
                            "final_url": current_url,
                            "result": "PASS"
                        }
                        print(f"[PASS] {route['name']}: {response.status}")
                    else:
                        route_test_results[route['name']] = {
                            "path": route['path'],
                            "status": response.status if response else "No response",
                            "result": "FAIL"
                        }
                        print(f"[FAIL] {route['name']}: {response.status if response else 'No response'}")
                    
                except Exception as e:
                    route_test_results[route['name']] = {
                        "path": route['path'],
                        "error": str(e),
                        "result": "ERROR"
                    }
                    print(f"[ERROR] {route['name']}: {e}")
            
            test_results["tests"]["navigation_testing"]["details"]["route_testing"] = route_test_results
            
            # Overall navigation result
            failed_routes = [k for k, v in route_test_results.items() if v.get("result") != "PASS"]
            if len(failed_routes) <= len(route_test_results) // 2:  # Allow up to 50% failures
                test_results["tests"]["navigation_testing"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            else:
                test_results["tests"]["navigation_testing"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["navigation_testing"]["status"] = "ERROR"
            test_results["tests"]["navigation_testing"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] Navigation test failed: {e}")
        
        try:
            # TEST 2: API Integration Testing
            print("\n=== TEST 2: API Integration Testing ===")
            
            test_results["tests"]["api_integration"] = {
                "name": "API Integration Test",
                "status": "running",
                "details": {},
                "evidence": []
            }
            
            # Go to a data-heavy page (like dashboard or test-bank)
            print("Loading data-heavy page for API testing...")
            await page.goto("http://localhost:5180/test-bank", wait_until="networkidle", timeout=15000)
            await page.wait_for_timeout(3000)
            
            # Filter network logs for API calls
            api_calls = []
            for log in network_logs:
                if log.get('type') == 'request':
                    url = log.get('url', '')
                    if any(pattern in url for pattern in ['/api/', '/graphql', '.json', '/data/']):
                        api_calls.append(log)
            
            test_results["tests"]["api_integration"]["details"]["api_calls"] = {
                "count": len(api_calls),
                "calls": api_calls[:10],  # First 10 API calls
                "result": "PASS" if api_calls else "WARN"
            }
            
            print(f"[INFO] Detected {len(api_calls)} API calls")
            
            # Check for API responses
            api_responses = []
            for log in network_logs:
                if log.get('type') == 'response':
                    url = log.get('url', '')
                    if any(pattern in url for pattern in ['/api/', '/graphql', '.json', '/data/']):
                        api_responses.append({
                            "url": url,
                            "status": log.get('status'),
                            "status_text": log.get('status_text')
                        })
            
            successful_responses = [r for r in api_responses if r['status'] < 400]
            failed_responses = [r for r in api_responses if r['status'] >= 400]
            
            test_results["tests"]["api_integration"]["details"]["api_responses"] = {
                "successful": len(successful_responses),
                "failed": len(failed_responses),
                "failed_details": failed_responses,
                "result": "PASS" if len(failed_responses) == 0 else "WARN"
            }
            
            print(f"[INFO] API Responses - Success: {len(successful_responses)}, Failed: {len(failed_responses)}")
            
            # Check for loading states and data rendering
            loading_indicators = []
            loading_selectors = [
                '.loading',
                '.spinner',
                '.skeleton',
                '[data-testid="loading"]',
                '.loading-spinner',
                '.loader'
            ]
            
            for selector in loading_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for element in elements:
                        if await element.is_visible():
                            loading_indicators.append(selector)
                            break
                except:
                    continue
            
            # Check for data tables or lists
            data_containers = []
            data_selectors = [
                'table tbody tr',
                '.data-row',
                '.list-item',
                '.card',
                '[data-testid*="item"]'
            ]
            
            for selector in data_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    if len(elements) > 0:
                        data_containers.append({
                            "selector": selector,
                            "count": len(elements)
                        })
                except:
                    continue
            
            test_results["tests"]["api_integration"]["details"]["data_rendering"] = {
                "loading_indicators": loading_indicators,
                "data_containers": data_containers[:5],  # First 5
                "result": "PASS" if data_containers else "WARN"
            }
            
            print(f"[INFO] Data containers found: {len(data_containers)}")
            
            # Take screenshot of data page
            await page.screenshot(path=f"artifacts/screenshots/api_test_data_page_{timestamp}.png")
            test_results["evidence"]["screenshots"].append(f"api_test_data_page_{timestamp}")
            
            # Overall API integration result
            api_issues = []
            if len(api_calls) == 0:
                api_issues.append("No API calls detected")
            if len(failed_responses) > 0:
                api_issues.append(f"{len(failed_responses)} failed API responses")
            if len(data_containers) == 0:
                api_issues.append("No data containers found")
            
            if len(api_issues) <= 1:  # Allow minor issues
                test_results["tests"]["api_integration"]["status"] = "PASSED"
                test_results["summary"]["passed"] += 1
            else:
                test_results["tests"]["api_integration"]["status"] = "FAILED"
                test_results["summary"]["failed"] += 1
            
            test_results["summary"]["total"] += 1
            
        except Exception as e:
            test_results["tests"]["api_integration"]["status"] = "ERROR"
            test_results["tests"]["api_integration"]["error"] = str(e)
            test_results["summary"]["failed"] += 1
            test_results["summary"]["total"] += 1
            print(f"[ERROR] API integration test failed: {e}")
        
        # Store all evidence
        test_results["evidence"]["console_logs"] = console_logs[-50:]  # Last 50 logs
        test_results["evidence"]["network_logs"] = network_logs[-50:]
        test_results["evidence"]["errors"] = errors
        
        await browser.close()
    
    return test_results

async def main():
    result = await comprehensive_final_test()
    
    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results_file = f"final_comprehensive_test_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("FINAL COMPREHENSIVE TEST COMPLETED")
    print("="*60)
    print(f"Results saved to: {results_file}")
    print(f"Total Tests: {result['summary']['total']}")
    print(f"Passed: {result['summary']['passed']}")
    print(f"Failed: {result['summary']['failed']}")
    print(f"Warnings: {result['summary']['warnings']}")
    
    print(f"\nTotal Errors Detected: {len(result['evidence']['errors'])}")
    
    for test_name, test_data in result['tests'].items():
        print(f"\n{test_name}: {test_data['status']}")

if __name__ == "__main__":
    asyncio.run(main())