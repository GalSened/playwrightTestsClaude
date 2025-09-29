"""
Environment Configuration Management for WeSign Tests

This module handles loading and managing different environment configurations
for development, staging, production, and local testing environments.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class LoginCredentials:
    """Login credentials for different user types"""
    email: str
    password: str


@dataclass
class BrowserSettings:
    """Browser configuration settings"""
    headless: bool
    viewport: Dict[str, int]
    slowMo: Optional[int] = None
    devtools: Optional[bool] = None


@dataclass
class TimeoutSettings:
    """Timeout configuration for different operations"""
    default: int
    login: int
    upload: int
    signing: int


@dataclass
class ApiSettings:
    """API configuration settings"""
    base_url: str
    timeout: int
    retry_attempts: int


@dataclass
class TestDataSettings:
    """Test data management settings"""
    cleanup_after_test: bool
    use_test_isolation: bool
    debug_mode: Optional[bool] = None
    safe_mode: Optional[bool] = None


@dataclass
class EnvironmentConfig:
    """Complete environment configuration"""
    base_url: str
    company_user: LoginCredentials
    basic_user: LoginCredentials
    test_files_path: str
    timeouts: TimeoutSettings
    browser_settings: BrowserSettings
    api_settings: Optional[ApiSettings] = None
    test_data: Optional[TestDataSettings] = None
    monitoring: Optional[Dict[str, Any]] = None
    development: Optional[Dict[str, Any]] = None


class EnvironmentManager:
    """Manages environment configurations for WeSign tests"""

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize the environment manager

        Args:
            base_path: Base path for configuration files (defaults to project root)
        """
        if base_path is None:
            # Default to the new_tests_for_wesign directory
            base_path = Path(__file__).parent.parent

        self.base_path = Path(base_path)
        self.current_env = os.getenv('WESIGN_TEST_ENV', 'dev')
        self._config_cache: Dict[str, EnvironmentConfig] = {}

    def get_config_file_path(self, environment: str) -> Path:
        """Get the path to the configuration file for the specified environment"""
        if environment == 'dev':
            return self.base_path / 'appsettings.json'
        else:
            return self.base_path / f'appsettings.{environment}.json'

    def load_config(self, environment: str) -> EnvironmentConfig:
        """
        Load configuration for the specified environment

        Args:
            environment: Environment name (dev, staging, production, local)

        Returns:
            EnvironmentConfig object with all settings
        """
        # Check cache first
        if environment in self._config_cache:
            return self._config_cache[environment]

        config_file = self.get_config_file_path(environment)

        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_file}")

        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)

            # Parse the configuration
            config = self._parse_config(config_data)

            # Cache the configuration
            self._config_cache[environment] = config

            return config

        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in configuration file {config_file}: {e}")
        except Exception as e:
            raise RuntimeError(f"Failed to load configuration from {config_file}: {e}")

    def _parse_config(self, config_data: Dict[str, Any]) -> EnvironmentConfig:
        """Parse configuration data into structured objects"""

        # Parse login credentials
        creds = config_data['login_credentials']
        company_user = LoginCredentials(**creds['company_user'])
        basic_user = LoginCredentials(**creds['basic_user'])

        # Parse timeouts
        timeouts = TimeoutSettings(**config_data['timeouts'])

        # Parse browser settings
        browser_data = config_data['browser_settings']
        browser_settings = BrowserSettings(
            headless=browser_data['headless'],
            viewport=browser_data['viewport'],
            slowMo=browser_data.get('slowMo'),
            devtools=browser_data.get('devtools')
        )

        # Parse API settings (optional)
        api_settings = None
        if 'api_settings' in config_data:
            api_settings = ApiSettings(**config_data['api_settings'])

        # Parse test data settings (optional)
        test_data = None
        if 'test_data' in config_data:
            test_data_config = config_data['test_data']
            test_data = TestDataSettings(
                cleanup_after_test=test_data_config['cleanup_after_test'],
                use_test_isolation=test_data_config['use_test_isolation'],
                debug_mode=test_data_config.get('debug_mode'),
                safe_mode=test_data_config.get('safe_mode')
            )

        return EnvironmentConfig(
            base_url=config_data['base_url'],
            company_user=company_user,
            basic_user=basic_user,
            test_files_path=config_data['test_files_path'],
            timeouts=timeouts,
            browser_settings=browser_settings,
            api_settings=api_settings,
            test_data=test_data,
            monitoring=config_data.get('monitoring'),
            development=config_data.get('development')
        )

    def get_current_config(self) -> EnvironmentConfig:
        """Get configuration for the current environment"""
        return self.load_config(self.current_env)

    def set_environment(self, environment: str) -> None:
        """Set the current environment"""
        valid_envs = ['dev', 'staging', 'production', 'local']
        if environment not in valid_envs:
            raise ValueError(f"Invalid environment: {environment}. Valid options: {valid_envs}")

        self.current_env = environment

    def get_test_files_path(self, environment: Optional[str] = None) -> Path:
        """Get the absolute path to test files for the specified environment"""
        if environment is None:
            environment = self.current_env

        config = self.load_config(environment)
        return self.base_path / config.test_files_path

    def list_available_environments(self) -> list[str]:
        """List all available environment configurations"""
        environments = []

        # Check for dev config (appsettings.json)
        if (self.base_path / 'appsettings.json').exists():
            environments.append('dev')

        # Check for other environment configs
        for env in ['staging', 'production', 'local']:
            if (self.base_path / f'appsettings.{env}.json').exists():
                environments.append(env)

        return environments

    def validate_config(self, environment: str) -> Dict[str, Any]:
        """
        Validate configuration for the specified environment

        Returns:
            Dict with validation results
        """
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }

        try:
            config = self.load_config(environment)

            # Validate required URLs
            if not config.base_url:
                validation_result['errors'].append('Missing base_url')

            # Validate credentials
            if not config.company_user.email or not config.company_user.password:
                validation_result['errors'].append('Missing company user credentials')

            if not config.basic_user.email or not config.basic_user.password:
                validation_result['errors'].append('Missing basic user credentials')

            # Validate test files path
            test_files_path = self.get_test_files_path(environment)
            if not test_files_path.exists():
                validation_result['warnings'].append(f'Test files directory does not exist: {test_files_path}')

            # Set valid to False if there are errors
            if validation_result['errors']:
                validation_result['valid'] = False

        except Exception as e:
            validation_result['valid'] = False
            validation_result['errors'].append(f'Configuration loading failed: {str(e)}')

        return validation_result


# Global environment manager instance
env_manager = EnvironmentManager()


def get_config(environment: Optional[str] = None) -> EnvironmentConfig:
    """
    Convenience function to get configuration

    Args:
        environment: Environment name (defaults to current environment)

    Returns:
        EnvironmentConfig object
    """
    if environment is None:
        return env_manager.get_current_config()
    else:
        return env_manager.load_config(environment)


def set_environment(environment: str) -> None:
    """
    Convenience function to set the current environment

    Args:
        environment: Environment name
    """
    env_manager.set_environment(environment)


def validate_environment(environment: str) -> Dict[str, Any]:
    """
    Convenience function to validate an environment configuration

    Args:
        environment: Environment name

    Returns:
        Dict with validation results
    """
    return env_manager.validate_config(environment)