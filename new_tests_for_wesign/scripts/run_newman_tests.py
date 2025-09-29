#!/usr/bin/env python3
"""
Newman API Tests Runner with Enhanced Path Detection

This script runs API tests using Newman with improved path detection
and fallback options for different installation methods.
"""

import sys
import subprocess
import json
import os
import shutil
from pathlib import Path
from datetime import datetime

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.environment import get_config, set_environment


def find_newman_executable():
    """Find Newman executable with enhanced path detection"""

    # First, try the standard which/where command
    newman_paths = ['newman', 'newman.cmd', 'newman.exe']

    for newman_cmd in newman_paths:
        if shutil.which(newman_cmd):
            return newman_cmd

    # Try common Node.js global installation paths
    possible_paths = [
        # Windows paths
        r"C:\Users\{}\AppData\Roaming\npm\newman.cmd".format(os.getenv('USERNAME', '')),
        r"C:\Users\{}\AppData\Roaming\npm\newman".format(os.getenv('USERNAME', '')),
        r"C:\Program Files\nodejs\newman.cmd",
        r"C:\Program Files\nodejs\newman",
        # Common npm global paths
        "/usr/local/bin/newman",
        "/usr/bin/newman",
        "~/.npm-global/bin/newman"
    ]

    for path in possible_paths:
        expanded_path = os.path.expanduser(path)
        if os.path.exists(expanded_path) and os.access(expanded_path, os.X_OK):
            return expanded_path

    # Try using npx as fallback
    if shutil.which('npx'):
        try:
            result = subprocess.run(['npx', 'newman', '--version'],
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return 'npx newman'
        except:
            pass

    return None


def run_newman_tests(environment='dev', verbose=False):
    """
    Run Newman API tests

    Args:
        environment: Target environment
        verbose: Enable verbose output

    Returns:
        bool: True if tests passed, False otherwise
    """
    print(f"Newman API Tests - Environment: {environment}")
    print("=" * 50)

    # Find Newman executable
    newman_cmd = find_newman_executable()
    if not newman_cmd:
        print("[ERROR] Newman not found!")
        print("\nTo install Newman, run one of:")
        print("  npm install -g newman")
        print("  npm install -g newman-reporter-htmlextra")
        print("\nOr use the Python API test runner instead:")
        print("  python scripts/run_api_tests_python.py")
        return False

    print(f"Using Newman: {newman_cmd}")

    # Set up configuration
    set_environment(environment)
    config = get_config()

    base_path = Path(__file__).parent.parent
    api_tests_path = base_path / "api_tests"
    reports_path = base_path / "reports" / "api"
    reports_path.mkdir(parents=True, exist_ok=True)

    # Check collection and environment files
    collection_file = api_tests_path / "WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json"
    env_file = api_tests_path / "WeSign API Environment.postman_environment.json"

    if not collection_file.exists():
        print(f"[ERROR] Postman collection not found: {collection_file}")
        return False

    if not env_file.exists():
        print(f"[ERROR] Postman environment not found: {env_file}")
        return False

    print(f"Collection: {collection_file.name}")
    print(f"Environment: {env_file.name}")
    print(f"Target URL: {config.base_url}")
    print()

    # Prepare Newman command
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_report = reports_path / f"newman_api_tests_{environment}_{timestamp}.html"

    # Build command based on whether we're using npx or direct newman
    if newman_cmd.startswith('npx'):
        cmd = ['npx', 'newman', 'run', str(collection_file)]
    else:
        cmd = [newman_cmd, 'run', str(collection_file)]

    cmd.extend([
        '--environment', str(env_file),
        '--delay-request', '1000',
        '--timeout-request', str(config.timeouts.default),
        '--reporters', 'cli,html',
        '--reporter-html-export', str(html_report)
    ])

    if verbose:
        cmd.extend(['--verbose', '--color', 'on'])
    else:
        cmd.extend(['--color', 'off'])

    print(f"Command: {' '.join(cmd[:3])} [collection] [options...]")
    print("Running Newman tests...")
    print("-" * 40)

    try:
        # Set environment variables for the collection
        env_vars = {
            **dict(os.environ),
            'WESIGN_BASE_URL': config.base_url,
            'WESIGN_LOGIN_EMAIL': config.company_user.email,
            'WESIGN_LOGIN_PASSWORD': config.company_user.password
        }

        result = subprocess.run(
            cmd,
            env=env_vars,
            text=True,
            timeout=300  # 5 minutes timeout
        )

        print("-" * 40)

        if result.returncode == 0:
            print("[SUCCESS] Newman API tests completed successfully!")
            print(f"HTML report saved to: {html_report}")
            return True
        else:
            print(f"[FAILED] Newman tests failed (exit code: {result.returncode})")
            return False

    except subprocess.TimeoutExpired:
        print("[ERROR] Newman tests timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run Newman tests: {str(e)}")
        return False


def validate_newman_setup():
    """Validate Newman setup and collection"""
    print("Validating Newman setup...")
    print("-" * 30)

    # Check Newman
    newman_cmd = find_newman_executable()
    if newman_cmd:
        print(f"[OK] Newman found: {newman_cmd}")

        # Get version
        try:
            if newman_cmd.startswith('npx'):
                version_cmd = ['npx', 'newman', '--version']
            else:
                version_cmd = [newman_cmd, '--version']

            result = subprocess.run(version_cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                print(f"[OK] Newman version: {result.stdout.strip()}")
            else:
                print("[WARN] Could not get Newman version")
        except:
            print("[WARN] Could not check Newman version")
    else:
        print("[ERROR] Newman not found")
        return False

    # Check collection files
    base_path = Path(__file__).parent.parent
    api_tests_path = base_path / "api_tests"

    collection_file = api_tests_path / "WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json"
    env_file = api_tests_path / "WeSign API Environment.postman_environment.json"

    if collection_file.exists():
        print(f"[OK] Postman collection found")
        try:
            with open(collection_file, 'r', encoding='utf-8') as f:
                collection = json.load(f)
            print(f"[OK] Collection is valid JSON")
            print(f"[INFO] Collection name: {collection.get('info', {}).get('name', 'Unknown')}")
        except Exception as e:
            print(f"[ERROR] Collection validation failed: {e}")
            return False
    else:
        print(f"[ERROR] Postman collection not found: {collection_file}")
        return False

    if env_file.exists():
        print(f"[OK] Postman environment found")
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                env_data = json.load(f)
            print(f"[OK] Environment is valid JSON")
            print(f"[INFO] Environment name: {env_data.get('name', 'Unknown')}")
        except Exception as e:
            print(f"[ERROR] Environment validation failed: {e}")
            return False
    else:
        print(f"[ERROR] Postman environment not found: {env_file}")
        return False

    print("\n[SUCCESS] Newman setup validation completed")
    return True


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run WeSign API tests using Newman")
    parser.add_argument("--env", default="dev", choices=["dev", "staging", "production", "local"],
                       help="Target environment (default: dev)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--validate", action="store_true",
                       help="Validate Newman setup")

    args = parser.parse_args()

    if args.validate:
        success = validate_newman_setup()
        sys.exit(0 if success else 1)

    success = run_newman_tests(args.env, args.verbose)
    sys.exit(0 if success else 1)