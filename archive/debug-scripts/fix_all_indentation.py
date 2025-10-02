#!/usr/bin/env python3
"""
Fix indentation issues in all generated test files
"""

import os
import glob

def fix_test_file(file_path):
    """Fix indentation and missing imports in a test file"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix indentation issues for pytest.mark decorators
        lines = content.split('\n')
        fixed_lines = []
        
        for line in lines:
            # Fix unindented pytest.mark decorators (should have 4 spaces)
            if line.strip().startswith('@pytest.mark') and not line.startswith('    @pytest.mark'):
                fixed_lines.append('    ' + line.strip())
            else:
                fixed_lines.append(line)
        
        fixed_content = '\n'.join(fixed_lines)
        
        # Add missing 're' import if needed
        if 're.compile' in fixed_content and 'import re' not in fixed_content:
            fixed_content = fixed_content.replace(
                'import pytest',
                'import pytest\nimport re'
            )
        
        # Write back only if content changed
        if fixed_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"Fixed: {file_path}")
            return True
        else:
            print(f"No changes needed: {file_path}")
            return False
            
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def fix_all_test_files():
    """Fix all test files in the tests directory"""
    
    test_files = glob.glob("tests/**/*.py", recursive=True)
    test_files = [f for f in test_files if f.endswith('.py') and 'test_' in f]
    
    print(f"Fixing {len(test_files)} test files...")
    
    fixed_count = 0
    for file_path in test_files:
        if fix_test_file(file_path):
            fixed_count += 1
    
    print(f"Fixed {fixed_count} test files")
    return fixed_count

if __name__ == "__main__":
    fix_all_test_files()