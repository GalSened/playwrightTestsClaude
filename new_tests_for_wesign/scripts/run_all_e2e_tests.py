#!/usr/bin/env python3
"""
Complete E2E Test Suite Runner

This script runs all end-to-end tests for the WeSign platform,
organized by test categories with comprehensive reporting.
"""

import sys
import subprocess
import json
import time
import concurrent.futures
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment, validate_environment


class E2ETestRunner:
    """Comprehensive E2E test runner for WeSign platform"""

    def __init__(self, environment='dev'):
        """Initialize the test runner"""
        self.environment = environment
        set_environment(environment)
        self.config = get_config()
        self.base_path = Path(__file__).parent.parent
        self.reports_path = self.base_path / "reports"
        self.reports_path.mkdir(exist_ok=True)

        # Test categories and their corresponding directories
        self.test_categories = {
            'auth': 'Authentication Tests',
            'documents': 'Document Management Tests',
            'templates': 'Template Management Tests',
            'contacts': 'Contact Management Tests',
            'self_signing': 'Self-Signing Tests'
        }

    def validate_environment(self) -> bool:
        """Validate the test environment before running tests"""
        print(f"Validating environment: {self.environment}")
        print("-" * 40)

        validation_result = validate_environment(self.environment)

        if validation_result['valid']:
            print("[OK] Environment configuration is valid")

            if validation_result['warnings']:
                print("[WARN] Warnings found:")
                for warning in validation_result['warnings']:
                    print(f"  - {warning}")

            return True
        else:
            print("[ERROR] Environment validation failed:")
            for error in validation_result['errors']:
                print(f"  - {error}")
            return False

    def check_prerequisites(self) -> bool:
        """Check test prerequisites"""
        print("Checking test prerequisites...")
        print("-" * 40)

        prerequisites_ok = True

        # Check test files
        test_files_path = self.base_path / self.config.test_files_path
        if not test_files_path.exists():
            print(f"[ERROR] Test files directory not found: {test_files_path}")
            prerequisites_ok = False
        else:
            files = list(test_files_path.glob('*'))
            print(f"[OK] Test files directory found with {len(files)} files")

        # Check pytest installation
        try:
            result = subprocess.run([sys.executable, "-m", "pytest", "--version"],
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print(f"[OK] Pytest available: {result.stdout.strip()}")
            else:
                print("[ERROR] Pytest not available")
                prerequisites_ok = False
        except Exception as e:
            print(f"[ERROR] Failed to check pytest: {e}")
            prerequisites_ok = False

        # Check playwright installation
        try:
            result = subprocess.run([sys.executable, "-c", "import playwright; print('Playwright installed')"],
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print("[OK] Playwright is installed")
            else:
                print("[ERROR] Playwright not available")
                prerequisites_ok = False
        except Exception as e:
            print(f"[ERROR] Failed to check playwright: {e}")
            prerequisites_ok = False

        return prerequisites_ok

    def run_category_tests(self, category: str, verbose: bool = False) -> Tuple[bool, Dict]:
        """
        Run tests for a specific category

        Args:
            category: Test category name
            verbose: Enable verbose output

        Returns:
            Tuple of (success, results_dict)
        """
        print(f"\nRunning {self.test_categories[category]}...")
        print("=" * 50)

        test_path = self.base_path / "tests" / category
        if not test_path.exists():
            print(f"[SKIP] Test directory not found: {test_path}")
            return True, {"status": "skipped", "reason": "directory not found"}

        # Build pytest command
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.reports_path / f"{category}_tests_{self.environment}_{timestamp}.html"

        cmd = [
            sys.executable, "-m", "pytest",
            str(test_path),
            "--tb=short",
            "--html", str(report_file),
            "--self-contained-html",
            f"--timeout={self.config.timeouts.default // 1000}",
        ]

        if verbose:
            cmd.extend(["-v", "-s"])
        else:
            cmd.append("-q")

        # Set environment variables
        env = {
            **dict(subprocess.os.environ),
            "WESIGN_TEST_ENV": self.environment
        }

        start_time = time.time()

        try:
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=not verbose,
                text=True
            )

            end_time = time.time()
            duration = end_time - start_time

            results = {
                "status": "passed" if result.returncode == 0 else "failed",
                "duration": duration,
                "exit_code": result.returncode,
                "report_file": str(report_file),
                "output": result.stdout if not verbose else None,
                "errors": result.stderr if result.stderr else None
            }

            if result.returncode == 0:
                print(f"[SUCCESS] {category} tests passed ({duration:.2f}s)")
            else:
                print(f"[FAILED] {category} tests failed ({duration:.2f}s)")
                if not verbose and result.stdout:
                    print("Output:", result.stdout[-500:])  # Last 500 chars

            return result.returncode == 0, results

        except Exception as e:
            print(f"[ERROR] Failed to run {category} tests: {str(e)}")
            return False, {"status": "error", "error": str(e)}

    def run_all_tests(self, verbose: bool = False, parallel: bool = False) -> Dict:
        """
        Run all E2E tests

        Args:
            verbose: Enable verbose output
            parallel: Run categories in parallel (experimental)

        Returns:
            Dict with comprehensive test results
        """
        print(f"WeSign E2E Test Suite - Environment: {self.environment}")
        print("=" * 60)

        # Environment validation
        if not self.validate_environment():
            return {"status": "failed", "reason": "environment validation failed"}

        # Prerequisites check
        if not self.check_prerequisites():
            return {"status": "failed", "reason": "prerequisites check failed"}

        print(f"\nTarget URL: {self.config.base_url}")
        print(f"Test User: {self.config.company_user.email}")
        print(f"Browser Mode: {'Headless' if self.config.browser_settings.headless else 'GUI'}")
        print(f"Parallel Execution: {'Enabled' if parallel else 'Disabled'}")

        overall_start_time = time.time()
        results = {
            "environment": self.environment,
            "start_time": datetime.now().isoformat(),
            "categories": {},
            "summary": {}
        }

        if parallel:
            # Run categories in parallel (experimental)
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_to_category = {
                    executor.submit(self.run_category_tests, category, verbose): category
                    for category in self.test_categories.keys()
                }

                for future in concurrent.futures.as_completed(future_to_category):
                    category = future_to_category[future]
                    try:
                        success, category_results = future.result()
                        results["categories"][category] = category_results
                    except Exception as e:
                        results["categories"][category] = {"status": "error", "error": str(e)}
        else:
            # Run categories sequentially
            for category in self.test_categories.keys():
                success, category_results = self.run_category_tests(category, verbose)
                results["categories"][category] = category_results

        overall_end_time = time.time()
        overall_duration = overall_end_time - overall_start_time

        # Generate summary
        passed = sum(1 for r in results["categories"].values() if r.get("status") == "passed")
        failed = sum(1 for r in results["categories"].values() if r.get("status") == "failed")
        skipped = sum(1 for r in results["categories"].values() if r.get("status") == "skipped")
        errors = sum(1 for r in results["categories"].values() if r.get("status") == "error")

        results["summary"] = {
            "total_categories": len(self.test_categories),
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "errors": errors,
            "overall_duration": overall_duration,
            "success_rate": (passed / len(self.test_categories)) * 100 if self.test_categories else 0
        }

        results["end_time"] = datetime.now().isoformat()

        # Print summary
        print("\n" + "=" * 60)
        print("TEST EXECUTION SUMMARY")
        print("=" * 60)
        print(f"Environment: {self.environment}")
        print(f"Total Duration: {overall_duration:.2f} seconds")
        print(f"Categories Passed: {passed}/{len(self.test_categories)}")
        print(f"Success Rate: {results['summary']['success_rate']:.1f}%")

        if failed > 0:
            print(f"\nFailed Categories:")
            for category, result in results["categories"].items():
                if result.get("status") == "failed":
                    print(f"  - {category}: {result.get('exit_code', 'unknown error')}")

        if errors > 0:
            print(f"\nCategories with Errors:")
            for category, result in results["categories"].items():
                if result.get("status") == "error":
                    print(f"  - {category}: {result.get('error', 'unknown error')}")

        # Save summary report
        summary_file = self.reports_path / f"e2e_summary_{self.environment}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        print(f"\nDetailed results saved to: {summary_file}")

        overall_success = failed == 0 and errors == 0
        print(f"\n[{'SUCCESS' if overall_success else 'FAILED'}] E2E Test Suite {'Completed Successfully' if overall_success else 'Failed'}")

        return results

    def run_smoke_tests(self) -> bool:
        """Run a minimal smoke test suite for quick validation"""
        print("Running WeSign Smoke Tests...")
        print("=" * 40)

        # Just run one test from each core category
        smoke_tests = [
            "tests/auth/test_authentication_core_fixed.py::TestAuthenticationFixed::test_login_with_valid_company_credentials_success",
            "tests/documents/test_documents_core_fixed.py::TestDocumentsCoreFixed::test_navigate_to_documents_page_success"
        ]

        cmd = [
            sys.executable, "-m", "pytest",
            *smoke_tests,
            "-v", "--tb=short"
        ]

        env = {"WESIGN_TEST_ENV": self.environment}

        try:
            result = subprocess.run(
                cmd,
                env={**dict(subprocess.os.environ), **env},
                text=True
            )

            if result.returncode == 0:
                print("[SUCCESS] Smoke tests passed!")
                return True
            else:
                print("[FAILED] Smoke tests failed!")
                return False

        except Exception as e:
            print(f"[ERROR] Failed to run smoke tests: {str(e)}")
            return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign E2E test suite")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--parallel", action="store_true",
                       help="Run test categories in parallel (experimental)")
    parser.add_argument("--smoke", action="store_true",
                       help="Run smoke tests only")
    parser.add_argument("--category", "-c",
                       choices=["auth", "documents", "templates", "contacts", "self_signing"],
                       help="Run tests for specific category only")

    args = parser.parse_args()

    runner = E2ETestRunner(args.env)

    if args.smoke:
        success = runner.run_smoke_tests()
        sys.exit(0 if success else 1)

    if args.category:
        success, results = runner.run_category_tests(args.category, args.verbose)
        sys.exit(0 if success else 1)

    # Run all tests
    results = runner.run_all_tests(args.verbose, args.parallel)
    overall_success = results.get("summary", {}).get("failed", 1) == 0

    sys.exit(0 if overall_success else 1)