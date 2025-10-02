#!/usr/bin/env python3
"""
Simple validation of converted test files
"""

import ast
import os

# 13 files that need fixing
TARGET_FILES = [
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/bulk_operations/test_bulk_operations_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/contacts/test_comprehensive_contacts_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/contacts/test_contacts_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/distribution/test_distribution_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/files/test_file_operations_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/file_operations/test_merge_files_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/integration/test_final_integration_scenarios_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/reports/test_reports_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/runner_validation/test_simple_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/system/test_system_administration_reports_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/templates/test_advanced_template_features_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/templates/test_template_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/user_management/test_user_profiles_and_groups_converted.py"
]

def validate_file(file_path):
    """Validate a single file for syntax errors."""
    try:
        if not os.path.exists(file_path):
            return f"NOT FOUND: {os.path.basename(file_path)}"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Try to parse the file
        ast.parse(content)
        return f"OK: {os.path.basename(file_path)}"
        
    except SyntaxError as e:
        return f"SYNTAX ERROR: {os.path.basename(file_path)} - Line {e.lineno}: {e.msg}"
    except Exception as e:
        return f"ERROR: {os.path.basename(file_path)} - {e}"

def main():
    """Validate all target files."""
    print("Validating 13 target converted files...")
    print("=" * 50)
    
    valid_files = 0
    
    for file_path in TARGET_FILES:
        result = validate_file(file_path)
        print(result)
        
        if result.startswith("OK:"):
            valid_files += 1
    
    print("=" * 50)
    print(f"RESULT: {valid_files}/{len(TARGET_FILES)} files compile successfully")
    
    if valid_files == len(TARGET_FILES):
        print("SUCCESS: All target files compile!")
    else:
        print(f"ISSUES: {len(TARGET_FILES) - valid_files} files need fixing")
    
    return valid_files == len(TARGET_FILES)

if __name__ == "__main__":
    main()