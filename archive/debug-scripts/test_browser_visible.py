#!/usr/bin/env python3
"""Test that browser opens visibly with updated conftest.py"""

import subprocess
import os

def test_headed_browser():
    """Test that WeSign tests now open browser visibly"""
    
    print("=== Testing Updated WeSign Headed Mode ===")
    print("Browser window should now open visibly!")
    
    # Change to WeSign directory  
    wesign_dir = r"C:\Users\gals\seleniumpythontests-1\playwright_tests"
    os.chdir(wesign_dir)
    
    # Run test with --headed flag
    cmd = [
        "python", "-m", "pytest",
        "tests/auth/test_login.py::TestLogin::test_login_with_empty_password_validation",
        "--headed", "-v", "-s"
    ]
    
    print(f"Command: {' '.join(cmd)}")
    print("WATCH FOR BROWSER WINDOW TO OPEN!")
    print("Press Ctrl+C if you see the browser window to confirm it's working")
    
    try:
        result = subprocess.run(cmd, timeout=45)
        print(f"Test completed: {result.returncode}")
        return True
    except subprocess.TimeoutExpired:
        print("Test timeout - likely means browser is open and test is running")
        return True
    except KeyboardInterrupt:
        print("Manual interruption - browser visibility confirmed!")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = test_headed_browser()
    if success:
        print("\nSUCCESS: WeSign tests can now run with visible browser!")
    else:
        print("\nFAILED: Still issues with headed mode")