"""
Pytest configuration and fixtures for WeSign tests
"""

import pytest
import pytest_asyncio
import asyncio
from playwright.async_api import async_playwright, Browser, BrowserContext, Page


@pytest_asyncio.fixture(scope="session")
async def browser():
    """Create a browser instance for the test session."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,  # Run in HEADED mode for visibility and debugging
            slow_mo=50,      # Add 50ms delay between actions for observation
            timeout=10000,   # 10 second timeout for browser launch
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--start-maximized',  # Start browser in full-screen mode
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        )
        yield browser
        await browser.close()


@pytest_asyncio.fixture(scope="function")
async def context(browser: Browser):
    """Create a browser context for each test."""
    context = await browser.new_context(
        viewport={'width': 1280, 'height': 720},
        locale='en-US',
        timezone_id='America/New_York'
    )
    yield context
    await context.close()


@pytest_asyncio.fixture(scope="function")
async def page(context: BrowserContext):
    """Create a page instance for each test."""
    page = await context.new_page()
    # Set default timeout for all operations
    page.set_default_timeout(30000)
    yield page
    await page.close()


@pytest_asyncio.fixture(scope="function")
async def authenticated_page(context: BrowserContext):
    """Create an authenticated page that's already logged in."""
    page = await context.new_page()

    # Navigate to login page
    await page.goto("https://devtest.comda.co.il/")
    await page.wait_for_load_state("domcontentloaded")

    # Perform login
    email_field = 'input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="Username"], input[placeholder*="שם משתמש"]'
    password_field = 'input[type="password"], input[name="password"], input[placeholder*="Password"], input[placeholder*="סיסמה"]'
    login_button = 'input[type="submit"], button[type="submit"], input[value="Sign in"], input[value="התחברות"]'

    await page.locator(email_field).first.fill("nirk@comsign.co.il")
    await page.locator(password_field).first.fill("Comsign1!")
    await page.locator(login_button).first.click()

    # Wait for dashboard to load
    try:
        await page.wait_for_url("**/dashboard**", timeout=15000)
    except:
        # Fallback: wait for dashboard elements
        await page.wait_for_selector('text=ראשי, text=מסמכים', timeout=10000)

    yield page
    await page.close()


# Test configuration fixtures
@pytest.fixture(scope="session")
def test_config():
    """Test configuration settings."""
    return {
        "base_url": "https://devtest.comda.co.il",
        "timeout": 30000,
        "company_user": {
            "email": "nirk@comsign.co.il",
            "password": "Comsign1!"
        },
        "basic_user": {
            "email": "basic@example.com",
            "password": "BasicPass123!"
        }
    }


# Test data fixtures
@pytest.fixture
def test_credentials():
    """Test credentials for different user types."""
    return {
        "company_user": {
            "email": "nirk@comsign.co.il",
            "password": "Comsign1!"
        },
        "basic_user": {
            "email": "basic@example.com",  # Update with actual basic user credentials
            "password": "BasicPass123!"
        },
        "invalid_user": {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
    }


@pytest.fixture
def security_test_data():
    """Test data for security testing."""
    return {
        "sql_injection_payloads": [
            "admin'--",
            "admin' OR '1'='1",
            "'; DROP TABLE users; --",
            "admin' UNION SELECT * FROM users --",
            "' OR 1=1 --"
        ],
        "xss_payloads": [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "'\"><script>alert('XSS')</script>"
        ],
        "invalid_emails": [
            "plaintext",
            "@missingdomain.com",
            "user@",
            "user@@domain.com",
            "user space@domain.com",
            "user.domain.com"
        ]
    }


# Removed autouse fixture to avoid conflicts with page fixture