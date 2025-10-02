"""
Test the Create Schedule button functionality in the UI
"""
import time
from playwright.sync_api import sync_playwright

def test_create_schedule_button():
    print("TESTING CREATE SCHEDULE BUTTON UI")
    print("=" * 40)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=1500)
        page = browser.new_page()
        
        try:
            print("1. Opening Playwright Smart platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            current_url = page.url
            print(f"   Current URL: {current_url}")
            
            if "/login" not in current_url:
                print("   SUCCESS: Authentication working")
                
                # Navigate to Test Bank
                print("2. Navigating to Test Bank...")
                test_bank_link = page.locator('a:has-text("Test Bank")')
                if test_bank_link.is_visible():
                    test_bank_link.click()
                    time.sleep(3)
                    
                    print(f"   Navigated to: {page.url}")
                    page.screenshot(path="test_bank_page_scheduler.png")
                    
                    # Look for Create Test Run button (purple button)
                    print("3. Looking for Create Test Run / Schedule button...")
                    create_buttons = [
                        'button:has-text("Create Test Run")',
                        'button:has-text("+ Create Test Run")', 
                        'button:has-text("Schedule")',
                        '[data-testid="create-test-run"]',
                        'button[type="submit"]'
                    ]
                    
                    found_button = None
                    for selector in create_buttons:
                        try:
                            button = page.locator(selector)
                            if button.is_visible():
                                found_button = selector
                                print(f"   Found button: {selector}")
                                break
                        except:
                            pass
                    
                    if found_button:
                        print(f"4. Clicking Create Test Run button...")
                        page.locator(found_button).click()
                        time.sleep(3)
                        
                        # Take screenshot after clicking
                        page.screenshot(path="after_create_button_click.png")
                        print("   Screenshot: after_create_button_click.png")
                        
                        # Look for scheduler form elements
                        print("5. Looking for scheduler form...")
                        scheduler_elements = [
                            'input[type="datetime-local"]',
                            'input[type="date"]',
                            'input[type="time"]',
                            'select',
                            '[data-testid="schedule-form"]',
                            'input[placeholder*="date"]',
                            'input[placeholder*="time"]'
                        ]
                        
                        found_scheduler_elements = []
                        for selector in scheduler_elements:
                            try:
                                element = page.locator(selector)
                                count = element.count()
                                if count > 0:
                                    found_scheduler_elements.append(f"{selector} ({count})")
                                    print(f"   Found: {selector} ({count} elements)")
                            except:
                                pass
                        
                        if found_scheduler_elements:
                            print("   SUCCESS: Scheduler form elements found!")
                            
                            # Try to fill in a simple schedule
                            print("6. Testing schedule form interaction...")
                            
                            # Look for date/time inputs
                            datetime_input = page.locator('input[type="datetime-local"]')
                            if datetime_input.is_visible():
                                # Set a future date/time
                                datetime_input.fill("2025-09-01T15:30")
                                print("   Filled datetime input")
                            
                            # Look for submit button
                            submit_buttons = [
                                'button:has-text("Schedule")',
                                'button:has-text("Create Schedule")',
                                'button[type="submit"]'
                            ]
                            
                            for submit_selector in submit_buttons:
                                try:
                                    submit_btn = page.locator(submit_selector)
                                    if submit_btn.is_visible():
                                        print(f"   Found submit button: {submit_selector}")
                                        # Don't actually submit, just verify it's there
                                        break
                                except:
                                    pass
                            
                            page.screenshot(path="scheduler_form_filled.png")
                            print("   Screenshot: scheduler_form_filled.png")
                            
                        else:
                            print("   No scheduler form elements found")
                            
                    else:
                        print("   Create Test Run button not found")
                        # Take screenshot to see what's available
                        page.screenshot(path="no_create_button_found.png") 
                        print("   Screenshot: no_create_button_found.png")
                        
                        # Try to find any buttons on the page
                        all_buttons = page.locator('button')
                        button_count = all_buttons.count()
                        print(f"   Found {button_count} total buttons on page")
                        
                        for i in range(min(button_count, 5)):
                            try:
                                button_text = all_buttons.nth(i).text_content()
                                print(f"   Button {i+1}: '{button_text}'")
                            except:
                                pass
                else:
                    print("   Test Bank link not found")
                    
            else:
                print("   FAILED: Still on login page")
                
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="create_schedule_error.png")
            
        finally:
            print("7. Test completed")
            time.sleep(2)
            browser.close()

if __name__ == "__main__":
    test_create_schedule_button()