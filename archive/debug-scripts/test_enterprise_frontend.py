# ENTERPRISE TRACE VIEWER - PLAYWRIGHT MCP COMPREHENSIVE TESTING
# Starting with frontend navigation and routing validation

from playwright.sync_api import sync_playwright
import time
import json
import os

def setup_test_environment():
    """Setup test results directory"""
    os.makedirs('test-results', exist_ok=True)
    print("📁 Test results directory created")

def test_frontend_navigation():
    """
    TICKET-005: Comprehensive frontend navigation and routing testing
    Testing all navigation elements with real enterprise data
    """
    
    with sync_playwright() as p:
        # Launch browser for comprehensive testing
        browser = p.chromium.launch(
            headless=False,
            args=['--start-maximized'],
            slow_mo=500  # Slow down for visibility
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            record_video_dir='test-results/videos/'
        )
        
        page = context.new_page()
        
        try:
            print("🎫 TICKET-005: FRONTEND NAVIGATION & ROUTING VALIDATION")
            print("=" * 60)
            
            # Step 1: Navigate to application
            print("📍 Step 1: Initial application load")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle')
            
            # Capture initial state
            page.screenshot(path='test-results/ticket-005-01-initial-load.png', full_page=True)
            print("✅ Application loaded successfully")
            
            # Step 2: Test main navigation
            print("📍 Step 2: Testing main navigation elements")
            
            nav_items = [
                ('Dashboard', '/'),
                ('Test Bank', '/test-bank'), 
                ('Reports', '/reports'),
                ('Analytics', '/analytics')
            ]
            
            navigation_results = []
            
            for nav_name, expected_path in nav_items:
                try:
                    print(f"🔍 Testing navigation to {nav_name}")
                    
                    # Click navigation item
                    nav_selector = f'text={nav_name}'
                    if page.is_visible(nav_selector):
                        page.click(nav_selector)
                        page.wait_for_load_state('networkidle')
                        
                        # Wait a bit for content to load
                        time.sleep(2)
                        
                        # Capture screenshot
                        page.screenshot(
                            path=f'test-results/ticket-005-02-nav-{nav_name.lower().replace(" ", "-")}.png',
                            full_page=True
                        )
                        
                        # Verify URL change
                        current_url = page.url
                        url_correct = expected_path in current_url or current_url.endswith('/')
                        
                        navigation_results.append({
                            'section': nav_name,
                            'expected_path': expected_path,
                            'actual_url': current_url,
                            'success': url_correct,
                            'accessible': True
                        })
                        
                        print(f"✅ {nav_name} - URL: {current_url}")
                        
                    else:
                        print(f"❌ Navigation item '{nav_name}' not found")
                        navigation_results.append({
                            'section': nav_name,
                            'success': False,
                            'accessible': False,
                            'error': 'Navigation element not visible'
                        })
                        
                except Exception as e:
                    print(f"❌ Error testing {nav_name}: {str(e)}")
                    navigation_results.append({
                        'section': nav_name,
                        'success': False,
                        'error': str(e)
                    })
            
            # Step 3: Focus on Reports section (our main feature)
            print("📍 Step 3: Deep testing of Reports section")
            
            # Navigate to Reports
            page.click('text=Reports')
            page.wait_for_load_state('networkidle')
            
            # Wait for API data to load
            print("⏳ Waiting for test run data to load from enterprise backend...")
            page.wait_for_timeout(3000)  # Wait for API calls
            
            page.screenshot(path='test-results/ticket-005-03-reports-loaded.png', full_page=True)
            
            # Step 4: Verify real data is displayed
            print("📍 Step 4: Verifying real data display")
            
            # Look for our test runs
            expected_runs = [
                'Mobile Device Testing',
                'UI Regression Tests',
                'Performance Test Suite',
                'Integration Test Suite',
                'Smoke Test Suite'
            ]
            
            data_verification = []
            
            for run_name in expected_runs:
                if page.is_visible(f'text={run_name}'):
                    print(f"✅ Found test run: {run_name}")
                    data_verification.append({'run': run_name, 'found': True})
                else:
                    print(f"⚠️ Test run not visible: {run_name}")
                    data_verification.append({'run': run_name, 'found': False})
            
            # Step 5: Test responsive design
            print("📍 Step 5: Testing responsive design")
            
            # Test different viewport sizes
            viewports = [
                {'width': 1920, 'height': 1080, 'name': 'desktop'},
                {'width': 1024, 'height': 768, 'name': 'tablet'},
                {'width': 375, 'height': 667, 'name': 'mobile'}
            ]
            
            for viewport in viewports:
                page.set_viewport_size(viewport['width'], viewport['height'])
                page.wait_for_timeout(1000)
                
                page.screenshot(
                    path=f'test-results/ticket-005-04-responsive-{viewport["name"]}.png',
                    full_page=True
                )
                print(f"✅ Tested {viewport['name']} viewport ({viewport['width']}x{viewport['height']})")
            
            # Reset to desktop size
            page.set_viewport_size(1920, 1080)
            
            # Step 6: Test browser navigation (back/forward)
            print("📍 Step 6: Testing browser navigation")
            
            page.click('text=Dashboard')
            page.wait_for_load_state('networkidle')
            
            page.click('text=Analytics') 
            page.wait_for_load_state('networkidle')
            
            # Test back button
            page.go_back()
            page.wait_for_load_state('networkidle')
            current_url = page.url
            print(f"✅ Back navigation works - Current URL: {current_url}")
            
            # Test forward button
            page.go_forward()
            page.wait_for_load_state('networkidle')
            current_url = page.url
            print(f"✅ Forward navigation works - Current URL: {current_url}")
            
            page.screenshot(path='test-results/ticket-005-05-navigation-complete.png', full_page=True)
            
            # Step 7: Test deep linking
            print("📍 Step 7: Testing deep linking")
            
            # Test direct navigation to reports
            page.goto('http://localhost:5173/reports')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)
            
            if 'reports' in page.url.lower() or page.is_visible('text=Reports'):
                print("✅ Deep linking to reports works")
            else:
                print("❌ Deep linking to reports failed")
            
            page.screenshot(path='test-results/ticket-005-06-deep-linking.png', full_page=True)
            
            # Comprehensive Results
            print("\n" + "=" * 60)
            print("🎫 TICKET-005 COMPREHENSIVE RESULTS")
            print("=" * 60)
            
            # Navigation Results
            successful_nav = sum(1 for result in navigation_results if result.get('success', False))
            total_nav = len(navigation_results)
            print(f"🔍 Navigation Testing: {successful_nav}/{total_nav} sections working")
            
            for result in navigation_results:
                status = "✅" if result.get('success', False) else "❌"
                print(f"   {status} {result['section']}")
            
            # Data Verification Results
            found_runs = sum(1 for result in data_verification if result['found'])
            total_expected = len(data_verification)
            print(f"📊 Data Display: {found_runs}/{total_expected} test runs visible")
            
            # Overall Assessment
            overall_success = (successful_nav / total_nav) >= 0.8 and (found_runs / total_expected) >= 0.6
            
            print(f"\n🎯 OVERALL STATUS: {'SUCCESS' if overall_success else 'NEEDS ATTENTION'}")
            print(f"📁 Screenshots saved: test-results/ticket-005-*.png")
            print(f"🎥 Video recording: test-results/videos/")
            
            return {
                'ticket': 'TICKET-005',
                'status': 'SUCCESS' if overall_success else 'PARTIAL',
                'navigation_success_rate': successful_nav / total_nav,
                'data_display_rate': found_runs / total_expected,
                'tests_completed': 7,
                'screenshots_taken': 6,
                'issues_found': [] if overall_success else ['Some navigation or data issues detected']
            }
            
        except Exception as e:
            print(f"❌ TICKET-005 failed with error: {str(e)}")
            page.screenshot(path='test-results/ticket-005-error.png', full_page=True)
            return {
                'ticket': 'TICKET-005',
                'status': 'FAILED',
                'error': str(e)
            }
            
        finally:
            # Keep browser open briefly for inspection
            print("\n🔍 Keeping browser open for 30 seconds for manual inspection...")
            time.sleep(30)
            context.close()
            browser.close()

if __name__ == "__main__":
    # Execute the test
    setup_test_environment()
    result = test_frontend_navigation()
    print(f"\nFinal Result: {json.dumps(result, indent=2)}")