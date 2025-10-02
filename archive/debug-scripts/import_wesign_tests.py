#!/usr/bin/env python3
"""
Import actual WeSign tests from external playwright_tests directory
"""

import os
import re
import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

def analyze_wesign_test_file(file_path):
    """Analyze a WeSign test file to extract test information"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract test functions
        test_functions = []
        
        # Find test functions using regex
        test_pattern = r'(?:async\s+)?def\s+(test_\w+)\s*\([^)]*\):'
        matches = re.findall(test_pattern, content)
        
        # Find class-based tests
        class_pattern = r'class\s+(Test\w+).*?:'
        class_matches = re.findall(class_pattern, content)
        
        # Extract docstrings and descriptions
        docstring_pattern = r'"""([^"]+)"""'
        docstrings = re.findall(docstring_pattern, content)
        
        # Determine category from file path
        path_parts = Path(file_path).parts
        category = "wesign"
        
        if "auth" in str(file_path):
            category = "auth"
        elif "contact" in str(file_path):
            category = "contacts"
        elif "document" in str(file_path) or "signing" in str(file_path):
            category = "documents"
        elif "template" in str(file_path):
            category = "templates"
        elif "report" in str(file_path):
            category = "reports"
        elif "user" in str(file_path):
            category = "user_management"
        elif "integration" in str(file_path):
            category = "integration"
        elif "system" in str(file_path):
            category = "system"
        
        # Extract test info
        for test_func in matches:
            test_info = {
                "function_name": test_func,
                "class_name": class_matches[0] if class_matches else "",
                "category": category,
                "file_path": str(file_path),
                "description": docstrings[0] if docstrings else f"WeSign {category} test: {test_func}",
                "tags": ["wesign", category, "regression"]
            }
            
            # Add specific tags based on test name
            if "login" in test_func.lower():
                test_info["tags"].extend(["login", "authentication", "smoke"])
            if "negative" in test_func.lower() or "fail" in test_func.lower():
                test_info["tags"].append("negative")
            if "admin" in test_func.lower():
                test_info["tags"].append("admin")
            if "performance" in test_func.lower():
                test_info["tags"].extend(["performance", "slow"])
            
            test_functions.append(test_info)
        
        return test_functions
    
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return []

def import_wesign_tests():
    """Import WeSign tests from external directory to test bank"""
    
    external_tests_dir = r"C:\Users\gals\seleniumpythontests-1\playwright_tests\tests"
    
    print(f"Importing WeSign tests from: {external_tests_dir}")
    
    if not os.path.exists(external_tests_dir):
        print(f"ERROR: External tests directory not found: {external_tests_dir}")
        return False
    
    # Find all test files
    test_files = []
    for root, dirs, files in os.walk(external_tests_dir):
        for file in files:
            if file.startswith("test_") and file.endswith(".py"):
                test_files.append(os.path.join(root, file))
    
    print(f"Found {len(test_files)} WeSign test files")
    
    # Analyze all test files
    all_tests = []
    for test_file in test_files:
        print(f"Analyzing: {test_file}")
        test_functions = analyze_wesign_test_file(test_file)
        all_tests.extend(test_functions)
    
    print(f"Extracted {len(all_tests)} individual test functions")
    
    # Import to database
    try:
        conn = sqlite3.connect("backend/data/scheduler.db")
        cursor = conn.cursor()
        
        tests_added = 0
        tags_added = 0
        
        for test in all_tests:
            test_id = str(uuid.uuid4())
            
            # Create relative file path
            rel_path = test["file_path"].replace(external_tests_dir, "").replace("\\", "/").lstrip("/")
            
            # Create test name
            if test["class_name"]:
                test_name = f"{test['class_name']}::{test['function_name']}"
            else:
                test_name = test["function_name"]
            
            # Insert test
            cursor.execute("""
                INSERT OR REPLACE INTO tests 
                (id, file_path, test_name, class_name, function_name, description, category, line_number, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                test_id,
                rel_path,
                test_name,
                test["class_name"],
                test["function_name"],
                test["description"],
                test["category"],
                1,
                True,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            tests_added += 1
            
            # Insert tags
            for tag in test["tags"]:
                cursor.execute("""
                    INSERT OR REPLACE INTO test_tags (test_id, tag_name, tag_type)
                    VALUES (?, ?, ?)
                """, (test_id, tag, "marker"))
                tags_added += 1
        
        conn.commit()
        conn.close()
        
        print(f"\nSuccessfully imported:")
        print(f"  - {tests_added} WeSign tests")
        print(f"  - {tags_added} test tags")
        
        # Generate import report
        report = {
            "timestamp": datetime.now().isoformat(),
            "source_directory": external_tests_dir,
            "tests_imported": tests_added,
            "tags_created": tags_added,
            "categories": list(set(test["category"] for test in all_tests)),
            "test_files": len(test_files)
        }
        
        with open("wesign_import_report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"Import report saved: wesign_import_report.json")
        return True
        
    except Exception as e:
        print(f"ERROR importing tests to database: {e}")
        return False

if __name__ == "__main__":
    success = import_wesign_tests()
    if success:
        print("\n✅ WeSign tests imported successfully!")
    else:
        print("\n❌ Failed to import WeSign tests!")