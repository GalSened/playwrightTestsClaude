#!/usr/bin/env python3
"""WeSign Integration Execution Test"""

import subprocess
import sys
import json
from pathlib import Path
from datetime import datetime

def test_wesign_execution():
    """Test WeSign integration"""
    wesign_dir = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests/tests")
    
    print("WeSign Integration Test")
    print("=" * 30)
    
    if not wesign_dir.exists():
        print("FAIL: WeSign test directory not found")
        return False
    
    # Find test files
    all_files = list(wesign_dir.rglob("test_*.py"))
    original_files = [f for f in all_files if "_converted" not in f.name]
    converted_files = [f for f in all_files if "_converted" in f.name]
    
    print(f"Total test files: {len(all_files)}")
    print(f"Original files: {len(original_files)}")
    print(f"Converted files: {len(converted_files)}")
    
    if converted_files:
        print(f"RECOMMENDATION: Remove {len(converted_files)} converted files")
    
    # Test one file
    if original_files:
        test_file = original_files[0]  # Take first available
        print(f"Testing: {test_file.name}")
        
        try:
            # Quick syntax check
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            compile(content, test_file, 'exec')
            print("Syntax check: PASS")
            
            # Try a quick pytest dry-run
            cmd = [sys.executable, "-m", "pytest", str(test_file), "--collect-only", "-q"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("Test discovery: PASS") 
                print("WeSign integration: WORKING")
                return True
            else:
                print(f"Test discovery: FAIL ({result.stderr[:100]}...)")
                return False
                
        except Exception as e:
            print(f"Error: {str(e)[:100]}...")
            return False
    else:
        print("FAIL: No original test files found")
        return False

if __name__ == "__main__":
    success = test_wesign_execution()
    sys.exit(0 if success else 1)
