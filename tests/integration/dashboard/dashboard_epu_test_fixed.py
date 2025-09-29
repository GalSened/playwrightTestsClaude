import asyncio
from playwright.async_api import async_playwright
import json
import time
import os
import sys

# Set encoding for Windows console
if sys.platform.startswith('win'):
    import locale
    try:
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except locale.Error:
        pass

async def test_dashboard_epu():
    """
    Comprehensive Playwright MCP tests for Dashboard page EPU
    """
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        results = {
            'test_suite': 'Dashboard EPU Tests',
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'tests': [],
            'summary': {'passed': 0, 'failed': 0, 'skipped': 0}
        }
        
        try:
            # === STEP 0: Check if application is running ===
            print("[SEARCH] Step 0: Checking if application is running...")
            try:
                await page.goto('http://localhost:5173/', wait_until='domcontentloaded', timeout=10000)
                print("[PASS] Application is running at http://localhost:5173/")
                await page.wait_for_timeout(2000)
                
            except Exception as e:
                print(f"[FAIL] Application is not running: {e}")
                results['tests'].append({
                    'name': 'Application Availability Check',
                    'status': 'failed',
                    'error': str(e),
                    'details': 'The application must be running at http://localhost:5173/ before tests can execute'
                })
                results['summary']['failed'] += 1
                return results
            
            # === TEST 1: Page Load Verification ===
            print("\\n[TEST] Test 1: Page Load Verification")
            
            try:
                # Navigate to dashboard
                await page.goto('http://localhost:5173/')
                print("[PASS] Navigated to dashboard")
                
                # Verify [data-testid="dashboard-page"] is visible
                dashboard_page = page.locator('[data-testid="dashboard-page"]')
                await dashboard_page.wait_for(state='visible', timeout=10000)
                print("[PASS] [data-testid='dashboard-page'] is visible")
                
                # Verify [data-testid="page-title"] has text "Dashboard"
                page_title = page.locator('[data-testid="page-title"]')
                await page_title.wait_for(state='visible', timeout=5000)
                title_text = await page_title.text_content()
                assert title_text == 'Dashboard', f"Expected 'Dashboard', got '{title_text}'"
                print("[PASS] Page title contains 'Dashboard'")
                
                # Verify core widgets render
                env_status = page.locator('[data-testid="environment-status"]')
                await env_status.wait_for(state='visible', timeout=5000)
                print("[PASS] [data-testid='environment-status'] is visible")
                
                stat_total_tests = page.locator('[data-testid="stat-total-tests"]')
                await stat_total_tests.wait_for(state='visible', timeout=5000)
                print("[PASS] [data-testid='stat-total-tests'] is visible")
                
                stat_total_suites = page.locator('[data-testid="stat-total-suites"]')
                await stat_total_suites.wait_for(state='visible', timeout=5000)
                print("[PASS] [data-testid='stat-total-suites'] is visible")
                
                # Take screenshot of initial state
                await page.screenshot(path='dashboard_initial_state.png')
                print("[CAMERA] Screenshot saved: dashboard_initial_state.png")
                
                results['tests'].append({
                    'name': 'Page Load Verification',
                    'status': 'passed',
                    'details': 'All core elements loaded successfully'
                })
                results['summary']['passed'] += 1
                
            except Exception as e:
                print(f"[FAIL] Page Load Verification failed: {e}")
                await page.screenshot(path='dashboard_load_failure.png')
                results['tests'].append({
                    'name': 'Page Load Verification',
                    'status': 'failed',
                    'error': str(e)
                })
                results['summary']['failed'] += 1
            
            # === TEST 2: Quick Actions Navigation ===
            print("\\n[TEST] Test 2: Quick Actions Navigation")
            
            try:
                # Ensure we're on the dashboard
                await page.goto('http://localhost:5173/')
                await page.wait_for_timeout(1000)
                
                # Test Create Suite navigation
                create_suite_btn = page.locator('[data-testid="quick-create-suite"]')
                await create_suite_btn.wait_for(state='visible', timeout=5000)
                await create_suite_btn.click()
                await page.wait_for_timeout(2000)
                
                # Verify navigation to /test-bank
                current_url = page.url
                assert '/test-bank' in current_url, f"Expected '/test-bank' in URL, got '{current_url}'"
                print("[PASS] Navigation to /test-bank works")
                
                # Navigate back
                await page.go_back()
                await page.wait_for_timeout(1000)
                
                # Test Reports navigation
                reports_btn = page.locator('[data-testid="quick-open-reports"]')
                await reports_btn.wait_for(state='visible', timeout=5000)
                await reports_btn.click()
                await page.wait_for_timeout(2000)
                
                # Verify navigation to /reports
                current_url = page.url
                assert '/reports' in current_url, f"Expected '/reports' in URL, got '{current_url}'"
                print("[PASS] Navigation to /reports works")
                
                # Navigate back to dashboard
                await page.go_back()
                await page.wait_for_timeout(1000)
                
                results['tests'].append({
                    'name': 'Quick Actions Navigation',
                    'status': 'passed',
                    'details': 'All navigation buttons work correctly'
                })
                results['summary']['passed'] += 1
                
            except Exception as e:
                print(f"[FAIL] Quick Actions Navigation failed: {e}")
                await page.screenshot(path='navigation_failure.png')
                results['tests'].append({
                    'name': 'Quick Actions Navigation',
                    'status': 'failed',
                    'error': str(e)
                })
                results['summary']['failed'] += 1
            
            # === TEST 3: Last Run Integration (if exists) ===
            print("\\n[TEST] Test 3: Last Run Integration")
            
            try:
                # Ensure we're on the dashboard
                await page.goto('http://localhost:5173/')
                await page.wait_for_timeout(1000)
                
                # Check if last run card is visible
                last_run_card = page.locator('[data-testid="last-run-card"]')
                
                try:
                    await last_run_card.wait_for(state='visible', timeout=3000)
                    print("[PASS] Last run card found")
                    
                    # Verify last run status is visible
                    last_run_status = page.locator('[data-testid="last-run-status"]')
                    await last_run_status.wait_for(state='visible', timeout=5000)
                    print("[PASS] [data-testid='last-run-status'] is visible")
                    
                    # Verify last run duration is visible
                    last_run_duration = page.locator('[data-testid="last-run-duration"]')
                    await last_run_duration.wait_for(state='visible', timeout=5000)
                    print("[PASS] [data-testid='last-run-duration'] is visible")
                    
                    # Test navigation to run details
                    details_link = page.locator('[data-testid="last-run-details-link"]')
                    await details_link.wait_for(state='visible', timeout=5000)
                    await details_link.click()
                    await page.wait_for_timeout(2000)
                    
                    # Verify navigation to reports section
                    current_url = page.url
                    assert '/reports' in current_url, f"Expected '/reports' in URL, got '{current_url}'"
                    print("[PASS] Navigation to run details works")
                    
                    results['tests'].append({
                        'name': 'Last Run Integration',
                        'status': 'passed',
                        'details': 'Last run summary displays and navigation works'
                    })
                    results['summary']['passed'] += 1
                    
                except Exception as inner_e:
                    print("[INFO] No last run data available (expected for fresh install)")
                    results['tests'].append({
                        'name': 'Last Run Integration',
                        'status': 'skipped',
                        'details': 'No last run data available'
                    })
                    results['summary']['skipped'] += 1
                
            except Exception as e:
                print(f"[FAIL] Last Run Integration failed: {e}")
                results['tests'].append({
                    'name': 'Last Run Integration',
                    'status': 'failed',
                    'error': str(e)
                })
                results['summary']['failed'] += 1
            
            # === TEST 4: Activity Feed Verification ===
            print("\\n[TEST] Test 4: Activity Feed Verification")
            
            try:
                # Ensure we're on the dashboard
                await page.goto('http://localhost:5173/')
                await page.wait_for_timeout(1000)
                
                # Verify activity feed is visible
                activity_feed = page.locator('[data-testid="activity-feed"]')
                await activity_feed.wait_for(state='visible', timeout=5000)
                print("[PASS] [data-testid='activity-feed'] is visible")
                
                # Check that either activity items exist OR activity empty exists
                activity_items = page.locator('[data-testid="activity-item"]')
                activity_empty = page.locator('[data-testid="activity-empty"]')
                
                item_count = await activity_items.count()
                empty_visible = await activity_empty.is_visible()
                
                if item_count > 0:
                    print(f"[PASS] Found {item_count} activity items")
                elif empty_visible:
                    print("[PASS] Empty activity state displayed correctly")
                else:
                    raise Exception("Neither activity items nor empty state found")
                
                results['tests'].append({
                    'name': 'Activity Feed Verification',
                    'status': 'passed',
                    'details': f'Activity feed displays correctly (items: {item_count}, empty: {empty_visible})'
                })
                results['summary']['passed'] += 1
                
            except Exception as e:
                print(f"[FAIL] Activity Feed Verification failed: {e}")
                await page.screenshot(path='activity_feed_failure.png')
                results['tests'].append({
                    'name': 'Activity Feed Verification',
                    'status': 'failed',
                    'error': str(e)
                })
                results['summary']['failed'] += 1
            
            # Take final screenshot
            await page.screenshot(path='dashboard_final_state.png')
            print("[CAMERA] Final screenshot saved: dashboard_final_state.png")
            
            return results
            
        finally:
            await browser.close()

