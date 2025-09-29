#!/usr/bin/env python3
"""
Unit Tests for Configuration Transformer (appsettings_patch.py)
==============================================================

Comprehensive unit tests for the WeSign configuration transformer utility.

Author: QA Intelligence System
Version: 2.0
"""

import json
import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from appsettings_patch import (
    ConfigurationTransformer,
    SecureCredentialManager,
    ConfigurationError
)


class TestSecureCredentialManager:
    """Test secure credential management functionality."""

    def test_mask_credentials_passwords(self):
        """Test password masking in various formats."""
        test_cases = [
            ('password="secret123"', 'password="***MASKED***"'),
            ('Password: "mypass"', 'Password: "***MASKED***"'),
            ('connectionstring="Server=test;Password=secret;', 'connectionstring="***MASKED***"'),
            ('JWT_SECRET="abcd1234"', 'JWT_SECRET="***MASKED***"'),
        ]

        for input_text, expected in test_cases:
            result = SecureCredentialManager.mask_credentials(input_text)
            assert '***MASKED***' in result
            assert 'secret' not in result
            assert 'mypass' not in result

    def test_mask_credentials_connection_strings(self):
        """Test connection string masking."""
        conn_str = 'Server=localhost;Database=Test;User Id=admin;Password=secret123;'
        result = SecureCredentialManager.mask_credentials(conn_str)
        assert 'secret123' not in result
        assert '***MASKED***' in result

    @patch.dict(os.environ, {'TEST_KEY': 'test_value'})
    def test_get_secure_value_exists(self):
        """Test retrieving existing environment variable."""
        value = SecureCredentialManager.get_secure_value('TEST_KEY')
        assert value == 'test_value'

    def test_get_secure_value_not_exists(self):
        """Test retrieving non-existent environment variable."""
        value = SecureCredentialManager.get_secure_value('NONEXISTENT_KEY')
        assert value is None

    def test_get_secure_value_with_default(self):
        """Test retrieving with default value."""
        value = SecureCredentialManager.get_secure_value('NONEXISTENT_KEY', 'default_value')
        assert value == 'default_value'


