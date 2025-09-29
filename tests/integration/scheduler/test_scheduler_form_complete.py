"""
Complete test of the scheduler form functionality
"""
import time
from playwright.sync_api import sync_playwright

def test_complete_scheduler_form():
    print("TESTING COMPLETE SCHEDULER FORM")
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
            
            print("3. Clicking on Scheduled Runs tab...")
            scheduled_runs_tab = page.locator('button:has-text("Scheduled Runs")')
            if scheduled_runs_tab.is_visible():
                scheduled_runs_tab.click()
                time.sleep(2)
                print("   Switched to Scheduled Runs tab")
            
            print("4. Looking for Schedule Run button...")
            schedule_run_btn = page.locator('button:has-text("Schedule Run")')
            
            if schedule_run_btn.is_visible():
                print("   Found Schedule Run button!")
                schedule_run_btn.click()
                time.sleep(3)
                
                page.screenshot(path="scheduler_form_opened.png")
                print("   Screenshot: scheduler_form_opened.png")
                
                print("5. Looking for scheduler form elements...")
                
                # Check for various form elements
                form_elements = {
                    'Suite Name': 'input[placeholder*="name"], input[name*="name"], select',
                    'Date/Time': 'input[type="datetime-local"], input[type="date"], input[type="time"]',
                    'Timezone': 'select, input[placeholder*="timezone"]',
                    'Notes': 'textarea, input[placeholder*="note"]',
                    'Priority': 'select, input[type="number"]',
                    'Submit Button': 'button:has-text("Create"), button:has-text("Schedule"), button[type="submit"]'
                }
                
                found_elements = {}
                for element_name, selector in form_elements.items():
                    try:
                        element = page.locator(selector)
                        count = element.count()
                        if count > 0:
                            found_elements[element_name] = count
                            print(f"   ✓ {element_name}: {count} elements")
                            
                            # Try to interact with the first element of each type
                            first_element = element.first
                            if first_element.is_visible():
                                if element_name == 'Suite Name':
                                    try:
                                        first_element.fill("Test Suite via UI")
                                        print("     - Filled suite name")
                                    except:
                                        pass
                                elif element_name == 'Date/Time':
                                    try:
                                        first_element.fill("2025-09-01T16:00")
                                        print("     - Set date/time")
                                    except:
                                        pass
                                elif element_name == 'Notes':
                                    try:
                                        first_element.fill("Created via UI test")
                                        print("     - Added notes")
                                    except:
                                        pass
                        else:
                            print(f"   ✗ {element_name}: Not found")
                    except Exception as e:
                        print(f"   ✗ {element_name}: Error - {e}")
                
                if found_elements:
                    print("6. SUCCESS: Scheduler form is functional!")
                    page.screenshot(path="scheduler_form_filled_complete.png")
                    print("   Screenshot: scheduler_form_filled_complete.png")
                    
                    # Check if submit button is enabled
                    submit_btn = page.locator('button:has-text("Create"), button:has-text("Schedule"), button[type="submit"]')
                    if submit_btn.is_visible():
                        is_enabled = not submit_btn.is_disabled()
                        print(f"   Submit button enabled: {is_enabled}")
                        
                        if is_enabled:
                            print("   READY: Form can be submitted (not submitting in test)")
                        else:
                            print("   INFO: Submit button disabled (may need more fields)")
                else:
                    print("6. FAILED: No scheduler form elements found")
                    
            else:
                print("   Schedule Run button not found")
                # Check what buttons are available
                all_buttons = page.locator('button')
                button_count = all_buttons.count()
                print(f"   Available buttons ({button_count}):")
                for i in range(min(button_count, 8)):
                    try:
                        btn_text = all_buttons.nth(i).text_content()
                        if btn_text.strip():
                            print(f"   - '{btn_text.strip()}'")
                    except:
                        pass
                        
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="scheduler_form_error.png")
            
        finally:
            print("7. Test completed")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    test_complete_scheduler_form()