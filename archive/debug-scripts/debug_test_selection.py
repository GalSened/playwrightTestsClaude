"""
Debug test selection mechanism
"""
import time
from playwright.sync_api import sync_playwright

def debug_test_selection():
    print("DEBUGGING TEST SELECTION MECHANISM")
    print("=" * 40)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=1500)
        page = browser.new_page()
        
        try:
            print("1. Opening platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            print("2. Going to Test Bank...")
            page.locator('a:has-text("Test Bank")').click()
            time.sleep(2)
            
            print("3. Checking initial state...")
            # Check Suite Builder status
            suite_builder_text = page.locator('[data-testid="suite-builder"], .suite-builder').text_content()
            if suite_builder_text:
                print(f"   Suite Builder: {suite_builder_text}")
            
            print("4. Selecting first test checkbox...")
            # Try different checkbox selectors
            checkbox_selectors = [
                'table tbody tr:first-child input[type="checkbox"]',
                'tr:first-child input[type="checkbox"]',
                'tbody input[type="checkbox"]:first-child',
                'input[type="checkbox"]'
            ]
            
            checkbox_clicked = False
            for selector in checkbox_selectors:
                try:
                    checkbox = page.locator(selector).first
                    if checkbox.is_visible():
                        print(f"   Using selector: {selector}")
                        checkbox.click()
                        checkbox_clicked = True
                        break
                except Exception as e:
                    print(f"   Failed with {selector}: {str(e)[:50]}")
            
            if checkbox_clicked:
                print("5. Checkbox clicked, waiting for UI update...")
                time.sleep(3)
                
                # Check if Suite Builder updated
                updated_suite_text = page.locator('[data-testid="suite-builder"], .suite-builder').text_content()
                if updated_suite_text:
                    print(f"   Suite Builder after click: {updated_suite_text}")
                
                # Check for selected tests indicators
                print("6. Looking for selection indicators...")
                
                selection_indicators = [
                    '[data-testid="selected-tests-list"]',
                    '.selected-tests',
                    ':has-text("tests selected")',
                    ':has-text("Selected Tests")'
                ]
                
                for indicator in selection_indicators:
                    try:
                        element = page.locator(indicator)
                        if element.is_visible():
                            text = element.text_content()
                            print(f"   Found indicator: {indicator} - {text[:100]}")
                    except:
                        pass
                
                print("7. Checking Schedule Run button status WITHOUT switching tabs...")
                page.screenshot(path="after_test_selection.png")
                print("   Screenshot: after_test_selection.png")
                
                # Don't switch tabs yet - check if there's any immediate feedback
                time.sleep(2)
                
                # Now try switching to scheduler tab
                print("8. Switching to Scheduled Runs...")
                scheduled_runs_tab = page.locator('button:has-text("Scheduled Runs")')
                scheduled_runs_tab.click()
                time.sleep(2)
                
                # Check button status
                schedule_btn = page.locator('[data-testid="show-schedule-form"]')
                if schedule_btn.is_visible():
                    disabled = schedule_btn.is_disabled()
                    print(f"   Schedule Run button disabled: {disabled}")
                    
                    if not disabled:
                        print("   SUCCESS: Selection persisted across tab switch!")
                    else:
                        print("   ISSUE: Selection lost when switching tabs")
                        
                page.screenshot(path="scheduler_tab_after_selection.png")
                print("   Screenshot: scheduler_tab_after_selection.png")
            else:
                print("   No checkbox could be clicked")
                
        except Exception as e:
            print(f"ERROR: {str(e)}")
            page.screenshot(path="debug_selection_error.png")
            
        finally:
            print("9. Test completed")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    debug_test_selection()