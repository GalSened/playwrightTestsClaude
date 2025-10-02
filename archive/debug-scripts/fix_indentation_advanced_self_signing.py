#!/usr/bin/env python3
"""
Script to fix indentation errors in test_advanced_self_signing_converted.py
"""

import re

def fix_indentation():
    file_path = r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests\signing\test_advanced_self_signing_converted.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    fixed_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains a try statement
        if line.strip() == 'try:':
            fixed_lines.append(line)
            i += 1
            
            # Process all lines after try until we find finally
            while i < len(lines):
                current_line = lines[i]
                
                # If we hit a finally that's misplaced, fix it
                if current_line.strip() == 'finally:':
                    # Add the finally at the same level as try
                    fixed_lines.append('        finally:')
                    break
                
                # If we hit a decorator that's misplaced after finally, break
                if current_line.strip().startswith('@pytest.mark') and i > 0 and lines[i-1].strip() == 'finally:':
                    # This decorator belongs to the next test method
                    break
                
                # If line is not indented properly inside try block, fix it
                if current_line and not current_line.startswith('            '):
                    # This line should be indented 4 more spaces (inside try block)
                    if current_line.startswith('        ') and not current_line.strip().startswith('@'):
                        # Remove the old indentation and add proper indentation
                        stripped = current_line.lstrip()
                        fixed_lines.append('            ' + stripped)
                    else:
                        fixed_lines.append(current_line)
                else:
                    fixed_lines.append(current_line)
                
                i += 1
        else:
            fixed_lines.append(line)
            i += 1
    
    # Join all lines back
    fixed_content = '\n'.join(fixed_lines)
    
    # Now do a second pass to clean up any remaining issues
    # Remove misplaced finally statements that are embedded within method signatures
    fixed_content = re.sub(r'\n        finally:\n            await self._cleanup_browser\(\)\n    async def', 
                          r'\n        finally:\n            await self._cleanup_browser()\n\n    async def', fixed_content)
    
    # Fix any decorators that got separated
    fixed_content = re.sub(r'(\n    @pytest\.mark\.\w+\n    @pytest\.mark\.\w+)\n        finally:\n            await self\._cleanup_browser\(\)\n', 
                          r'\n        finally:\n            await self._cleanup_browser()\n\1\n', fixed_content)
    
    # Write the fixed content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print("Fixed indentation errors in test_advanced_self_signing_converted.py")

if __name__ == "__main__":
    fix_indentation()