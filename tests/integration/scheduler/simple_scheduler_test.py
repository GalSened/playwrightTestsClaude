"""
Simple scheduler test without unicode characters
"""
import time
from playwright.sync_api import sync_playwright

def test_simple_scheduler():
    print("TESTING SIMPLE SCHEDULER WORKFLOW")
    print("=" * 35)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=2000)
        page = browser.new_page()
        
        try:
            print("1. Opening platform...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            
            print("2. Going to Test Bank...")
            page.locator('a:has-text("Test Bank")').click()
            time.sleep(2)
            
            print("3. Selecting tests...")
            # Find and check first 3 test checkboxes
            checkboxes = page.locator('table input[type="checkbox"]')
            count = checkboxes.count()
            print(f"   Found {count} checkboxes")
            
            selected = 0
            for i in range(min(3, count)):
                try:
                    cb = checkboxes.nth(i)
                    if cb.is_visible():
                        cb.check()
                        selected += 1
                        print(f"   Selected test {i+1}")
                        time.sleep(0.5)
                except Exception as e:
                    print(f"   Failed test {i+1}: {str(e)[:50]}")
            
            print(f"   Total selected: {selected}")
            time.sleep(2)
            
            print("4. Going to Scheduled Runs...")
            page.locator('button:has-text("Scheduled Runs")').click()
            time.sleep(2)
            
            print("5. Checking Schedule Run button...")
            schedule_btn = page.locator('[data-testid="show-schedule-form"]')
            
            if schedule_btn.is_visible():
                disabled = schedule_btn.is_disabled()
                print(f"   Button disabled: {disabled}")
                
                if not disabled:
                    print("6. SUCCESS: Button enabled, clicking...")
                    schedule_btn.click()
                    time.sleep(3)
                    
                    page.screenshot(path="scheduler_form_opened_success.png")
                    print("   Screenshot saved: scheduler_form_opened_success.png")
                    
                    # Look for form inputs
                    inputs = page.locator('input, select, textarea')
                    input_count = inputs.count()
                    print(f"   Found {input_count} form inputs")
                    
                    if input_count > 0:
                        print("7. SUCCESS: Scheduler form working!")
                    else:
                        print("7. No form inputs found")
                else:
                    print("6. Button still disabled")
                    page.screenshot(path="button_still_disabled.png")
            else:
                print("   Schedule button not found")
                
        except Exception as e:
            print(f"ERROR: {str(e)[:100]}")
            page.screenshot(path="simple_scheduler_error.png")
            
        finally:
            print("8. Test completed")
            time.sleep(2)
            browser.close()

if __name__ == "__main__":
    test_simple_scheduler()