#!/usr/bin/env python3
"""
API Tests Runner using Newman

This script runs API tests using Newman (Postman CLI) for the WeSign platform.
Supports different environments and provides comprehensive reporting.
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


class WeSignAPITestRunner:
    """API test runner for WeSign platform using Newman"""

    def __init__(self, environment='dev'):
        """Initialize the API test runner"""
        self.environment = environment
        set_environment(environment)
        self.config = get_config()
        self.base_path = Path(__file__).parent.parent
        self.api_tests_path = self.base_path / "api_tests"
        self.reports_path = self.base_path / "reports" / "api"
        self.reports_path.mkdir(parents=True, exist_ok=True)

        # Check if Newman is available
        if not self._check_newman():
            raise RuntimeError("Newman is not installed. Please install Newman CLI: npm install -g newman")

    def _check_newman(self) -> bool:
        """Check if Newman CLI is available"""
        try:
            result = subprocess.run(['newman', '--version'], capture_output=True, text=True)
            return result.returncode == 0
        except FileNotFoundError:
            return False

    def _get_postman_collection_path(self) -> Path:
        """Get path to the Postman collection file"""
        collection_file = self.api_tests_path / "WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json"
        if not collection_file.exists():
            raise FileNotFoundError(f"Postman collection not found: {collection_file}")
        return collection_file

    def _get_environment_file_path(self) -> Path:
        """Get path to the Postman environment file"""
        env_file = self.api_tests_path / "WeSign API Environment.postman_environment.json"
        if not env_file.exists():
            raise FileNotFoundError(f"Postman environment file not found: {env_file}")
        return env_file

    def _create_dynamic_environment(self) -> Path:
        """Create a dynamic environment file based on current configuration"""
        env_template_path = self._get_environment_file_path()

        # Read the template environment
        with open(env_template_path, 'r', encoding='utf-8') as f:
            env_data = json.load(f)

        # Update environment variables based on current config
        for value in env_data['values']:
            if value['key'] == 'baseUrl':
                value['value'] = self.config.base_url
            elif value['key'] == 'loginEmail':
                value['value'] = self.config.company_user.email
            elif value['key'] == 'loginPassword':
                value['value'] = self.config.company_user.password
            elif value['key'] == 'test_email':
                value['value'] = self.config.company_user.email
            elif value['key'] == 'test_password':
                value['value'] = self.config.company_user.password

        # Save dynamic environment file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dynamic_env_path = self.reports_path / f"dynamic_env_{self.environment}_{timestamp}.json"

        with open(dynamic_env_path, 'w', encoding='utf-8') as f:
            json.dump(env_data, f, indent=2, ensure_ascii=False)

        return dynamic_env_path

    def run_api_tests(self,
                     verbose: bool = False,
                     html_report: bool = True,
                     json_report: bool = True,
                     bail: bool = False,
                     timeout: Optional[int] = None) -> Dict:
        """
        Run API tests using Newman

        Args:
            verbose: Enable verbose output
            html_report: Generate HTML report
            json_report: Generate JSON report
            bail: Stop on first failure
            timeout: Request timeout in milliseconds

        Returns:
            Dict with test results
        """
        print(f"Running WeSign API Tests - Environment: {self.environment}")
        print("=" * 60)

        # Get collection and environment files
        collection_path = self._get_postman_collection_path()
        env_path = self._create_dynamic_environment()

        print(f"Collection: {collection_path.name}")
        print(f"Environment: {self.environment}")
        print(f"Base URL: {self.config.base_url}")
        print(f"Test User: {self.config.company_user.email}")
        print()

        # Prepare Newman command
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        cmd = [
            'newman', 'run', str(collection_path),
            '--environment', str(env_path),
            '--delay-request', '1000',  # 1 second delay between requests
            '--timeout-request', str(timeout or self.config.timeouts.default),
        ]

        if bail:
            cmd.append('--bail')

        if verbose:
            cmd.extend(['--verbose', '--color', 'on'])
        else:
            cmd.extend(['--silent', '--color', 'off'])

        # Add reporting options
        if html_report:
            html_path = self.reports_path / f"api_tests_{self.environment}_{timestamp}.html"
            cmd.extend(['--reporters', 'cli,htmlextra', '--reporter-htmlextra-export', str(html_path)])
            print(f"HTML report will be saved to: {html_path}")

        if json_report:
            json_path = self.reports_path / f"api_tests_{self.environment}_{timestamp}.json"
            cmd.extend(['--reporters', 'cli,json', '--reporter-json-export', str(json_path)])
            print(f"JSON report will be saved to: {json_path}")

        print(f"Executing Newman command...")
        print("-" * 40)

        start_time = time.time()

        try:
            # Run Newman
            result = subprocess.run(
                cmd,
                capture_output=not verbose,
                text=True
            )

            end_time = time.time()
            duration = end_time - start_time

            # Parse results
            results = {
                "environment": self.environment,
                "start_time": datetime.fromtimestamp(start_time).isoformat(),
                "end_time": datetime.fromtimestamp(end_time).isoformat(),
                "duration": duration,
                "exit_code": result.returncode,
                "success": result.returncode == 0,
                "stdout": result.stdout if not verbose else None,
                "stderr": result.stderr if result.stderr else None
            }

            print("-" * 40)
            print(f"API tests completed in {duration:.2f} seconds")

            if result.returncode == 0:
                print("[SUCCESS] All API tests passed!")
            else:
                print(f"[FAILED] Some API tests failed (exit code: {result.returncode})")
                if not verbose and result.stdout:
                    print("Output:")
                    print(result.stdout[-1000:])  # Last 1000 chars

            # Try to extract test summary from JSON report if available
            if json_report and json_path.exists():
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        newman_report = json.load(f)

                    stats = newman_report.get('run', {}).get('stats', {})
                    results.update({
                        "total_tests": stats.get('tests', {}).get('total', 0),
                        "passed_tests": stats.get('tests', {}).get('total', 0) - stats.get('tests', {}).get('failed', 0),
                        "failed_tests": stats.get('tests', {}).get('failed', 0),
                        "total_assertions": stats.get('assertions', {}).get('total', 0),
                        "failed_assertions": stats.get('assertions', {}).get('failed', 0)
                    })

                    print(f"\nTest Summary:")
                    print(f"  Total Tests: {results['total_tests']}")
                    print(f"  Passed: {results['passed_tests']}")
                    print(f"  Failed: {results['failed_tests']}")
                    print(f"  Assertions: {results['total_assertions']} total, {results['failed_assertions']} failed")

                except Exception as e:
                    print(f"[WARNING] Could not parse Newman JSON report: {e}")

            return results

        except Exception as e:
            print(f"[ERROR] Failed to run API tests: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "environment": self.environment
            }

    def run_specific_folder(self, folder_name: str, verbose: bool = False) -> bool:
        """
        Run tests for a specific folder in the collection

        Args:
            folder_name: Name of the folder to run
            verbose: Enable verbose output

        Returns:
            bool: True if tests passed, False otherwise
        """
        print(f"Running API tests for folder: {folder_name}")
        print(f"Environment: {self.environment}")
        print("-" * 40)

        collection_path = self._get_postman_collection_path()
        env_path = self._create_dynamic_environment()

        cmd = [
            'newman', 'run', str(collection_path),
            '--environment', str(env_path),
            '--folder', folder_name,
            '--delay-request', '1000',
            '--timeout-request', str(self.config.timeouts.default)
        ]

        if verbose:
            cmd.extend(['--verbose', '--color', 'on'])

        try:
            result = subprocess.run(cmd, text=True)
            return result.returncode == 0
        except Exception as e:
            print(f"[ERROR] Failed to run folder tests: {str(e)}")
            return False

    def list_available_folders(self) -> List[str]:
        """List all available folders in the Postman collection"""
        try:
            collection_path = self._get_postman_collection_path()

            with open(collection_path, 'r', encoding='utf-8') as f:
                collection_data = json.load(f)

            folders = []
            for item in collection_data.get('item', []):
                if 'item' in item:  # This is a folder
                    folders.append(item.get('name', 'Unnamed Folder'))

            return folders

        except Exception as e:
            print(f"[ERROR] Failed to list folders: {str(e)}")
            return []

    def validate_collection(self) -> bool:
        """Validate the Postman collection"""
        try:
            collection_path = self._get_postman_collection_path()

            cmd = ['newman', 'run', str(collection_path), '--dry-run']
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0:
                print("[OK] Postman collection is valid")
                return True
            else:
                print(f"[ERROR] Collection validation failed: {result.stderr}")
                return False

        except Exception as e:
            print(f"[ERROR] Failed to validate collection: {str(e)}")
            return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign API tests using Newman")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--no-html", action="store_true",
                       help="Skip HTML report generation")
    parser.add_argument("--no-json", action="store_true",
                       help="Skip JSON report generation")
    parser.add_argument("--bail", action="store_true",
                       help="Stop on first failure")
    parser.add_argument("--timeout", type=int,
                       help="Request timeout in milliseconds")
    parser.add_argument("--folder", "-f", metavar="FOLDER_NAME",
                       help="Run tests for specific folder only")
    parser.add_argument("--list-folders", action="store_true",
                       help="List all available test folders")
    parser.add_argument("--validate", action="store_true",
                       help="Validate Postman collection")

    args = parser.parse_args()

    try:
        runner = WeSignAPITestRunner(args.env)

        if args.list_folders:
            folders = runner.list_available_folders()
            print("Available test folders:")
            for folder in folders:
                print(f"  - {folder}")
            sys.exit(0)

        if args.validate:
            success = runner.validate_collection()
            sys.exit(0 if success else 1)

        if args.folder:
            success = runner.run_specific_folder(args.folder, args.verbose)
            sys.exit(0 if success else 1)

        # Run all API tests
        results = runner.run_api_tests(
            verbose=args.verbose,
            html_report=not args.no_html,
            json_report=not args.no_json,
            bail=args.bail,
            timeout=args.timeout
        )

        sys.exit(0 if results.get('success', False) else 1)

    except Exception as e:
        print(f"[ERROR] API test runner failed: {str(e)}")
        sys.exit(1)