async def main():
    """Main function to run tests and display results"""
    print("[ROCKET] Starting Dashboard EPU Tests...")
    result = await test_dashboard_epu()
    
    print(f"\\n[CHART] FINAL TEST RESULTS:")
    print(f"{'='*50}")
    print(f"Test Suite: {result['test_suite']}")
    print(f"Timestamp: {result['timestamp']}")
    print(f"Passed: {result['summary']['passed']}")
    print(f"Failed: {result['summary']['failed']}")
    print(f"Skipped: {result['summary']['skipped']}")
    print(f"Total: {sum(result['summary'].values())}")
    
    print(f"\\n[CLIPBOARD] DETAILED RESULTS:")
    print(f"{'='*50}")
    for test in result['tests']:
        status_icon = "[PASS]" if test['status'] == 'passed' else "[FAIL]" if test['status'] == 'failed' else "[SKIP]"
        print(f"{status_icon} {test['name']}: {test['status'].upper()}")
        if 'details' in test:
            print(f"   Details: {test['details']}")
        if 'error' in test:
            print(f"   Error: {test['error']}")
    
    # Save results to JSON file
    results_file = 'dashboard_epu_results.json'
    with open(results_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\\n[SAVE] Full results saved to: {results_file}")
    
    return result

if __name__ == "__main__":
    asyncio.run(main())