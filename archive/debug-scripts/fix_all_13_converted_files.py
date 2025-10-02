#!/usr/bin/env python3
"""
Fix IndentationErrors in all 13 remaining WeSign converted test files
"""

import re
import ast

# List of 13 files to fix
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

def fix_indentation_in_file(file_path):
    """Fix indentation issues in a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern 1: Fix try blocks that are not properly indented (missing 4 spaces)
        content = re.sub(r'(\n        await self\._setup_browser\(\)\n        try:\n)        # ', r'\1            # ', content)
        content = re.sub(r'(\n        await self\._setup_browser\(\)\n        try:\n)        ([a-zA-Z])', r'\1            \2', content)
        
        # Pattern 2: Fix nested try blocks that should be try/except properly indented
        content = re.sub(r'(\n        try:\n        try:\n)', r'\1            try:\n', content)
        
        # Pattern 3: Fix finally blocks that are improperly positioned with decorators
        # This is the main pattern causing issues
        content = re.sub(
            r'(\n    @pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n)        finally:\n            await self\._cleanup_browser\(\)\n    async def',
            r'\1    async def',
            content
        )
        
        # Pattern 4: Fix finally blocks that should be at the method level
        content = re.sub(
            r'(\n        except Exception as e:\n            pytest\.skip\([^)]+\)\n\n)    @pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n        finally:\n            await self\._cleanup_browser\(\)',
            r'\1        finally:\n            await self._cleanup_browser()\n\n    @pytest.mark.\\g<2>\n    @pytest.mark.asyncio',
            content
        )
        
        # Pattern 5: Move standalone finally blocks to proper position
        # Find patterns like:
        # except Exception as e:
        #     pytest.skip(...)
        #
        # @pytest.mark...
        # @pytest.mark.asyncio
        #     finally:
        #         await self._cleanup_browser()
        # async def next_method...
        
        content = re.sub(
            r'(\n        except Exception as e:\n            pytest\.skip\([^)]+\)\n\n)(@pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n)        finally:\n            await self\._cleanup_browser\(\)\n    async def',
            r'\1        finally:\n            await self._cleanup_browser()\n\n    \2    async def',
            content
        )
        
        # Pattern 6: Fix blocks where try/finally structure is broken
        # Look for try: at method level followed by incorrect indentation
        lines = content.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Look for method definitions followed by try blocks
            if (line.strip().startswith('async def test_') and 
                i + 2 < len(lines) and 
                lines[i+2].strip() == 'try:'):
                
                # This is a method with a try block
                fixed_lines.append(line)  # method def
                i += 1
                fixed_lines.append(lines[i])  # docstring or setup
                i += 1
                fixed_lines.append(lines[i])  # try:
                i += 1
                
                # Now fix indentation of the try block content
                indent_level = 12  # 3 levels of 4 spaces
                while i < len(lines):
                    current_line = lines[i]
                    
                    # Check if we've reached the end of this method
                    if (current_line.strip().startswith('@pytest.mark') or
                        current_line.strip().startswith('async def') or
                        current_line.strip().startswith('finally:') or
                        current_line.strip().startswith('def ') or
                        current_line.strip().startswith('class ')):
                        
                        # Add finally block if missing
                        if not any('finally:' in prev_line for prev_line in fixed_lines[-10:]):
                            fixed_lines.append('        finally:')
                            fixed_lines.append('            await self._cleanup_browser()')
                            fixed_lines.append('')
                        
                        # Don't increment i here, let outer loop handle this line
                        break
                    
                    # Fix indentation for content inside try block
                    if current_line.strip():
                        if current_line.startswith('        # '):
                            # Comment line - should be indented to 12 spaces
                            fixed_lines.append('            ' + current_line.lstrip())
                        elif current_line.startswith('        ') and not current_line.startswith('            '):
                            # Content line that needs more indentation
                            fixed_lines.append('    ' + current_line)
                        else:
                            fixed_lines.append(current_line)
                    else:
                        fixed_lines.append(current_line)
                    
                    i += 1
            else:
                fixed_lines.append(line)
                i += 1
        
        content = '\n'.join(fixed_lines)
        
        # Final cleanup patterns
        # Remove duplicate finally blocks
        content = re.sub(r'(\n        finally:\n            await self\._cleanup_browser\(\))\n        finally:\n            await self\._cleanup_browser\(\)', r'\1', content)
        
        # Ensure proper spacing before method definitions
        content = re.sub(r'(\n    @pytest\.mark\.\w+\n    @pytest\.mark\.asyncio\n)(\s*)async def', r'\1    async def', content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Test if the file compiles
        try:
            ast.parse(content)
            print(f"✓ Fixed and validated: {file_path}")
            return True
        except SyntaxError as e:
            print(f"✗ Syntax error remains in {file_path}: {e}")
            return False
            
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

def main():
    """Fix all 13 files."""
    print("Fixing IndentationErrors in 13 WeSign converted test files...")
    
    success_count = 0
    for file_path in FILES_TO_FIX:
        if fix_indentation_in_file(file_path):
            success_count += 1
    
    print(f"\nSummary: {success_count}/{len(FILES_TO_FIX)} files fixed successfully")
    
    if success_count == len(FILES_TO_FIX):
        print("All files have been fixed and compile successfully!")
    else:
        print("Some files still have issues. Manual review may be needed.")

if __name__ == "__main__":
    main()