#!/usr/bin/env python3
"""
Documents Tests Runner

This script runs all document-related tests for the WeSign platform.
Supports different environments and provides detailed reporting.
"""

import sys
import subprocess
import json
import time
from pathlib import Path
from datetime import datetime

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment


def run_documents_tests(environment='dev', verbose=False, html_report=False, test_type='all'):
    """
    Run documents tests for the specified environment

    Args:
        environment: Target environment (dev, staging, production, local)
        verbose: Enable verbose output
        html_report: Generate HTML test report
        test_type: Type of tests to run (all, core, advanced)

    Returns:
        bool: True if all tests passed, False otherwise
    """
    print(f"Running WeSign Documents Tests - Environment: {environment}")
    print(f"Test Type: {test_type}")
    print("=" * 60)

    # Set the environment
    set_environment(environment)
    config = get_config()

    # Verify environment configuration
    print(f"Target URL: {config.base_url}")
    print(f"Test User: {config.company_user.email}")
    print(f"Browser Mode: {'Headless' if config.browser_settings.headless else 'GUI'}")
    print(f"Test Files Path: {config.test_files_path}")
    print()

    # Verify test files exist
    test_files_path = Path(__file__).parent.parent / config.test_files_path
    if not test_files_path.exists():
        print(f"[WARNING] Test files directory not found: {test_files_path}")
    else:
        test_files = list(test_files_path.glob('*'))
        print(f"Available test files: {len(test_files)} files")

    # Build pytest command
    test_path = Path(__file__).parent.parent / "tests" / "documents"

    # Select test files based on type
    if test_type == 'core':
        test_files = [test_path / "test_documents_core_fixed.py"]
    elif test_type == 'advanced':
        test_files = [test_path / "test_documents_advanced.py"]
    else:  # all
        test_files = [str(test_path)]

    cmd = [
        sys.executable, "-m", "pytest",
        *[str(f) for f in test_files],
        "--tb=short",
        f"--timeout={config.timeouts.default // 1000}",
    ]

    if verbose:
        cmd.extend(["-v", "-s"])
    else:
        cmd.append("-q")

    if html_report:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = Path(__file__).parent.parent / "reports" / f"documents_tests_{test_type}_{environment}_{timestamp}.html"
        report_path.parent.mkdir(exist_ok=True)
        cmd.extend(["--html", str(report_path), "--self-contained-html"])
        print(f"HTML report will be saved to: {report_path}")

    # Add environment variable
    env = {"WESIGN_TEST_ENV": environment}

    print(f"Executing: {' '.join(cmd)}")
    print("Starting documents tests...")
    print("-" * 40)

    start_time = time.time()

    try:
        # Run the tests
        result = subprocess.run(
            cmd,
            env={**dict(subprocess.os.environ), **env},
            capture_output=not verbose,
            text=True
        )

        end_time = time.time()
        duration = end_time - start_time

        print("-" * 40)
        print(f"Tests completed in {duration:.2f} seconds")

        if result.returncode == 0:
            print("[SUCCESS] All documents tests passed!")
            return True
        else:
            print(f"[FAILED] Some documents tests failed (exit code: {result.returncode})")
            if not verbose and result.stdout:
                print("Test output:")
                print(result.stdout)
            if result.stderr:
                print("Error output:")
                print(result.stderr)
            return False

    except Exception as e:
        print(f"[ERROR] Failed to run documents tests: {str(e)}")
        return False


def run_upload_performance_test(environment='dev', file_count=5):
    """
    Run document upload performance test

    Args:
        environment: Target environment
        file_count: Number of files to upload concurrently

    Returns:
        bool: True if test passed, False otherwise
    """
    print(f"Running Document Upload Performance Test")
    print(f"Environment: {environment}")
    print(f"Concurrent Files: {file_count}")
    print("-" * 40)

    set_environment(environment)

    test_path = Path(__file__).parent.parent / "tests" / "documents"
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path / "test_documents_advanced.py"),
        "-k", "bulk_upload",
        "-v", "--tb=short"
    ]

    env = {
        "WESIGN_TEST_ENV": environment,
        "BULK_UPLOAD_COUNT": str(file_count)
    }

    try:
        result = subprocess.run(
            cmd,
            env={**dict(subprocess.os.environ), **env},
            text=True
        )

        return result.returncode == 0

    except Exception as e:
        print(f"[ERROR] Failed to run performance test: {str(e)}")
        return False


def check_test_files():
    """Check and report on available test files"""
    print("Checking Test Files:")
    print("-" * 30)

    test_files_path = Path(__file__).parent.parent / "test_files"

    if not test_files_path.exists():
        print(f"[ERROR] Test files directory not found: {test_files_path}")
        return False

    files = list(test_files_path.glob('*'))
    if not files:
        print("[WARNING] No test files found")
        return False

    print(f"Found {len(files)} test files:")
    for file in sorted(files):
        size = file.stat().st_size
        print(f"  - {file.name} ({size} bytes)")

    # Check for required file types
    required_types = ['.pdf', '.txt', '.docx', '.png', '.jpg']
    available_types = set(file.suffix.lower() for file in files)

    print(f"\nAvailable file types: {', '.join(sorted(available_types))}")

    missing_types = [ext for ext in required_types if ext not in available_types]
    if missing_types:
        print(f"[WARNING] Missing file types: {', '.join(missing_types)}")

    return True


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign documents tests")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--html", action="store_true",
                       help="Generate HTML test report")
    parser.add_argument("--type", default="all", choices=["all", "core", "advanced"],
                       help="Type of tests to run (default: all)")
    parser.add_argument("--performance", action="store_true",
                       help="Run performance tests")
    parser.add_argument("--check-files", action="store_true",
                       help="Check available test files")

    args = parser.parse_args()

    if args.check_files:
        check_test_files()
        sys.exit(0)

    if args.performance:
        success = run_upload_performance_test(args.env)
    else:
        success = run_documents_tests(args.env, args.verbose, args.html, args.type)

    sys.exit(0 if success else 1)