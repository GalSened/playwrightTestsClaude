#!/usr/bin/env python3
"""
Validate all converted test files for syntax errors
"""

import ast
import os

# List of ALL converted files
ALL_CONVERTED_FILES = [
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/auth/test_login_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/bulk_operations/test_bulk_operations_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/contacts/test_comprehensive_contacts_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/contacts/test_contacts_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/distribution/test_distribution_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/documents/test_document_editing_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/documents/test_document_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/files/test_file_operations_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/file_operations/test_merge_files_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/integration/test_final_integration_scenarios_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/reports/test_reports_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/runner_validation/test_simple_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_advanced_others_signing_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_advanced_self_signing_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_advanced_signing_scenarios_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_comprehensive_others_signing_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_comprehensive_self_signing_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_live_signing_sessions_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_signing_integration_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_signing_workflows_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/signing/test_smart_card_integration_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/system/test_system_administration_reports_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/templates/test_advanced_template_features_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/templates/test_template_management_converted.py",
    "C:/Users/gals/seleniumpythontests-1/playwright_tests/tests/user_management/test_user_profiles_and_groups_converted.py"
]

def validate_file(file_path):
    """Validate a single file for syntax errors."""
    try:
        if not os.path.exists(file_path):
            return f"FILE NOT FOUND: {file_path}"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Try to parse the file
        ast.parse(content)
        return f"✓ VALID: {file_path}"
        
    except SyntaxError as e:
        return f"✗ SYNTAX ERROR: {file_path} - Line {e.lineno}: {e.msg}"
    except Exception as e:
        return f"✗ ERROR: {file_path} - {e}"

def main():
    """Validate all converted files."""
    print("Validating all WeSign converted test files...")
    print("=" * 60)
    
    valid_files = []
    invalid_files = []
    
    for file_path in ALL_CONVERTED_FILES:
        result = validate_file(file_path)
        print(result)
        
        if result.startswith("✓"):
            valid_files.append(file_path)
        else:
            invalid_files.append(file_path)
    
    print("\n" + "=" * 60)
    print(f"SUMMARY: {len(valid_files)}/{len(ALL_CONVERTED_FILES)} files compile successfully")
    
    if invalid_files:
        print("\nFILES WITH ISSUES:")
        for file_path in invalid_files:
            print(f"  - {os.path.basename(file_path)}")
    else:
        print("\n🎉 ALL FILES COMPILE SUCCESSFULLY!")
    
    return len(valid_files) == len(ALL_CONVERTED_FILES)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)