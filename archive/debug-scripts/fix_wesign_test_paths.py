#!/usr/bin/env python3
"""
Fix WeSign test paths to point to the correct external directory for execution
"""

import sqlite3
import os

def fix_wesign_test_paths():
    """Update test paths to point to external WeSign test directory"""
    
    external_tests_dir = r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests"
    local_tests_dir = r"tests"
    
    print(f"Fixing WeSign test paths...")
    print(f"External directory: {external_tests_dir}")
    print(f"Current directory: {os.getcwd()}")
    
    try:
        conn = sqlite3.connect("backend/data/scheduler.db")
        cursor = conn.cursor()
        
        # Get all tests with relative paths
        cursor.execute("SELECT id, file_path FROM tests")
        tests = cursor.fetchall()
        
        print(f"Found {len(tests)} tests to update")
        
        updated = 0
        for test_id, file_path in tests:
            # Create absolute path to external directory
            absolute_path = os.path.join(external_tests_dir, file_path).replace("\\", "/")
            
            # Update the database with absolute path
            cursor.execute("UPDATE tests SET file_path = ? WHERE id = ?", (absolute_path, test_id))
            updated += 1
            
            if updated <= 5:  # Show first 5 updates
                print(f"  Updated: {file_path} -> {absolute_path}")
        
        conn.commit()
        conn.close()
        
        print(f"Successfully updated {updated} test paths")
        return True
        
    except Exception as e:
        print(f"Error updating paths: {e}")
        return False

def verify_test_file_exists():
    """Verify that updated test files actually exist"""
    
    print("\nVerifying test files exist...")
    
    try:
        conn = sqlite3.connect("backend/data/scheduler.db")
        cursor = conn.cursor()
        
        # Check a few test files
        cursor.execute("SELECT file_path FROM tests LIMIT 5")
        test_paths = cursor.fetchall()
        
        for (file_path,) in test_paths:
            if os.path.exists(file_path):
                print(f"✅ EXISTS: {file_path}")
            else:
                print(f"❌ MISSING: {file_path}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error verifying files: {e}")
        return False

if __name__ == "__main__":
    print("=== Fixing WeSign Test Paths ===")
    
    success = fix_wesign_test_paths()
    if success:
        verify_test_file_exists()
        print("\nTest paths updated - WeSign tests should now execute properly!")
    else:
        print("\nFailed to update test paths")