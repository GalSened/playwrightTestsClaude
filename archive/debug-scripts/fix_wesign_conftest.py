#!/usr/bin/env python3
"""
Fix WeSign conftest.py to support --headed command line option
"""

import os

def fix_conftest_for_headed_mode():
    """Update WeSign conftest.py to respect --headed flag"""
    
    conftest_path = r"C:\Users\gals\seleniumpythontests-1\playwright_tests\conftest.py"
    
    print(f"Fixing conftest.py at: {conftest_path}")
    
    # Read current conftest.py
    with open(conftest_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Current content preview:")
    lines = content.split('\n')
    for i, line in enumerate(lines[20:30], 21):
        if 'headless' in line:
            print(f"Line {i}: {line}")
    
    # Create new conftest content that supports --headed
    new_conftest = '''"""Comprehensive pytest configuration with all required fixtures"""

import pytest
import asyncio
import sys
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Add project root to path
sys.path.append(os.path.dirname(__file__))

# Configure pytest-asyncio
pytest_plugins = ("pytest_asyncio",)

# Import required components
from config.settings import settings
from pages.login_page import LoginPage

def pytest_addoption(parser):
    """Add custom command line options"""
    parser.addoption(
        "--headed",
        action="store_true", 
        default=False,
        help="Run tests in headed mode (browser visible)"
    )

@pytest.fixture(scope="function")
async def page(request):
    """Create a fresh page for each test with timeout protection."""
    # Check if --headed flag is set
    headed_mode = request.config.getoption("--headed")
    headless_mode = not headed_mode
    
    print(f"Browser mode: {'HEADED (visible)' if headed_mode else 'HEADLESS (hidden)'}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless_mode,  # Now respects --headed flag
            timeout=10000,  # 10 second timeout for browser launch
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        try:
            context = await browser.new_context(
                ignore_https_errors=True,
                viewport={"width": 1920, "height": 1080}
            )
            page = await context.new_page()
            
            # Set default timeouts
            page.set_default_timeout(15000)  # 15 seconds
            page.set_default_navigation_timeout(20000)  # 20 seconds
            
            yield page
            
        finally:
            await browser.close()


@pytest.fixture(scope="function")
async def authenticated_page(page):
    """Provide a pre-authenticated page for tests that need login."""
    try:
        # Create login page instance
        login_page = LoginPage(page)
        
        # Perform login
        await login_page.navigate()
        await login_page.login_as_company_user()
        await login_page.verify_login_success()
        
        yield page
        
    except Exception as e:
        print(f"Authentication failed: {e}")
        # Still yield the page for debugging
        yield page

@pytest.fixture(scope="session")
def performance_monitor():
    """Performance monitoring fixture."""
    import time
    return {
        "start_time": time.time()
    }

# Custom markers for different test types
pytest_markers = {
    "smoke": "Basic smoke tests",
    "integration": "Integration tests", 
    "comprehensive": "Comprehensive test suites",
    "advanced": "Advanced feature tests",
    "bulk_operations": "Bulk operation tests",
    "contact_creation": "Contact creation tests",
    "distribution": "Distribution tests",
    "files": "File operation tests",
    "final_scenarios": "Final integration scenarios",
    "smart_card": "Smart card tests",
    "english": "Tests running in English",
    "hebrew": "Tests running in Hebrew",
    "login": "Login and authentication tests",
    "performance": "Performance tests",
    "regression": "Regression tests",
    "critical": "Critical functionality tests"
}
'''
    
    # Backup original file
    backup_path = conftest_path + ".backup"
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Backup created: {backup_path}")
    
    # Write new conftest.py
    with open(conftest_path, 'w', encoding='utf-8') as f:
        f.write(new_conftest)
    
    print("✅ conftest.py updated to support --headed flag!")
    print("   Now when you run pytest with --headed, the browser will be visible")
    
    return True

if __name__ == "__main__":
    success = fix_conftest_for_headed_mode()
    if success:
        print("\n🎉 WeSign tests now support headed mode!")
        print("Usage: python -m pytest tests/auth/test_login.py --headed")
    else:
        print("\n❌ Failed to fix conftest.py")