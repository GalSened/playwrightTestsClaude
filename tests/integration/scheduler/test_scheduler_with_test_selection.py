"""
Test scheduler with proper test selection
"""
import time
from playwright.sync_api import sync_playwright

def test_scheduler_with_test_selection():
    print("TESTING SCHEDULER WITH TEST SELECTION")
    print("=" * 40)
    
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
            
            print("3. On Tests & Suites tab - selecting tests...")
            
            # Find test checkboxes in the table
            test_checkboxes = page.locator('table input[type="checkbox"], tbody input[type="checkbox"], tr input[type="checkbox"]')
            checkbox_count = test_checkboxes.count()
            print(f"   Found {checkbox_count} test checkboxes")
            
            if checkbox_count > 0:
                # Select first 3 tests
                tests_selected = 0
                for i in range(min(3, checkbox_count)):
                    try:
                        checkbox = test_checkboxes.nth(i)
                        if checkbox.is_visible() and not checkbox.is_checked():
                            checkbox.check()
                            tests_selected += 1
                            print(f"   ✓ Selected test {i+1}")
                            time.sleep(0.5)  # Small delay between selections
                    except Exception as e:
                        print(f"   ✗ Failed to select test {i+1}: {e}")
                
                print(f"   Total tests selected: {tests_selected}")
                
                if tests_selected > 0:
                    # Wait for UI to update
                    time.sleep(2)
                    
                    # Check Suite Builder status
                    suite_builder_text = page.locator('.suite-builder, [data-testid*="suite"]').text_content()
                    if suite_builder_text and "selected" in suite_builder_text.lower():
                        print(f"   Suite Builder updated: {suite_builder_text}")
                    
                    print("4. Switching to Scheduled Runs tab...")
                    scheduled_runs_tab = page.locator('button:has-text("Scheduled Runs")')
                    scheduled_runs_tab.click()
                    time.sleep(2)
                    
                    print("5. Checking Schedule Run button status...")
                    schedule_run_btn = page.locator('button:has-text("Schedule Run"), [data-testid="show-schedule-form"]')
                    
                    if schedule_run_btn.is_visible():
                        is_disabled = schedule_run_btn.is_disabled()
                        print(f"   Schedule Run button disabled: {is_disabled}")
                        
                        if not is_disabled:
                            print("6. SUCCESS: Schedule Run button enabled! Clicking...")
                            schedule_run_btn.click()
                            time.sleep(3)
                            
                            page.screenshot(path="scheduler_form_with_selected_tests.png")
                            print("   Screenshot: scheduler_form_with_selected_tests.png")
                            
                            print("7. Looking for scheduler form...")
                            
                            # Check for form elements
                            form_elements = {
                                'Suite Name Input': 'input[name*="suite"], input[placeholder*="suite"], input[placeholder*="name"]',
                                'DateTime Input': 'input[type="datetime-local"], input[type="date"], input[type="time"]',
                                'Timezone Select': 'select[name*="timezone"], select:has(option:has-text("Jerusalem"))',
                                'Notes Textarea': 'textarea, input[placeholder*="note"]',
                                'Submit Button': 'button:has-text("Create"), button:has-text("Schedule"), button[type="submit"]'
                            }
                            
                            form_working = True
                            for element_name, selector in form_elements.items():
                                try:
                                    element = page.locator(selector).first
                                    if element.is_visible():
                                        print(f"   ✓ Found: {element_name}")
                                        
                                        # Try to interact with form elements
                                        if element_name == 'Suite Name Input':
                                            element.fill("Test Suite from UI")
                                            print("     - Filled suite name")
                                        elif element_name == 'DateTime Input':
                                            element.fill("2025-09-01T17:30")
                                            print("     - Set date/time")
                                        elif element_name == 'Notes Textarea':
                                            element.fill("Created via complete UI test")
                                            print("     - Added notes")
                                    else:
                                        print(f"   ✗ Not visible: {element_name}")
                                        form_working = False
                                except Exception as e:
                                    print(f"   ✗ Error with {element_name}: {e}")
                                    form_working = False
                            
                            if form_working:
                                print("8. SUCCESS: Scheduler form is fully functional!")
                                page.screenshot(path="scheduler_form_filled_ready.png")
                                print("   Screenshot: scheduler_form_filled_ready.png")
                                
                                # Check if we can submit (don't actually submit)
                                submit_btn = page.locator('button:has-text("Create"), button:has-text("Schedule"), button[type="submit"]')
                                if submit_btn.is_visible() and not submit_btn.is_disabled():
                                    print("   ✓ Form ready for submission!")
                                    print("   (Not submitting in test mode)")
                                else:
                                    print("   ⚠ Submit button not ready yet")
                            else:
                                print("8. PARTIAL: Some form elements not working properly")
                                
                        else:
                            print("6. Schedule Run button still disabled after test selection")
                            
                            # Debug: check if tests are actually selected
                            print("   Debugging: checking test selection state...")
                            page.goto("http://localhost:3000/test-bank")  # Refresh to check state
                            time.sleep(2)
                            
                            selected_checkboxes = page.locator('input[type="checkbox"]:checked')
                            selected_count = selected_checkboxes.count()
                            print(f"   Currently selected tests: {selected_count}")
                    else:
                        print("   Schedule Run button not found")
                else:
                    print("4. No tests were successfully selected")
            else:
                print("   No test checkboxes found")
                
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="scheduler_selection_error.png")
            
        finally:
            print("9. Test completed")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    test_scheduler_with_test_selection()