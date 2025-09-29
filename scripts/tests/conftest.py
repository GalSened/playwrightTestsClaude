#!/usr/bin/env python3
"""
Test Configuration and Fixtures for WeSign CI/CD Utilities
==========================================================

Common test fixtures and configuration for all utility test suites.

Author: QA Intelligence System
Version: 2.0
"""

import pytest
import tempfile
import json
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock


@pytest.fixture
def temp_json_file():
    """Create a temporary JSON file for testing."""
    def _create_temp_json(data):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(data, f)
            return Path(f.name)
    return _create_temp_json


@pytest.fixture
def temp_sqlite_db():
    """Create a temporary SQLite database for testing."""
    def _create_temp_db(schema_sql=None):
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name

        conn = sqlite3.connect(db_path)
        if schema_sql:
            conn.executescript(schema_sql)
        else:
            conn.execute('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)')
            conn.execute('INSERT INTO test_table (name) VALUES ("test_record")')
        conn.commit()
        conn.close()
        return Path(db_path)
    return _create_temp_db


@pytest.fixture
def mock_http_response():
    """Create mock HTTP response for testing."""
    def _create_response(status_code=200, headers=None, content='', json_data=None):
        response = MagicMock()
        response.status_code = status_code
        response.headers = headers or {}
        response.content = content.encode() if isinstance(content, str) else content
        response.text = content if isinstance(content, str) else content.decode()

        if json_data:
            response.json.return_value = json_data
        else:
            response.json.side_effect = ValueError("No JSON object could be decoded")

        return response
    return _create_response


@pytest.fixture
def sample_config_data():
    """Provide sample configuration data for testing."""
    return {
        'endpoints': [
            {
                'name': 'health_check',
                'url': 'https://example.com/health',
                'method': 'GET',
                'expected_status': 200,
                'timeout_seconds': 5
            },
            {
                'name': 'api_test',
                'url': 'https://api.example.com/v1/test',
                'method': 'POST',
                'payload': {'test': True},
                'expected_status': 201,
                'timeout_seconds': 10
            }
        ],
        'databases': [
            {
                'name': 'main_db',
                'connection_string': 'Data Source=test.db',
                'db_type': 'sqlite',
                'test_query': 'SELECT COUNT(*) FROM test_table'
            }
        ],
        'services': [
            {
                'name': 'web_server',
                'host': 'localhost',
                'port': 80,
                'protocol': 'tcp'
            }
        ],
        'performance_thresholds': {
            'endpoint_response_time_ms': 3000,
            'database_query_time_ms': 1000
        }
    }


@pytest.fixture
def sample_appsettings_data():
    """Provide sample appsettings.json data for testing."""
    return {
        "Logging": {
            "LogLevel": {
                "Default": "Information",
                "Microsoft.AspNetCore": "Warning"
            }
        },
        "ConnectionStrings": {
            "DefaultConnection": "Data Source=app.db"
        },
        "AllowedHosts": "*",
        "WeSignSettings": {
            "BaseUrl": "https://localhost:7001",
            "Environment": "Development",
            "EnableDetailedErrors": True
        }
    }


@pytest.fixture
def cleanup_files():
    """Clean up files created during tests."""
    files_to_cleanup = []

    def register_file(file_path):
        files_to_cleanup.append(Path(file_path))

    yield register_file

    # Cleanup
    for file_path in files_to_cleanup:
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass  # Ignore cleanup errors


@pytest.fixture
def mock_environment():
    """Mock environment variables for testing."""
    def _mock_env(env_vars):
        import os
        from unittest.mock import patch
        return patch.dict(os.environ, env_vars)
    return _mock_env


@pytest.fixture(autouse=True)
def reset_logging():
    """Reset logging configuration between tests."""
    import logging
    # Store original handlers
    original_handlers = logging.root.handlers[:]
    original_level = logging.root.level

    yield

    # Restore original configuration
    logging.root.handlers = original_handlers
    logging.root.level = original_level


@pytest.fixture
def sample_trx_data():
    """Provide sample TRX test results XML data."""
    return '''<?xml version="1.0" encoding="utf-8"?>
<TestRun id="test-run-id" name="Test Results" runUser="testuser" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Times creation="2024-01-01T10:00:00.000Z" queuing="2024-01-01T10:00:00.000Z" start="2024-01-01T10:00:01.000Z" finish="2024-01-01T10:00:05.000Z" />
  <ResultSummary outcome="Completed">
    <Counters total="10" executed="10" passed="8" failed="2" error="0" timeout="0" aborted="0" inconclusive="0" />
  </ResultSummary>
</TestRun>'''


@pytest.fixture
def sample_newman_html():
    """Provide sample Newman HTML report content."""
    return '''<!DOCTYPE html>
<html>
<head><title>Newman Test Report</title></head>
<body>
  <div class="summary">
    <h2>Test Summary</h2>
    <p>Total tests: 15</p>
    <p>Passed: 12</p>
    <p>Failed: 3</p>
    <p>Execution time: 45.5 seconds</p>
  </div>
  <div class="results">
    <p>Average response time: 250ms</p>
  </div>
</body>
</html>'''


@pytest.fixture
def sample_playwright_html():
    """Provide sample Playwright HTML report content."""
    return '''<!DOCTYPE html>
<html>
<head><title>Playwright Test Report</title></head>
<body>
  <div class="suites-header">
    <h1>Test Results</h1>
    <p>20 total, 18 passed, 2 failed, 0 skipped</p>
    <p>Duration: 120.5 seconds</p>
  </div>
</body>
</html>'''


@pytest.fixture
def mock_jenkins_response():
    """Mock Jenkins API response data."""
    def _create_jenkins_response(build_number=42, status='SUCCESS'):
        return {
            'number': build_number,
            'url': f'http://jenkins:8080/job/test-job/{build_number}/',
            'building': False,
            'result': status,
            'timestamp': 1640995200000,  # 2022-01-01 00:00:00 UTC
            'duration': 300000,  # 5 minutes in milliseconds
            'displayName': f'#{build_number}',
            'description': 'Test build',
            'builtOn': 'jenkins-agent-1',
            'actions': [
                {
                    'causes': [
                        {'shortDescription': 'Started by user admin'}
                    ]
                },
                {
                    'lastBuiltRevision': {'SHA1': 'abcd1234567890'},
                    'remoteUrls': ['https://github.com/example/repo.git'],
                    'branch': [{'name': 'origin/main'}]
                }
            ],
            'artifacts': [
                {
                    'displayPath': 'test-results.xml',
                    'fileName': 'test-results.xml',
                    'relativePath': 'artifacts/test-results.xml',
                    'size': 1024
                }
            ]
        }
    return _create_jenkins_response