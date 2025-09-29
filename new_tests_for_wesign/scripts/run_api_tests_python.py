#!/usr/bin/env python3
"""
API Tests Runner using Python Requests

This script runs API tests using Python requests library for the WeSign platform.
Alternative to Newman when Newman CLI is not available or accessible.
"""

import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment


class WeSignPythonAPITestRunner:
    """Python-based API test runner for WeSign platform"""

    def __init__(self, environment='dev'):
        """Initialize the API test runner"""
        self.environment = environment
        set_environment(environment)
        self.config = get_config()
        self.base_path = Path(__file__).parent.parent
        self.reports_path = self.base_path / "reports" / "api"
        self.reports_path.mkdir(parents=True, exist_ok=True)

        # Session for maintaining cookies/auth
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'WeSign-API-Tests/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })

        # Test results storage
        self.test_results = []
        self.auth_token = None

    def _log_test_result(self, test_name: str, success: bool,
                        response: Optional[requests.Response] = None,
                        error: Optional[str] = None,
                        duration: float = 0) -> Dict:
        """Log test result"""
        result = {
            "test_name": test_name,
            "success": success,
            "duration": duration,
            "timestamp": datetime.now().isoformat(),
            "error": error
        }

        if response:
            result.update({
                "status_code": response.status_code,
                "response_time": response.elapsed.total_seconds(),
                "response_size": len(response.content) if response.content else 0
            })

        self.test_results.append(result)
        return result

    def test_health_check(self) -> bool:
        """Test basic health/connectivity"""
        print("Testing API health check...")

        start_time = time.time()
        try:
            # Try to access the base URL
            response = self.session.get(
                self.config.base_url,
                timeout=30,
                allow_redirects=True
            )
            duration = time.time() - start_time

            success = response.status_code < 500
            self._log_test_result("health_check", success, response, duration=duration)

            if success:
                print(f"[OK] Health check passed (status: {response.status_code}, time: {duration:.2f}s)")
            else:
                print(f"[FAILED] Health check failed (status: {response.status_code})")

            return success

        except Exception as e:
            duration = time.time() - start_time
            self._log_test_result("health_check", False, error=str(e), duration=duration)
            print(f"[ERROR] Health check failed: {str(e)}")
            return False

    def test_authentication(self) -> bool:
        """Test authentication endpoint"""
        print("Testing authentication...")

        # Common authentication endpoints to try
        auth_endpoints = [
            "/api/auth/login",
            "/auth/login",
            "/login",
            "/api/login",
            "/api/v1/auth/login"
        ]

        auth_data = {
            "email": self.config.company_user.email,
            "password": self.config.company_user.password
        }

        for endpoint in auth_endpoints:
            print(f"  Trying endpoint: {endpoint}")
            start_time = time.time()

            try:
                url = self.config.base_url.rstrip('/') + endpoint
                response = self.session.post(
                    url,
                    json=auth_data,
                    timeout=30
                )
                duration = time.time() - start_time

                if response.status_code in [200, 201]:
                    # Try to extract token from response
                    try:
                        data = response.json()
                        # Common token field names
                        token_fields = ['token', 'access_token', 'authToken', 'jwt', 'bearer_token']
                        for field in token_fields:
                            if field in data:
                                self.auth_token = data[field]
                                self.session.headers['Authorization'] = f'Bearer {self.auth_token}'
                                break
                    except:
                        pass

                    self._log_test_result(f"auth_{endpoint.replace('/', '_')}", True, response, duration=duration)
                    print(f"[OK] Authentication successful (endpoint: {endpoint}, time: {duration:.2f}s)")
                    return True

                elif response.status_code == 404:
                    print(f"  [SKIP] Endpoint not found: {endpoint}")
                    continue

                else:
                    self._log_test_result(f"auth_{endpoint.replace('/', '_')}", False, response, duration=duration)
                    print(f"  [FAILED] Authentication failed (status: {response.status_code})")

            except Exception as e:
                duration = time.time() - start_time
                print(f"  [ERROR] Request failed: {str(e)}")
                continue

        print("[FAILED] No working authentication endpoint found")
        return False

    def test_api_endpoints(self) -> bool:
        """Test common API endpoints"""
        print("Testing common API endpoints...")

        # Common API endpoints to test
        endpoints = [
            {"path": "/api/users/profile", "method": "GET", "name": "user_profile"},
            {"path": "/api/user", "method": "GET", "name": "user_info"},
            {"path": "/api/documents", "method": "GET", "name": "documents_list"},
            {"path": "/api/documents/list", "method": "GET", "name": "documents_list_alt"},
            {"path": "/api/templates", "method": "GET", "name": "templates_list"},
            {"path": "/api/contacts", "method": "GET", "name": "contacts_list"},
            {"path": "/api/dashboard", "method": "GET", "name": "dashboard_data"},
            {"path": "/api/health", "method": "GET", "name": "api_health", "auth_required": False},
            {"path": "/api/status", "method": "GET", "name": "api_status", "auth_required": False}
        ]

        success_count = 0
        total_count = 0

        for endpoint in endpoints:
            total_count += 1
            path = endpoint["path"]
            method = endpoint["method"]
            name = endpoint["name"]
            auth_required = endpoint.get("auth_required", True)

            print(f"  Testing: {method} {path}")

            if auth_required and not self.auth_token:
                print(f"    [SKIP] Requires authentication (no token available)")
                continue

            start_time = time.time()
            try:
                url = self.config.base_url.rstrip('/') + path

                if method == "GET":
                    response = self.session.get(url, timeout=30)
                elif method == "POST":
                    response = self.session.post(url, json={}, timeout=30)
                else:
                    print(f"    [SKIP] Method {method} not implemented")
                    continue

                duration = time.time() - start_time

                if response.status_code in [200, 201]:
                    success_count += 1
                    self._log_test_result(name, True, response, duration=duration)
                    print(f"    [OK] Success (status: {response.status_code}, time: {duration:.2f}s)")

                elif response.status_code == 401:
                    print(f"    [AUTH] Authentication required (status: 401)")
                    self._log_test_result(name, False, response, error="Authentication required", duration=duration)

                elif response.status_code == 404:
                    print(f"    [SKIP] Endpoint not found (status: 404)")
                    self._log_test_result(name, False, response, error="Endpoint not found", duration=duration)

                else:
                    print(f"    [FAILED] Request failed (status: {response.status_code})")
                    self._log_test_result(name, False, response, duration=duration)

            except Exception as e:
                duration = time.time() - start_time
                print(f"    [ERROR] Request error: {str(e)}")
                self._log_test_result(name, False, error=str(e), duration=duration)

        print(f"\nAPI endpoints test completed: {success_count}/{total_count} successful")
        return success_count > 0

    def test_document_upload_simulation(self) -> bool:
        """Simulate document upload test"""
        print("Testing document upload endpoints...")

        upload_endpoints = [
            "/api/documents/upload",
            "/api/upload",
            "/upload"
        ]

        # Create a minimal test file simulation
        test_file_data = {
            "filename": "test_document.pdf",
            "content_type": "application/pdf",
            "size": 1024,
            "data": "Test document content"
        }

        for endpoint in upload_endpoints:
            print(f"  Testing upload endpoint: {endpoint}")
            start_time = time.time()

            try:
                url = self.config.base_url.rstrip('/') + endpoint

                # Try as JSON first
                response = self.session.post(
                    url,
                    json=test_file_data,
                    timeout=60
                )

                duration = time.time() - start_time

                if response.status_code in [200, 201]:
                    self._log_test_result(f"upload_{endpoint.replace('/', '_')}", True, response, duration=duration)
                    print(f"    [OK] Upload endpoint accessible (status: {response.status_code})")
                    return True

                elif response.status_code == 404:
                    print(f"    [SKIP] Upload endpoint not found")
                    continue

                else:
                    self._log_test_result(f"upload_{endpoint.replace('/', '_')}", False, response, duration=duration)
                    print(f"    [INFO] Upload endpoint responded (status: {response.status_code})")

            except Exception as e:
                duration = time.time() - start_time
                print(f"    [ERROR] Upload test error: {str(e)}")
                continue

        return False

    def run_comprehensive_tests(self, verbose: bool = False) -> Dict:
        """Run comprehensive API test suite"""
        print(f"Running WeSign API Tests (Python) - Environment: {self.environment}")
        print("=" * 60)

        print(f"Target URL: {self.config.base_url}")
        print(f"Test User: {self.config.company_user.email}")
        print()

        start_time = time.time()
        self.test_results = []

        # Run test suite
        tests = [
            ("Health Check", self.test_health_check),
            ("Authentication", self.test_authentication),
            ("API Endpoints", self.test_api_endpoints),
            ("Document Upload", self.test_document_upload_simulation)
        ]

        passed_tests = 0
        total_tests = len(tests)

        for test_name, test_func in tests:
            print(f"\n--- {test_name} ---")
            try:
                if test_func():
                    passed_tests += 1
            except Exception as e:
                print(f"[ERROR] Test {test_name} crashed: {str(e)}")

        end_time = time.time()
        total_duration = end_time - start_time

        # Generate summary
        results = {
            "environment": self.environment,
            "start_time": datetime.fromtimestamp(start_time).isoformat(),
            "end_time": datetime.fromtimestamp(end_time).isoformat(),
            "total_duration": total_duration,
            "tests": {
                "total": total_tests,
                "passed": passed_tests,
                "failed": total_tests - passed_tests,
                "success_rate": (passed_tests / total_tests) * 100
            },
            "detailed_results": self.test_results,
            "summary": {
                "auth_available": self.auth_token is not None,
                "api_accessible": any(r["success"] for r in self.test_results),
                "total_requests": len(self.test_results)
            }
        }

        # Save detailed report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = self.reports_path / f"python_api_tests_{self.environment}_{timestamp}.json"

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # Print summary
        print("\n" + "=" * 60)
        print("API TEST SUMMARY")
        print("=" * 60)
        print(f"Environment: {self.environment}")
        print(f"Total Duration: {total_duration:.2f} seconds")
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        print(f"Success Rate: {results['tests']['success_rate']:.1f}%")
        print(f"Total API Requests: {len(self.test_results)}")
        print(f"Authentication Available: {'Yes' if self.auth_token else 'No'}")

        print(f"\nDetailed report saved to: {report_path}")

        overall_success = passed_tests == total_tests
        print(f"\n[{'SUCCESS' if overall_success else 'PARTIAL'}] API Tests {'Completed Successfully' if overall_success else 'Completed with Issues'}")

        return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign API tests using Python requests")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")

    args = parser.parse_args()

    try:
        runner = WeSignPythonAPITestRunner(args.env)
        results = runner.run_comprehensive_tests(args.verbose)

        # Exit with appropriate code
        success_rate = results.get("tests", {}).get("success_rate", 0)
        sys.exit(0 if success_rate >= 75 else 1)  # Consider 75% success rate as passing

    except Exception as e:
        print(f"[ERROR] API test runner failed: {str(e)}")
        sys.exit(1)