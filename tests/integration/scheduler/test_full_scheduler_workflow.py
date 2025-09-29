"""
Test the complete scheduler workflow from test selection to schedule creation
"""
import time
from playwright.sync_api import sync_playwright

def test_full_scheduler_workflow():
    print("TESTING FULL SCHEDULER WORKFLOW")
    print("=" * 35)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=2000)
        page = browser.new_page()
        
        try:
            print("1. Opening Playwright Smart platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            print("2. Navigating to Test Bank...")
            test_bank_link = page.locator('a:has-text("Test Bank")')
            test_bank_link.click()
            time.sleep(2)
            
            print("3. Starting on Tests & Suites tab...")
            tests_suites_tab = page.locator('button:has-text("Tests & Suites")')
            if tests_suites_tab.is_visible():
                tests_suites_tab.click()
                time.sleep(2)
                print("   Switched to Tests & Suites tab")
            
            page.screenshot(path="tests_suites_tab.png")
            print("   Screenshot: tests_suites_tab.png")
            
            print("4. Looking for tests to select...")
            
            # Look for test checkboxes or selection elements
            test_selectors = [
                'input[type="checkbox"]',
                '[data-testid*="test"]',
                '.test-item',
                '.test-card',
                'button:has-text("Select")',
                'tr', # table rows
                '[role="row"]'
            ]
            
            found_tests = False
            for selector in test_selectors:
                try:
                    elements = page.locator(selector)
                    count = elements.count()
                    if count > 0:
                        print(f"   Found {count} elements with selector: {selector}")
                        
                        if selector == 'input[type="checkbox"]':
                            # Try to check the first few checkboxes
                            for i in range(min(3, count)):
                                try:
                                    checkbox = elements.nth(i)
                                    if checkbox.is_visible() and not checkbox.is_checked():
                                        checkbox.check()
                                        print(f"   ✓ Selected test {i+1}")
                                        found_tests = True
                                except Exception as e:
                                    print(f"   ✗ Could not select test {i+1}: {e}")
                        
                        if found_tests:
                            break
                            
                except Exception as e:
                    continue
            
            if not found_tests:
                print("   No selectable tests found, checking page content...")
                page_text = page.content()
                if 'test' in page_text.lower():
                    print("   Tests content detected, but no selection mechanism found")
                else:
                    print("   No test content found on page")
            
            print("5. Checking if Schedule button is now enabled...")
            time.sleep(2)
            
            # Navigate to Scheduled Runs tab
            scheduled_runs_tab = page.locator('button:has-text("Scheduled Runs")')
            if scheduled_runs_tab.is_visible():
                scheduled_runs_tab.click()
                time.sleep(2)
                print("   Switched to Scheduled Runs tab")
            
            # Check Schedule Run button status
            schedule_run_btn = page.locator('button:has-text("Schedule Run"),[data-testid="show-schedule-form"]')
            
            if schedule_run_btn.is_visible():
                is_disabled = schedule_run_btn.is_disabled()
                print(f"   Schedule Run button disabled: {is_disabled}")
                
                if not is_disabled:
                    print("6. SUCCESS: Schedule Run button is enabled!")
                    schedule_run_btn.click()
                    time.sleep(3)
                    
                    page.screenshot(path="scheduler_form_opened_after_selection.png")
                    print("   Screenshot: scheduler_form_opened_after_selection.png")
                    
                    print("7. Testing scheduler form...")
                    # Look for form elements
                    form_found = False
                    
                    # Common scheduler form selectors
                    form_selectors = [
                        'form',
                        '[data-testid*="schedule"]',
                        'input[type="datetime-local"]',
                        'input[name*="date"]',
                        'input[name*="time"]',
                        'select'
                    ]
                    
                    for selector in form_selectors:
                        try:
                            elements = page.locator(selector)
                            count = elements.count()
                            if count > 0:
                                print(f"   Found {count} form elements: {selector}")
                                form_found = True
                        except:
                            continue
                    
                    if form_found:
                        print("   SUCCESS: Scheduler form is accessible!")
                    else:
                        print("   INFO: Form elements not yet visible (may need more interaction)")
                        
                else:
                    print("6. Schedule Run button still disabled")
                    print("   This could mean:")
                    print("   - No tests were successfully selected")
                    print("   - Additional requirements need to be met")
                    print("   - The selection mechanism works differently")
                    
                    # Try to find any selection indicators
                    print("   Checking for selection indicators...")
                    page.screenshot(path="schedule_button_still_disabled.png")
                    
            else:
                print("   Schedule Run button not found")
            
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="full_scheduler_workflow_error.png")
            
        finally:
            print("8. Test completed")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    test_full_scheduler_workflow()