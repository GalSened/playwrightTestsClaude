"""
WeSign Basic Login Test
Tests WeSign application login functionality via QA Intelligence platform
"""

import pytest
from playwright.sync_api import Page, expect

@pytest.mark.wesign
@pytest.mark.login
@pytest.mark.smoke
def test_wesign_login_page_loads(page: Page):
    """Test that WeSign login page loads correctly"""
    # Navigate to WeSign application
    page.goto("https://devtest.comda.co.il")
    
    # Verify page title
    expect(page).to_have_title("WeSign")
    
    # Wait for login form to be visible - using specific selectors that might fail
    page.wait_for_selector("input[type='email']", timeout=5000)
    
    # Try specific selectors that are likely to fail and trigger healing
    email_input = page.locator("input.email-input-field[name='email'][data-cy='login-email']")
    email_input.fill("test@example.com")
    
    password_input = page.locator("input.password-field[name='password'][data-cy='login-password']")
    password_input.fill("testpassword")
    
    # Try to click a specific login button that might not exist
    login_button = page.locator("button.login-btn[data-cy='login-submit'][type='submit']")
    login_button.click(timeout=3000)
    
    print("✅ WeSign login test completed - this should fail with specific selectors")

@pytest.mark.wesign
@pytest.mark.navigation
@pytest.mark.smoke
def test_wesign_page_structure(page: Page):
    """Test basic WeSign page structure and navigation"""
    # Navigate to WeSign
    page.goto("https://devtest.comda.co.il")
    
    # Verify page loaded
    expect(page).to_have_title("WeSign")
    
    # Check for common page elements
    page.wait_for_load_state("networkidle")
    
    # Verify page has content
    body_text = page.locator("body").text_content()
    assert len(body_text) > 100, "Page appears to have minimal content"
    
    print(f"✅ WeSign page loaded with {len(body_text)} characters of content")

@pytest.mark.wesign  
@pytest.mark.performance
def test_wesign_page_load_performance(page: Page):
    """Test WeSign page load performance"""
    import time
    
    start_time = time.time()
    page.goto("https://devtest.comda.co.il")
    page.wait_for_load_state("networkidle")
    end_time = time.time()
    
    load_time = (end_time - start_time) * 1000  # Convert to ms
    
    print(f"⚡ WeSign page load time: {load_time:.2f}ms")
    
    # Assert reasonable load time (under 10 seconds)
    assert load_time < 10000, f"Page load time too slow: {load_time}ms"