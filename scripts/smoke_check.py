#!/usr/bin/env python3
"""
Smoke Test Suite for WeSign CI/CD Pipeline
==========================================

Comprehensive HTTP endpoint testing with retry logic, health check validation,
database connectivity verification, and service dependency validation.

Author: QA Intelligence System
Version: 2.0
Platform: Windows-compatible (py command ready)
"""

import argparse
import asyncio
import json
import logging
import os
import sqlite3
import sys
import time
import urllib.parse
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import re
import socket
import subprocess

try:
    import requests
    from requests.adapters import HTTPAdapter
    from requests.packages.urllib3.util.retry import Retry
except ImportError:
    print("ERROR: requests library not installed. Run: pip install requests")
    sys.exit(1)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('smoke_check.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Structured test result data."""
    test_name: str
    category: str
    status: str  # 'PASS', 'FAIL', 'SKIP', 'WARN'
    duration_ms: float
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None
    retry_count: int = 0

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()


@dataclass
class EndpointConfig:
    """Configuration for HTTP endpoint testing."""
    name: str
    url: str
    method: str = 'GET'
    headers: Optional[Dict[str, str]] = None
    payload: Optional[Dict[str, Any]] = None
    expected_status: int = 200
    timeout_seconds: int = 10
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    validation_rules: Optional[Dict[str, Any]] = None


@dataclass
class DatabaseConfig:
    """Configuration for database connectivity testing."""
    name: str
    connection_string: str
    db_type: str  # 'sqlite', 'postgresql', 'sqlserver'
    test_query: str = 'SELECT 1'
    timeout_seconds: int = 10


@dataclass
class ServiceConfig:
    """Configuration for service dependency testing."""
    name: str
    host: str
    port: int
    protocol: str = 'tcp'  # 'tcp', 'udp', 'icmp'
    timeout_seconds: int = 5


class RetryableHTTPSession:
    """HTTP session with configurable retry logic and exponential backoff."""

    def __init__(self, max_retries: int = 3, backoff_factor: float = 1.0):
        self.session = requests.Session()

        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE']
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

        # Set default headers
        self.session.headers.update({
            'User-Agent': 'WeSign-SmokeTest/2.0',
            'Accept': 'application/json, text/plain, */*'
        })

    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        """Make HTTP request with retry logic."""
        return self.session.request(method, url, **kwargs)

    def close(self):
        """Close the session."""
        self.session.close()


class DatabaseTester:
    """Database connectivity and health testing."""

    @staticmethod
    def test_sqlite_connection(config: DatabaseConfig) -> TestResult:
        """Test SQLite database connection."""
        start_time = time.time()

        try:
            # Handle both file paths and connection strings
            db_path = config.connection_string
            if db_path.startswith('Data Source='):
                db_path = db_path.split('Data Source=')[1].split(';')[0]

            conn = sqlite3.connect(db_path, timeout=config.timeout_seconds)
            cursor = conn.cursor()
            cursor.execute(config.test_query)
            result = cursor.fetchone()
            conn.close()

            duration_ms = (time.time() - start_time) * 1000

            return TestResult(
                test_name=f"sqlite_connection_{config.name}",
                category='database',
                status='PASS',
                duration_ms=duration_ms,
                message=f"SQLite connection successful, query result: {result}",
                details={
                    'database_path': db_path,
                    'test_query': config.test_query,
                    'query_result': result
                }
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"sqlite_connection_{config.name}",
                category='database',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"SQLite connection failed: {str(e)}",
                details={'error_type': type(e).__name__, 'database_path': config.connection_string}
            )

    @staticmethod
    def test_postgresql_connection(config: DatabaseConfig) -> TestResult:
        """Test PostgreSQL database connection."""
        start_time = time.time()

        try:
            import psycopg2
            from psycopg2 import OperationalError

            conn = psycopg2.connect(
                config.connection_string,
                connect_timeout=config.timeout_seconds
            )
            cursor = conn.cursor()
            cursor.execute(config.test_query)
            result = cursor.fetchone()
            conn.close()

            duration_ms = (time.time() - start_time) * 1000

            return TestResult(
                test_name=f"postgresql_connection_{config.name}",
                category='database',
                status='PASS',
                duration_ms=duration_ms,
                message=f"PostgreSQL connection successful, query result: {result}",
                details={
                    'test_query': config.test_query,
                    'query_result': result
                }
            )

        except ImportError:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"postgresql_connection_{config.name}",
                category='database',
                status='SKIP',
                duration_ms=duration_ms,
                message="PostgreSQL driver (psycopg2) not installed",
                details={'install_command': 'pip install psycopg2-binary'}
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"postgresql_connection_{config.name}",
                category='database',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"PostgreSQL connection failed: {str(e)}",
                details={'error_type': type(e).__name__}
            )

    @staticmethod
    def test_sqlserver_connection(config: DatabaseConfig) -> TestResult:
        """Test SQL Server database connection."""
        start_time = time.time()

        try:
            import pyodbc

            conn = pyodbc.connect(
                config.connection_string,
                timeout=config.timeout_seconds
            )
            cursor = conn.cursor()
            cursor.execute(config.test_query)
            result = cursor.fetchone()
            conn.close()

            duration_ms = (time.time() - start_time) * 1000

            return TestResult(
                test_name=f"sqlserver_connection_{config.name}",
                category='database',
                status='PASS',
                duration_ms=duration_ms,
                message=f"SQL Server connection successful, query result: {result}",
                details={
                    'test_query': config.test_query,
                    'query_result': result[0] if result else None
                }
            )

        except ImportError:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"sqlserver_connection_{config.name}",
                category='database',
                status='SKIP',
                duration_ms=duration_ms,
                message="SQL Server driver (pyodbc) not installed",
                details={'install_command': 'pip install pyodbc'}
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"sqlserver_connection_{config.name}",
                category='database',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"SQL Server connection failed: {str(e)}",
                details={'error_type': type(e).__name__}
            )


