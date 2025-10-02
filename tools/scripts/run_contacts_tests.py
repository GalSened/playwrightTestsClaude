#!/usr/bin/env python3
"""
Test runner script for Contacts functionality tests
Provides easy command-line interface to run specific test suites
"""

import subprocess
import sys
import argparse
import os


def run_command(command, description):
    """Run a command and handle output"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=False)
        print(f"\n✅ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} failed with exit code {e.returncode}")
        return False


def main():
    """Main test runner function"""
    parser = argparse.ArgumentParser(description="Run Contacts functionality tests")
    parser.add_argument('--suite', choices=[
        'english', 'hebrew', 'accessibility', 'performance', 
        'cross-browser', 'edge-cases', 'all', 'smoke'
    ], default='all', help='Test suite to run')
    parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit'], 
                        default='chromium', help='Browser to use')
    parser.add_argument('--headed', action='store_true', help='Run tests in headed mode')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--parallel', type=int, default=1, help='Number of parallel workers')
    parser.add_argument('--html-report', action='store_true', help='Generate HTML report')
    
    args = parser.parse_args()
    
    # Ensure we're in the correct directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Base pytest command
    base_cmd = "python -m pytest"
    
    # Add common options
    common_opts = []
    if args.verbose:
        common_opts.append("-v")
    if args.headed:
        common_opts.append("--headed")
    if args.html_report:
        common_opts.append("--html=reports/contacts_test_report.html")
        common_opts.append("--self-contained-html")
    if args.parallel > 1:
        common_opts.append(f"-n {args.parallel}")
    
    common_opts.append(f"--browser={args.browser}")
    
    # Define test suites
    test_suites = {
        'english': 'tests/test_contacts_english.py',
        'hebrew': 'tests/test_contacts_hebrew.py', 
        'accessibility': 'tests/test_contacts_accessibility.py',
        'performance': 'tests/test_contacts_performance.py',
        'cross-browser': 'tests/test_contacts_cross_browser.py',
        'edge-cases': 'tests/test_contacts_edge_cases.py',
        'smoke': 'tests/test_contacts_english.py::TestContactsEnglish::test_contacts_page_loads tests/test_contacts_english.py::TestContactsEnglish::test_add_contact_button_click tests/test_contacts_english.py::TestContactsEnglish::test_search_functionality_with_valid_query',
        'all': 'tests/test_contacts_*.py'
    }
    
    success = True
    
    if args.suite == 'all':
        # Run all test suites in order
        suite_order = ['english', 'hebrew', 'accessibility', 'performance', 'cross-browser', 'edge-cases']
        
        for suite_name in suite_order:
            test_path = test_suites[suite_name]
            cmd = f"{base_cmd} {' '.join(common_opts)} {test_path}"
            
            if not run_command(cmd, f"Contacts {suite_name.title()} Tests"):
                success = False
                if input("\nContinue with remaining test suites? (y/n): ").lower() != 'y':
                    break
    else:
        # Run specific test suite
        test_path = test_suites[args.suite]
        cmd = f"{base_cmd} {' '.join(common_opts)} {test_path}"
        success = run_command(cmd, f"Contacts {args.suite.title()} Tests")
    
    # Print summary
    print(f"\n{'='*60}")
    if success:
        print("🎉 All requested tests completed successfully!")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
    print(f"{'='*60}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())