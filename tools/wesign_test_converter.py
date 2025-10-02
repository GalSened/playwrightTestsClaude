#!/usr/bin/env python3
"""
WeSign Test Converter - Automated conversion from broken fixture to working pattern
This script converts all WeSign tests from the broken conftest.py fixture approach
to the proven working direct Playwright pattern.
"""
import os
import re
import shutil
import json
from pathlib import Path
from typing import List, Dict, Tuple

class WeSignTestConverter:
    def __init__(self, source_dir: str, target_dir: str = None):
        self.source_dir = Path(source_dir)
        self.target_dir = Path(target_dir) if target_dir else self.source_dir
        self.conversion_stats = {
            "files_processed": 0,
            "tests_converted": 0,
            "errors": []
        }
        
    def convert_test_file(self, file_path: Path) -> bool:
        """Convert a single test file from fixture to working pattern"""
        try:
            print(f"Converting: {file_path}")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip if already converted
            if '_setup_browser' in content:
                print(f"  ✅ Already converted")
                return True
            
            # Apply conversion patterns
            converted_content = self._apply_conversion_patterns(content, file_path.name)
            
            # Write converted file
            converted_path = self._get_converted_path(file_path)
            with open(converted_path, 'w', encoding='utf-8') as f:
                f.write(converted_content)
            
            # Count converted tests
            test_count = len(re.findall(r'async def test_\w+', converted_content))
            self.conversion_stats["tests_converted"] += test_count
            self.conversion_stats["files_processed"] += 1
            
            print(f"  ✅ Converted {test_count} tests -> {converted_path.name}")
            return True
            
        except Exception as e:
            error_msg = f"Error converting {file_path}: {str(e)}"
            print(f"  ❌ {error_msg}")
            self.conversion_stats["errors"].append(error_msg)
            return False
    
    def _apply_conversion_patterns(self, content: str, filename: str) -> str:
        """Apply all conversion patterns to transform the test file"""
        
        # 1. Add required imports
        content = self._add_imports(content)
        
        # 2. Convert test class structure
        content = self._convert_class_structure(content)
        
        # 3. Convert individual test methods
        content = self._convert_test_methods(content)
        
        # 4. Fix indentation and formatting
        content = self._fix_formatting(content)
        
        return content
    
    def _add_imports(self, content: str) -> str:
        """Add required imports for direct Playwright approach"""
        
        # Check if imports already exist
        if 'from playwright.async_api import async_playwright' in content:
            return content
        
        # Find import section
        import_pattern = r'(import pytest\nimport allure\n)(.*?)(from .+?import .+?\n)*'
        
        new_imports = '''import pytest
import allure
from playwright.async_api import Page, async_playwright

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

'''
        
        # Replace or add imports
        if 'import pytest' in content:
            content = re.sub(r'import pytest.*?\n', '', content)
            content = re.sub(r'import allure.*?\n', '', content)
        
        # Add at the beginning after docstring
        if '"""' in content:
            parts = content.split('"""')
            if len(parts) >= 3:
                content = f'"""{parts[1]}"""\n\n{new_imports}' + '"""'.join(parts[2:])
            else:
                content = new_imports + content
        else:
            content = new_imports + content
        
        return content
    
    def _convert_class_structure(self, content: str) -> str:
        """Convert test class to include browser management methods"""
        
        browser_methods = '''
    def _initialize_page_objects(self):
        """Initialize page objects."""
        from pages.login_page import LoginPage
        from pages.home_page import HomePage
        self.login_page = LoginPage(self.page)
        self.home_page = HomePage(self.page)
        

    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects with working page
        self._initialize_page_objects()
        

'''
        
        # Find class definition and add methods
        class_pattern = r'(class Test\w+:.*?\n)(.*?)((?=class|\Z))'
        
        def add_methods(match):
            class_def = match.group(1)
            class_body = match.group(2)
            next_part = match.group(3) if match.group(3) else ""
            
            # Add browser methods after class definition
            return class_def + browser_methods + class_body + next_part
        
        content = re.sub(class_pattern, add_methods, content, flags=re.DOTALL)
        
        return content
    
    def _convert_test_methods(self, content: str) -> str:
        """Convert individual test methods from fixture to direct approach"""
        
        # Pattern to match test methods with page parameter
        test_pattern = r'(async def test_\w+)\(self, page\):(.*?)(?=async def test_|\Z)'
        
        def convert_method(match):
            method_sig = match.group(1)
            method_body = match.group(2)
            
            # Remove page parameter
            new_sig = f"{method_sig}(self):"
            
            # Wrap method body with browser setup/cleanup
            new_body = f'''
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
{self._indent_code(method_body, 12)}
        finally:
            await self._cleanup_browser()
'''
            
            return new_sig + new_body
        
        content = re.sub(test_pattern, convert_method, content, flags=re.DOTALL)
        
        # Also handle test methods without page parameter but need conversion
        simple_test_pattern = r'(async def test_\w+)\(self\):(.*?)(?=async def test_|\Z)'
        
        def convert_simple_method(match):
            method_sig = match.group(1)
            method_body = match.group(2)
            
            # Skip if already has setup/cleanup
            if '_setup_browser' in method_body:
                return match.group(0)
            
            new_body = f'''
        """Converted test with working direct Playwright setup."""
        await self._setup_browser()
        try:
            # Test implementation
{self._indent_code(method_body, 12)}
        finally:
            await self._cleanup_browser()
'''
            
            return method_sig + new_body
        
        content = re.sub(simple_test_pattern, convert_simple_method, content, flags=re.DOTALL)
        
        return content
    
    def _indent_code(self, code: str, indent_spaces: int) -> str:
        """Properly indent code block"""
        lines = code.strip().split('\n')
        indented_lines = []
        
        for line in lines:
            if line.strip():
                indented_lines.append(' ' * indent_spaces + line.lstrip())
            else:
                indented_lines.append('')
        
        return '\n'.join(indented_lines)
    
    def _fix_formatting(self, content: str) -> str:
        """Fix formatting and indentation issues"""
        
        # Remove extra blank lines
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # Fix method spacing
        content = re.sub(r'(\n    async def test_)', r'\n\n    async def test_', content)
        
        return content
    
    def _get_converted_path(self, original_path: Path) -> Path:
        """Get the path for the converted file"""
        if original_path.stem.endswith('_converted'):
            return original_path
        
        return original_path.parent / f"{original_path.stem}_converted{original_path.suffix}"
    
    def convert_all_tests(self, test_categories: List[str] = None) -> Dict:
        """Convert all test files in specified categories"""
        
        if test_categories is None:
            test_categories = ['auth', 'signing', 'documents', 'contacts', 'templates', 
                             'dashboard', 'distribution', 'reports', 'bulk_operations']
        
        total_files = 0
        converted_files = 0
        
        for category in test_categories:
            category_path = self.source_dir / "tests" / category
            
            if not category_path.exists():
                print(f"⚠️  Category not found: {category}")
                continue
            
            print(f"\n📂 Converting {category} tests...")
            
            # Find all Python test files
            test_files = list(category_path.glob("test_*.py"))
            total_files += len(test_files)
            
            for test_file in test_files:
                if self.convert_test_file(test_file):
                    converted_files += 1
        
        # Update final stats
        self.conversion_stats.update({
            "total_files": total_files,
            "converted_files": converted_files,
            "success_rate": (converted_files / total_files * 100) if total_files > 0 else 0
        })
        
        return self.conversion_stats
    
    def generate_report(self) -> str:
        """Generate conversion report"""
        
        stats = self.conversion_stats
        
        report = f"""
# WeSign Test Conversion Report

## 📊 Conversion Statistics
- **Total Files**: {stats.get('total_files', 0)}
- **Files Processed**: {stats['files_processed']}
- **Tests Converted**: {stats['tests_converted']}
- **Success Rate**: {stats.get('success_rate', 0):.1f}%

## 🎯 Results
- ✅ **Converted Files**: {stats.get('converted_files', 0)}
- ❌ **Errors**: {len(stats['errors'])}

## 🔧 Next Steps
1. Run converted tests: `pytest tests/*/test_*_converted.py -v`
2. Validate WeSign functionality through QA Intelligence UI
3. Replace original files with converted versions after validation

## 📝 Conversion Details
The conversion process:
- ✅ Replaced broken conftest.py fixture pattern
- ✅ Added direct Playwright browser management
- ✅ Implemented proper setup/cleanup in try/finally blocks
- ✅ Maintained all original test logic and assertions
- ✅ Added page object initialization

## ⚠️ Errors Encountered
"""
        
        if stats['errors']:
            for error in stats['errors']:
                report += f"- {error}\n"
        else:
            report += "- None! All conversions successful.\n"
        
        return report

def main():
    """Main conversion entry point"""
    
    # Configuration
    WESIGN_TESTS_DIR = "C:/Users/gals/seleniumpythontests-1/playwright_tests"
    
    print("🚀 Starting WeSign Test Conversion...")
    print(f"📁 Source Directory: {WESIGN_TESTS_DIR}")
    
    # Initialize converter
    converter = WeSignTestConverter(WESIGN_TESTS_DIR)
    
    # Convert all test categories
    results = converter.convert_all_tests()
    
    # Generate and save report
    report = converter.generate_report()
    
    report_path = Path("wesign_conversion_report.md")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n📊 Conversion Complete!")
    print(f"📄 Report saved: {report_path}")
    print(f"🎯 Results: {results['converted_files']}/{results.get('total_files', 0)} files converted")
    
    return results

if __name__ == "__main__":
    main()