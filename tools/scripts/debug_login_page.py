#!/usr/bin/env python3
"""
Debug script to analyze the login page and find correct selectors
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright
from src.config.wesign_test_config import WeSignTestConfig

def debug_login_page():
    """Debug the login page to find correct selectors"""
    config = WeSignTestConfig()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        try:
            # Navigate to base URL
            page.goto(config.urls['base_url'])
            page.wait_for_load_state('networkidle')
            
            print(f"Current URL: {page.url}")
            
            # Look for all input elements
            print("\nAll input elements:")
            inputs = page.locator('input').all()
            for i, input_elem in enumerate(inputs):
                try:
                    input_type = input_elem.get_attribute('type') or ''
                    name = input_elem.get_attribute('name') or ''
                    id_attr = input_elem.get_attribute('id') or ''
                    placeholder = input_elem.get_attribute('placeholder') or ''
                    classes = input_elem.get_attribute('class') or ''
                    print(f"  Input {i}: type='{input_type}', name='{name}', id='{id_attr}', placeholder='{placeholder}', classes: {classes}")
                except:
                    print(f"  Input {i}: <could not read>")
            
            # Look for all buttons
            print("\nAll buttons:")
            buttons = page.locator('button').all()
            for i, button in enumerate(buttons):
                try:
                    text = button.inner_text()
                    button_type = button.get_attribute('type') or ''
                    classes = button.get_attribute('class') or ''
                    print(f"  Button {i}: '{text}' (type: {button_type}, classes: {classes})")
                except:
                    print(f"  Button {i}: <could not read>")
            
            # Take screenshot for manual inspection
            page.screenshot(path='artifacts/screenshots/login_page_debug.png', full_page=True)
            print("\nScreenshot saved to artifacts/screenshots/login_page_debug.png")
            
        except Exception as e:
            print(f"Error: {e}")
        
        finally:
            browser.close()

if __name__ == "__main__":
    debug_login_page()