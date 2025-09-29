"""
Configuration package for WeSign test suite

This package provides environment configuration management
for different testing environments (dev, staging, production, local).
"""

from .environment import (
    EnvironmentConfig,
    EnvironmentManager,
    LoginCredentials,
    BrowserSettings,
    TimeoutSettings,
    ApiSettings,
    TestDataSettings,
    get_config,
    set_environment,
    validate_environment,
    env_manager
)

__all__ = [
    "EnvironmentConfig",
    "EnvironmentManager", 
    "LoginCredentials",
    "BrowserSettings",
    "TimeoutSettings",
    "ApiSettings",
    "TestDataSettings",
    "get_config",
    "set_environment",
    "validate_environment",
    "env_manager"
]
