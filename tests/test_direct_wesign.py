"""
Direct WeSign test without complex config dependencies
This test will fail with real selectors to validate healing capture
"""

import pytest
from playwright.sync_api import Page


def test_wesign_direct_selector_failure(page: Page):
    """Test WeSign with specific selectors that will fail"""
    page.goto("https://devtest.comda.co.il")
    
    # Wait for page to load
    page.wait_for_load_state("domcontentloaded")
    
    # These specific selectors should fail and trigger healing
    # Using overly specific selectors that likely don't exist
    email_input = page.locator("input.email-field[data-cy='login-email'][name='email']")
    email_input.fill("test@example.com")
    
    password_input = page.locator("input.password-input[data-cy='login-password'][name='password']")
    password_input.fill("testpassword")
    
    # Try to click login button with specific selector
    login_button = page.locator("button.submit-btn[data-cy='login-submit'][type='submit']")
    login_button.click()
    
    print("Test should fail with selector issues")


def test_wesign_timing_failure_direct(page: Page):
    """Test WeSign with timing issues"""
    page.goto("https://devtest.comda.co.il")
    
    # Very short timeout - should cause timing failure
    email_input = page.locator("input[type='email']")
    email_input.wait_for(timeout=500)  # 0.5 seconds - very short
    email_input.fill("test@example.com")
    
    submit_button = page.locator("button[type='submit'], input[type='submit'], .login-button")
    submit_button.click(timeout=1000)  # 1 second timeout


def test_wesign_non_existent_elements(page: Page):
    """Test WeSign with elements that definitely don't exist"""
    page.goto("https://devtest.comda.co.il")
    page.wait_for_load_state("domcontentloaded")
    
    # These selectors should definitely fail
    non_existent = page.locator("#definitely-not-existing-element")
    non_existent.click()
    
    another_missing = page.locator(".missing-class-selector")
    another_missing.fill("test")