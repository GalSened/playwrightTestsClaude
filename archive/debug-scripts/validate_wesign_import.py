#!/usr/bin/env python3
"""
Validate that WeSign tests were correctly imported to the test bank
"""

import sqlite3
import json

def validate_wesign_import():
    """Validate WeSign tests import to scheduler database"""
    
    print("Validating WeSign tests import...")
    
    try:
        # Connect to scheduler database
        conn = sqlite3.connect("backend/data/scheduler.db")
        cursor = conn.cursor()
        
        # Count total tests
        cursor.execute("SELECT COUNT(*) FROM tests")
        total_tests = cursor.fetchone()[0]
        print(f"Total tests in database: {total_tests}")
        
        # Count tests by category
        cursor.execute("SELECT category, COUNT(*) FROM tests GROUP BY category ORDER BY COUNT(*) DESC")
        categories = cursor.fetchall()
        print(f"Tests by category:")
        for category, count in categories:
            print(f"  - {category}: {count} tests")
        
        # Count tags
        cursor.execute("SELECT COUNT(*) FROM test_tags")
        total_tags = cursor.fetchone()[0]
        print(f"Total tags: {total_tags}")
        
        # Sample some test names
        cursor.execute("SELECT test_name, category FROM tests LIMIT 10")
        sample_tests = cursor.fetchall()
        print(f"Sample tests:")
        for test_name, category in sample_tests:
            print(f"  - [{category}] {test_name}")
        
        # Check for WeSign-specific markers
        cursor.execute("SELECT DISTINCT tag_name FROM test_tags ORDER BY tag_name")
        tags = [row[0] for row in cursor.fetchall()]
        wesign_tags = [tag for tag in tags if any(keyword in tag.lower() for keyword in ['wesign', 'auth', 'login', 'document', 'sign'])]
        print(f"WeSign-related tags: {wesign_tags[:10]}")
        
        conn.close()
        
        # Compare with import report
        try:
            with open("wesign_import_report.json", "r") as f:
                report = json.load(f)
            
            print(f"Import report validation:")
            print(f"  Expected tests: {report['tests_imported']}")
            print(f"  Actual tests: {total_tests}")
            print(f"  Expected tags: {report['tags_created']}")  
            print(f"  Actual tags: {total_tags}")
            print(f"  Expected categories: {len(report['categories'])}")
            print(f"  Actual categories: {len(categories)}")
            
            if total_tests == report['tests_imported']:
                print("SUCCESS: Test count matches import report")
                return True
            else:
                print("WARNING: Test count mismatch")
                return False
                
        except FileNotFoundError:
            print("Import report not found, skipping validation")
            return total_tests > 0
            
    except Exception as e:
        print(f"ERROR validating import: {e}")
        return False

if __name__ == "__main__":
    success = validate_wesign_import()
    if success:
        print("WeSign tests validation PASSED")
    else:
        print("WeSign tests validation FAILED")