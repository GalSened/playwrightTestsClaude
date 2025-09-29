#!/usr/bin/env python3
"""
Unit Tests for Smoke Test Suite (smoke_check.py)
================================================

Comprehensive unit tests for the WeSign smoke test suite utility.

Author: QA Intelligence System
Version: 2.0
"""

import json
import pytest
import tempfile
import sqlite3
import time
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open
import sys
import requests

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from smoke_check import (
    SmokeTestSuite,
    RetryableHTTPSession,
    DatabaseTester,
    ServiceTester,
    EndpointConfig,
    DatabaseConfig,
    ServiceConfig,
    TestResult,
    TestMetrics
)


class TestTestResult:
    """Test TestResult data class."""

    def test_test_result_creation(self):
        """Test TestResult creation and timestamp."""
        result = TestResult(
            test_name='test_example',
            category='endpoint',
            status='PASS',
            duration_ms=150.5,
            message='Test passed successfully'
        )

        assert result.test_name == 'test_example'
        assert result.category == 'endpoint'
        assert result.status == 'PASS'
        assert result.duration_ms == 150.5
        assert result.message == 'Test passed successfully'
        assert result.timestamp is not None
        assert result.retry_count == 0

    def test_test_result_with_details(self):
        """Test TestResult with additional details."""
        details = {'endpoint': 'https://example.com', 'status_code': 200}
        result = TestResult(
            test_name='test_http',
            category='endpoint',
            status='PASS',
            duration_ms=200.0,
            message='HTTP test passed',
            details=details,
            retry_count=1
        )

        assert result.details == details
        assert result.retry_count == 1


class TestEndpointConfig:
    """Test EndpointConfig data class."""

    def test_endpoint_config_defaults(self):
        """Test EndpointConfig with default values."""
        config = EndpointConfig(
            name='test_endpoint',
            url='https://example.com/api'
        )

        assert config.name == 'test_endpoint'
        assert config.url == 'https://example.com/api'
        assert config.method == 'GET'
        assert config.expected_status == 200
        assert config.timeout_seconds == 10
        assert config.max_retries == 3
        assert config.retry_delay_seconds == 1.0

    def test_endpoint_config_custom_values(self):
        """Test EndpointConfig with custom values."""
        config = EndpointConfig(
            name='api_test',
            url='https://api.example.com/v1/test',
            method='POST',
            headers={'Authorization': 'Bearer token'},
            payload={'test': True},
            expected_status=201,
            timeout_seconds=30,
            max_retries=5,
            retry_delay_seconds=2.0
        )

        assert config.method == 'POST'
        assert config.headers == {'Authorization': 'Bearer token'}
        assert config.payload == {'test': True}
        assert config.expected_status == 201
        assert config.timeout_seconds == 30
        assert config.max_retries == 5
        assert config.retry_delay_seconds == 2.0


