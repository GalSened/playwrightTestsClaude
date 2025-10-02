#!/usr/bin/env python3
"""
Fix indentation errors in the remaining 13 converted files
"""

import re
import ast
import os

# 13 files that need fixing
FILES_TO_FIX = [
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

def fix_indentation_issues(content):
    """Fix common indentation issues in the converted files."""
    
    # Split content into lines for processing
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern 1: Fix try blocks with missing indentation
        if (line.strip() == 'try:' and i + 1 < len(lines)):
            next_line = lines[i + 1] if i + 1 < len(lines) else ""
            
            # If next line starts at same indentation as try, it needs to be indented
            if (next_line.strip() and 
                not next_line.startswith(' ') and 
                line.startswith('        try:')):
                # This is a try at method level (8 spaces) with content at 0 indentation
                fixed_lines.append(line)  # Add the try line
                i += 1
                
                # Indent the content that follows
                while i < len(lines):
                    current_line = lines[i]
                    
                    if current_line.strip() == '':
                        fixed_lines.append(current_line)
                    elif (current_line.strip().startswith('finally:') or
                          current_line.strip().startswith('except') or
                          current_line.strip().startswith('async def') or
                          current_line.strip().startswith('@pytest')):
                        # These should maintain their original indentation or break the try block
                        if current_line.strip().startswith('finally:'):
                            fixed_lines.append('        finally:')
                            fixed_lines.append('            await self._cleanup_browser()')
                        else:
                            fixed_lines.append(current_line)
                        break
                    else:
                        # Indent this line to be inside the try block (12 spaces for method content)
                        if current_line.strip():
                            fixed_lines.append('            ' + current_line.strip())
                        else:
                            fixed_lines.append(current_line)
                    i += 1
                continue
            
            # Pattern 2: Fix try blocks where content is improperly indented  
            elif (next_line.strip() and 
                  not next_line.startswith('            ') and
                  line.startswith('        try:')):
                
                fixed_lines.append(line)  # Add the try line
                i += 1
                
                # Fix indentation for the try block content
                while i < len(lines):
                    current_line = lines[i]
                    
                    if current_line.strip() == '':
                        fixed_lines.append(current_line)
                    elif (current_line.strip().startswith('finally:') or
                          current_line.strip().startswith('except')):
                        # End of try block - maintain proper indentation
                        if current_line.strip().startswith('finally:'):
                            fixed_lines.append('        finally:')
                            fixed_lines.append('            await self._cleanup_browser()')
                        elif current_line.strip().startswith('except'):
                            fixed_lines.append('        except Exception as e:')
                            # Look ahead for the exception content
                            if i + 1 < len(lines) and 'pytest.skip' in lines[i + 1]:
                                fixed_lines.append('            ' + lines[i + 1].strip())
                                i += 1
                        break
                    elif (current_line.strip().startswith('async def') or
                          current_line.strip().startswith('@pytest')):
                        # New method starting - break out
                        fixed_lines.append(current_line)
                        break
                    else:
                        # Content inside try block - ensure proper indentation
                        if current_line.strip():
                            if not current_line.startswith('            '):
                                fixed_lines.append('            ' + current_line.strip())
                            else:
                                fixed_lines.append(current_line)
                        else:
                            fixed_lines.append(current_line)
                    i += 1
                continue
        
        # Pattern 3: Fix duplicate try statements
        if line.strip() == 'try:' and i > 0:
            prev_lines = [lines[j] for j in range(max(0, i-5), i) if lines[j].strip()]
            if any('try:' in prev_line for prev_line in prev_lines[-2:]):
                # Skip this duplicate try
                i += 1
                continue
        
        # Pattern 4: Fix orphaned finally blocks mixed with decorators  
        if (line.strip().startswith('@pytest') and i + 2 < len(lines) and
            'finally:' in lines[i + 2]):
            # Add the decorator
            fixed_lines.append(line)
            i += 1
            # Skip the problematic finally and continue
            if lines[i].strip().startswith('@pytest'):
                fixed_lines.append(lines[i])
                i += 1
            # Skip the orphaned finally block
            while i < len(lines) and ('finally:' in lines[i] or 'await self._cleanup_browser()' in lines[i]):
                i += 1
            continue
            
        # Default: add line as-is
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_file(file_path):
    """Fix a single file."""
    try:
        if not os.path.exists(file_path):
            return f"File not found: {file_path}"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply fixes
        fixed_content = fix_indentation_issues(content)
        
        # Additional specific fixes
        # Fix common patterns
        fixed_content = re.sub(r'(\n        try:\n)        ([a-zA-Z])', r'\1            \2', fixed_content)
        fixed_content = re.sub(r'(\n        try:\n)([a-zA-Z])', r'\1            \2', fixed_content)
        
        # Ensure finally blocks are properly placed
        fixed_content = re.sub(
            r'(\n        except Exception as e:\n            pytest\.skip\([^)]+\)\n)(\n    @pytest\.mark)',
            r'\1        finally:\n            await self._cleanup_browser()\2',
            fixed_content
        )
        
        # Write fixed content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        # Test if it compiles
        try:
            ast.parse(fixed_content)
            return f"SUCCESS: Fixed {os.path.basename(file_path)}"
        except SyntaxError as e:
            return f"STILL HAS ERRORS: {os.path.basename(file_path)} - Line {e.lineno}: {e.msg}"
            
    except Exception as e:
        return f"ERROR: {os.path.basename(file_path)} - {e}"

def main():
    """Fix all 13 files."""
    print("Fixing IndentationErrors in 13 WeSign converted test files...")
    print("=" * 60)
    
    success_count = 0
    for file_path in FILES_TO_FIX:
        result = fix_file(file_path)
        print(result)
        
        if result.startswith("SUCCESS"):
            success_count += 1
    
    print("=" * 60)
    print(f"SUMMARY: {success_count}/{len(FILES_TO_FIX)} files fixed successfully")
    
    return success_count == len(FILES_TO_FIX)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)