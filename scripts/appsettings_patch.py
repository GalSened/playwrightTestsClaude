#!/usr/bin/env python3
"""
Configuration Transformer for WeSign CI/CD Pipeline
===================================================

Robust JSON configuration transformer for WeSign deployment automation.
Handles environment-specific settings application with secure credential management.

Author: QA Intelligence System
Version: 2.0
Platform: Windows-compatible (py command ready)
"""

import argparse
import json
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Union
import re
from datetime import datetime

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('appsettings_patch.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass


class SecureCredentialManager:
    """Handles secure credential injection and masking."""

    # Patterns for credential detection and masking
    CREDENTIAL_PATTERNS = [
        r'(?i)(password|pwd|secret|key|token).*?["\']([^"\']+)["\']',
        r'(?i)connectionstring.*?["\']([^"\']+)["\']',
        r'(?i)(server=.*?;.*?password=)([^;]+)(;?)',
    ]

    @classmethod
    def mask_credentials(cls, text: str) -> str:
        """Mask sensitive information in log outputs."""
        masked_text = text
        for pattern in cls.CREDENTIAL_PATTERNS:
            masked_text = re.sub(pattern, r'\1***MASKED***\3' if r'\3' in pattern else r'\1***MASKED***', masked_text)
        return masked_text

    @classmethod
    def get_secure_value(cls, key: str, default: Optional[str] = None) -> Optional[str]:
        """Retrieve secure value from environment variables."""
        value = os.getenv(key, default)
        if value:
            logger.info(f"Retrieved secure value for key: {key}")
            return value
        logger.warning(f"No value found for secure key: {key}")
        return None


class ConfigurationTransformer:
    """Robust JSON configuration transformer with environment-specific settings."""

    SUPPORTED_ENVIRONMENTS = ['DevTest', 'Staging', 'Production', 'Local']

    def __init__(self, config_path: Path, environment: str):
        """Initialize the transformer with configuration file and target environment."""
        self.config_path = Path(config_path)
        self.environment = environment
        self.backup_path = None
        self.transformation_log = []

        # Validate environment
        if environment not in self.SUPPORTED_ENVIRONMENTS:
            raise ConfigurationError(f"Unsupported environment: {environment}. Supported: {self.SUPPORTED_ENVIRONMENTS}")

        # Validate config file exists
        if not self.config_path.exists():
            raise ConfigurationError(f"Configuration file not found: {self.config_path}")

        logger.info(f"Initialized ConfigurationTransformer for {environment} environment")

    def create_backup(self) -> Path:
        """Create a timestamped backup of the original configuration."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{self.config_path.stem}_backup_{timestamp}{self.config_path.suffix}"
        self.backup_path = self.config_path.parent / backup_filename

        shutil.copy2(self.config_path, self.backup_path)
        logger.info(f"Created backup: {self.backup_path}")
        return self.backup_path

    def load_configuration(self) -> Dict[str, Any]:
        """Load and validate JSON configuration file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info("Configuration loaded successfully")
            return config
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Invalid JSON in configuration file: {e}")
        except Exception as e:
            raise ConfigurationError(f"Failed to load configuration: {e}")

    def apply_environment_settings(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment-specific settings to configuration."""
        environment_settings = self._get_environment_settings()

        for setting_path, new_value in environment_settings.items():
            old_value = self._apply_nested_setting(config, setting_path, new_value)
            self.transformation_log.append({
                'path': setting_path,
                'old_value': SecureCredentialManager.mask_credentials(str(old_value)),
                'new_value': SecureCredentialManager.mask_credentials(str(new_value)),
                'timestamp': datetime.now().isoformat()
            })

        logger.info(f"Applied {len(environment_settings)} environment-specific settings")
        return config

    def _get_environment_settings(self) -> Dict[str, Any]:
        """Get environment-specific configuration settings."""
        base_settings = {
            'Logging:LogLevel:Default': 'Information',
            'AllowedHosts': '*'
        }

        # Environment-specific configurations
        env_configs = {
            'DevTest': {
                **base_settings,
                'ConnectionStrings:DefaultConnection': SecureCredentialManager.get_secure_value(
                    'WESIGN_DEVTEST_CONNECTION_STRING',
                    'Server=devtest-db.comda.co.il;Database=WeSign_DevTest;Integrated Security=true;TrustServerCertificate=true;'
                ),
                'WeSignSettings:BaseUrl': 'https://devtest.comda.co.il',
                'WeSignSettings:Environment': 'DevTest',
                'Logging:LogLevel:Default': 'Debug',
                'WeSignSettings:EnableDetailedErrors': True,
                'WeSignSettings:AllowTestAccounts': True,
            },
            'Staging': {
                **base_settings,
                'ConnectionStrings:DefaultConnection': SecureCredentialManager.get_secure_value(
                    'WESIGN_STAGING_CONNECTION_STRING',
                    'Server=staging-db.comda.co.il;Database=WeSign_Staging;Integrated Security=true;TrustServerCertificate=true;'
                ),
                'WeSignSettings:BaseUrl': 'https://staging.comda.co.il',
                'WeSignSettings:Environment': 'Staging',
                'WeSignSettings:EnableDetailedErrors': False,
                'WeSignSettings:AllowTestAccounts': False,
            },
            'Production': {
                **base_settings,
                'ConnectionStrings:DefaultConnection': SecureCredentialManager.get_secure_value(
                    'WESIGN_PROD_CONNECTION_STRING'
                ),
                'WeSignSettings:BaseUrl': 'https://wesign.comda.co.il',
                'WeSignSettings:Environment': 'Production',
                'Logging:LogLevel:Default': 'Warning',
                'WeSignSettings:EnableDetailedErrors': False,
                'WeSignSettings:AllowTestAccounts': False,
                'WeSignSettings:EnablePerformanceMonitoring': True,
            },
            'Local': {
                **base_settings,
                'ConnectionStrings:DefaultConnection': SecureCredentialManager.get_secure_value(
                    'WESIGN_LOCAL_CONNECTION_STRING',
                    'Server=localhost;Database=WeSign_Local;Integrated Security=true;TrustServerCertificate=true;'
                ),
                'WeSignSettings:BaseUrl': 'https://localhost:7001',
                'WeSignSettings:Environment': 'Local',
                'Logging:LogLevel:Default': 'Debug',
                'WeSignSettings:EnableDetailedErrors': True,
                'WeSignSettings:AllowTestAccounts': True,
                'WeSignSettings:EnableHotReload': True,
            }
        }

        # Add JWT settings from environment
        jwt_secret = SecureCredentialManager.get_secure_value('WESIGN_JWT_SECRET')
        if jwt_secret:
            for env_name in env_configs:
                env_configs[env_name]['JwtSettings:Secret'] = jwt_secret
                env_configs[env_name]['JwtSettings:Issuer'] = f'WeSign-{env_name}'
                env_configs[env_name]['JwtSettings:ExpirationMinutes'] = 60 if env_name == 'Local' else 30

        return env_configs.get(self.environment, {})

    def _apply_nested_setting(self, config: Dict[str, Any], setting_path: str, new_value: Any) -> Any:
        """Apply a setting to nested JSON structure using dot notation."""
        keys = setting_path.split(':')
        current = config

        # Navigate to the parent of the target key
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            elif not isinstance(current[key], dict):
                # If the intermediate key exists but is not a dict, log warning and replace
                logger.warning(f"Replacing non-dict value at {key} with dict to support nested setting")
                current[key] = {}
            current = current[key]

        # Store old value and set new value
        final_key = keys[-1]
        old_value = current.get(final_key)
        current[final_key] = new_value

        return old_value

    def validate_configuration(self, config: Dict[str, Any]) -> bool:
        """Validate the transformed configuration."""
        validation_rules = [
            self._validate_connection_strings,
            self._validate_urls,
            self._validate_logging_configuration,
            self._validate_jwt_settings,
        ]

        for rule in validation_rules:
            try:
                if not rule(config):
                    return False
            except Exception as e:
                logger.error(f"Validation rule failed: {e}")
                return False

        logger.info("Configuration validation passed")
        return True

    def _validate_connection_strings(self, config: Dict[str, Any]) -> bool:
        """Validate database connection strings."""
        conn_strings = config.get('ConnectionStrings', {})

        if not conn_strings:
            logger.warning("No connection strings found")
            return True

        for name, conn_str in conn_strings.items():
            if not conn_str or not isinstance(conn_str, str):
                logger.error(f"Invalid connection string for {name}")
                return False

            # Basic connection string format validation
            required_parts = ['Server=', 'Database=']
            if not all(part in conn_str for part in required_parts):
                logger.error(f"Connection string {name} missing required components")
                return False

        return True

    def _validate_urls(self, config: Dict[str, Any]) -> bool:
        """Validate URL configurations."""
        wesign_settings = config.get('WeSignSettings', {})
        base_url = wesign_settings.get('BaseUrl')

        if base_url:
            url_pattern = r'^https?://[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?(?::\d+)?/?$'
            if not re.match(url_pattern, base_url):
                logger.error(f"Invalid BaseUrl format: {base_url}")
                return False

        return True

    def _validate_logging_configuration(self, config: Dict[str, Any]) -> bool:
        """Validate logging configuration."""
        logging_config = config.get('Logging', {})
        if not logging_config:
            return True

        log_levels = logging_config.get('LogLevel', {})
        valid_levels = ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical', 'None']

        for category, level in log_levels.items():
            if level not in valid_levels:
                logger.error(f"Invalid log level '{level}' for category '{category}'")
                return False

        return True

    def _validate_jwt_settings(self, config: Dict[str, Any]) -> bool:
        """Validate JWT configuration settings."""
        jwt_settings = config.get('JwtSettings', {})
        if not jwt_settings:
            return True

        required_fields = ['Secret', 'Issuer']
        for field in required_fields:
            if not jwt_settings.get(field):
                logger.error(f"Missing required JWT setting: {field}")
                return False

        expiration = jwt_settings.get('ExpirationMinutes')
        if expiration and (not isinstance(expiration, int) or expiration <= 0):
            logger.error("Invalid JWT expiration minutes")
            return False

        return True

    def save_configuration(self, config: Dict[str, Any]) -> bool:
        """Save the transformed configuration back to file."""
        try:
            # Write with proper formatting
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            logger.info(f"Configuration saved successfully to {self.config_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            return False

    def rollback_configuration(self) -> bool:
        """Rollback to the backup configuration."""
        if not self.backup_path or not self.backup_path.exists():
            logger.error("No backup available for rollback")
            return False

        try:
            shutil.copy2(self.backup_path, self.config_path)
            logger.info(f"Rolled back configuration from backup: {self.backup_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to rollback configuration: {e}")
            return False

    def get_transformation_summary(self) -> Dict[str, Any]:
        """Get a summary of all transformations applied."""
        return {
            'environment': self.environment,
            'config_path': str(self.config_path),
            'backup_path': str(self.backup_path) if self.backup_path else None,
            'transformations_count': len(self.transformation_log),
            'transformations': self.transformation_log,
            'timestamp': datetime.now().isoformat()
        }


def main():
    """Main entry point for the configuration transformer."""
    parser = argparse.ArgumentParser(
        description='Transform WeSign configuration for specific environments',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  py appsettings_patch.py -c appsettings.json -e DevTest
  py appsettings_patch.py -c appsettings.Production.json -e Production --validate-only
  py appsettings_patch.py -c config.json -e Staging --backup-only
        """
    )

    parser.add_argument(
        '-c', '--config',
        type=str,
        required=True,
        help='Path to the configuration file (JSON)'
    )

    parser.add_argument(
        '-e', '--environment',
        type=str,
        required=True,
        choices=ConfigurationTransformer.SUPPORTED_ENVIRONMENTS,
        help='Target environment for configuration'
    )

    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate configuration without applying changes'
    )

    parser.add_argument(
        '--backup-only',
        action='store_true',
        help='Only create backup without applying changes'
    )

    parser.add_argument(
        '--rollback',
        action='store_true',
        help='Rollback to the most recent backup'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what changes would be made without applying them'
    )

    parser.add_argument(
        '--output-summary',
        type=str,
        help='Output transformation summary to specified JSON file'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Initialize transformer
        transformer = ConfigurationTransformer(
            config_path=Path(args.config),
            environment=args.environment
        )

        # Handle rollback operation
        if args.rollback:
            if transformer.rollback_configuration():
                logger.info("Configuration rollback completed successfully")
                return 0
            else:
                logger.error("Configuration rollback failed")
                return 1

        # Create backup
        backup_path = transformer.create_backup()

        # Handle backup-only operation
        if args.backup_only:
            logger.info(f"Backup created: {backup_path}")
            return 0

        # Load configuration
        config = transformer.load_configuration()

        # Handle validate-only operation
        if args.validate_only:
            if transformer.validate_configuration(config):
                logger.info("Configuration validation passed")
                return 0
            else:
                logger.error("Configuration validation failed")
                return 1

        # Apply transformations
        if args.dry_run:
            logger.info("DRY RUN MODE - No changes will be applied")
            # Load environment settings and show what would change
            env_settings = transformer._get_environment_settings()
            logger.info(f"Would apply {len(env_settings)} settings:")
            for path, value in env_settings.items():
                masked_value = SecureCredentialManager.mask_credentials(str(value))
                logger.info(f"  {path} -> {masked_value}")
            return 0

        # Apply environment settings
        transformed_config = transformer.apply_environment_settings(config)

        # Validate transformed configuration
        if not transformer.validate_configuration(transformed_config):
            logger.error("Transformed configuration failed validation")
            transformer.rollback_configuration()
            return 1

        # Save configuration
        if not transformer.save_configuration(transformed_config):
            logger.error("Failed to save transformed configuration")
            transformer.rollback_configuration()
            return 1

        # Output summary if requested
        if args.output_summary:
            summary = transformer.get_transformation_summary()
            with open(args.output_summary, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            logger.info(f"Transformation summary saved to: {args.output_summary}")

        logger.info(f"Configuration transformation completed successfully for {args.environment} environment")
        summary = transformer.get_transformation_summary()
        logger.info(f"Applied {summary['transformations_count']} transformations")

        return 0

    except ConfigurationError as e:
        logger.error(f"Configuration error: {e}")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)