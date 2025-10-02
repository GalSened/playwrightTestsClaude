"""
Test single test execution functionality
"""
import time
from playwright.sync_api import sync_playwright

def test_single_test_execution():
    print("TESTING SINGLE TEST EXECUTION")
    print("=" * 30)
    
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
            
            page.screenshot(path="test_bank_ready.png")
            print("   Screenshot: test_bank_ready.png")
            
            print("3. Looking for Run buttons...")
            
            # Look for run buttons in various forms
            run_selectors = [
                'button:has-text("Run")',
                '[data-testid*="run"]',
                'button[title*="run"], button[title*="Run"]',
                '.run-button',
                'button:has(svg)', # Buttons with icons
                'td button', # Buttons in table cells
                'tr button' # Buttons in table rows
            ]
            
            run_button_found = False
            for selector in run_selectors:
                try:
                    buttons = page.locator(selector)
                    count = buttons.count()
                    if count > 0:
                        print(f"   Found {count} buttons with selector: {selector}")
                        
                        # Try clicking the first visible run button
                        for i in range(min(3, count)):
                            try:
                                button = buttons.nth(i)
                                if button.is_visible():
                                    button_text = button.text_content() or ""
                                    print(f"   Button {i}: '{button_text}' - visible: {button.is_visible()}")
                                    
                                    if "run" in button_text.lower() or "play" in button_text.lower():
                                        print(f"4. Clicking run button: '{button_text}'")
                                        button.click()
                                        run_button_found = True
                                        time.sleep(3)
                                        break
                            except Exception as e:
                                print(f"   Error with button {i}: {str(e)[:50]}")
                        
                        if run_button_found:
                            break
                except Exception as e:
                    continue
            
            if run_button_found:
                print("5. Run button clicked, checking result...")
                page.screenshot(path="after_run_click.png")
                print("   Screenshot: after_run_click.png")
                
                # Look for signs of test execution
                execution_indicators = [
                    ':has-text("Running")',
                    ':has-text("Executing")', 
                    ':has-text("Started")',
                    '.test-running',
                    '[data-testid*="running"]',
                    ':has-text("Browser")',
                    ':has-text("Playwright")'
                ]
                
                for indicator in execution_indicators:
                    try:
                        element = page.locator(indicator)
                        if element.is_visible():
                            text = element.text_content()
                            print(f"   Execution indicator: {text[:100]}")
                    except:
                        pass
                
                # Wait a bit longer to see if anything happens
                print("6. Waiting for execution to start...")
                time.sleep(5)
                
                page.screenshot(path="execution_status.png")
                print("   Screenshot: execution_status.png")
                
                # Check if new browser windows opened (sign of test execution)
                all_contexts = browser.contexts
                print(f"   Browser contexts: {len(all_contexts)}")
                
                if len(all_contexts) > 1:
                    print("   SUCCESS: Additional browser context detected (test likely started)")
                else:
                    print("   INFO: No additional browser contexts (test may be queued or different execution model)")
                
            else:
                print("4. No run buttons found")
                
                # Debug: List all buttons on the page
                all_buttons = page.locator('button')
                button_count = all_buttons.count()
                print(f"   Total buttons found: {button_count}")
                
                for i in range(min(10, button_count)):
                    try:
                        button = all_buttons.nth(i)
                        if button.is_visible():
                            text = button.text_content() or ""
                            title = button.get_attribute("title") or ""
                            classes = button.get_attribute("class") or ""
                            print(f"   Button {i}: '{text}' title='{title}' class='{classes[:50]}'")
                    except:
                        pass
            
            print("7. Checking Reports page for execution history...")
            try:
                reports_link = page.locator('a:has-text("Reports")')
                if reports_link.is_visible():
                    reports_link.click()
                    time.sleep(3)
                    
                    page.screenshot(path="reports_page.png")
                    print("   Screenshot: reports_page.png")
                    
                    # Look for test runs
                    reports_content = page.content()
                    if 'run' in reports_content.lower() or 'test' in reports_content.lower():
                        print("   Reports page has test run content")
                    else:
                        print("   Reports page appears empty")
            except:
                print("   Could not access Reports page")
                
        except Exception as e:
            print(f"ERROR: {str(e)}")
            page.screenshot(path="single_test_error.png")
            
        finally:
            print("8. Test completed")
            time.sleep(3)
            browser.close()

if __name__ == "__main__":
    test_single_test_execution()