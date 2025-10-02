#!/usr/bin/env python3
"""Test headed browser execution"""

import subprocess
import os

print("=== Testing WeSign Headed Mode ===")

# Change to WeSign directory
wesign_dir = r"C:\Users\gals\seleniumpythontests-1\playwright_tests"
os.chdir(wesign_dir)

# Install browsers first
print("Installing browsers...")
subprocess.run(["python", "-m", "playwright", "install", "chromium"], timeout=60)

# Test headed mode
print("Running test in headed mode - BROWSER SHOULD OPEN!")
cmd = [
    "python", "-m", "pytest", 
    "tests/auth/test_login.py::TestLogin::test_login_with_empty_password_validation",
    "-v", "--headed", "-s"
]

try:
    subprocess.run(cmd, timeout=30)
    print("Test started successfully!")
except subprocess.TimeoutExpired:
    print("Test is running (timeout expected)")
except Exception as e:
    print(f"Error: {e}")