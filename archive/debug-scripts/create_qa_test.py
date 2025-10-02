#!/usr/bin/env python3
"""
QA Intelligence Test Creator
Helper script to create new QA Intelligence system tests in the correct location
"""

import os
import sys
from datetime import datetime

# Test categories
CATEGORIES = {
    'dashboard': 'Dashboard functionality tests',
    'auth': 'Authentication and authorization tests',
    'scheduler': 'Test scheduler functionality tests',
    'frontend': 'Frontend UI component tests',
    'backend': 'Backend API and service tests',
    'ai-system': 'AI and ML system tests',
    'integration': 'Integration and E2E tests',
    'validation': 'General validation tests'
}

def create_test_template(category, test_name, description):
    """Create a test file template"""
    
    template = f'''"""
{test_name.replace('_', ' ').title()}
{description}
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_{test_name.lower()}():
    """
    {description}
    
    Test validates:
    - TODO: Add specific validation points
    - TODO: Add expected behavior
    - TODO: Add edge cases to test
    """
    
    print(f"=== TESTING {test_name.upper().replace('_', ' ')} ===")
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    try:
        # TODO: Add your test implementation here
        print("1. Starting test...")
        
        # Navigate to QA Intelligence dashboard
        await page.goto("http://localhost:3000")
        await page.wait_for_load_state('networkidle')
        
        print("2. Test implementation needed")
        # Add your specific test steps here
        
        print("3. Test completed successfully")
        return True
        
    except Exception as e:
        print(f"Test failed: {{str(e)}}")
        return False
    
    finally:
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_{test_name.lower()}())
    
    print("\\n" + "="*50)
    if result:
        print("SUCCESS: Test passed!")
    else:
        print("FAILURE: Test failed!")
    print("="*50)
'''
    
    return template

def main():
    print("=== QA Intelligence Test Creator ===")
    print("This creates new test files in the correct qa-intelligence-tests directory")
    print()
    
    # Show available categories
    print("Available categories:")
    for i, (cat, desc) in enumerate(CATEGORIES.items(), 1):
        print(f"{i}. {cat} - {desc}")
    print()
    
    # Get category choice
    try:
        choice = input("Choose category (1-8 or name): ").strip()
        
        if choice.isdigit():
            choice = int(choice)
            if 1 <= choice <= len(CATEGORIES):
                category = list(CATEGORIES.keys())[choice - 1]
            else:
                print("Invalid choice!")
                return
        else:
            if choice.lower() in CATEGORIES:
                category = choice.lower()
            else:
                print(f"Unknown category: {choice}")
                return
                
    except KeyboardInterrupt:
        print("\\nCancelled.")
        return
    
    # Get test name
    test_name = input(f"Test name (without test_ prefix): ").strip()
    if not test_name:
        print("Test name required!")
        return
    
    # Clean test name
    test_name = test_name.replace(' ', '_').replace('-', '_').lower()
    if test_name.startswith('test_'):
        test_name = test_name[5:]
    
    # Get description
    description = input(f"Test description: ").strip()
    if not description:
        description = f"Test {test_name.replace('_', ' ')}"
    
    # Create file path
    filename = f"test_{test_name}.py"
    filepath = os.path.join("qa-intelligence-tests", category, filename)
    
    # Check if file exists
    if os.path.exists(filepath):
        overwrite = input(f"File {filepath} exists. Overwrite? (y/N): ").strip().lower()
        if overwrite != 'y':
            print("Cancelled.")
            return
    
    # Create directory if needed
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Generate template
    template = create_test_template(category, test_name, description)
    
    # Write file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(template)
        
        print(f"\\n✅ Created: {filepath}")
        print(f"📁 Category: {category}")
        print(f"📝 Description: {description}")
        print(f"\\n🚀 To run: python {filepath}")
        print("\\n📖 Don't forget to:")
        print("   - Implement the actual test logic")
        print("   - Add specific validation points") 
        print("   - Test with real data, not mocks")
        print("   - Update this script if you add test categories")
        
    except Exception as e:
        print(f"Error creating file: {e}")

if __name__ == "__main__":
    main()