#!/usr/bin/env python3
"""
Script to fix import paths after project reorganization
"""
import os
import re
from pathlib import Path


def fix_imports_in_file(file_path):
    """Fix import paths in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Fix imports from pages
        content = re.sub(r'from pages\.', r'from src.pages.', content)
        
        # Fix imports from utils
        content = re.sub(r'from utils\.', r'from src.utils.', content)
        
        # Fix imports from config
        content = re.sub(r'from config\.', r'from src.config.', content)
        
        # Only write if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated imports in: {file_path}")
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False


def main():
    """Main function to fix all imports"""
    base_dir = Path(__file__).parent.parent
    tests_dir = base_dir / "tests"
    
    # Find all Python test files
    test_files = []
    for root, dirs, files in os.walk(tests_dir):
        for file in files:
            if file.endswith('.py') and (file.startswith('test_') or file == 'conftest.py'):
                test_files.append(os.path.join(root, file))
    
    print(f"Found {len(test_files)} test files to process")
    
    updated_count = 0
    for test_file in test_files:
        if fix_imports_in_file(test_file):
            updated_count += 1
    
    print(f"\nUpdated {updated_count} files")
    
    # Also fix the main conftest.py if needed
    main_conftest = base_dir / "conftest.py" 
    if main_conftest.exists():
        if fix_imports_in_file(main_conftest):
            print(f"Updated imports in main conftest.py")


if __name__ == "__main__":
    main()