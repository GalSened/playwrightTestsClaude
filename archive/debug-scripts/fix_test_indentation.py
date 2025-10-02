#!/usr/bin/env python3
"""
Fix indentation issues in converted Python test files
"""

import os
import re
from pathlib import Path

def fix_python_test_file(file_path):
    """Fix indentation and formatting issues in a Python test file"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix the marker indentation issue
        # Replace multiple pytest.mark lines with proper indentation
        lines = content.split('\n')
        fixed_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # If we find a line with the setup method
            if 'def setup(self, page: Page' in line:
                fixed_lines.append(line)
                i += 1
                # Add the method body with proper indentation
                while i < len(lines) and (lines[i].strip() == '' or lines[i].startswith('        ') or lines[i].startswith('    @')):
                    if lines[i].strip().startswith('@pytest.mark'):
                        # Skip standalone marker lines, we'll handle them later
                        pass
                    else:
                        fixed_lines.append(lines[i])
                    i += 1
                
                # Now handle test methods with their markers
                while i < len(lines):
                    if lines[i].strip().startswith('@pytest.mark'):
                        # Collect all consecutive markers
                        markers = []
                        while i < len(lines) and lines[i].strip().startswith('@pytest.mark'):
                            markers.append('    ' + lines[i].strip())  # Proper indentation
                            i += 1
                        
                        # Add the markers
                        fixed_lines.extend(markers)
                        
                        # Add any following @allure decorators and method definition
                        while i < len(lines) and (lines[i].strip().startswith('@allure') or 
                                                lines[i].strip().startswith('def test_') or
                                                lines[i].strip() == ''):
                            if lines[i].strip():  # Skip empty lines
                                fixed_lines.append('    ' + lines[i].strip() if lines[i].strip().startswith('@allure') or lines[i].strip().startswith('def ') else lines[i])
                            else:
                                fixed_lines.append(lines[i])
                            i += 1
                            
                            # If we hit the method definition, break to continue normally
                            if lines[i-1].strip().startswith('def test_'):
                                break
                        
                    else:
                        fixed_lines.append(lines[i])
                        i += 1
                
                break
            else:
                fixed_lines.append(line)
                i += 1
        
        # Write the fixed content
        fixed_content = '\n'.join(fixed_lines)
        
        # Additional cleanup - ensure proper spacing and remove duplicate empty lines
        fixed_content = re.sub(r'\n\n\n+', '\n\n', fixed_content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
            
        print(f"Fixed: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def fix_all_test_files():
    """Fix all Python test files in the tests directory"""
    
    print("Fixing indentation issues in converted Python test files...")
    
    fixed_count = 0
    failed_count = 0
    
    for root, dirs, files in os.walk("tests/"):
        for file in files:
            if file.endswith(".py") and file.startswith("test_"):
                file_path = os.path.join(root, file)
                if fix_python_test_file(file_path):
                    fixed_count += 1
                else:
                    failed_count += 1
    
    print(f"\nIndentation Fix Summary:")
    print(f"  Files fixed: {fixed_count}")
    print(f"  Files failed: {failed_count}")
    
    return fixed_count, failed_count

if __name__ == "__main__":
    fix_all_test_files()