class ServiceTester:
    """Service dependency and network connectivity testing."""

    @staticmethod
    def test_tcp_connection(config: ServiceConfig) -> TestResult:
        """Test TCP port connectivity."""
        start_time = time.time()

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(config.timeout_seconds)
            result = sock.connect_ex((config.host, config.port))
            sock.close()

            duration_ms = (time.time() - start_time) * 1000

            if result == 0:
                return TestResult(
                    test_name=f"tcp_connection_{config.name}",
                    category='service',
                    status='PASS',
                    duration_ms=duration_ms,
                    message=f"TCP connection to {config.host}:{config.port} successful",
                    details={'endpoint': f"{config.host}:{config.port}", 'protocol': 'TCP'}
                )
            else:
                return TestResult(
                    test_name=f"tcp_connection_{config.name}",
                    category='service',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"TCP connection to {config.host}:{config.port} failed (code: {result})",
                    details={'endpoint': f"{config.host}:{config.port}", 'error_code': result}
                )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"tcp_connection_{config.name}",
                category='service',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"TCP connection test failed: {str(e)}",
                details={'error_type': type(e).__name__, 'endpoint': f"{config.host}:{config.port}"}
            )

    @staticmethod
    def test_ping_connectivity(config: ServiceConfig) -> TestResult:
        """Test ICMP ping connectivity."""
        start_time = time.time()

        try:
            # Use Windows ping command
            cmd = ['ping', '-n', '1', '-w', str(config.timeout_seconds * 1000), config.host]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=config.timeout_seconds + 2)

            duration_ms = (time.time() - start_time) * 1000

            if result.returncode == 0:
                # Extract response time from ping output
                output = result.stdout
                time_match = re.search(r'time[<>=]+(\d+)ms', output)
                response_time = time_match.group(1) if time_match else 'unknown'

                return TestResult(
                    test_name=f"ping_connectivity_{config.name}",
                    category='service',
                    status='PASS',
                    duration_ms=duration_ms,
                    message=f"Ping to {config.host} successful (response time: {response_time}ms)",
                    details={'host': config.host, 'response_time_ms': response_time}
                )
            else:
                return TestResult(
                    test_name=f"ping_connectivity_{config.name}",
                    category='service',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"Ping to {config.host} failed",
                    details={'host': config.host, 'stderr': result.stderr}
                )

        except subprocess.TimeoutExpired:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"ping_connectivity_{config.name}",
                category='service',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Ping to {config.host} timed out after {config.timeout_seconds}s",
                details={'host': config.host, 'timeout_seconds': config.timeout_seconds}
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"ping_connectivity_{config.name}",
                category='service',
                status='FAIL',
                duration_ms=duration_ms,
                message=f"Ping test failed: {str(e)}",
                details={'error_type': type(e).__name__, 'host': config.host}
            )


