#!/usr/bin/env python3
"""
Surgical fix for the specific indentation issues in converted files
"""

import re
from pathlib import Path

def fix_file_surgical(file_path):
    """Fix specific indentation issues in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix 1: Lines that have finally: appended to assert statements
    content = re.sub(
        r'(\s+assert .+?)(\s+finally:)',
        r'\1\n        finally:',
        content
    )
    
    # Fix 2: Fix try blocks that have no indented content
    lines = content.split('\n')
    fixed_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # If this is a try statement
        if line.strip() == 'try:':
            try_indent = len(line) - len(line.lstrip())
            fixed_lines.append(line)
            i += 1
            
            # Look ahead to see if the next non-empty line is properly indented
            next_content_lines = []
            while i < len(lines):
                next_line = lines[i]
                
                # If we hit finally at the same indentation as try, process the accumulated content
                if next_line.strip() == 'finally:' and len(next_line) - len(next_line.lstrip()) == try_indent:
                    # Add the content with proper indentation
                    for content_line in next_content_lines:
                        if content_line.strip():
                            stripped = content_line.lstrip()
                            fixed_lines.append(' ' * (try_indent + 4) + stripped)
                        else:
                            fixed_lines.append('')
                    
                    # Add the finally block
                    fixed_lines.append(next_line)
                    break
                else:
                    next_content_lines.append(next_line)
                    i += 1
        else:
            fixed_lines.append(line)
        
        i += 1
    
    content = '\n'.join(fixed_lines)
    
    # Fix 3: Remove orphaned decorator blocks and cleanup calls that got misplaced
    content = re.sub(
        r'\n\s*@pytest\.mark\.\w+\s*\n\s*@pytest\.mark\.\w+\s*\n\s*await self\._cleanup_browser\(\)\s*\n',
        '\n            await self._cleanup_browser()\n\n    @pytest.mark.smoke\n    @pytest.mark.asyncio\n',
        content
    )
    
    # Fix 4: Fix method signatures that got mangled
    content = re.sub(
        r'(\n\s*finally:\s*\n\s*await self\._cleanup_browser\(\))\s*\n\s*(\@pytest\.mark\.\w+)\s*\n\s*(\@pytest\.mark\.\w+)\s*\n\s*(async def test_\w+)',
        r'\1\n\n    \2\n    \3\n    \4',
        content
    )
    
    # Fix 5: Clean up any remaining malformed structures
    content = re.sub(r'\n\s+finally:\s*\n\s+await self\._cleanup_browser\(\)\s*\n\s+@pytest', '\n        finally:\n            await self._cleanup_browser()\n\n    @pytest', content)
    
    # Fix 6: Add proper spacing between methods
    content = re.sub(r'(\n        finally:\n            await self\._cleanup_browser\(\))\n(\s*@pytest)', r'\1\n\n    \2', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Surgically fixed: {file_path}")

def main():
    """Fix all the specified files surgically."""
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
                fix_file_surgical(file_path)
            except Exception as e:
                print(f"Error fixing {file_path}: {e}")

if __name__ == "__main__":
    main()