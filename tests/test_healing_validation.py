"""
Test for validating self-healing system capture with real failures
This test intentionally uses selectors that will fail to validate healing capture
"""

import pytest
from playwright.sync_api import Page, expect


class TestHealingValidation:
    """Test class to generate real failures for healing system validation"""
    
    def test_intentional_selector_failure(self, page: Page):
        """Test with intentionally bad selector to trigger healing capture"""
        page.goto("https://devtest.comda.co.il")
        
        # Wait for page to load
        page.wait_for_load_state("domcontentloaded")
        
        # This selector should fail and trigger healing
        try:
            # Using a selector that doesn't exist to trigger failure
            bad_button = page.locator("button.non-existent-login-button-class")
            bad_button.click(timeout=5000)  # Short timeout to fail quickly
        except Exception as e:
            # Re-raise to ensure test fails and healing system captures it
            raise AssertionError(f"Selector failed as expected for healing test: {str(e)}")
    
    def test_timing_failure_validation(self, page: Page):
        """Test with timing issue to trigger healing capture"""
        page.goto("https://devtest.comda.co.il")
        
        # This should cause a timeout error
        try:
            # Wait for something that might not appear quickly
            page.wait_for_selector("input[name='email']", timeout=2000)  # Very short timeout
            
            # Try to interact immediately without proper wait
            email_input = page.locator("input[name='email']")
            email_input.fill("test@example.com")
            email_input.press("Tab")
            
            # This selector might not be available yet
            submit_button = page.locator("button:text('התחבר')")
            submit_button.click(timeout=1000)  # Very short timeout
            
        except Exception as e:
            raise AssertionError(f"Timing failure as expected for healing test: {str(e)}")
    
    def test_dom_change_failure_validation(self, page: Page):  
        """Test with DOM change scenario to trigger healing capture"""
        page.goto("https://devtest.comda.co.il")
        
        page.wait_for_load_state("domcontentloaded")
        
        try:
            # Get initial element reference
            initial_button = page.locator("button").first
            
            # If page has dynamic content, this might become stale
            page.wait_for_timeout(100)  # Minimal wait
            
            # Try to interact with potentially stale element
            initial_button.click(timeout=3000)
            
            # Try another selector that might have changed
            dynamic_element = page.locator(".login-form input:first-child")
            dynamic_element.fill("test@example.com")
            
        except Exception as e:
            raise AssertionError(f"DOM change failure as expected for healing test: {str(e)}")

    def test_alternative_selector_validation(self, page: Page):
        """Test using primary selector that should fail, with known alternatives"""
        page.goto("https://devtest.comda.co.il")
        
        page.wait_for_load_state("domcontentloaded")
        
        try:
            # Primary selector that might fail
            primary_selector = page.locator("button.primary-login-btn")  # Non-existent
            primary_selector.click(timeout=4000)
            
        except Exception as e:
            # This should trigger healing which should find alternatives like:
            # - "button:text('התחבר')"
            # - "button.login-button" 
            # - "#login-btn"
            # - "input[type='submit']"
            raise AssertionError(f"Primary selector failed - healing should find alternatives: {str(e)}")

    def test_network_failure_validation(self, page: Page):
        """Test with potential network/resource loading issues"""
        try:
            # Try to navigate to a potentially slow-loading page
            page.goto("https://devtest.comda.co.il", timeout=3000)  # Short timeout
            
            # Wait for critical resources with short timeout
            page.wait_for_load_state("networkidle", timeout=2000)
            
            # Try to interact with elements that depend on network resources
            login_form = page.locator("form.login-form")
            login_form.wait_for(timeout=2000)
            
        except Exception as e:
            raise AssertionError(f"Network failure as expected for healing test: {str(e)}")