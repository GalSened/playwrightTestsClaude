#!/usr/bin/env python3
"""
Comprehensive script to fix all indentation issues in converted files
"""

import re
from pathlib import Path

def fix_file_comprehensive(file_path):
    """Fix a file comprehensively by rewriting it with correct structure."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract all the important parts: imports, class definition, methods
    lines = content.split('\n')
    
    # Build the corrected file
    fixed_lines = []
    
    # Process imports and initial setup (everything before class definition)
    i = 0
    while i < len(lines) and not lines[i].strip().startswith('class Test'):
        fixed_lines.append(lines[i])
        i += 1
    
    # Add the class definition
    if i < len(lines):
        fixed_lines.append(lines[i])  # class definition
        i += 1
    
    # Process methods within the class
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            fixed_lines.append('')
            i += 1
            continue
        
        # Handle helper methods (_initialize_page_objects, _cleanup_browser, _setup_browser)
        if line.startswith('def ') and ('_initialize' in line or '_cleanup' in line or '_setup' in line):
            # Add the method with proper indentation
            method_lines = []
            method_lines.append('    ' + lines[i].strip())  # method definition
            i += 1
            
            # Process method content
            while i < len(lines):
                current = lines[i].strip()
                if not current:
                    method_lines.append('')
                elif current.startswith('async def test_') or current.startswith('def ') or current.startswith('@pytest') or current.startswith('"""'):
                    # End of this method, break
                    break
                else:
                    # Method content
                    method_lines.append('        ' + current)
                i += 1
            
            fixed_lines.extend(method_lines)
            fixed_lines.append('')  # Add spacing after method
            continue
        
        # Handle test methods
        if line.startswith('async def test_') or (line.startswith('@pytest') and i+1 < len(lines) and 'async def test_' in lines[i+1]):
            # Collect decorators first
            decorators = []
            while i < len(lines) and lines[i].strip().startswith('@pytest'):
                decorators.append('    ' + lines[i].strip())
                i += 1
            
            # Add decorators
            fixed_lines.extend(decorators)
            
            # Add method definition
            if i < len(lines) and lines[i].strip().startswith('async def test_'):
                fixed_lines.append('    ' + lines[i].strip())
                i += 1
                
                # Add docstring
                if i < len(lines) and '"""' in lines[i]:
                    fixed_lines.append('        ' + lines[i].strip())
                    i += 1
                
                # Add setup call
                if i < len(lines) and 'await self._setup_browser()' in lines[i]:
                    fixed_lines.append('        await self._setup_browser()')
                    i += 1
                
                # Add try block
                if i < len(lines) and lines[i].strip() == 'try:':
                    fixed_lines.append('        try:')
                    i += 1
                    
                    # Process try content
                    try_content = []
                    while i < len(lines):
                        current = lines[i].strip()
                        
                        # End conditions
                        if current == 'finally:' or current.startswith('@pytest') or current.startswith('async def'):
                            break
                        
                        if current and not current.startswith('await self._cleanup_browser()'):
                            try_content.append(current)
                        
                        i += 1
                    
                    # Add try content with proper indentation
                    for content_line in try_content:
                        if content_line:
                            fixed_lines.append('            ' + content_line)
                        else:
                            fixed_lines.append('')
                    
                    # Add finally block
                    fixed_lines.append('        finally:')
                    fixed_lines.append('            await self._cleanup_browser()')
                    fixed_lines.append('')  # Add spacing after test method
        else:
            i += 1
    
    # Join and write back
    fixed_content = '\n'.join(fixed_lines)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"Comprehensively fixed: {file_path}")

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
    
    for file_rel_path in files_to_fix:
        file_path = base_dir / file_rel_path
        if file_path.exists():
            try:
                fix_file_comprehensive(file_path)
            except Exception as e:
                print(f"Error fixing {file_path}: {e}")
        else:
            print(f"File not found: {file_path}")

if __name__ == "__main__":
    main()