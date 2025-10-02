#!/usr/bin/env python3
"""
Simple WeSign Test Converter - Convert broken fixture tests to working pattern
"""
import os
import re
from pathlib import Path

def convert_auth_tests():
    """Convert authentication tests as a priority"""
    
    WESIGN_TESTS_DIR = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests")
    auth_dir = WESIGN_TESTS_DIR / "tests" / "auth"
    
    print("Starting WeSign Authentication Test Conversion...")
    print(f"Source: {auth_dir}")
    
    if not auth_dir.exists():
        print(f"ERROR: Auth directory not found: {auth_dir}")
        return False
    
    # Find test files that need conversion
    test_files = list(auth_dir.glob("test_*.py"))
    print(f"Found {len(test_files)} test files")
    
    converted_count = 0
    
    for test_file in test_files:
        # Skip already converted files
        if "_converted" in test_file.name:
            print(f"SKIP: {test_file.name} (already converted)")
            continue
            
        print(f"Converting: {test_file.name}")
        
        try:
            # Read original file
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip if already has working pattern
            if '_setup_browser' in content:
                print(f"  SKIP: Already has working pattern")
                continue
            
            # Apply simple conversion
            converted_content = apply_conversion(content)
            
            # Write converted file
            converted_file = test_file.parent / f"{test_file.stem}_converted{test_file.suffix}"
            with open(converted_file, 'w', encoding='utf-8') as f:
                f.write(converted_content)
            
            converted_count += 1
            print(f"  SUCCESS: Created {converted_file.name}")
            
        except Exception as e:
            print(f"  ERROR: {str(e)}")
    
    print(f"\nConversion Complete: {converted_count} files converted")
    return converted_count > 0

def apply_conversion(content):
    """Apply conversion patterns to transform test content"""
    
    # Working pattern template
    browser_setup = '''
    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        from playwright.async_api import async_playwright
        from pages.login_page import LoginPage
        from pages.home_page import HomePage
        
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)

'''
    
    # Add imports if missing
    if 'from playwright.async_api import' not in content:
        import_section = '''from playwright.async_api import Page, async_playwright

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

'''
        # Insert after existing imports
        if 'from pages.' in content:
            content = content.replace('from pages.', import_section + 'from pages.')
        elif 'import allure' in content:
            content = content.replace('import allure', import_section + 'import allure')
        else:
            content = import_section + content
    
    # Add browser management methods to class
    class_pattern = r'(class Test\w+:)'
    if re.search(class_pattern, content):
        content = re.sub(class_pattern, r'\1' + browser_setup, content)
    
    # Convert test methods from fixture to working pattern
    # Pattern: async def test_xxx(self, page):
    test_pattern = r'async def (test_\w+)\(self, page\):(.*?)(?=\n    async def|\n\nclass|\Z)'
    
    def convert_test_method(match):
        method_name = match.group(1)
        method_body = match.group(2)
        
        return f'''async def {method_name}(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
{method_body}
        finally:
            await self._cleanup_browser()'''
    
    content = re.sub(test_pattern, convert_test_method, content, flags=re.DOTALL)
    
    # Also handle methods without page parameter that need structure
    simple_pattern = r'async def (test_\w+)\(self\):(.*?)(?=\n    async def|\n\nclass|\Z)'
    
    def convert_simple_method(match):
        method_name = match.group(1)
        method_body = match.group(2)
        
        # Skip if already converted
        if 'await self._setup_browser()' in method_body:
            return match.group(0)
        
        return f'''async def {method_name}(self):
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation
{method_body}
        finally:
            await self._cleanup_browser()'''
    
    content = re.sub(simple_pattern, convert_simple_method, content, flags=re.DOTALL)
    
    return content

if __name__ == "__main__":
    convert_auth_tests()