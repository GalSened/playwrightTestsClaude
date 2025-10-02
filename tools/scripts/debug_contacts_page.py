#!/usr/bin/env python3
"""
Debug script to analyze the contacts page and find correct selectors
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright
from src.config.wesign_test_config import WeSignTestConfig
from src.utils.test_helpers import TestHelpers

def debug_contacts_page():
    """Debug the contacts page to find correct selectors"""
    config = WeSignTestConfig()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        # Create test helpers
        test_helpers = TestHelpers(page, config)
        
        try:
            # Navigate to base URL
            page.goto(config.urls['base_url'])
            page.wait_for_load_state('networkidle')
            
            # Login
            if test_helpers.login_with_default_user():
                print("Login successful")
                
                # Navigate to contacts page - first click Contacts button
                contacts_button = page.locator('button.button--contacts-ent:has-text("Contacts")').first
                contacts_button.click()
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(3000)
                
                print(f"Current URL: {page.url}")
                
                # Look for all buttons on the page
                print("\nAll buttons on page:")
                buttons = page.locator('button').all()
                for i, button in enumerate(buttons):
                    try:
                        text = button.inner_text()
                        visible = button.is_visible()
                        classes = button.get_attribute('class') or ''
                        print(f"  Button {i}: '{text}' (visible: {visible}, classes: {classes})")
                    except:
                        print(f"  Button {i}: <could not read>")
                
                # Look for input elements
                print("\nAll input elements:")
                inputs = page.locator('input').all()
                for i, input_elem in enumerate(inputs):
                    try:
                        input_type = input_elem.get_attribute('type') or ''
                        placeholder = input_elem.get_attribute('placeholder') or ''
                        classes = input_elem.get_attribute('class') or ''
                        print(f"  Input {i}: type='{input_type}', placeholder='{placeholder}', classes: {classes}")
                    except:
                        print(f"  Input {i}: <could not read>")
                
                # Look for links with import/excel text
                print("\nAll elements with 'import' or 'excel' text:")
                all_elements = page.locator('*').all()
                for elem in all_elements:
                    try:
                        text = elem.inner_text().lower()
                        if 'import' in text or 'excel' in text:
                            tag = elem.evaluate('el => el.tagName')
                            classes = elem.get_attribute('class') or ''
                            print(f"  {tag}: '{text}' (classes: {classes})")
                    except:
                        continue
                
                # Take screenshot for manual inspection
                page.screenshot(path='artifacts/screenshots/contacts_debug.png', full_page=True)
                print("\nScreenshot saved to artifacts/screenshots/contacts_debug.png")
                
            else:
                print("Login failed")
                
        except Exception as e:
            print(f"Error: {e}")
        
        finally:
            browser.close()

if __name__ == "__main__":
    debug_contacts_page()