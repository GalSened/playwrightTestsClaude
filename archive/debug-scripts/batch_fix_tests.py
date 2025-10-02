#!/usr/bin/env python3
"""
Batch fix indentation issues in all converted Python test files
"""

import os
import re

def fix_indentation_in_file(file_path):
    """Fix the specific indentation issue with pytest.mark decorators"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find and fix the pattern where pytest.mark decorators are not properly indented
        # Pattern: lines that start with '@pytest.mark' but are not indented with 4 spaces
        lines = content.split('\n')
        fixed_lines = []
        
        for i, line in enumerate(lines):
            # If line starts with '@pytest.mark' and is not properly indented (should be 4 spaces)
            if line.strip().startswith('@pytest.mark') and not line.startswith('    @pytest.mark'):
                # Add proper indentation
                fixed_lines.append('    ' + line.strip())
            else:
                fixed_lines.append(line)
        
        fixed_content = '\n'.join(fixed_lines)
        
        # Only write if content changed
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
    """Fix all Python test files in the tests directory"""
    
    print("Fixing indentation issues in all converted Python test files...")
    
    fixed_count = 0
    
    for root, dirs, files in os.walk("tests/"):
        for file in files:
            if file.endswith(".py") and file.startswith("test_"):
                file_path = os.path.join(root, file)
                if fix_indentation_in_file(file_path):
                    fixed_count += 1
    
    print(f"\nFixed {fixed_count} test files")
    return fixed_count

if __name__ == "__main__":
    fix_all_test_files()