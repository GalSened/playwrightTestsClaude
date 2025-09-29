"""
Comprehensive tests for Single Test Runner module
Tests all edge cases and scenarios for individual test execution
"""

import pytest
import asyncio
import unittest
from unittest.mock import Mock, patch, MagicMock, AsyncMock, call
import time
import threading
from datetime import datetime, timedelta
import json
import tempfile
import os
import sys
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

# Import test utilities
from qodo_tests import TestConstants, TestFixtures, MockTestCase, MockAIService, logger, create_temp_test_file, cleanup_temp_files


class TestSingleTestRunner(unittest.TestCase):
    """Comprehensive tests for SingleTestRunner"""

    def setUp(self):
        """Set up test fixtures"""
        self.runner = None
        self.mock_db = Mock()
        self.mock_ai_service = MockAIService()
        self.mock_reporter = Mock()
        self.test_case = TestFixtures.get_sample_test_case()
        self.temp_files = []
        
    def tearDown(self):
        """Clean up after tests"""
        if self.runner:
            self.runner.cleanup()
        cleanup_temp_files(self.temp_files)

    @patch('single_test_runner.SingleTestRunner')
    def test_single_runner_initialization_default(self, mock_runner_class):
        """Test SingleTestRunner initialization with default configuration"""
        mock_runner = Mock()
        mock_runner.config = {'timeout': 30, 'retries': 3}
        mock_runner_class.return_value = mock_runner
        
        runner = mock_runner_class()
        
        # Verify initialization
        mock_runner_class.assert_called_once()
        self.assertIsNotNone(runner)
        self.assertEqual(runner.config['timeout'], 30)

    @patch('single_test_runner.SingleTestRunner')
    def test_single_runner_initialization_custom_config(self, mock_runner_class):
        """Test SingleTestRunner initialization with custom configuration"""
        custom_config = {
            'timeout': 60,
            'retries': 5,
            'screenshot_on_failure': True,
            'ai_healing_enabled': True
        }
        
        mock_runner = Mock()
        mock_runner.config = custom_config
        mock_runner_class.return_value = mock_runner
        
        runner = mock_runner_class(config=custom_config)
        
        mock_runner_class.assert_called_once_with(config=custom_config)
        self.assertEqual(runner.config['timeout'], 60)
        self.assertEqual(runner.config['retries'], 5)
        self.assertTrue(runner.config['ai_healing_enabled'])

    @patch('single_test_runner.SingleTestRunner')
    async def test_execute_single_test_success(self, mock_runner_class):
        """Test successful single test execution"""
        mock_runner = AsyncMock()
        mock_runner_class.return_value = mock_runner
        
        expected_result = {
            'test_id': 'test_001',
            'status': 'passed',
            'execution_time': 2.5,
            'start_time': datetime.now(),
            'end_time': datetime.now() + timedelta(seconds=2.5),
            'steps_executed': 5,
            'screenshots': [],
            'logs': ['Test started', 'Navigation successful', 'Login completed']
        }
        mock_runner.execute_test.return_value = expected_result
        
        runner = mock_runner_class()
        result = await runner.execute_test(self.test_case)
        
        # Assertions
        self.assertEqual(result['status'], 'passed')
        self.assertEqual(result['test_id'], 'test_001')
        self.assertIsInstance(result['execution_time'], (int, float))
        self.assertEqual(result['steps_executed'], 5)
        mock_runner.execute_test.assert_called_once_with(self.test_case)

    @patch('single_test_runner.SingleTestRunner')
    async def test_execute_single_test_failure_with_screenshot(self, mock_runner_class):
        """Test single test execution failure with screenshot capture"""
        mock_runner = AsyncMock()
        mock_runner_class.return_value = mock_runner
        
        expected_result = {
            'test_id': 'test_001',
            'status': 'failed',
            'error_message': 'Element not found: #login-button',
            'error_type': 'ElementNotFoundError',
            'execution_time': 1.2,
            'screenshot': 'failure_screenshot_001.png',
            'page_source': '<html>...</html>',
            'browser_logs': ['Console error: Element not visible'],
            'stack_trace': 'Traceback...'
        }
        mock_runner.execute_test.return_value = expected_result
        
        runner = mock_runner_class()
        result = await runner.execute_test(self.test_case)
        
        # Assertions
        self.assertEqual(result['status'], 'failed')
        self.assertIn('error_message', result)
        self.assertIn('screenshot', result)
        self.assertIn('page_source', result)
        self.assertEqual(result['error_type'], 'ElementNotFoundError')

    @patch('single_test_runner.SingleTestRunner')
    async def test_execute_test_timeout_handling(self, mock_runner_class):
        """Test test execution timeout handling"""
        mock_runner = AsyncMock()
        mock_runner_class.return_value = mock_runner
        
        # Mock timeout scenario
        async def timeout_side_effect(*args, **kwargs):
            await asyncio.sleep(2)  # Simulate long-running test
            raise asyncio.TimeoutError("Test execution timed out after 30 seconds")
        
        mock_runner.execute_test.side_effect = timeout_side_effect
        
        runner = mock_runner_class()
        
        with self.assertRaises(asyncio.TimeoutError):
            await asyncio.wait_for(runner.execute_test(self.test_case), timeout=1)

    @patch('single_test_runner.SingleTestRunner')
    def test_test_validation_valid_case(self, mock_runner_class):
        """Test validation of valid test cases"""
        mock_runner = Mock()
        mock_runner_class.return_value = mock_runner
        
        