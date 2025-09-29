#!/usr/bin/env python3
"""
Comprehensive Test Suite Runner

This script orchestrates and runs all types of tests for the WeSign platform:
- E2E Tests (Playwright)
- API Tests (Newman/Python requests)
- Load Tests (K6)

Provides unified reporting and execution management.
"""

import sys
import subprocess
import json
import time
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment, validate_environment


class ComprehensiveTestRunner:
    """Comprehensive test runner for all WeSign test types"""

    def __init__(self, environment='dev'):
        """Initialize the comprehensive test runner"""
        self.environment = environment
        set_environment(environment)
        self.config = get_config()
        self.base_path = Path(__file__).parent.parent
        self.scripts_path = self.base_path / "scripts"
        self.reports_path = self.base_path / "reports"
        self.reports_path.mkdir(exist_ok=True)

        # Test suite configuration
        self.test_suites = {
            'e2e': {
                'name': 'End-to-End Tests',
                'script': 'run_all_e2e_tests.py',
                'description': 'Browser-based functional tests',
                'estimated_duration': '15-30 minutes',
                'priority': 'high'
            },
            'api': {
                'name': 'API Tests',
                'script': 'run_newman_tests.py',
                'fallback_script': 'run_api_tests_python.py',
                'description': 'REST API endpoint tests',
                'estimated_duration': '5-10 minutes',
                'priority': 'high'
            },
            'load': {
                'name': 'Load Tests',
                'script': 'run_load_tests.py',
                'description': 'Performance and load testing',
                'estimated_duration': '10-20 minutes',
                'priority': 'medium'
            }
        }

        # Execution results storage
        self.execution_results = {}

    def validate_environment_setup(self) -> bool:
        """Validate environment configuration and prerequisites"""
        print("Validating Environment Setup")
        print("=" * 40)

        # Validate environment configuration
        validation_result = validate_environment(self.environment)
        if not validation_result['valid']:
            print(f"[ERROR] Environment validation failed:")
            for error in validation_result['errors']:
                print(f"  - {error}")
            return False
        else:
            print(f"[OK] Environment '{self.environment}' configuration is valid")

        # Check test scripts
        missing_scripts = []
        for suite_name, suite_config in self.test_suites.items():
            script_path = self.scripts_path / suite_config['script']
            if script_path.exists():
                print(f"[OK] {suite_config['name']} script found")
            else:
                print(f"[MISSING] {suite_config['name']} script: {script_path}")
                missing_scripts.append(suite_name)

        # Check Python dependencies
        try:
            import playwright
            print("[OK] Playwright available")
        except ImportError:
            print("[WARNING] Playwright not available - E2E tests will fail")

        try:
            import requests
            print("[OK] Requests library available")
        except ImportError:
            print("[WARNING] Requests library not available - API fallback tests will fail")

        # Check external tools
        external_tools = [
            ('newman', 'Newman (Postman CLI)'),
            ('k6', 'K6 Load Testing'),
            ('python', 'Python')
        ]

        for tool, description in external_tools:
            try:
                result = subprocess.run([tool, '--version'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    print(f"[OK] {description} available")
                else:
                    print(f"[WARNING] {description} not working properly")
            except (FileNotFoundError, subprocess.TimeoutExpired):
                print(f"[WARNING] {description} not found")

        return len(missing_scripts) == 0

    def run_test_suite(self,
                      suite_name: str,
                      args: Optional[List[str]] = None,
                      timeout: Optional[int] = None) -> Dict:
        """
        Run a specific test suite

        Args:
            suite_name: Name of the test suite (e2e, api, load)
            args: Additional arguments to pass to the test script
            timeout: Timeout in seconds

        Returns:
            Dict with execution results
        """
        if suite_name not in self.test_suites:
            raise ValueError(f"Invalid test suite: {suite_name}")

        suite_config = self.test_suites[suite_name]
        script_name = suite_config['script']
        script_path = self.scripts_path / script_name

        print(f"\nRunning {suite_config['name']}")
        print("=" * 50)
        print(f"Script: {script_name}")
        print(f"Estimated Duration: {suite_config['estimated_duration']}")
        print(f"Priority: {suite_config['priority']}")
        print()

        # Check if primary script exists
        if not script_path.exists():
            # Try fallback script if available
            if 'fallback_script' in suite_config:
                fallback_script = suite_config['fallback_script']
                fallback_path = self.scripts_path / fallback_script
                if fallback_path.exists():
                    print(f"[INFO] Using fallback script: {fallback_script}")
                    script_path = fallback_path
                    script_name = fallback_script
                else:
                    return {
                        "suite": suite_name,
                        "success": False,
                        "error": f"Neither primary nor fallback script found",
                        "start_time": datetime.now().isoformat()
                    }
            else:
                return {
                    "suite": suite_name,
                    "success": False,
                    "error": f"Test script not found: {script_path}",
                    "start_time": datetime.now().isoformat()
                }

        # Build command
        cmd = [sys.executable, str(script_path), '--env', self.environment]
        if args:
            cmd.extend(args)

        start_time = time.time()
        result_data = {
            "suite": suite_name,
            "script": script_name,
            "environment": self.environment,
            "start_time": datetime.fromtimestamp(start_time).isoformat(),
            "command": ' '.join(cmd)
        }

        try:
            # Run the test script
            result = subprocess.run(
                cmd,
                cwd=self.base_path,
                capture_output=True,
                text=True,
                timeout=timeout or 3600  # Default 1 hour timeout
            )

            end_time = time.time()
            duration = end_time - start_time

            result_data.update({
                "end_time": datetime.fromtimestamp(end_time).isoformat(),
                "duration": duration,
                "exit_code": result.returncode,
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr
            })

            if result.returncode == 0:
                print(f"[SUCCESS] {suite_config['name']} completed successfully ({duration:.2f}s)")
            else:
                print(f"[FAILED] {suite_config['name']} failed (exit code: {result.returncode}, {duration:.2f}s)")
                if result.stderr:
                    print("Error output:")
                    print(result.stderr[-500:])  # Last 500 chars

            return result_data

        except subprocess.TimeoutExpired:
            print(f"[TIMEOUT] {suite_config['name']} timed out")
            return {
                **result_data,
                "success": False,
                "error": "timeout",
                "end_time": datetime.now().isoformat(),
                "duration": time.time() - start_time
            }

        except Exception as e:
            print(f"[ERROR] Failed to run {suite_config['name']}: {str(e)}")
            return {
                **result_data,
                "success": False,
                "error": str(e),
                "end_time": datetime.now().isoformat(),
                "duration": time.time() - start_time
            }

    def run_smoke_tests(self, include_suites: Optional[List[str]] = None) -> Dict:
        """Run smoke tests across all or specified test suites"""
        print("Running Comprehensive Smoke Tests")
        print("=" * 60)

        suites_to_run = include_suites or ['e2e', 'api']  # Skip load tests in smoke mode
        results = {
            "test_type": "smoke",
            "environment": self.environment,
            "start_time": datetime.now().isoformat(),
            "suites": {},
            "summary": {}
        }

        # Smoke test arguments for each suite
        smoke_args = {
            'e2e': ['--smoke'],
            'api': [],  # API tests are generally quick
            'load': ['--smoke']  # If load tests are included
        }

        passed = 0
        total = len(suites_to_run)

        for suite_name in suites_to_run:
            if suite_name in self.test_suites:
                args = smoke_args.get(suite_name, [])
                result = self.run_test_suite(suite_name, args, timeout=600)  # 10 minute timeout for smoke
                results["suites"][suite_name] = result
                if result.get("success"):
                    passed += 1

        results["summary"] = {
            "total_suites": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": (passed / total) * 100 if total > 0 else 0
        }

        results["end_time"] = datetime.now().isoformat()

        return results

    def run_full_test_suite(self,
                           include_suites: Optional[List[str]] = None,
                           parallel: bool = False) -> Dict:
        """
        Run the complete test suite

        Args:
            include_suites: List of suites to run (default: all)
            parallel: Run suites in parallel (experimental)

        Returns:
            Dict with comprehensive results
        """
        print("WeSign Comprehensive Test Suite")
        print("=" * 60)

        # Validate environment
        if not self.validate_environment_setup():
            return {
                "success": False,
                "error": "Environment validation failed",
                "start_time": datetime.now().isoformat()
            }

        suites_to_run = include_suites or list(self.test_suites.keys())
        start_time = time.time()

        results = {
            "test_type": "full",
            "environment": self.environment,
            "start_time": datetime.fromtimestamp(start_time).isoformat(),
            "suites": {},
            "configuration": {
                "base_url": self.config.base_url,
                "test_user": self.config.company_user.email,
                "browser_headless": self.config.browser_settings.headless,
                "parallel_execution": parallel
            }
        }

        print(f"Environment: {self.environment}")
        print(f"Base URL: {self.config.base_url}")
        print(f"Test User: {self.config.company_user.email}")
        print(f"Parallel Execution: {'Enabled' if parallel else 'Disabled'}")
        print(f"Suites to run: {', '.join(suites_to_run)}")
        print()

        if parallel:
            # Run suites in parallel (experimental)
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_to_suite = {
                    executor.submit(self.run_test_suite, suite_name): suite_name
                    for suite_name in suites_to_run if suite_name in self.test_suites
                }

                for future in concurrent.futures.as_completed(future_to_suite):
                    suite_name = future_to_suite[future]
                    try:
                        result = future.result()
                        results["suites"][suite_name] = result
                    except Exception as e:
                        results["suites"][suite_name] = {
                            "suite": suite_name,
                            "success": False,
                            "error": str(e)
                        }
        else:
            # Run suites sequentially
            for suite_name in suites_to_run:
                if suite_name in self.test_suites:
                    result = self.run_test_suite(suite_name)
                    results["suites"][suite_name] = result

        end_time = time.time()
        total_duration = end_time - start_time

        # Generate summary
        passed = sum(1 for r in results["suites"].values() if r.get("success"))
        failed = len(results["suites"]) - passed

        results["summary"] = {
            "total_suites": len(results["suites"]),
            "passed": passed,
            "failed": failed,
            "success_rate": (passed / len(results["suites"])) * 100 if results["suites"] else 0,
            "total_duration": total_duration
        }

        results["end_time"] = datetime.fromtimestamp(end_time).isoformat()

        # Save comprehensive report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.reports_path / f"comprehensive_test_report_{self.environment}_{timestamp}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # Print summary
        print("\n" + "=" * 60)
        print("COMPREHENSIVE TEST SUITE SUMMARY")
        print("=" * 60)
        print(f"Environment: {self.environment}")
        print(f"Total Duration: {total_duration:.2f} seconds ({total_duration/60:.1f} minutes)")
        print(f"Test Suites: {passed}/{len(results['suites'])} passed")
        print(f"Success Rate: {results['summary']['success_rate']:.1f}%")

        if failed > 0:
            print(f"\nFailed Test Suites:")
            for suite_name, result in results["suites"].items():
                if not result.get("success"):
                    error = result.get("error", result.get("exit_code", "unknown"))
                    print(f"  - {suite_name}: {error}")

        print(f"\nDetailed report saved to: {report_file}")

        overall_success = failed == 0
        print(f"\n[{'SUCCESS' if overall_success else 'FAILED'}] Comprehensive Test Suite {'Completed Successfully' if overall_success else 'Failed'}")

        return results

    def generate_test_plan_report(self) -> Dict:
        """Generate a test plan report showing what would be executed"""
        print("WeSign Test Plan Report")
        print("=" * 40)

        plan = {
            "environment": self.environment,
            "configuration": {
                "base_url": self.config.base_url,
                "test_user": self.config.company_user.email,
                "browser_headless": self.config.browser_settings.headless
            },
            "test_suites": []
        }

        total_estimated_time = 0

        for suite_name, suite_config in self.test_suites.items():
            script_path = self.scripts_path / suite_config['script']
            available = script_path.exists()

            suite_plan = {
                "name": suite_config['name'],
                "description": suite_config['description'],
                "estimated_duration": suite_config['estimated_duration'],
                "priority": suite_config['priority'],
                "script": suite_config['script'],
                "available": available
            }

            plan["test_suites"].append(suite_plan)

            print(f"\n{suite_config['name']}:")
            print(f"  Description: {suite_config['description']}")
            print(f"  Estimated Duration: {suite_config['estimated_duration']}")
            print(f"  Priority: {suite_config['priority']}")
            print(f"  Available: {'Yes' if available else 'No'}")

            # Try to extract numeric time estimate for total
            duration_str = suite_config['estimated_duration']
            if 'minutes' in duration_str:
                # Extract average of range (e.g., "15-30 minutes" -> 22.5)
                import re
                matches = re.findall(r'(\d+)', duration_str)
                if len(matches) >= 2:
                    total_estimated_time += (int(matches[0]) + int(matches[1])) / 2
                elif len(matches) == 1:
                    total_estimated_time += int(matches[0])

        plan["estimated_total_duration"] = f"{total_estimated_time:.1f} minutes"

        print(f"\nEstimated Total Duration: {plan['estimated_total_duration']}")

        return plan


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run comprehensive WeSign test suite")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--suites", nargs='+', choices=["e2e", "api", "load"],
                       help="Test suites to run (default: all available)")
    parser.add_argument("--smoke", action="store_true",
                       help="Run smoke tests only")
    parser.add_argument("--parallel", action="store_true",
                       help="Run test suites in parallel (experimental)")
    parser.add_argument("--plan", action="store_true",
                       help="Show test plan without executing")
    parser.add_argument("--validate", action="store_true",
                       help="Validate environment setup only")

    args = parser.parse_args()

    try:
        runner = ComprehensiveTestRunner(args.env)

        if args.plan:
            runner.generate_test_plan_report()
            sys.exit(0)

        if args.validate:
            success = runner.validate_environment_setup()
            sys.exit(0 if success else 1)

        if args.smoke:
            results = runner.run_smoke_tests(args.suites)
            success = results["summary"]["failed"] == 0
        else:
            results = runner.run_full_test_suite(args.suites, args.parallel)
            success = results.get("summary", {}).get("failed", 1) == 0

        sys.exit(0 if success else 1)

    except Exception as e:
        print(f"[ERROR] Comprehensive test runner failed: {str(e)}")
        sys.exit(1)