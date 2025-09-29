#!/usr/bin/env python3
"""
Automated Hard Wait Replacement Script
Systematically replaces all hard waits with smart conditional waits
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple


class HardWaitFixer:
    """Automated tool to replace hard waits with smart waits"""

    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.files_processed = 0
        self.waits_replaced = 0
        self.replacement_patterns = {
            # Common patterns and their smart wait replacements
            r'await page\.wait_for_timeout\((\d+)\)': self._get_smart_wait_replacement,
            r'await .*\.wait_for_timeout\((\d+)\)': self._get_smart_wait_replacement_generic,
        }

    def _get_smart_wait_replacement(self, match, context_lines: List[str]) -> str:
        """Generate appropriate smart wait replacement based on context"""
        timeout_value = int(match.group(1))

        # Analyze context to determine best replacement
        context = ' '.join(context_lines).lower()

        if any(keyword in context for keyword in ['login', 'auth', 'credential']):
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_login_result()"

        elif any(keyword in context for keyword in ['upload', 'file']):
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_document_upload()"

        elif any(keyword in context for keyword in ['nav', 'load', 'goto', 'click']):
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_navigation_complete()"

        elif any(keyword in context for keyword in ['form', 'submit', 'save']):
            return f"smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_form_submission()"

        elif any(keyword in context for keyword in ['modal', 'popup', 'dialog']):
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_modal_interaction()"

        elif any(keyword in context for keyword in ['language', 'lang', 'switch']):
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_language_switch()"

        elif timeout_value >= 5000:  # Long waits usually for complex operations
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_navigation_complete()"

        else:  # Default fallback
            return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_navigation_complete()"

    def _get_smart_wait_replacement_generic(self, match, context_lines: List[str]) -> str:
        """Generic replacement for non-page objects"""
        return "smart_waits = WeSignSmartWaits(page)\n            await smart_waits.wait_for_navigation_complete()"

    def analyze_file(self, file_path: Path) -> Dict:
        """Analyze a file for hard waits"""
        if not file_path.suffix == '.py':
            return {}

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()

            wait_patterns = []
            for i, line in enumerate(lines):
                if 'wait_for_timeout' in line:
                    # Get context (3 lines before and after)
                    start_idx = max(0, i - 3)
                    end_idx = min(len(lines), i + 4)
                    context_lines = lines[start_idx:end_idx]

                    wait_patterns.append({
                        'line_number': i + 1,
                        'line_content': line.strip(),
                        'context': context_lines
                    })

            return {
                'file_path': file_path,
                'wait_count': len(wait_patterns),
                'patterns': wait_patterns,
                'has_smart_waits_import': 'from utils.smart_waits import' in content
            }

        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
            return {}

    def fix_file(self, file_path: Path) -> bool:
        """Fix hard waits in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            original_content = content
            replacements_made = 0

            # Add smart waits import if needed
            if 'from utils.smart_waits import' not in content:
                # Find the imports section and add our import
                imports_pattern = r'(from playwright\.async_api import[^\n]+\n)'
                if re.search(imports_pattern, content):
                    content = re.sub(
                        imports_pattern,
                        r'\1from utils.smart_waits import WeSignSmartWaits\n',
                        content
                    )

            # Replace hard waits with smart waits
            lines = content.splitlines()
            new_lines = []

            for i, line in enumerate(lines):
                if 'wait_for_timeout' in line and 'smart_waits' not in line:
                    # Get context for intelligent replacement
                    start_idx = max(0, i - 3)
                    end_idx = min(len(lines), i + 4)
                    context_lines = lines[start_idx:end_idx]

                    # Determine replacement based on context
                    indent = len(line) - len(line.lstrip())

                    if any(keyword in ' '.join(context_lines).lower() for keyword in ['login', 'auth']):
                        replacement = ' ' * indent + "smart_waits = WeSignSmartWaits(page)\n" + ' ' * indent + "await smart_waits.wait_for_login_result()"
                    elif any(keyword in ' '.join(context_lines).lower() for keyword in ['upload', 'file']):
                        replacement = ' ' * indent + "smart_waits = WeSignSmartWaits(page)\n" + ' ' * indent + "await smart_waits.wait_for_document_upload()"
                    elif any(keyword in ' '.join(context_lines).lower() for keyword in ['language', 'lang']):
                        replacement = ' ' * indent + "smart_waits = WeSignSmartWaits(page)\n" + ' ' * indent + "await smart_waits.wait_for_language_switch()"
                    else:
                        replacement = ' ' * indent + "smart_waits = WeSignSmartWaits(page)\n" + ' ' * indent + "await smart_waits.wait_for_navigation_complete()"

                    new_lines.append(replacement)
                    replacements_made += 1
                else:
                    new_lines.append(line)

            if replacements_made > 0:
                # Write the modified content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(new_lines))

                print(f"✅ Fixed {replacements_made} hard waits in {file_path.name}")
                self.waits_replaced += replacements_made
                return True
            else:
                return False

        except Exception as e:
            print(f"❌ Error fixing {file_path}: {e}")
            return False

    def process_directory(self):
        """Process all Python files in the directory"""
        print(f"Scanning {self.base_path} for hard waits...")

        # Find all Python test files
        python_files = list(self.base_path.glob("test_*.py"))

        if not python_files:
            print("No test files found!")
            return

        print(f"Found {len(python_files)} test files")

        # Analyze all files first
        total_waits = 0
        files_with_waits = []

        for file_path in python_files:
            analysis = self.analyze_file(file_path)
            if analysis and analysis.get('wait_count', 0) > 0:
                files_with_waits.append(analysis)
                total_waits += analysis['wait_count']

        print(f"\nAnalysis Results:")
        print(f"   Files with hard waits: {len(files_with_waits)}")
        print(f"   Total hard waits found: {total_waits}")

        if not files_with_waits:
            print("No hard waits found!")
            return

        # Show detailed breakdown
        print(f"\nDetailed Breakdown:")
        for analysis in files_with_waits:
            file_name = analysis['file_path'].name
            wait_count = analysis['wait_count']
            has_import = analysis['has_smart_waits_import']
            print(f"   {file_name}: {wait_count} waits {'(has smart waits import)' if has_import else '(needs import)'}")

        # Ask for confirmation
        response = input(f"\nFix all {total_waits} hard waits? (y/n): ").lower()
        if response != 'y':
            print("Operation cancelled.")
            return

        # Fix all files
        print(f"\nFixing hard waits...")
        fixed_files = 0

        for analysis in files_with_waits:
            if self.fix_file(analysis['file_path']):
                fixed_files += 1
                self.files_processed += 1

        print(f"\nSummary:")
        print(f"   Files processed: {fixed_files}")
        print(f"   Hard waits replaced: {self.waits_replaced}")
        print(f"   Estimated time savings: {self.waits_replaced * 2}+ seconds per test run")


def main():
    """Main execution function"""
    current_dir = os.getcwd()

    print("WeSign Hard Wait Replacement Tool")
    print("=====================================")

    fixer = HardWaitFixer(current_dir)
    fixer.process_directory()

    print("\nHard wait replacement complete!")
    print("Remember to run tests to validate the changes.")


if __name__ == "__main__":
    main()