class TestRetryableHTTPSession:
    """Test RetryableHTTPSession functionality."""

    def test_session_initialization(self):
        """Test HTTP session initialization."""
        session = RetryableHTTPSession(max_retries=5, backoff_factor=2.0)

        assert session.session is not None
        assert 'WeSign-SmokeTest/2.0' in session.session.headers['User-Agent']
        assert 'application/json' in session.session.headers['Accept']

    def test_session_close(self):
        """Test HTTP session cleanup."""
        session = RetryableHTTPSession()
        session.close()
        # Session should be closed without errors

    @patch('requests.Session.request')
    def test_session_request(self, mock_request):
        """Test HTTP session request method."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        session = RetryableHTTPSession()
        response = session.request('GET', 'https://example.com')

        mock_request.assert_called_once_with('GET', 'https://example.com')
        assert response == mock_response


class TestDatabaseTester:
    """Test DatabaseTester functionality."""

    def test_sqlite_connection_success(self):
        """Test successful SQLite connection."""
        # Create temporary SQLite database
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as db_file:
            db_path = db_file.name

        try:
            # Initialize database
            conn = sqlite3.connect(db_path)
            conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')
            conn.commit()
            conn.close()

            # Test connection
            config = DatabaseConfig(
                name='test_db',
                connection_string=db_path,
                db_type='sqlite',
                test_query='SELECT COUNT(*) FROM sqlite_master WHERE type="table"',
                timeout_seconds=5
            )

            result = DatabaseTester.test_sqlite_connection(config)

            assert result.test_name == 'sqlite_connection_test_db'
            assert result.category == 'database'
            assert result.status == 'PASS'
            assert result.duration_ms > 0
            assert 'successful' in result.message.lower()
            assert result.details is not None
            assert 'query_result' in result.details

        finally:
            Path(db_path).unlink(missing_ok=True)

    def test_sqlite_connection_failure(self):
        """Test SQLite connection failure."""
        config = DatabaseConfig(
            name='nonexistent_db',
            connection_string='/nonexistent/path/database.db',
            db_type='sqlite',
            test_query='SELECT 1',
            timeout_seconds=5
        )

        result = DatabaseTester.test_sqlite_connection(config)

        assert result.test_name == 'sqlite_connection_nonexistent_db'
        assert result.category == 'database'
        assert result.status == 'FAIL'
        assert 'failed' in result.message.lower()
        assert result.details is not None
        assert 'error_type' in result.details

    @patch('psycopg2.connect')
    def test_postgresql_connection_success(self, mock_connect):
        """Test successful PostgreSQL connection."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (1,)
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        config = DatabaseConfig(
            name='test_pg',
            connection_string='postgresql://user:pass@localhost/testdb',
            db_type='postgresql',
            test_query='SELECT 1',
            timeout_seconds=10
        )

        result = DatabaseTester.test_postgresql_connection(config)

        assert result.test_name == 'postgresql_connection_test_pg'
        assert result.category == 'database'
        assert result.status == 'PASS'
        assert 'successful' in result.message.lower()

    def test_postgresql_driver_not_installed(self):
        """Test PostgreSQL when driver is not installed."""
        with patch.dict('sys.modules', {'psycopg2': None}):
            config = DatabaseConfig(
                name='test_pg',
                connection_string='postgresql://user:pass@localhost/testdb',
                db_type='postgresql'
            )

            result = DatabaseTester.test_postgresql_connection(config)

            assert result.status == 'SKIP'
            assert 'psycopg2' in result.message
            assert 'install_command' in result.details


class TestServiceTester:
    """Test ServiceTester functionality."""

    @patch('socket.socket')
    def test_tcp_connection_success(self, mock_socket):
        """Test successful TCP connection."""
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_socket.return_value = mock_sock

        config = ServiceConfig(
            name='web_server',
            host='example.com',
            port=80,
            protocol='tcp',
            timeout_seconds=5
        )

        result = ServiceTester.test_tcp_connection(config)

        assert result.test_name == 'tcp_connection_web_server'
        assert result.category == 'service'
        assert result.status == 'PASS'
        assert 'successful' in result.message.lower()
        assert result.details['endpoint'] == 'example.com:80'

    @patch('socket.socket')
    def test_tcp_connection_failure(self, mock_socket):
        """Test failed TCP connection."""
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 111  # Connection refused
        mock_socket.return_value = mock_sock

        config = ServiceConfig(
            name='unreachable_server',
            host='nonexistent.example.com',
            port=9999,
            timeout_seconds=5
        )

        result = ServiceTester.test_tcp_connection(config)

        assert result.status == 'FAIL'
        assert 'failed' in result.message.lower()
        assert result.details['error_code'] == 111

    @patch('subprocess.run')
    def test_ping_connectivity_success(self, mock_subprocess):
        """Test successful ping connectivity."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64'
        mock_subprocess.return_value = mock_result

        config = ServiceConfig(
            name='gateway',
            host='192.168.1.1',
            port=0,  # Not used for ping
            protocol='icmp',
            timeout_seconds=5
        )

        result = ServiceTester.test_ping_connectivity(config)

        assert result.status == 'PASS'
        assert 'successful' in result.message.lower()
        assert result.details['host'] == '192.168.1.1'

    @patch('subprocess.run')
    def test_ping_connectivity_failure(self, mock_subprocess):
        """Test failed ping connectivity."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = 'Destination host unreachable'
        mock_subprocess.return_value = mock_result

        config = ServiceConfig(
            name='unreachable',
            host='nonexistent.example.com',
            port=0,
            protocol='icmp',
            timeout_seconds=5
        )

        result = ServiceTester.test_ping_connectivity(config)

        assert result.status == 'FAIL'
        assert 'failed' in result.message.lower()


