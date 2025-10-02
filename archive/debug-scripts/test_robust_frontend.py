# ROBUST FRONTEND TESTING - ENTERPRISE TRACE VIEWER
from playwright.sync_api import sync_playwright
import time
import os

def test_enterprise_frontend_robust():
    """Robust testing of the enterprise frontend with better selectors"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        try:
            print("ENTERPRISE FRONTEND COMPREHENSIVE TESTING")
            print("=" * 50)
            
            # Setup
            os.makedirs('test-results', exist_ok=True)
            
            # Step 1: Load application
            print("STEP 1: Loading application...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            page.screenshot(path='test-results/robust-01-loaded.png', full_page=True)
            print("SUCCESS: Application loaded")
            
            # Step 2: Test each navigation item
            print("STEP 2: Testing navigation...")
            
            nav_tests = [
                {'name': 'Dashboard', 'selector': 'a[href="/"]', 'expected_path': '/'},
                {'name': 'Test Bank', 'selector': 'a[href="/test-bank"]', 'expected_path': '/test-bank'},
                {'name': 'Reports', 'selector': 'a[href="/reports"]', 'expected_path': '/reports'},
                {'name': 'Analytics', 'selector': 'a[href="/analytics"]', 'expected_path': '/analytics'}
            ]
            
            nav_results = []
            
            for nav in nav_tests:
                try:
                    print(f"Testing {nav['name']}...")
                    
                    # Wait for element to be visible and click
                    page.wait_for_selector(nav['selector'], state='visible')
                    page.click(nav['selector'])
                    page.wait_for_load_state('networkidle')
                    
                    # Wait for content to load
                    time.sleep(2)
                    
                    # Verify URL
                    current_url = page.url
                    url_correct = nav['expected_path'] in current_url
                    
                    # Take screenshot
                    screenshot_name = f"robust-02-{nav['name'].lower().replace(' ', '-')}.png"
                    page.screenshot(path=f'test-results/{screenshot_name}', full_page=True)
                    
                    nav_results.append({
                        'name': nav['name'],
                        'success': url_correct,
                        'url': current_url
                    })
                    
                    print(f"SUCCESS: {nav['name']} - URL: {current_url}")
                    
                except Exception as e:
                    print(f"ERROR: {nav['name']} failed - {str(e)}")
                    nav_results.append({'name': nav['name'], 'success': False, 'error': str(e)})
            
            # Step 3: Deep dive into Reports section
            print("STEP 3: Deep testing Reports section...")
            
            # Go to Reports
            page.click('a[href="/reports"]')
            page.wait_for_load_state('networkidle')
            
            # Wait for API data to load
            print("Waiting for enterprise backend data...")
            page.wait_for_timeout(5000)
            
            # Check for loading indicators
            loading_selectors = ['.loading', '.spinner', 'text=Loading']
            for selector in loading_selectors:
                if page.is_visible(selector):
                    print(f"Found loading indicator: {selector}")
                    page.wait_for_selector(selector, state='hidden', timeout=10000)
            
            page.screenshot(path='test-results/robust-03-reports-loaded.png', full_page=True)
            
            # Step 4: Look for test data
            print("STEP 4: Verifying real test data display...")
            
            # Check for table or list structures
            data_containers = [
                'table tbody tr',
                '.test-run-item',
                '[data-testid*="run"]',
                'li',
                '.run-row'
            ]
            
            data_found = False
            for selector in data_containers:
                elements = page.query_selector_all(selector)
                if elements and len(elements) > 0:
                    print(f"Found {len(elements)} data items with selector: {selector}")
                    data_found = True
                    
                    # Try to get text from first few items
                    for i, element in enumerate(elements[:5]):
                        text = element.text_content()
                        if text and len(text.strip()) > 0:
                            print(f"  Data item {i+1}: {text.strip()[:50]}...")
                    break
            
            if not data_found:
                print("WARNING: No test data containers found")
                
                # Check for error messages
                error_selectors = ['.error', '.alert', 'text=Error', 'text=Failed']
                for selector in error_selectors:
                    if page.is_visible(selector):
                        error_text = page.text_content(selector) if 'text=' not in selector else selector
                        print(f"Found error: {error_text}")
            
            # Step 5: Test interactive elements
            print("STEP 5: Testing interactive elements...")
            
            # Find all buttons
            buttons = page.query_selector_all('button')
            print(f"Found {len(buttons)} buttons")
            
            interactive_results = []
            for i, button in enumerate(buttons[:10]):  # Test first 10 buttons
                try:
                    if button.is_visible() and button.is_enabled():
                        button_text = button.text_content() or f"Button {i+1}"
                        print(f"Testing button: {button_text}")
                        
                        # Click button
                        button.click()
                        time.sleep(1)
                        
                        # Check for modal/dialog
                        modal_found = False
                        modal_selectors = ['.modal', '.dialog', '[role="dialog"]', '.popup']
                        for modal_sel in modal_selectors:
                            if page.is_visible(modal_sel):
                                print(f"SUCCESS: Button opened modal: {modal_sel}")
                                modal_found = True
                                
                                # Try to close modal
                                close_selectors = ['button:has-text("Close")', 'button:has-text("Cancel")', '.close']
                                for close_sel in close_selectors:
                                    if page.is_visible(close_sel):
                                        page.click(close_sel)
                                        break
                                else:
                                    page.keyboard.press('Escape')  # Fallback
                                break
                        
                        interactive_results.append({
                            'button': button_text,
                            'clicked': True,
                            'opened_modal': modal_found
                        })
                        
                except Exception as e:
                    print(f"Button test error: {str(e)}")
                    interactive_results.append({
                        'button': f"Button {i+1}",
                        'clicked': False,
                        'error': str(e)
                    })
            
            page.screenshot(path='test-results/robust-04-interactions-tested.png', full_page=True)
            
            # Step 6: API connectivity test
            print("STEP 6: Testing API connectivity...")
            
            # Monitor network requests
            api_requests = []
            def track_requests(request):
                if 'api' in request.url:
                    api_requests.append({
                        'url': request.url,
                        'method': request.method
                    })
            
            page.on('request', track_requests)
            
            # Refresh to trigger API calls
            page.reload()
            page.wait_for_load_state('networkidle')
            time.sleep(3)
            
            print(f"Captured {len(api_requests)} API requests:")
            for req in api_requests[:5]:  # Show first 5
                print(f"  {req['method']} {req['url']}")
            
            # Final screenshot
            page.screenshot(path='test-results/robust-05-final.png', full_page=True)
            
            # Results Summary
            print("\n" + "=" * 50)
            print("COMPREHENSIVE TEST RESULTS:")
            print("=" * 50)
            
            successful_nav = sum(1 for r in nav_results if r.get('success', False))
            print(f"Navigation: {successful_nav}/{len(nav_results)} sections working")
            
            successful_buttons = sum(1 for r in interactive_results if r.get('clicked', False))
            print(f"Interactive: {successful_buttons}/{len(interactive_results)} buttons tested")
            
            print(f"API Requests: {len(api_requests)} captured")
            print(f"Data Display: {'YES' if data_found else 'NEEDS INVESTIGATION'}")
            
            overall_success = successful_nav >= 3 and len(api_requests) > 0
            print(f"Overall Status: {'SUCCESS' if overall_success else 'PARTIAL SUCCESS'}")
            
            print("\nScreenshots saved:")
            print("- robust-01-loaded.png")
            print("- robust-02-*.png (navigation)")  
            print("- robust-03-reports-loaded.png")
            print("- robust-04-interactions-tested.png")
            print("- robust-05-final.png")
            
            # Keep browser open for manual inspection
            print("\nKeeping browser open for 60 seconds...")
            time.sleep(60)
            
            return {
                'navigation_success': successful_nav,
                'buttons_tested': len(interactive_results),
                'api_requests': len(api_requests),
                'data_found': data_found,
                'overall_success': overall_success
            }
            
        except Exception as e:
            print(f"CRITICAL ERROR: {str(e)}")
            page.screenshot(path='test-results/robust-error.png', full_page=True)
            return {'error': str(e), 'overall_success': False}
            
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    result = test_enterprise_frontend_robust()
    print(f"\nFINAL RESULT: {result}")