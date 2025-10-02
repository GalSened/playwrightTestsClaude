#!/usr/bin/env python3
"""
Robust script to fix indentation errors in all *_converted.py files
"""

import os
import re
from pathlib import Path

def fix_file_indentation(file_path):
    """Fix indentation errors in a single file with more robust approach."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Step 1: Clean up the malformed structure
        lines = content.split('\n')
        fixed_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Skip empty lines and process normally
            if not line.strip():
                fixed_lines.append(line)
                i += 1
                continue
            
            # Look for async def patterns that start test methods
            if re.match(r'^(\s*)async def test_.*\(self\):', line):
                # This is a test method definition
                fixed_lines.append(line)
                i += 1
                
                # Look for the docstring
                if i < len(lines) and '"""' in lines[i]:
                    fixed_lines.append(lines[i])
                    i += 1
                
                # Look for setup call
                if i < len(lines) and 'await self._setup_browser()' in lines[i]:
                    fixed_lines.append(lines[i])
                    i += 1
                
                # Look for try statement
                if i < len(lines) and lines[i].strip() == 'try:':
                    try_indent = len(lines[i]) - len(lines[i].lstrip())
                    fixed_lines.append(lines[i])
                    i += 1
                    
                    # Process everything until we find the finally block
                    try_content = []
                    while i < len(lines):
                        current_line = lines[i]
                        
                        # Check for finally at same level as try
                        if current_line.strip() == 'finally:' and len(current_line) - len(current_line.lstrip()) == try_indent:
                            # Add all try content with proper indentation
                            for content_line in try_content:
                                if content_line.strip():
                                    # Ensure proper indentation (try_indent + 4)
                                    stripped = content_line.lstrip()
                                    fixed_lines.append(' ' * (try_indent + 4) + stripped)
                                else:
                                    fixed_lines.append(content_line)
                            
                            # Add finally block
                            fixed_lines.append(current_line)
                            i += 1
                            
                            # Add finally content with proper indentation
                            if i < len(lines) and 'await self._cleanup_browser()' in lines[i]:
                                cleanup_line = lines[i]
                                stripped_cleanup = cleanup_line.lstrip()
                                fixed_lines.append(' ' * (try_indent + 4) + stripped_cleanup)
                                i += 1
                            
                            break
                        else:
                            try_content.append(current_line)
                            i += 1
                    
                    # If no finally found, just add the content
                    if i >= len(lines):
                        for content_line in try_content:
                            if content_line.strip():
                                stripped = content_line.lstrip()
                                fixed_lines.append(' ' * (try_indent + 4) + stripped)
                            else:
                                fixed_lines.append(content_line)
            
            # Look for orphaned decorators or cleanup calls
            elif line.strip().startswith('@pytest.mark') or line.strip() == 'await self._cleanup_browser()':
                # Check if this is misplaced - skip orphaned calls
                if 'await self._cleanup_browser()' in line and i > 0:
                    # This might be an orphaned cleanup call, skip it
                    i += 1
                    continue
                else:
                    fixed_lines.append(line)
                    i += 1
            
            else:
                fixed_lines.append(line)
                i += 1
        
        # Step 2: Clean up any remaining malformed structures
        content = '\n'.join(fixed_lines)
        
        # Remove any orphaned lines that got misplaced
        content = re.sub(r'\n\s*finally:\s*\n\s*await self\._cleanup_browser\(\)\s*\n\s*\n\s*@pytest\.mark\.\w+\s*\n\s*@pytest\.mark\.\w+\s*\n\s*await self\._cleanup_browser\(\)\s*\n', '\n        finally:\n            await self._cleanup_browser()\n\n', content)
        
        # Fix any remaining malformed try-finally blocks
        content = re.sub(r'(\s+)async def (test_\w+)\(self\):\s*\n(\s+)"""([^"]+)"""\s*\n(\s+)await self\._setup_browser\(\)\s*\n(\s+)try:\s*\n(.*?)\s+finally:\s*\n\s+await self\._cleanup_browser\(\)', 
                         r'\1async def \2(self):\n\3"""\4"""\n\5await self._setup_browser()\n\6try:\n\7\n\6finally:\n\6    await self._cleanup_browser()', 
                         content, flags=re.DOTALL)
        
        # Add proper spacing between test methods
        content = re.sub(r'(\n        finally:\n            await self._cleanup_browser\(\))\n(\s*@pytest\.mark)', r'\1\n\n\2', content)
        
        # Write the cleaned content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Robustly fixed indentation in: {file_path}")
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def main():
    """Main function to fix all converted files."""
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
    
    fixed_count = 0
    
    for file_rel_path in files_to_fix:
        file_path = base_dir / file_rel_path
        if file_path.exists():
            if fix_file_indentation(file_path):
                fixed_count += 1
        else:
            print(f"File not found: {file_path}")
    
    print(f"\nRobustly fixed {fixed_count} files successfully.")

if __name__ == "__main__":
    main()