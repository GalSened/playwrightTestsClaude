#!/usr/bin/env python3
"""
Validate that all new tests appear correctly in the test bank
"""

import subprocess
import json
import time
import os
from datetime import datetime

def discover_tests_via_pytest():
    """Use pytest to discover all available tests"""
    
    try:
        # Run pytest discovery
        result = subprocess.run([
            "venv/Scripts/python.exe", "-m", "pytest", 
            "--collect-only", "--quiet", "tests/", 
            "--tb=no"
        ], capture_output=True, text=True, timeout=60)
        
        discovered_tests = []
        if result.returncode == 0:
            lines = result.stdout.split('\\n')
            for line in lines:
                if "::" in line and "test_" in line:
                    discovered_tests.append(line.strip())
        
        return discovered_tests, result.stderr
        
    except Exception as e:
        return [], str(e)

def validate_test_categories():
    """Validate test categories and structure"""
    
    categories = {}
    total_tests = 0
    
    for root, dirs, files in os.walk("tests/"):
        for file in files:
            if file.endswith(".py") and file.startswith("test_"):
                rel_path = os.path.relpath(os.path.join(root, file))
                category = rel_path.split(os.sep)[1] if len(rel_path.split(os.sep)) > 1 else "root"
                
                if category not in categories:
                    categories[category] = []
                categories[category].append(file)
                total_tests += 1
    
    return categories, total_tests

def validate_test_bank_ui():
    """Navigate to test bank UI to validate tests appear"""
    
    print("Validating test bank UI integration...")
    
    # For now, just check if we can access the test bank
    # The actual UI validation will be done with the MCP test
    validation_script = '''
import asyncio
from playwright.async_api import async_playwright

async def check_test_bank():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.newPage()
        
        try:
            # Navigate to test bank
            await page.goto("http://localhost:3000/test-bank")
            await page.wait_for_timeout(5000)  # Wait for tests to load
            
            # Take screenshot for validation
            await page.screenshot(path="test_bank_validation.png", full_page=True)
            
            # Check if tests are visible
            test_rows = await page.query_selector_all("tbody tr, [data-testid*='test'], .test-item")
            test_count = len(test_rows)
            
            print(f"Test bank UI shows {test_count} test items")
            
            return test_count > 0, test_count
            
        except Exception as e:
            print(f"Error validating test bank UI: {e}")
            return False, 0
        finally:
            await browser.close()

# Run validation
success, count = asyncio.run(check_test_bank())
print(f"UI Validation: {success}, Test count: {count}")
'''
    
    try:
        with open("temp_ui_validation.py", "w") as f:
            f.write(validation_script)
        
        result = subprocess.run([
            "venv/Scripts/python.exe", "temp_ui_validation.py"
        ], capture_output=True, text=True, timeout=30)
        
        os.remove("temp_ui_validation.py")  # Cleanup
        
        return "success" in result.stdout.lower(), result.stdout + result.stderr
        
    except Exception as e:
        return False, str(e)

def main():
    """Main validation function"""
    
    print("Starting comprehensive test bank validation...")
    
    validation_results = {
        "timestamp": datetime.now().isoformat(),
        "pytest_discovery": {},
        "category_validation": {},
        "ui_validation": {},
        "overall_success": True
    }
    
    # 1. Pytest discovery
    print("\\n1. Running pytest test discovery...")
    discovered_tests, error = discover_tests_via_pytest()
    validation_results["pytest_discovery"] = {
        "test_count": len(discovered_tests),
        "tests": discovered_tests[:10],  # First 10 for sample
        "error": error,
        "success": len(discovered_tests) > 0
    }
    
    print(f"   Found {len(discovered_tests)} tests via pytest")
    if error:
        print(f"   Errors: {error}")
    
    # 2. Category validation
    print("\\n2. Validating test categories...")
    categories, total_tests = validate_test_categories()
    validation_results["category_validation"] = {
        "total_tests": total_tests,
        "categories": {cat: len(files) for cat, files in categories.items()},
        "category_count": len(categories),
        "success": total_tests > 20  # Should have at least 23 tests
    }
    
    print(f"   Total tests: {total_tests}")
    print(f"   Categories: {list(categories.keys())}")
    for cat, files in categories.items():
        print(f"     {cat}: {len(files)} tests")
    
    # 3. UI validation
    print("\\n3. Validating test bank UI...")
    ui_success, ui_output = validate_test_bank_ui()
    validation_results["ui_validation"] = {
        "success": ui_success,
        "output": ui_output,
        "screenshot_taken": os.path.exists("test_bank_validation.png")
    }
    
    print(f"   UI validation: {'SUCCESS' if ui_success else 'FAILED'}")
    
    # Overall validation
    validation_results["overall_success"] = (
        validation_results["pytest_discovery"]["success"] and
        validation_results["category_validation"]["success"] and
        validation_results["ui_validation"]["success"]
    )
    
    # Save results
    with open("test_bank_validation.json", "w") as f:
        json.dump(validation_results, f, indent=2)
    
    print(f"\\n{'='*50}")
    print("TEST BANK VALIDATION SUMMARY")
    print(f"{'='*50}")
    print(f"Pytest Discovery: {'PASS' if validation_results['pytest_discovery']['success'] else 'FAIL'}")
    print(f"Category Structure: {'PASS' if validation_results['category_validation']['success'] else 'FAIL'}")
    print(f"UI Integration: {'PASS' if validation_results['ui_validation']['success'] else 'FAIL'}")
    print(f"Overall Status: {'SUCCESS' if validation_results['overall_success'] else 'FAILED'}")
    print(f"Validation report: test_bank_validation.json")
    
    return validation_results["overall_success"]

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)