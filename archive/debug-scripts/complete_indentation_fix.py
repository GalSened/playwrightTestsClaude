#!/usr/bin/env python3
"""
Complete fix for all indentation issues in converted files
"""

import os
from pathlib import Path

def completely_fix_file(file_path):
    """Fix a file by extracting good parts and rebuilding structure."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find the start of the class
    class_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('class Test'):
            class_start = i
            break
    
    if class_start == -1:
        print(f"No class found in {file_path}")
        return False
    
    # Extract everything before the class (imports, etc.)
    header_lines = lines[:class_start]
    
    # Extract the class line
    class_line = lines[class_start]
    
    # Find all the test methods and helper methods
    methods = []
    current_method = None
    i = class_start + 1
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this is a method definition
        if line.strip().startswith('def ') or line.strip().startswith('async def'):
            if current_method:
                methods.append(current_method)
            current_method = {
                'definition': line.strip(),
                'content': [],
                'docstring': None
            }
        elif line.strip().startswith('"""') and current_method and not current_method['docstring']:
            current_method['docstring'] = line.strip()
        elif current_method:
            # Add content to current method
            stripped = line.strip()
            if stripped and not stripped.startswith('@pytest') and not stripped.startswith('async def') and not stripped.startswith('def '):
                current_method['content'].append(stripped)
        elif line.strip().startswith('@pytest'):
            # This is a decorator for the next method
            if current_method:
                methods.append(current_method)
            current_method = {
                'decorators': [line.strip()],
                'definition': None,
                'content': [],
                'docstring': None
            }
            # Look ahead for more decorators
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith('@pytest'):
                current_method['decorators'].append(lines[j].strip())
                j += 1
            i = j - 1  # Adjust i since we've looked ahead
        
        i += 1
    
    # Add the last method if exists
    if current_method:
        methods.append(current_method)
    
    # Now rebuild the file with proper structure
    fixed_lines = []
    
    # Add header
    fixed_lines.extend(header_lines)
    fixed_lines.append(class_line)
    
    # Add methods with proper indentation
    for method in methods:
        if not method.get('definition'):
            continue
            
        fixed_lines.append('')  # Empty line before method
        
        # Add decorators
        if 'decorators' in method:
            for decorator in method['decorators']:
                fixed_lines.append('    ' + decorator)
        
        # Add method definition
        if method['definition'].startswith('async def') or method['definition'].startswith('def'):
            fixed_lines.append('    ' + method['definition'])
        
        # Add docstring
        if method['docstring']:
            fixed_lines.append('        ' + method['docstring'])
        
        # Add method body with try-finally structure
        if 'test_' in method['definition']:  # This is a test method
            fixed_lines.append('        await self._setup_browser()')
            fixed_lines.append('        try:')
            
            # Add the method content with proper indentation
            for content_line in method['content']:
                if content_line and not content_line.startswith('await self._cleanup_browser'):
                    if not content_line.startswith('finally:') and not content_line.startswith('except:'):
                        fixed_lines.append('            ' + content_line)
            
            fixed_lines.append('        finally:')
            fixed_lines.append('            await self._cleanup_browser()')
        else:
            # This is a helper method
            for content_line in method['content']:
                if content_line:
                    fixed_lines.append('        ' + content_line)
    
    # Write the fixed content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    print(f"Completely fixed: {file_path}")
    return True

def main():
    """Fix all the specified files."""
    base_dir = Path(r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests")
    
    files_to_fix = [
        "signing/test_advanced_self_signing_converted.py",
        "signing/test_advanced_signing_scenarios_converted.py", 
        "signing/test_comprehensive_others_signing_converted.py",
        "signing/test_comprehensive_self_signing_converted.py",
        "signing/test_live_signing_sessions_converted.py",
        "signing/test_signing_integration_converted.py",
        "signing/test_signing_workflows_converted.py",
        "signing/test_smart_card_integration_converted.py"
    ]
    
    success_count = 0
    for file_rel_path in files_to_fix:
        file_path = base_dir / file_rel_path
        if file_path.exists():
            try:
                if completely_fix_file(file_path):
                    success_count += 1
            except Exception as e:
                print(f"Error completely fixing {file_path}: {e}")
        else:
            print(f"File not found: {file_path}")
    
    print(f"\nCompletely fixed {success_count} files successfully.")

if __name__ == "__main__":
    main()