#!/usr/bin/env python3
"""
Validate current test bank baseline before migration
"""

import requests
import json
from datetime import datetime
import os

def validate_test_bank_baseline():
    """Get current test bank state for migration baseline"""
    
    baseline = {
        "timestamp": datetime.now().isoformat(),
        "current_python_tests": [],
        "api_accessible": False,
        "test_count": 0,
        "categories": set(),
        "errors": []
    }
    
    # Count current Python test files
    try:
        for root, dirs, files in os.walk("tests/"):
            for file in files:
                if file.endswith(".py") and file.startswith("test_"):
                    rel_path = os.path.relpath(os.path.join(root, file))
                    category = rel_path.split(os.sep)[1] if len(rel_path.split(os.sep)) > 1 else "root"
                    baseline["categories"].add(category)
                    baseline["current_python_tests"].append({
                        "file": rel_path,
                        "category": category
                    })
        
        baseline["categories"] = list(baseline["categories"])
        baseline["current_files_count"] = len(baseline["current_python_tests"])
        print(f"Found {baseline['current_files_count']} Python test files")
        print(f"Categories: {baseline['categories']}")
        
    except Exception as e:
        baseline["errors"].append(f"Error scanning Python tests: {str(e)}")
        print(f"Error scanning Python tests: {e}")
    
    # Try to access test discovery API
    try:
        response = requests.get("http://localhost:8081/api/test-discovery/tests", timeout=5)
        if response.status_code == 200:
            tests_data = response.json()
            baseline["api_accessible"] = True
            baseline["test_count"] = len(tests_data) if isinstance(tests_data, list) else 0
            baseline["api_tests"] = tests_data[:5] if isinstance(tests_data, list) else []
            print(f"Test bank API accessible - {baseline['test_count']} tests found")
        else:
            baseline["errors"].append(f"API returned status {response.status_code}")
            print(f"API returned status {response.status_code}")
    except Exception as e:
        baseline["errors"].append(f"API connection failed: {str(e)}")
        print(f"API connection failed: {e}")
    
    # Count TypeScript files to convert
    try:
        ts_files = []
        for root, dirs, files in os.walk("playwright-system-tests/tests/"):
            for file in files:
                if file.endswith(".spec.ts"):
                    rel_path = os.path.relpath(os.path.join(root, file))
                    ts_files.append(rel_path)
        
        baseline["typescript_files"] = ts_files
        baseline["typescript_count"] = len(ts_files)
        print(f"Found {baseline['typescript_count']} TypeScript test files to convert")
        
    except Exception as e:
        baseline["errors"].append(f"Error scanning TypeScript tests: {str(e)}")
        print(f"Error scanning TypeScript tests: {e}")
    
    # Save baseline
    with open("migration_baseline.json", "w") as f:
        json.dump(baseline, f, indent=2)
    
    print(f"Baseline saved to: migration_baseline.json")
    
    # Print summary
    print("\n" + "="*50)
    print("📊 MIGRATION BASELINE SUMMARY")
    print("="*50)
    print(f"Python tests: {baseline.get('current_files_count', 0)}")
    print(f"TypeScript tests: {baseline.get('typescript_count', 0)}")
    print(f"Test bank API: {'Working' if baseline['api_accessible'] else 'Not accessible'}")
    print(f"Categories: {len(baseline.get('categories', []))}")
    print(f"Errors: {len(baseline['errors'])}")
    
    if baseline['errors']:
        print("\nIssues found:")
        for error in baseline['errors']:
            print(f"   • {error}")
    
    return baseline

if __name__ == "__main__":
    validate_test_bank_baseline()