class TestConfigurationTransformer:
    """Test configuration transformation functionality."""

    def create_test_config(self):
        """Create a test configuration file."""
        config = {
            "Logging": {
                "LogLevel": {
                    "Default": "Information"
                }
            },
            "ConnectionStrings": {
                "DefaultConnection": "Data Source=test.db"
            },
            "AllowedHosts": "*"
        }
        return config

    def test_initialization_valid_environment(self):
        """Test initialization with valid environment."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.create_test_config(), f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            assert transformer.environment == 'DevTest'
            assert transformer.config_path == config_path
        finally:
            config_path.unlink()

    def test_initialization_invalid_environment(self):
        """Test initialization with invalid environment."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.create_test_config(), f)
            config_path = Path(f.name)

        try:
            with pytest.raises(ConfigurationError):
                ConfigurationTransformer(config_path, 'InvalidEnv')
        finally:
            config_path.unlink()

    def test_initialization_missing_file(self):
        """Test initialization with missing configuration file."""
        config_path = Path('nonexistent.json')
        with pytest.raises(ConfigurationError):
            ConfigurationTransformer(config_path, 'DevTest')

    def test_load_configuration_valid(self):
        """Test loading valid JSON configuration."""
        config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            loaded_config = transformer.load_configuration()
            assert loaded_config == config
        finally:
            config_path.unlink()

    def test_load_configuration_invalid_json(self):
        """Test loading invalid JSON configuration."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('invalid json content {')
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            with pytest.raises(ConfigurationError):
                transformer.load_configuration()
        finally:
            config_path.unlink()

    def test_create_backup(self):
        """Test backup creation."""
        config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            backup_path = transformer.create_backup()

            assert backup_path.exists()
            assert backup_path != config_path
            assert 'backup' in backup_path.name

            # Verify backup content
            with open(backup_path, 'r') as backup_file:
                backup_config = json.load(backup_file)
            assert backup_config == config

            # Cleanup
            backup_path.unlink()
        finally:
            config_path.unlink()

    def test_apply_nested_setting(self):
        """Test applying nested configuration settings."""
        config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')

            # Test setting nested value
            old_value = transformer._apply_nested_setting(
                config, 'Logging:LogLevel:Microsoft', 'Warning'
            )
            assert config['Logging']['LogLevel']['Microsoft'] == 'Warning'

            # Test creating new nested structure
            transformer._apply_nested_setting(
                config, 'NewSection:NewKey', 'NewValue'
            )
            assert config['NewSection']['NewKey'] == 'NewValue'

        finally:
            config_path.unlink()

    @patch.dict(os.environ, {
        'WESIGN_DEVTEST_CONNECTION_STRING': 'Server=dev;Database=DevTest;',
        'WESIGN_JWT_SECRET': 'dev-secret-key'
    })
    def test_apply_environment_settings_devtest(self):
        """Test applying DevTest environment settings."""
        config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            original_config = transformer.load_configuration()
            transformed_config = transformer.apply_environment_settings(original_config)

            # Verify environment-specific changes
            assert 'WeSignSettings' in transformed_config
            assert transformed_config['WeSignSettings']['Environment'] == 'DevTest'
            assert transformed_config['WeSignSettings']['BaseUrl'] == 'https://devtest.comda.co.il'
            assert transformed_config['ConnectionStrings']['DefaultConnection'] == 'Server=dev;Database=DevTest;'
            assert 'JwtSettings' in transformed_config
            assert transformed_config['JwtSettings']['Secret'] == 'dev-secret-key'

        finally:
            config_path.unlink()

    def test_validation_connection_strings(self):
        """Test connection string validation."""
        config = {
            'ConnectionStrings': {
                'Valid': 'Server=localhost;Database=Test;',
                'Invalid': 'InvalidConnectionString',
                'Empty': ''
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            is_valid = transformer._validate_connection_strings(config)
            assert not is_valid  # Should fail due to invalid connection strings
        finally:
            config_path.unlink()

    def test_validation_urls(self):
        """Test URL validation."""
        valid_config = {
            'WeSignSettings': {
                'BaseUrl': 'https://valid.example.com'
            }
        }

        invalid_config = {
            'WeSignSettings': {
                'BaseUrl': 'invalid-url'
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(valid_config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')

            # Test valid URL
            assert transformer._validate_urls(valid_config) == True

            # Test invalid URL
            assert transformer._validate_urls(invalid_config) == False
        finally:
            config_path.unlink()

    def test_validation_jwt_settings(self):
        """Test JWT settings validation."""
        valid_config = {
            'JwtSettings': {
                'Secret': 'valid-secret',
                'Issuer': 'valid-issuer',
                'ExpirationMinutes': 30
            }
        }

        invalid_config = {
            'JwtSettings': {
                'Secret': '',  # Missing required field
                'ExpirationMinutes': -5  # Invalid expiration
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(valid_config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')

            # Test valid JWT settings
            assert transformer._validate_jwt_settings(valid_config) == True

            # Test invalid JWT settings
            assert transformer._validate_jwt_settings(invalid_config) == False
        finally:
            config_path.unlink()

    def test_rollback_configuration(self):
        """Test configuration rollback functionality."""
        original_config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(original_config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')

            # Create backup
            backup_path = transformer.create_backup()

            # Modify original file
            modified_config = original_config.copy()
            modified_config['Modified'] = True
            with open(config_path, 'w') as f:
                json.dump(modified_config, f)

            # Rollback
            success = transformer.rollback_configuration()
            assert success

            # Verify rollback
            with open(config_path, 'r') as f:
                restored_config = json.load(f)
            assert restored_config == original_config
            assert 'Modified' not in restored_config

            # Cleanup
            backup_path.unlink()
        finally:
            config_path.unlink()

    def test_transformation_summary(self):
        """Test transformation summary generation."""
        config = self.create_test_config()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            config_path = Path(f.name)

        try:
            transformer = ConfigurationTransformer(config_path, 'DevTest')
            transformer.create_backup()

            # Apply some transformations
            transformer.apply_environment_settings(transformer.load_configuration())

            # Get summary
            summary = transformer.get_transformation_summary()

            assert 'environment' in summary
            assert summary['environment'] == 'DevTest'
            assert 'config_path' in summary
            assert 'transformations_count' in summary
            assert 'timestamp' in summary
            assert isinstance(summary['transformations'], list)

        finally:
            config_path.unlink()
            if transformer.backup_path and transformer.backup_path.exists():
                transformer.backup_path.unlink()


class TestConfigurationTransformerIntegration:
    """Integration tests for the configuration transformer."""

    @patch.dict(os.environ, {
        'WESIGN_DEVTEST_CONNECTION_STRING': 'Server=integration-test;Database=DevTest;',
        'WESIGN_JWT_SECRET': 'integration-test-secret'
    })
    def test_full_transformation_workflow(self):
        """Test complete transformation workflow."""
        original_config = {
            "Logging": {
                "LogLevel": {
                    "Default": "Information"
                }
            },
            "ConnectionStrings": {
                "DefaultConnection": "Data Source=original.db"
            },
            "AllowedHosts": "*"
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(original_config, f)
            config_path = Path(f.name)

        try:
            # Initialize transformer
            transformer = ConfigurationTransformer(config_path, 'DevTest')

            # Create backup
            backup_path = transformer.create_backup()
            assert backup_path.exists()

            # Load and transform configuration
            config = transformer.load_configuration()
            transformed_config = transformer.apply_environment_settings(config)

            # Validate transformed configuration
            is_valid = transformer.validate_configuration(transformed_config)
            assert is_valid

            # Save transformed configuration
            success = transformer.save_configuration(transformed_config)
            assert success

            # Verify saved configuration
            with open(config_path, 'r') as f:
                saved_config = json.load(f)

            # Check transformations were applied
            assert saved_config['WeSignSettings']['Environment'] == 'DevTest'
            assert saved_config['WeSignSettings']['BaseUrl'] == 'https://devtest.comda.co.il'
            assert saved_config['ConnectionStrings']['DefaultConnection'] == 'Server=integration-test;Database=DevTest;'
            assert saved_config['JwtSettings']['Secret'] == 'integration-test-secret'
            assert saved_config['Logging']['LogLevel']['Default'] == 'Debug'  # DevTest specific

            # Test rollback
            rollback_success = transformer.rollback_configuration()
            assert rollback_success

            # Verify rollback
            with open(config_path, 'r') as f:
                restored_config = json.load(f)
            assert restored_config == original_config

            # Cleanup
            backup_path.unlink()

        finally:
            config_path.unlink()

    def test_multiple_environment_transformations(self):
        """Test transformations for different environments."""
        base_config = {
            "Logging": {"LogLevel": {"Default": "Information"}},
            "ConnectionStrings": {"DefaultConnection": "Data Source=base.db"},
            "AllowedHosts": "*"
        }

        environments = ['DevTest', 'Staging', 'Production']

        for environment in environments:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(base_config, f)
                config_path = Path(f.name)

            try:
                transformer = ConfigurationTransformer(config_path, environment)
                config = transformer.load_configuration()
                transformed_config = transformer.apply_environment_settings(config)

                # Verify environment-specific settings
                assert transformed_config['WeSignSettings']['Environment'] == environment

                if environment == 'DevTest':
                    assert transformed_config['WeSignSettings']['BaseUrl'] == 'https://devtest.comda.co.il'
                    assert transformed_config['Logging']['LogLevel']['Default'] == 'Debug'
                    assert transformed_config['WeSignSettings']['EnableDetailedErrors'] == True
                elif environment == 'Staging':
                    assert transformed_config['WeSignSettings']['BaseUrl'] == 'https://staging.comda.co.il'
                    assert transformed_config['WeSignSettings']['EnableDetailedErrors'] == False
                elif environment == 'Production':
                    assert transformed_config['WeSignSettings']['BaseUrl'] == 'https://wesign.comda.co.il'
                    assert transformed_config['Logging']['LogLevel']['Default'] == 'Warning'
                    assert transformed_config['WeSignSettings']['EnablePerformanceMonitoring'] == True

            finally:
                config_path.unlink()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])