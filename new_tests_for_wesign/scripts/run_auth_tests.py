#!/usr/bin/env python3
"""
Authentication Tests Runner

This script runs all authentication-related tests for the WeSign platform.
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


def run_auth_tests(environment='dev', verbose=False, html_report=False):
    """
    Run authentication tests for the specified environment

    Args:
        environment: Target environment (dev, staging, production, local)
        verbose: Enable verbose output
        html_report: Generate HTML test report

    Returns:
        bool: True if all tests passed, False otherwise
    """
    print(f"Running WeSign Authentication Tests - Environment: {environment}")
    print("=" * 60)

    # Set the environment
    set_environment(environment)
    config = get_config()

    # Verify environment configuration
    print(f"Target URL: {config.base_url}")
    print(f"Test User: {config.company_user.email}")
    print(f"Browser Mode: {'Headless' if config.browser_settings.headless else 'GUI'}")
    print()

    # Build pytest command
    test_path = Path(__file__).parent.parent / "tests" / "auth"
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "--tb=short",
        f"--timeout={config.timeouts.default // 1000}",
    ]

    if verbose:
        cmd.extend(["-v", "-s"])
    else:
        cmd.append("-q")

    if html_report:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = Path(__file__).parent.parent / "reports" / f"auth_tests_{environment}_{timestamp}.html"
        report_path.parent.mkdir(exist_ok=True)
        cmd.extend(["--html", str(report_path), "--self-contained-html"])
        print(f"HTML report will be saved to: {report_path}")

    # Add environment variable
    env = {"WESIGN_TEST_ENV": environment}

    print(f"Executing: {' '.join(cmd)}")
    print("Starting authentication tests...")
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
            print("[SUCCESS] All authentication tests passed!")
            return True
        else:
            print(f"[FAILED] Some authentication tests failed (exit code: {result.returncode})")
            if not verbose and result.stdout:
                print("Test output:")
                print(result.stdout)
            if result.stderr:
                print("Error output:")
                print(result.stderr)
            return False

    except Exception as e:
        print(f"[ERROR] Failed to run authentication tests: {str(e)}")
        return False


def run_specific_auth_test(test_name, environment='dev', verbose=True):
    """
    Run a specific authentication test

    Args:
        test_name: Name of the test to run
        environment: Target environment
        verbose: Enable verbose output

    Returns:
        bool: True if test passed, False otherwise
    """
    print(f"Running specific authentication test: {test_name}")
    print(f"Environment: {environment}")
    print("-" * 40)

    set_environment(environment)

    test_path = Path(__file__).parent.parent / "tests" / "auth"
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "-k", test_name,
        "-v" if verbose else "-q",
        "--tb=short"
    ]

    env = {"WESIGN_TEST_ENV": environment}

    try:
        result = subprocess.run(
            cmd,
            env={**dict(subprocess.os.environ), **env},
            text=True
        )

        return result.returncode == 0

    except Exception as e:
        print(f"[ERROR] Failed to run test {test_name}: {str(e)}")
        return False


def list_auth_tests():
    """List all available authentication tests"""
    print("Available Authentication Tests:")
    print("-" * 40)

    test_path = Path(__file__).parent.parent / "tests" / "auth"

    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "--collect-only", "-q"
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            test_count = 0
            for line in lines:
                if '::test_' in line:
                    test_name = line.split('::')[-1]
                    if test_name.startswith('test_'):
                        print(f"  - {test_name}")
                        test_count += 1

            print(f"\nTotal: {test_count} authentication tests found")
        else:
            print("[ERROR] Failed to collect test information")

    except Exception as e:
        print(f"[ERROR] Failed to list tests: {str(e)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign authentication tests")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--html", action="store_true",
                       help="Generate HTML test report")
    parser.add_argument("--test", "-t", metavar="TEST_NAME",
                       help="Run specific test by name")
    parser.add_argument("--list", "-l", action="store_true",
                       help="List all available tests")

    args = parser.parse_args()

    if args.list:
        list_auth_tests()
        sys.exit(0)

    if args.test:
        success = run_specific_auth_test(args.test, args.env, args.verbose)
    else:
        success = run_auth_tests(args.env, args.verbose, args.html)

    sys.exit(0 if success else 1)