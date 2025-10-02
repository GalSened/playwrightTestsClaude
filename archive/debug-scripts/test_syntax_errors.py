#!/usr/bin/env python3
"""
Test which files have syntax errors
"""

import py_compile
from pathlib import Path
import sys

def test_file_syntax(file_path):
    """Test if a file compiles without syntax errors."""
    try:
        py_compile.compile(file_path, doraise=True)
        return True, None
    except py_compile.PyCompileError as e:
        return False, str(e)

def main():
    """Test all the converted files for syntax errors."""
    base_dir = Path(r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests")
    
    files_to_check = [
        "signing/test_advanced_self_signing_converted.py",
        "signing/test_advanced_signing_scenarios_converted.py", 
        "signing/test_comprehensive_others_signing_converted.py",
        "signing/test_comprehensive_self_signing_converted.py",
        "signing/test_live_signing_sessions_converted.py",
        "signing/test_signing_integration_converted.py",
        "signing/test_signing_workflows_converted.py",
        "signing/test_smart_card_integration_converted.py"
    ]
    
    results = []
    
    for file_rel_path in files_to_check:
        file_path = base_dir / file_rel_path
        if file_path.exists():
            success, error = test_file_syntax(file_path)
            results.append((file_rel_path, success, error))
            if success:
                print(f"OK {file_rel_path} - OK")
            else:
                print(f"ERROR {file_rel_path} - ERROR: {error}")
        else:
            print(f"? {file_rel_path} - NOT FOUND")
    
    # Summary
    success_count = sum(1 for _, success, _ in results if success)
    print(f"\nSummary: {success_count}/{len(results)} files passed syntax check")
    
    return results

if __name__ == "__main__":
    main()