class TestSmokeTestSuite:
    """Test SmokeTestSuite main functionality."""

    def test_initialization_with_config_file(self):
        """Test suite initialization with config file."""
        config_data = {
            'endpoints': [
                {
                    'name': 'test_endpoint',
                    'url': 'https://example.com',
                    'method': 'GET',
                    'expected_status': 200
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = Path(f.name)

        try:
            suite = SmokeTestSuite(config_file=config_path)
            assert suite.config_file == config_path
            assert len(suite.config['endpoints']) == 1
            assert suite.config['endpoints'][0]['name'] == 'test_endpoint'
        finally:
            config_path.unlink()
            suite.session.close()

    def test_initialization_without_config_file(self):
        """Test suite initialization without config file."""
        suite = SmokeTestSuite()

        # Should use default configuration
        assert suite.config_file is None
        assert 'endpoints' in suite.config
        assert 'databases' in suite.config
        assert 'services' in suite.config

        suite.session.close()

    def test_initialization_with_invalid_config_file(self):
        """Test suite initialization with invalid config file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('invalid json content')
            config_path = Path(f.name)

        try:
            suite = SmokeTestSuite(config_file=config_path)
            # Should fall back to defaults when config file is invalid
            assert 'endpoints' in suite.config
        finally:
            config_path.unlink()
            suite.session.close()

    def test_default_configuration(self):
        """Test default configuration structure."""
        suite = SmokeTestSuite()
        config = suite._get_default_configuration()

        # Verify required sections exist
        required_sections = ['endpoints', 'databases', 'services', 'performance_thresholds']
        for section in required_sections:
            assert section in config

        # Verify endpoints have required fields
        for endpoint in config['endpoints']:
            assert 'name' in endpoint
            assert 'url' in endpoint
            assert 'method' in endpoint

        suite.session.close()

    @patch.dict('os.environ', {'WESIGN_BASE_URL': 'https://test.example.com'})
    def test_default_configuration_with_env_var(self):
        """Test default configuration uses environment variables."""
        suite = SmokeTestSuite()
        config = suite._get_default_configuration()

        # Check that environment variable is used
        base_url = 'https://test.example.com'
        for endpoint in config['endpoints']:
            if endpoint['url'].startswith(base_url):
                assert True
                break
        else:
            pytest.fail("Base URL from environment variable not found in endpoints")

        suite.session.close()

    @patch('smoke_check.requests.Response')
    def test_validate_response_content_type(self, mock_response_class):
        """Test response validation for content type."""
        mock_response = MagicMock()
        mock_response.headers = {'content-type': 'application/json; charset=utf-8'}
        mock_response.text = 'test response'
        mock_response.json.return_value = {'test': True}

        suite = SmokeTestSuite()

        config = EndpointConfig(
            name='test',
            url='https://example.com',
            validation_rules={'content_type': 'application/json'}
        )

        result = suite._validate_response(mock_response, config)

        assert result['valid'] == True
        assert len(result['checks']) > 0
        assert result['checks'][0]['rule'] == 'content_type'
        assert result['checks'][0]['passed'] == True

        suite.session.close()

    def test_validate_response_contains_text(self):
        """Test response validation for required text."""
        mock_response = MagicMock()
        mock_response.headers = {}
        mock_response.text = 'This is a test response with required content'

        suite = SmokeTestSuite()

        config = EndpointConfig(
            name='test',
            url='https://example.com',
            validation_rules={'response_contains': ['required content', 'test response']}
        )

        result = suite._validate_response(mock_response, config)

        assert result['valid'] == True
        content_checks = [check for check in result['checks'] if check['rule'] == 'response_contains']
        assert len(content_checks) == 2
        assert all(check['passed'] for check in content_checks)

        suite.session.close()

    def test_validate_response_json_structure(self):
        """Test response validation for JSON structure."""
        mock_response = MagicMock()
        mock_response.headers = {}
        mock_response.text = 'valid response'
        mock_response.json.return_value = {'key': 'value', 'status': 'ok'}

        suite = SmokeTestSuite()

        config = EndpointConfig(
            name='test',
            url='https://example.com',
            validation_rules={'json_structure': True}
        )

        result = suite._validate_response(mock_response, config)

        assert result['valid'] == True
        json_checks = [check for check in result['checks'] if check['rule'] == 'json_structure']
        assert len(json_checks) == 1
        assert json_checks[0]['passed'] == True

        suite.session.close()

    def test_calculate_test_summary(self):
        """Test test summary calculation."""
        suite = SmokeTestSuite()

        # Add mock results
        suite.results = [
            TestResult('test1', 'endpoint', 'PASS', 100.0, 'Test 1 passed'),
            TestResult('test2', 'endpoint', 'FAIL', 150.0, 'Test 2 failed'),
            TestResult('test3', 'database', 'PASS', 200.0, 'Test 3 passed'),
            TestResult('test4', 'service', 'WARN', 75.0, 'Test 4 warning'),
            TestResult('test5', 'service', 'SKIP', 0.0, 'Test 5 skipped'),
        ]

        summary = suite._calculate_test_summary()

        assert summary['total_tests'] == 5
        assert summary['passed'] == 2
        assert summary['failed'] == 1
        assert summary['warnings'] == 1
        assert summary['skipped'] == 1
        assert summary['success_rate_percent'] == 40.0  # 2/5 * 100
        assert summary['overall_status'] == 'FAIL'  # Has failures

        # Check categories
        assert 'endpoint' in summary['categories']
        assert 'database' in summary['categories']
        assert 'service' in summary['categories']

        # Check performance metrics
        assert 'performance' in summary
        assert summary['performance']['average_duration_ms'] == 105.0  # (100+150+200+75+0)/5
        assert summary['performance']['max_duration_ms'] == 200.0
        assert summary['performance']['min_duration_ms'] == 0.0

        suite.session.close()


class TestSmokeTestSuiteIntegration:
    """Integration tests for SmokeTestSuite."""

    @patch('smoke_check.RetryableHTTPSession.request')
    def test_run_endpoint_tests_success(self, mock_request):
        """Test running endpoint tests with successful responses."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b'test response'
        mock_response.headers = {'content-type': 'text/html'}
        mock_response.text = 'test response'
        mock_request.return_value = mock_response

        config_data = {
            'endpoints': [
                {
                    'name': 'test_endpoint',
                    'url': 'https://example.com',
                    'method': 'GET',
                    'expected_status': 200,
                    'timeout_seconds': 5
                }
            ],
            'performance_thresholds': {
                'endpoint_response_time_ms': 3000
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_path = Path(f.name)

        try:
            suite = SmokeTestSuite(config_file=config_path)
            results = suite.run_endpoint_tests()

            assert len(results) == 1
            assert results[0].test_name == 'endpoint_test_endpoint'
            assert results[0].category == 'endpoint'
            assert results[0].status == 'PASS'
            assert results[0].duration_ms > 0

        finally:
            config_path.unlink()
            suite.session.close()

    def test_run_database_tests_sqlite(self):
        """Test running database tests with SQLite."""
        # Create temporary SQLite database
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as db_file:
            db_path = db_file.name

        try:
            # Initialize database
            conn = sqlite3.connect(db_path)
            conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')
            conn.commit()
            conn.close()

            config_data = {
                'databases': [
                    {
                        'name': 'test_db',
                        'connection_string': db_path,
                        'db_type': 'sqlite',
                        'test_query': 'SELECT COUNT(*) FROM sqlite_master',
                        'timeout_seconds': 10
                    }
                ]
            }

            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(config_data, f)
                config_path = Path(f.name)

            try:
                suite = SmokeTestSuite(config_file=config_path)
                results = suite.run_database_tests()

                assert len(results) == 1
                assert results[0].test_name == 'sqlite_connection_test_db'
                assert results[0].category == 'database'
                assert results[0].status == 'PASS'

            finally:
                config_path.unlink()
                suite.session.close()

        finally:
            Path(db_path).unlink(missing_ok=True)

    @patch('subprocess.run')
    def test_run_all_tests_comprehensive(self, mock_subprocess):
        """Test running all smoke tests together."""
        # Mock ping subprocess
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'Reply from host: time<1ms'
        mock_subprocess.return_value = mock_result

        # Create minimal test database
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as db_file:
            db_path = db_file.name

        try:
            conn = sqlite3.connect(db_path)
            conn.execute('CREATE TABLE test (id INTEGER PRIMARY KEY)')
            conn.commit()
            conn.close()

            config_data = {
                'endpoints': [],  # Empty to avoid network calls in test
                'databases': [
                    {
                        'name': 'test_db',
                        'connection_string': db_path,
                        'db_type': 'sqlite'
                    }
                ],
                'services': [
                    {
                        'name': 'ping_test',
                        'host': 'localhost',
                        'port': 0,
                        'protocol': 'icmp'
                    }
                ]
            }

            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(config_data, f)
                config_path = Path(f.name)

            try:
                suite = SmokeTestSuite(config_file=config_path)
                report = suite.run_all_tests()

                assert 'summary' in report
                assert 'execution_info' in report
                assert 'results' in report
                assert 'configuration' in report

                summary = report['summary']
                assert summary['total_tests'] >= 2  # At least database and service tests
                assert 'passed' in summary
                assert 'failed' in summary
                assert 'success_rate_percent' in summary

            finally:
                config_path.unlink()
                suite.session.close()

        finally:
            Path(db_path).unlink(missing_ok=True)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])