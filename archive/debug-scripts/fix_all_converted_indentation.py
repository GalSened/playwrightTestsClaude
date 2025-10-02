#!/usr/bin/env python3
"""
Script to fix indentation errors in all *_converted.py files
"""

import os
import re
from pathlib import Path

def fix_indentation_in_file(file_path):
    """Fix indentation errors in a single file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        fixed_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Handle try blocks that need proper indentation
            if re.match(r'^(\s+)try:\s*$', line):
                # Get the base indentation level
                try_indent = len(line) - len(line.lstrip())
                fixed_lines.append(line)
                i += 1
                
                # Process content inside try block until we find finally
                try_content_lines = []
                while i < len(lines):
                    current_line = lines[i]
                    
                    # Check if this is the finally block at the same level as try
                    if re.match(r'^(\s+)finally:\s*$', current_line):
                        finally_indent = len(current_line) - len(current_line.lstrip())
                        if finally_indent == try_indent:
                            # Add all the try content with proper indentation
                            for try_line in try_content_lines:
                                if try_line.strip():  # Non-empty line
                                    # Ensure it's indented 4 spaces more than try
                                    stripped = try_line.lstrip()
                                    fixed_lines.append(' ' * (try_indent + 4) + stripped)
                                else:
                                    fixed_lines.append(try_line)
                            
                            # Add the finally block
                            fixed_lines.append(current_line)
                            break
                        else:
                            # This finally is at wrong indentation, fix it
                            fixed_lines.extend([' ' * (try_indent + 4) + tl.lstrip() if tl.strip() else tl 
                                               for tl in try_content_lines])
                            fixed_lines.append(' ' * try_indent + 'finally:')
                            break
                    else:
                        try_content_lines.append(current_line)
                        i += 1
                
                # If we never found a finally, just add the content
                if i >= len(lines):
                    for try_line in try_content_lines:
                        if try_line.strip():
                            stripped = try_line.lstrip()
                            fixed_lines.append(' ' * (try_indent + 4) + stripped)
                        else:
                            fixed_lines.append(try_line)
                
                i += 1
            else:
                fixed_lines.append(line)
                i += 1
        
        # Join lines back
        fixed_content = '\n'.join(fixed_lines)
        
        # Additional cleanup patterns
        # Fix decorators that got misplaced
        fixed_content = re.sub(
            r'(\n\s+finally:\n\s+await self\._cleanup_browser\(\))\n(\s+async def)', 
            r'\1\n\n\2', 
            fixed_content
        )
        
        # Fix decorators that come after finally blocks
        fixed_content = re.sub(
            r'(\n\s+@pytest\.mark\.\w+)\n(\s+@pytest\.mark\.\w+)\n(\s+finally:)',
            r'\3\n            await self._cleanup_browser()\n\n\1\n\2',
            fixed_content
        )
        
        # Write back the fixed content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"Fixed indentation in: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def main():
    """Main function to fix all converted files."""
    base_dir = Path(r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests")
    
    # Files mentioned in the request that need fixing
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
    
    fixed_count = 0
    
    for file_rel_path in files_to_fix:
        file_path = base_dir / file_rel_path
        if file_path.exists():
            if fix_indentation_in_file(file_path):
                fixed_count += 1
        else:
            print(f"File not found: {file_path}")
    
    print(f"\nFixed {fixed_count} files successfully.")

if __name__ == "__main__":
    main()