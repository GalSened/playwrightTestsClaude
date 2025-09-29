#!/usr/bin/env python3
"""
Environment Configuration Validation Script

This script validates all available environment configurations
and reports any issues found.
"""

import sys
import json
from pathlib import Path

# Add the parent directory to the path so we can import our config module
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import env_manager


def main():
    """Main validation function"""
    print("WeSign Test Environment Configuration Validation")
    print("=" * 60)

    # Get all available environments
    environments = env_manager.list_available_environments()

    if not environments:
        print("[ERROR] No environment configurations found!")
        return False

    print(f"Found {len(environments)} environment configuration(s): {', '.join(environments)}")
    print()

    all_valid = True

    for env in environments:
        print(f"Validating environment: {env}")
        print("-" * 40)

        try:
            # Validate the configuration
            validation_result = env_manager.validate_config(env)

            if validation_result['valid']:
                print(f"[OK] {env} configuration is valid")

                # Show warnings if any
                if validation_result['warnings']:
                    print("[WARN] Warnings:")
                    for warning in validation_result['warnings']:
                        print(f"   - {warning}")
            else:
                print(f"[ERROR] {env} configuration has errors:")
                for error in validation_result['errors']:
                    print(f"   - {error}")
                all_valid = False

                # Show warnings if any
                if validation_result['warnings']:
                    print("[WARN] Additional warnings:")
                    for warning in validation_result['warnings']:
                        print(f"   - {warning}")

        except Exception as e:
            print(f"[ERROR] Failed to validate {env}: {str(e)}")
            all_valid = False

        print()

    # Summary
    if all_valid:
        print("[SUCCESS] All environment configurations are valid!")
        return True
    else:
        print("[ERROR] Some environment configurations have issues. Please fix them before running tests.")
        return False


def print_config_details(environment: str):
    """Print detailed configuration for debugging"""
    try:
        config = env_manager.load_config(environment)
        print(f"\nDetailed configuration for {environment}:")
        print(f"  Base URL: {config.base_url}")
        print(f"  Company User: {config.company_user.email}")
        print(f"  Basic User: {config.basic_user.email}")
        print(f"  Test Files Path: {config.test_files_path}")
        print(f"  Browser Headless: {config.browser_settings.headless}")
        print(f"  Default Timeout: {config.timeouts.default}ms")

        if config.api_settings:
            print(f"  API Base URL: {config.api_settings.base_url}")
            print(f"  API Retry Attempts: {config.api_settings.retry_attempts}")

        if config.test_data:
            print(f"  Cleanup After Test: {config.test_data.cleanup_after_test}")
            print(f"  Test Isolation: {config.test_data.use_test_isolation}")

    except Exception as e:
        print(f"[ERROR] Failed to load configuration details for {environment}: {str(e)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Validate WeSign test environment configurations")
    parser.add_argument("--details", metavar="ENV", help="Show detailed configuration for specific environment")
    parser.add_argument("--list", action="store_true", help="List all available environments")

    args = parser.parse_args()

    if args.list:
        environments = env_manager.list_available_environments()
        print("Available environments:")
        for env in environments:
            print(f"  - {env}")
        sys.exit(0)

    if args.details:
        print_config_details(args.details)
        sys.exit(0)

    # Run validation
    success = main()
    sys.exit(0 if success else 1)