#!/usr/bin/env python3
"""
Restore proper WeSign tests to the test bank database from wesign_tests.json
"""

import json
import sqlite3
import uuid
from datetime import datetime

def restore_wesign_tests():
    """Restore WeSign tests from JSON to database"""
    
    print("Loading WeSign tests from wesign_tests.json...")
    
    try:
        with open("wesign_tests.json", "r", encoding="utf-8") as f:
            wesign_tests = json.load(f)
    except FileNotFoundError:
        print("ERROR: wesign_tests.json not found!")
        return False
    
    print(f"Found {len(wesign_tests)} WeSign tests to restore")
    
    # Connect to scheduler database (where tests are actually stored)
    try:
        import sqlite3
        conn = sqlite3.connect("backend/data/scheduler.db")
        cursor = conn.cursor()
        
        print("Connected to scheduler database")
        
        # Insert tests
        tests_added = 0
        tags_added = 0
        
        for test in wesign_tests:
            # Generate unique ID if not present
            test_id = test.get("id", str(uuid.uuid4()))
            
            # Extract test info
            file_path = test.get("filePath", "").replace("C:/Users/gals/Desktop/playwrightTestsClaude/tests/", "")
            test_name = f"{test.get('module', 'Unknown')}::{test.get('testFunction', test.get('name', 'unknown'))}"
            description = test.get("description", test.get("name", ""))
            category = test.get("module", "unknown")
            
            # Insert test
            cursor.execute("""
                INSERT OR REPLACE INTO tests 
                (id, file_path, test_name, class_name, function_name, description, category, line_number, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                test_id,
                file_path,
                test_name, 
                test.get('module', ''),
                test.get('testFunction', test.get('name', '')),
                description,
                category,
                1,  # line_number
                True,  # is_active
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            tests_added += 1
            
            # Insert tags
            tags = test.get("tags", [])
            for tag in tags:
                cursor.execute("""
                    INSERT OR REPLACE INTO test_tags (test_id, tag_name, tag_type)
                    VALUES (?, ?, ?)
                """, (test_id, tag, "marker"))
                tags_added += 1
        
        conn.commit()
        conn.close()
        
        print(f"Successfully restored:")
        print(f"  - {tests_added} WeSign tests")
        print(f"  - {tags_added} test tags")
        
        return True
        
    except Exception as e:
        print(f"ERROR restoring tests: {e}")
        return False

if __name__ == "__main__":
    success = restore_wesign_tests()
    if success:
        print("\n✅ WeSign tests restored to test bank successfully!")
    else:
        print("\n❌ Failed to restore WeSign tests!")