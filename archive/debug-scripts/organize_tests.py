"""
Organize QA Intelligence Tests
Move all system test files into organized folders
"""

import os
import shutil
import glob
from pathlib import Path

# Define test categories and their patterns
test_categories = {
    'dashboard': [
        '*dashboard*',
        'debug_dashboard*',
        'simple_dashboard*',
        'final_dashboard*'
    ],
    'auth': [
        '*auth*',
        '*login*',
        'registration_page_test.py',
        'comprehensive_auth_flow_test.py'
    ],
    'scheduler': [
        '*scheduler*',
        '*schedule*',
        'demo_scheduler*',
        'simple_scheduler*',
        'manual_scheduler*'
    ],
    'frontend': [
        '*frontend*',
        '*ui*',
        'test_bank*',
        'test_reports*',
        '*epu*',
        'cross_page_epu_test.py',
        'analytics_epu_test.py'
    ],
    'backend': [
        '*api*',
        'debug_test_discovery.py',
        'get_all_tests.py'
    ],
    'ai-system': [
        '*ai*',
        'test_failure_intelligence.py',
        'test_prd_coverage_analysis.py'
    ],
    'integration': [
        '*execution*',
        '*run_button*',
        'test_single_test_execution.py',
        'test_run_single_test.py',
        'test_actual_wesign_execution.py'
    ],
    'validation': [
        '*validation*',
        '*verification*',
        '*check*',
        'simple_test*',
        'debug_test*',
        'comprehensive_test*',
        'final_comprehensive_test.py',
        'test_fix_verification.py',
        'test_path_fix.py',
        'test_headed_single.py'
    ]
}

def organize_tests():
    print("=== ORGANIZING QA INTELLIGENCE TESTS ===")
    
    base_dir = Path(".")
    qa_tests_dir = Path("qa-intelligence-tests")
    
    # Create base directory if it doesn't exist
    qa_tests_dir.mkdir(exist_ok=True)
    
    # Create category directories
    for category in test_categories.keys():
        category_dir = qa_tests_dir / category
        category_dir.mkdir(exist_ok=True)
        print(f"Created directory: {category_dir}")
    
    moved_files = 0
    errors = []
    
    # Move files by category
    for category, patterns in test_categories.items():
        category_dir = qa_tests_dir / category
        print(f"\nProcessing {category} category...")
        
        for pattern in patterns:
            # Find files matching this pattern
            matching_files = glob.glob(pattern)
            
            for file_path in matching_files:
                file_name = Path(file_path).name
                source = Path(file_path)
                destination = category_dir / file_name
                
                # Skip if file doesn't exist or is already in target directory
                if not source.exists() or source.parent == category_dir:
                    continue
                    
                # Skip if it's a directory
                if source.is_dir():
                    continue
                
                try:
                    # Move the file
                    shutil.move(str(source), str(destination))
                    print(f"  Moved: {file_name} -> {category}/")
                    moved_files += 1
                except Exception as e:
                    error_msg = f"Error moving {file_name}: {str(e)}"
                    errors.append(error_msg)
                    print(f"  ERROR: {error_msg}")
    
    # Handle any remaining test files that didn't match patterns
    remaining_test_files = glob.glob("test_*.py") + glob.glob("*test*.py")
    
    if remaining_test_files:
        print(f"\nFound {len(remaining_test_files)} remaining test files:")
        misc_dir = qa_tests_dir / "misc"
        misc_dir.mkdir(exist_ok=True)
        
        for file_path in remaining_test_files:
            file_name = Path(file_path).name
            source = Path(file_path)
            destination = misc_dir / file_name
            
            # Skip if already processed or in target directory
            if not source.exists() or source.parent.name in test_categories.keys():
                continue
                
            if source.is_dir():
                continue
            
            try:
                shutil.move(str(source), str(destination))
                print(f"  Moved: {file_name} -> misc/")
                moved_files += 1
            except Exception as e:
                error_msg = f"Error moving {file_name}: {str(e)}"
                errors.append(error_msg)
                print(f"  ERROR: {error_msg}")
    
    # Create a README file
    readme_content = """# QA Intelligence System Tests

This directory contains all tests for the QA Intelligence system, organized by category:

## Directory Structure

- **dashboard/**: Dashboard-related tests (UI, functionality, validation)
- **auth/**: Authentication and authorization tests (login, registration)
- **scheduler/**: Test scheduler functionality (UI, API, workflows)
- **frontend/**: Frontend UI tests (components, pages, EPU tests)
- **backend/**: Backend API and service tests
- **ai-system/**: AI and machine learning system tests
- **integration/**: Integration and end-to-end tests
- **validation/**: General validation and verification tests
- **misc/**: Miscellaneous tests that don't fit other categories

## Running Tests

All tests in this directory are for the QA Intelligence system itself, not for WeSign testing.

### Example Usage:
```bash
# Run all dashboard tests
python qa-intelligence-tests/dashboard/test_dashboard_validation.py

# Run authentication tests
python qa-intelligence-tests/auth/test_login_fix.py

# Run scheduler tests
python qa-intelligence-tests/scheduler/test_scheduler_ui_verification.py
```

## Guidelines

- All new QA Intelligence system tests should be placed in the appropriate category directory
- Use descriptive filenames that indicate the test purpose
- Keep WeSign application tests separate in the `/tests` directory
- Update this README when adding new test categories
"""
    
    readme_path = qa_tests_dir / "README.md"
    with open(readme_path, "w") as f:
        f.write(readme_content)
    
    print(f"\n=== ORGANIZATION COMPLETE ===")
    print(f"Files moved: {moved_files}")
    print(f"Errors: {len(errors)}")
    
    if errors:
        print("\nErrors encountered:")
        for error in errors:
            print(f"  - {error}")
    
    print(f"\nCreated README.md in {qa_tests_dir}")
    print("QA Intelligence tests are now organized!")
    
    return moved_files, errors

if __name__ == "__main__":
    moved, errors = organize_tests()