class SmokeTestSuite:
    """Comprehensive smoke test suite for WeSign deployment validation."""

    def __init__(self, config_file: Optional[Path] = None):
        """Initialize the smoke test suite."""
        self.config_file = config_file
        self.session = RetryableHTTPSession()
        self.results: List[TestResult] = []
        self.start_time = datetime.now()

        # Load configuration
        self.config = self._load_configuration()

    def _load_configuration(self) -> Dict[str, Any]:
        """Load test configuration from file or use defaults."""
        default_config = self._get_default_configuration()

        if self.config_file and self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                # Merge configurations
                default_config.update(file_config)
                logger.info(f"Loaded configuration from {self.config_file}")
            except Exception as e:
                logger.warning(f"Failed to load config file: {e}, using defaults")

        return default_config

    def _get_default_configuration(self) -> Dict[str, Any]:
        """Get default test configuration for WeSign environments."""
        base_url = os.getenv('WESIGN_BASE_URL', 'https://devtest.comda.co.il')

        return {
            'endpoints': [
                {
                    'name': 'health_check',
                    'url': f'{base_url}/health',
                    'method': 'GET',
                    'expected_status': 200,
                    'timeout_seconds': 5,
                    'validation_rules': {
                        'response_contains': ['status', 'timestamp'],
                        'json_structure': True
                    }
                },
                {
                    'name': 'api_status',
                    'url': f'{base_url}/api/status',
                    'method': 'GET',
                    'expected_status': 200,
                    'timeout_seconds': 10,
                    'validation_rules': {
                        'response_contains': ['version', 'environment'],
                        'json_structure': True
                    }
                },
                {
                    'name': 'home_page',
                    'url': base_url,
                    'method': 'GET',
                    'expected_status': 200,
                    'timeout_seconds': 10,
                    'validation_rules': {
                        'response_contains': ['WeSign', 'DOCTYPE'],
                        'content_type': 'text/html'
                    }
                },
                {
                    'name': 'auth_login_page',
                    'url': f'{base_url}/login',
                    'method': 'GET',
                    'expected_status': 200,
                    'timeout_seconds': 10,
                    'validation_rules': {
                        'response_contains': ['login', 'password'],
                        'content_type': 'text/html'
                    }
                },
                {
                    'name': 'api_auth_test',
                    'url': f'{base_url}/api/auth/test',
                    'method': 'POST',
                    'payload': {'test': True},
                    'expected_status': 401,  # Expected unauthorized for smoke test
                    'timeout_seconds': 5,
                    'validation_rules': {
                        'json_structure': True
                    }
                }
            ],
            'databases': [
                {
                    'name': 'wesign_main',
                    'connection_string': os.getenv('WESIGN_CONNECTION_STRING', 'Data Source=wesign.db'),
                    'db_type': 'sqlite',
                    'test_query': 'SELECT COUNT(*) FROM sqlite_master WHERE type="table"',
                    'timeout_seconds': 10
                }
            ],
            'services': [
                {
                    'name': 'web_server',
                    'host': urllib.parse.urlparse(base_url).hostname,
                    'port': urllib.parse.urlparse(base_url).port or (443 if base_url.startswith('https') else 80),
                    'protocol': 'tcp',
                    'timeout_seconds': 5
                },
                {
                    'name': 'database_server',
                    'host': 'localhost',
                    'port': 5432,
                    'protocol': 'tcp',
                    'timeout_seconds': 5
                }
            ],
            'performance_thresholds': {
                'endpoint_response_time_ms': 3000,  # Modern 3-second standard
                'database_query_time_ms': 1000,
                'service_connection_time_ms': 1000
            }
        }

    def run_endpoint_tests(self) -> List[TestResult]:
        """Run HTTP endpoint smoke tests."""
        logger.info("Running HTTP endpoint tests...")
        results = []

        for endpoint_data in self.config.get('endpoints', []):
            config = EndpointConfig(**endpoint_data)
            result = self._test_endpoint(config)
            results.append(result)
            self.results.append(result)

        return results

    def _test_endpoint(self, config: EndpointConfig) -> TestResult:
        """Test a single HTTP endpoint."""
        start_time = time.time()
        retry_count = 0

        for attempt in range(config.max_retries + 1):
            try:
                # Prepare request parameters
                request_params = {
                    'timeout': config.timeout_seconds,
                    'verify': False,  # For dev environments with self-signed certs
                }

                if config.headers:
                    request_params['headers'] = config.headers

                if config.payload and config.method.upper() in ['POST', 'PUT', 'PATCH']:
                    request_params['json'] = config.payload
                    if 'headers' not in request_params:
                        request_params['headers'] = {}
                    request_params['headers']['Content-Type'] = 'application/json'

                # Make the request
                response = self.session.request(config.method, config.url, **request_params)
                duration_ms = (time.time() - start_time) * 1000

                # Validate response
                validation_result = self._validate_response(response, config)

                # Check performance threshold
                threshold = self.config.get('performance_thresholds', {}).get('endpoint_response_time_ms', 3000)
                performance_warning = duration_ms > threshold

                status = 'PASS'
                message = f"Endpoint test passed (status: {response.status_code}, time: {duration_ms:.0f}ms)"

                if response.status_code != config.expected_status:
                    status = 'FAIL'
                    message = f"Unexpected status code: {response.status_code} (expected: {config.expected_status})"
                elif not validation_result['valid']:
                    status = 'FAIL'
                    message = f"Response validation failed: {validation_result['message']}"
                elif performance_warning:
                    status = 'WARN'
                    message += f" - Performance warning: response time exceeded {threshold}ms threshold"

                return TestResult(
                    test_name=f"endpoint_{config.name}",
                    category='endpoint',
                    status=status,
                    duration_ms=duration_ms,
                    message=message,
                    details={
                        'url': config.url,
                        'method': config.method,
                        'status_code': response.status_code,
                        'expected_status': config.expected_status,
                        'response_size': len(response.content) if response.content else 0,
                        'content_type': response.headers.get('content-type', ''),
                        'validation': validation_result,
                        'performance_threshold_ms': threshold
                    },
                    retry_count=retry_count
                )

            except requests.exceptions.RequestException as e:
                retry_count += 1
                if attempt < config.max_retries:
                    logger.warning(f"Endpoint {config.name} failed (attempt {attempt + 1}), retrying: {str(e)}")
                    time.sleep(config.retry_delay_seconds * (2 ** attempt))  # Exponential backoff
                    continue

                duration_ms = (time.time() - start_time) * 1000
                return TestResult(
                    test_name=f"endpoint_{config.name}",
                    category='endpoint',
                    status='FAIL',
                    duration_ms=duration_ms,
                    message=f"Endpoint request failed: {str(e)}",
                    details={
                        'url': config.url,
                        'method': config.method,
                        'error_type': type(e).__name__,
                        'max_retries': config.max_retries
                    },
                    retry_count=retry_count
                )

    def _validate_response(self, response: requests.Response, config: EndpointConfig) -> Dict[str, Any]:
        """Validate HTTP response according to configuration rules."""
        validation_rules = config.validation_rules or {}
        validation_results = {'valid': True, 'checks': []}

        # Check content type
        expected_content_type = validation_rules.get('content_type')
        if expected_content_type:
            actual_content_type = response.headers.get('content-type', '').lower()
            content_type_match = expected_content_type.lower() in actual_content_type

            validation_results['checks'].append({
                'rule': 'content_type',
                'expected': expected_content_type,
                'actual': actual_content_type,
                'passed': content_type_match
            })

            if not content_type_match:
                validation_results['valid'] = False

        # Check response contains specific strings
        response_contains = validation_rules.get('response_contains', [])
        if response_contains:
            response_text = response.text.lower()
            for required_text in response_contains:
                contains_text = required_text.lower() in response_text

                validation_results['checks'].append({
                    'rule': 'response_contains',
                    'expected': required_text,
                    'passed': contains_text
                })

                if not contains_text:
                    validation_results['valid'] = False

        # Check JSON structure
        if validation_rules.get('json_structure'):
            try:
                json_data = response.json()
                validation_results['checks'].append({
                    'rule': 'json_structure',
                    'passed': True,
                    'details': f"Valid JSON with {len(json_data)} keys" if isinstance(json_data, dict) else "Valid JSON array" if isinstance(json_data, list) else "Valid JSON primitive"
                })
            except ValueError:
                validation_results['checks'].append({
                    'rule': 'json_structure',
                    'passed': False,
                    'error': 'Invalid JSON format'
                })
                validation_results['valid'] = False

        validation_results['message'] = 'All validations passed' if validation_results['valid'] else 'Some validations failed'
        return validation_results

    def run_database_tests(self) -> List[TestResult]:
        """Run database connectivity smoke tests."""
        logger.info("Running database connectivity tests...")
        results = []

        for db_data in self.config.get('databases', []):
            config = DatabaseConfig(**db_data)

            if config.db_type.lower() == 'sqlite':
                result = DatabaseTester.test_sqlite_connection(config)
            elif config.db_type.lower() == 'postgresql':
                result = DatabaseTester.test_postgresql_connection(config)
            elif config.db_type.lower() == 'sqlserver':
                result = DatabaseTester.test_sqlserver_connection(config)
            else:
                result = TestResult(
                    test_name=f"database_connection_{config.name}",
                    category='database',
                    status='SKIP',
                    duration_ms=0,
                    message=f"Unsupported database type: {config.db_type}"
                )

            results.append(result)
            self.results.append(result)

        return results

    def run_service_tests(self) -> List[TestResult]:
        """Run service dependency connectivity tests."""
        logger.info("Running service dependency tests...")
        results = []

        for service_data in self.config.get('services', []):
            config = ServiceConfig(**service_data)

            if config.protocol.lower() == 'tcp':
                result = ServiceTester.test_tcp_connection(config)
            elif config.protocol.lower() == 'icmp':
                result = ServiceTester.test_ping_connectivity(config)
            else:
                result = TestResult(
                    test_name=f"service_connection_{config.name}",
                    category='service',
                    status='SKIP',
                    duration_ms=0,
                    message=f"Unsupported protocol: {config.protocol}"
                )

            results.append(result)
            self.results.append(result)

        return results

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all smoke tests and return comprehensive results."""
        logger.info("Starting comprehensive smoke test suite...")

        # Run all test categories
        endpoint_results = self.run_endpoint_tests()
        database_results = self.run_database_tests()
        service_results = self.run_service_tests()

        # Calculate summary statistics
        total_duration = (datetime.now() - self.start_time).total_seconds()
        summary = self._calculate_test_summary()

        # Generate final report
        report = {
            'summary': summary,
            'execution_info': {
                'start_time': self.start_time.isoformat(),
                'end_time': datetime.now().isoformat(),
                'total_duration_seconds': total_duration,
                'environment': os.getenv('WESIGN_ENVIRONMENT', 'unknown')
            },
            'results': {
                'endpoints': [asdict(r) for r in endpoint_results],
                'databases': [asdict(r) for r in database_results],
                'services': [asdict(r) for r in service_results]
            },
            'configuration': {
                'performance_thresholds': self.config.get('performance_thresholds', {}),
                'test_counts': {
                    'endpoints': len(endpoint_results),
                    'databases': len(database_results),
                    'services': len(service_results)
                }
            }
        }

        logger.info(f"Smoke test suite completed in {total_duration:.2f} seconds")
        logger.info(f"Results: {summary['passed']} passed, {summary['failed']} failed, {summary['warnings']} warnings, {summary['skipped']} skipped")

        return report

    def _calculate_test_summary(self) -> Dict[str, Any]:
        """Calculate comprehensive test summary statistics."""
        passed = sum(1 for r in self.results if r.status == 'PASS')
        failed = sum(1 for r in self.results if r.status == 'FAIL')
        warnings = sum(1 for r in self.results if r.status == 'WARN')
        skipped = sum(1 for r in self.results if r.status == 'SKIP')

        total_tests = len(self.results)
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0

        # Calculate category-specific summaries
        categories = {}
        for result in self.results:
            if result.category not in categories:
                categories[result.category] = {'passed': 0, 'failed': 0, 'warnings': 0, 'skipped': 0, 'total': 0}

            categories[result.category][result.status.lower() if result.status.lower() in ['passed', 'failed', 'warnings', 'skipped'] else 'failed'] += 1
            categories[result.category]['total'] += 1

        # Performance analysis
        avg_duration = sum(r.duration_ms for r in self.results) / len(self.results) if self.results else 0
        max_duration = max(r.duration_ms for r in self.results) if self.results else 0
        min_duration = min(r.duration_ms for r in self.results) if self.results else 0

        return {
            'total_tests': total_tests,
            'passed': passed,
            'failed': failed,
            'warnings': warnings,
            'skipped': skipped,
            'success_rate_percent': round(success_rate, 2),
            'overall_status': 'PASS' if failed == 0 else 'FAIL',
            'categories': categories,
            'performance': {
                'average_duration_ms': round(avg_duration, 2),
                'max_duration_ms': round(max_duration, 2),
                'min_duration_ms': round(min_duration, 2)
            }
        }

    def close(self):
        """Clean up resources."""
        self.session.close()


def main():
    """Main entry point for the smoke test suite."""
    parser = argparse.ArgumentParser(
        description='WeSign Smoke Test Suite - Comprehensive deployment validation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  py smoke_check.py --config smoke_config.json --output results.json
  py smoke_check.py --environment DevTest --endpoints-only
  py smoke_check.py --verbose --retry-count 5
        """
    )

    parser.add_argument(
        '--config',
        type=str,
        help='Path to JSON configuration file'
    )

    parser.add_argument(
        '--output',
        type=str,
        help='Output file for test results (JSON format)'
    )

    parser.add_argument(
        '--environment',
        type=str,
        help='Target environment (sets WESIGN_ENVIRONMENT env var)'
    )

    parser.add_argument(
        '--endpoints-only',
        action='store_true',
        help='Run only HTTP endpoint tests'
    )

    parser.add_argument(
        '--databases-only',
        action='store_true',
        help='Run only database connectivity tests'
    )

    parser.add_argument(
        '--services-only',
        action='store_true',
        help='Run only service dependency tests'
    )

    parser.add_argument(
        '--retry-count',
        type=int,
        default=3,
        help='Maximum retry count for failed tests'
    )

    parser.add_argument(
        '--timeout',
        type=int,
        default=10,
        help='Default timeout in seconds for all tests'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    parser.add_argument(
        '--fail-fast',
        action='store_true',
        help='Stop on first test failure'
    )

    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Set environment if specified
    if args.environment:
        os.environ['WESIGN_ENVIRONMENT'] = args.environment
        logger.info(f"Set environment to: {args.environment}")

    try:
        # Initialize test suite
        config_file = Path(args.config) if args.config else None
        suite = SmokeTestSuite(config_file=config_file)

        # Run specific test categories or all tests
        if args.endpoints_only:
            results = {'results': {'endpoints': [asdict(r) for r in suite.run_endpoint_tests()]}}
        elif args.databases_only:
            results = {'results': {'databases': [asdict(r) for r in suite.run_database_tests()]}}
        elif args.services_only:
            results = {'results': {'services': [asdict(r) for r in suite.run_service_tests()]}}
        else:
            results = suite.run_all_tests()

        # Check for failures and handle fail-fast mode
        if args.fail_fast and results.get('summary', {}).get('failed', 0) > 0:
            logger.error("Fail-fast mode: stopping due to test failures")
            suite.close()
            return 1

        # Output results
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.info(f"Results saved to: {args.output}")

        # Print summary
        if 'summary' in results:
            summary = results['summary']
            print(f"\nSmoke Test Results Summary:")
            print(f"Total Tests: {summary['total_tests']}")
            print(f"Passed: {summary['passed']}")
            print(f"Failed: {summary['failed']}")
            print(f"Warnings: {summary['warnings']}")
            print(f"Skipped: {summary['skipped']}")
            print(f"Success Rate: {summary['success_rate_percent']}%")
            print(f"Overall Status: {summary['overall_status']}")

        suite.close()

        # Return appropriate exit code
        return 0 if results.get('summary', {}).get('overall_status') == 'PASS' else 1

    except Exception as e:
        logger.error(f"Smoke test suite failed: {str(e)}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)