#!/usr/bin/env python3
"""
Load Testing Runner using K6

This script runs performance and load tests using K6 for the WeSign platform.
Supports different test scenarios and environments with comprehensive reporting.
"""

import sys
import subprocess
import json
import time
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment


class WeSignLoadTestRunner:
    """Load test runner for WeSign platform using K6"""

    def __init__(self, environment='dev'):
        """Initialize the load test runner"""
        self.environment = environment
        set_environment(environment)
        self.config = get_config()
        self.base_path = Path(__file__).parent.parent
        self.load_testing_path = self.base_path / "loadTesting"
        self.reports_path = self.base_path / "reports" / "load"
        self.reports_path.mkdir(parents=True, exist_ok=True)

        # Test scenarios configuration
        self.test_scenarios = {
            'smoke': {
                'basic': 'scenarios/smoke/smoke-basic.js',
                'auth': 'scenarios/smoke/smoke-auth.js'
            },
            'load': {
                'user-journey': 'scenarios/load/load-user-journey.js',
                'documents': 'scenarios/load/load-documents.js'
            },
            'stress': {
                'auth': 'scenarios/stress/stress-auth.js'
            },
            'spike': {
                'login': 'scenarios/spike/spike-login.js',
                'documents': 'scenarios/spike/spike-documents.js'
            },
            'soak': {
                'endurance': 'scenarios/soak/soak-endurance.js'
            },
            'volume': {
                'breakpoint': 'scenarios/volume/breakpoint-analysis.js'
            }
        }

        # Check if K6 is available
        if not self._check_k6():
            raise RuntimeError("K6 is not installed or not accessible. Please install K6 from https://k6.io/docs/getting-started/installation/")

    def _check_k6(self) -> bool:
        """Check if K6 CLI is available"""
        try:
            result = subprocess.run(['k6', 'version'], capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _get_k6_executable(self) -> str:
        """Get K6 executable path"""
        if shutil.which('k6'):
            return 'k6'

        # Try common installation paths
        possible_paths = [
            # Windows paths
            r"C:\Program Files\k6\k6.exe",
            r"C:\k6\k6.exe",
            # Linux/Mac paths
            "/usr/local/bin/k6",
            "/usr/bin/k6"
        ]

        for path in possible_paths:
            if Path(path).exists():
                return path

        return 'k6'  # Fallback to default

    def _prepare_environment_config(self) -> Dict:
        """Prepare environment configuration for K6"""
        return {
            'BASE_URL': self.config.base_url,
            'LOGIN_EMAIL': self.config.company_user.email,
            'LOGIN_PASSWORD': self.config.company_user.password,
            'ENVIRONMENT': self.environment,
            'DEFAULT_TIMEOUT': str(self.config.timeouts.default),
            'UPLOAD_TIMEOUT': str(self.config.timeouts.upload)
        }

    def run_scenario(self,
                    category: str,
                    scenario: str,
                    duration: Optional[str] = None,
                    virtual_users: Optional[int] = None,
                    verbose: bool = False) -> Dict:
        """
        Run a specific load test scenario

        Args:
            category: Test category (smoke, load, stress, spike, soak, volume)
            scenario: Scenario name within the category
            duration: Test duration (e.g., '30s', '5m')
            virtual_users: Number of virtual users
            verbose: Enable verbose output

        Returns:
            Dict with test results
        """
        if category not in self.test_scenarios:
            raise ValueError(f"Invalid category: {category}. Available: {list(self.test_scenarios.keys())}")

        if scenario not in self.test_scenarios[category]:
            raise ValueError(f"Invalid scenario: {scenario}. Available for {category}: {list(self.test_scenarios[category].keys())}")

        script_path = self.load_testing_path / self.test_scenarios[category][scenario]
        if not script_path.exists():
            raise FileNotFoundError(f"Test script not found: {script_path}")

        print(f"Running Load Test: {category}/{scenario}")
        print("=" * 50)

        # Prepare K6 command
        k6_cmd = self._get_k6_executable()
        cmd = [k6_cmd, 'run']

        # Add environment variables
        env_config = self._prepare_environment_config()

        # Add K6 options
        if virtual_users:
            cmd.extend(['--vus', str(virtual_users)])

        if duration:
            cmd.extend(['--duration', duration])

        # Add environment variable options
        for key, value in env_config.items():
            cmd.extend(['--env', f'{key}={value}'])

        # Add output options
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_output = self.reports_path / f"k6_{category}_{scenario}_{self.environment}_{timestamp}.json"
        cmd.extend(['--out', f'json={json_output}'])

        # Add the script
        cmd.append(str(script_path))

        print(f"Script: {script_path.name}")
        print(f"Environment: {self.environment}")
        print(f"Base URL: {env_config['BASE_URL']}")
        if virtual_users:
            print(f"Virtual Users: {virtual_users}")
        if duration:
            print(f"Duration: {duration}")
        print(f"JSON Output: {json_output}")
        print()

        print("Starting K6 load test...")
        print("-" * 40)

        start_time = time.time()

        try:
            # Run K6
            result = subprocess.run(
                cmd,
                cwd=self.load_testing_path,
                capture_output=not verbose,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            end_time = time.time()
            execution_duration = end_time - start_time

            print("-" * 40)
            print(f"Load test completed in {execution_duration:.2f} seconds")

            # Parse results
            test_results = {
                "category": category,
                "scenario": scenario,
                "environment": self.environment,
                "start_time": datetime.fromtimestamp(start_time).isoformat(),
                "end_time": datetime.fromtimestamp(end_time).isoformat(),
                "execution_duration": execution_duration,
                "exit_code": result.returncode,
                "success": result.returncode == 0,
                "json_output_file": str(json_output),
                "stdout": result.stdout if not verbose else None,
                "stderr": result.stderr if result.stderr else None
            }

            # Try to parse K6 JSON output for summary
            if json_output.exists():
                try:
                    # K6 outputs NDJSON (newline-delimited JSON), so we need to parse the last line
                    with open(json_output, 'r', encoding='utf-8') as f:
                        lines = f.readlines()

                    # Find the summary line (usually the last line with "type": "Point" and metric data)
                    for line in reversed(lines):
                        try:
                            data = json.loads(line.strip())
                            if data.get('type') == 'Point' and 'metric' in data:
                                # This is basic - K6 JSON format is complex
                                # For detailed analysis, would need more sophisticated parsing
                                break
                        except:
                            continue

                    # For now, just indicate we have the raw data
                    test_results["json_data_available"] = True
                    test_results["total_data_points"] = len(lines)

                except Exception as e:
                    print(f"[WARNING] Could not parse K6 JSON output: {e}")

            if result.returncode == 0:
                print("[SUCCESS] Load test completed successfully!")
            else:
                print(f"[FAILED] Load test failed (exit code: {result.returncode})")
                if not verbose and result.stdout:
                    print("K6 Output:")
                    print(result.stdout[-1000:])  # Last 1000 chars

            return test_results

        except subprocess.TimeoutExpired:
            print("[ERROR] Load test timed out after 1 hour")
            return {"success": False, "error": "timeout", "category": category, "scenario": scenario}

        except Exception as e:
            print(f"[ERROR] Failed to run load test: {str(e)}")
            return {"success": False, "error": str(e), "category": category, "scenario": scenario}

    def run_smoke_tests(self, verbose: bool = False) -> Dict:
        """Run smoke tests for quick validation"""
        print("Running WeSign Load Testing Smoke Tests")
        print("=" * 50)

        smoke_scenarios = [
            ('smoke', 'basic'),
            ('smoke', 'auth')
        ]

        results = {
            "test_type": "smoke",
            "environment": self.environment,
            "start_time": datetime.now().isoformat(),
            "scenarios": {},
            "summary": {}
        }

        passed = 0
        total = len(smoke_scenarios)

        for category, scenario in smoke_scenarios:
            print(f"\n--- Running {category}/{scenario} ---")
            try:
                result = self.run_scenario(
                    category=category,
                    scenario=scenario,
                    duration='30s',  # Short duration for smoke tests
                    virtual_users=1,  # Single user for smoke tests
                    verbose=verbose
                )
                results["scenarios"][f"{category}_{scenario}"] = result
                if result.get("success"):
                    passed += 1
            except Exception as e:
                print(f"[ERROR] Smoke test {category}/{scenario} failed: {e}")
                results["scenarios"][f"{category}_{scenario}"] = {"success": False, "error": str(e)}

        results["summary"] = {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": (passed / total) * 100
        }

        results["end_time"] = datetime.now().isoformat()

        print(f"\n--- Smoke Test Summary ---")
        print(f"Passed: {passed}/{total}")
        print(f"Success Rate: {results['summary']['success_rate']:.1f}%")

        return results

    def list_available_scenarios(self) -> None:
        """List all available test scenarios"""
        print("Available Load Test Scenarios:")
        print("=" * 40)

        for category, scenarios in self.test_scenarios.items():
            print(f"\n{category.upper()}:")
            for scenario, script_path in scenarios.items():
                script_full_path = self.load_testing_path / script_path
                status = "✓" if script_full_path.exists() else "✗"
                print(f"  {status} {scenario}")

    def validate_k6_setup(self) -> bool:
        """Validate K6 setup and test scripts"""
        print("Validating K6 Load Testing Setup")
        print("=" * 40)

        # Check K6
        try:
            k6_cmd = self._get_k6_executable()
            result = subprocess.run([k6_cmd, 'version'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print(f"[OK] K6 found: {result.stdout.strip()}")
            else:
                print("[ERROR] K6 not working properly")
                return False
        except Exception as e:
            print(f"[ERROR] K6 check failed: {e}")
            return False

        # Check load testing directory
        if self.load_testing_path.exists():
            print(f"[OK] Load testing directory found: {self.load_testing_path}")
        else:
            print(f"[ERROR] Load testing directory not found: {self.load_testing_path}")
            return False

        # Check test scripts
        total_scripts = 0
        missing_scripts = 0

        for category, scenarios in self.test_scenarios.items():
            for scenario, script_path in scenarios.items():
                total_scripts += 1
                script_full_path = self.load_testing_path / script_path
                if script_full_path.exists():
                    print(f"[OK] {category}/{scenario}")
                else:
                    print(f"[MISSING] {category}/{scenario} - {script_path}")
                    missing_scripts += 1

        print(f"\nScript Status: {total_scripts - missing_scripts}/{total_scripts} available")

        if missing_scripts == 0:
            print("\n[SUCCESS] K6 load testing setup validation completed")
            return True
        else:
            print(f"\n[WARNING] {missing_scripts} test scripts are missing")
            return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign load tests using K6")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--category", "-c",
                       choices=["smoke", "load", "stress", "spike", "soak", "volume"],
                       help="Test category")
    parser.add_argument("--scenario", "-s",
                       help="Specific scenario within category")
    parser.add_argument("--duration", "-d",
                       help="Test duration (e.g., '30s', '5m', '1h')")
    parser.add_argument("--vus", type=int,
                       help="Number of virtual users")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--smoke", action="store_true",
                       help="Run smoke tests")
    parser.add_argument("--list", action="store_true",
                       help="List available scenarios")
    parser.add_argument("--validate", action="store_true",
                       help="Validate K6 setup")

    args = parser.parse_args()

    try:
        runner = WeSignLoadTestRunner(args.env)

        if args.list:
            runner.list_available_scenarios()
            sys.exit(0)

        if args.validate:
            success = runner.validate_k6_setup()
            sys.exit(0 if success else 1)

        if args.smoke:
            results = runner.run_smoke_tests(args.verbose)
            success = results["summary"]["passed"] == results["summary"]["total"]
            sys.exit(0 if success else 1)

        if args.category and args.scenario:
            result = runner.run_scenario(
                category=args.category,
                scenario=args.scenario,
                duration=args.duration,
                virtual_users=args.vus,
                verbose=args.verbose
            )
            sys.exit(0 if result.get("success") else 1)

        # Default: show help
        parser.print_help()

    except Exception as e:
        print(f"[ERROR] Load test runner failed: {str(e)}")
        sys.exit(1)