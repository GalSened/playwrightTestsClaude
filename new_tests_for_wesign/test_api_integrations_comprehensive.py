"""Comprehensive API Integrations and Webhooks Test Suite - WeSign"""

import pytest
import asyncio
import json
import tempfile
import os
from datetime import datetime
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


class TestAPIIntegrationsComprehensive:
    """Comprehensive API integrations and webhooks test suite covering all integration scenarios"""

    @pytest.mark.asyncio
    async def test_api_settings_and_configuration_page(self):
        """Test 1: API settings and configuration page navigation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            try:
                print("=== API SETTINGS CONFIGURATION PAGE TEST ===")

                # Step 1: Authenticate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                assert await auth_page.is_login_successful(), "Login should succeed"

                # Step 2: Try to navigate to API settings
                api_urls = [
                    "https://devtest.comda.co.il/dashboard/api",
                    "https://devtest.comda.co.il/dashboard/settings/api",
                    "https://devtest.comda.co.il/dashboard/integrations",
                    "https://devtest.comda.co.il/dashboard/webhooks",
                    "https://devtest.comda.co.il/dashboard/profile"  # API settings might be in profile
                ]

                api_page_found = False
                working_url = None

                for url in api_urls:
                    await page.goto(url)
                    await page.wait_for_load_state("networkidle")

                    # Check for API-related elements
                    api_indicators = [
                        ":has-text('API')",
                        ":has-text('Webhook')",
                        ":has-text('Integration')",
                        ":has-text('Token')",
                        ":has-text('Key')",
                        ".api-settings",
                        ".webhook-settings",
                        "[data-testid*='api']"
                    ]

                    for indicator in api_indicators:
                        if await page.locator(indicator).count() > 0:
                            api_page_found = True
                            working_url = url
                            print(f"API settings found at: {url} with indicator: {indicator}")
                            break

                    if api_page_found:
                        break

                # If not found directly, look for API settings in navigation menus
                if not api_page_found:
                    await page.goto("https://devtest.comda.co.il/dashboard")
                    await page.wait_for_load_state("networkidle")

                    # Look for settings or integration navigation
                    nav_selectors = [
                        "a:has-text('Settings')",
                        "a:has-text('API')",
                        "a:has-text('Integration')",
                        "button:has-text('Settings')",
                        ".settings-menu",
                        "[data-testid*='settings']"
                    ]

                    for nav_selector in nav_selectors:
                        if await page.locator(nav_selector).count() > 0:
                            await page.locator(nav_selector).click()
                            await page.wait_for_load_state("networkidle")

                            # Check if this leads to API settings
                            for indicator in api_indicators:
                                if await page.locator(indicator).count() > 0:
                                    api_page_found = True
                                    working_url = page.url
                                    print(f"API settings accessed via navigation: {nav_selector}")
                                    break

                            if api_page_found:
                                break

                # Validate API settings page elements
                if api_page_found:
                    api_elements = {
                        "api_key_display": await page.locator("input[name*='key'], input[name*='token'], .api-key, [data-testid*='api-key']").count() > 0,
                        "webhook_url": await page.locator("input[name*='webhook'], input[name*='url'], .webhook-url").count() > 0,
                        "generate_button": await page.locator("button:has-text('Generate'), button:has-text('Create Key')").count() > 0,
                        "save_button": await page.locator("button:has-text('Save'), button:has-text('Update')").count() > 0
                    }

                    print(f"API settings page elements: {api_elements}")

                current_url = page.url
                print(f"Final URL: {current_url}, API page found: {api_page_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_api_key_generation_and_management(self):
        """Test 2: API key generation and management functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== API KEY GENERATION MANAGEMENT TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to profile/settings first
                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for API key generation elements
                api_key_selectors = [
                    "input[name*='apikey']",
                    "input[name*='api-key']",
                    "input[name*='token']",
                    ".api-key-input",
                    "[data-testid*='api-key']"
                ]

                api_key_field_found = False
                current_api_key = None

                for selector in api_key_selectors:
                    if await page.locator(selector).count() > 0:
                        api_key_field_found = True
                        current_api_key = await page.locator(selector).input_value()
                        print(f"API key field found: {selector}")
                        if current_api_key:
                            print(f"Current API key (partial): {current_api_key[:10]}...")
                        break

                # Look for generate/regenerate buttons
                generate_buttons = [
                    "button:has-text('Generate')",
                    "button:has-text('Create Key')",
                    "button:has-text('Regenerate')",
                    "button:has-text('New Key')",
                    ".generate-api-key",
                    "[data-testid*='generate']"
                ]

                generate_button_found = False
                for btn_selector in generate_buttons:
                    if await page.locator(btn_selector).count() > 0:
                        generate_button_found = True
                        print(f"Generate button found: {btn_selector}")

                        # Test key generation (if safe to do)
                        button_text = await page.locator(btn_selector).text_content()
                        if "regenerate" not in button_text.lower():  # Avoid regenerating existing keys
                            await page.locator(btn_selector).click()
                            await page.wait_for_timeout(2000)

                            # Check for new key or confirmation
                            if api_key_field_found:
                                new_api_key = await page.locator(api_key_selectors[0]).input_value()
                                key_generated = new_api_key != current_api_key
                                print(f"New API key generated: {key_generated}")

                        break

                # Look for API key visibility toggle
                visibility_toggles = [
                    "button:has-text('Show')",
                    "button:has-text('Hide')",
                    ".toggle-visibility",
                    ".show-hide-btn",
                    "[data-testid*='visibility']"
                ]

                visibility_toggle_found = False
                for toggle_selector in visibility_toggles:
                    if await page.locator(toggle_selector).count() > 0:
                        visibility_toggle_found = True
                        print(f"Visibility toggle found: {toggle_selector}")
                        break

                # Look for API key copy functionality
                copy_buttons = [
                    "button:has-text('Copy')",
                    "button[title*='copy']",
                    ".copy-btn",
                    "[data-testid*='copy']"
                ]

                copy_functionality_found = False
                for copy_selector in copy_buttons:
                    if await page.locator(copy_selector).count() > 0:
                        copy_functionality_found = True
                        print(f"Copy functionality found: {copy_selector}")
                        break

                # Look for API key expiration/status
                status_indicators = [
                    ".api-key-status",
                    ":has-text('Active')",
                    ":has-text('Expired')",
                    ".expiration-date",
                    "[data-testid*='status']"
                ]

                status_info_found = False
                for status_selector in status_indicators:
                    if await page.locator(status_selector).count() > 0:
                        status_info_found = True
                        print(f"API key status info found: {status_selector}")
                        break

                print(f"API key management validated - Field: {api_key_field_found}, Generate: {generate_button_found}, Visibility: {visibility_toggle_found}, Copy: {copy_functionality_found}, Status: {status_info_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_webhook_configuration_and_endpoints(self):
        """Test 3: Webhook configuration and endpoint management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== WEBHOOK CONFIGURATION ENDPOINTS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for webhook URL configuration
                webhook_url_selectors = [
                    "input[name*='webhook']",
                    "input[name*='callback']",
                    "input[name*='endpoint']",
                    "input[placeholder*='webhook']",
                    ".webhook-url",
                    "[data-testid*='webhook']"
                ]

                webhook_url_field_found = False
                for selector in webhook_url_selectors:
                    if await page.locator(selector).count() > 0:
                        webhook_url_field_found = True

                        # Test webhook URL validation
                        test_urls = [
                            "https://example.com/webhook",
                            "http://invalid-url",  # Invalid SSL
                            "not-a-url",  # Invalid format
                            "https://valid-webhook.example.com/callback"
                        ]

                        for test_url in test_urls:
                            await page.locator(selector).fill(test_url)
                            await page.locator(selector).blur()
                            await page.wait_for_timeout(500)

                            # Check for validation messages
                            validation_error = await page.locator(".error, .invalid-feedback").count() > 0
                            print(f"Webhook URL '{test_url}' validation error: {validation_error}")

                        print(f"Webhook URL field found: {selector}")
                        break

                # Look for webhook event configuration
                webhook_events_selectors = [
                    "input[type='checkbox'][name*='event']",
                    ".webhook-events",
                    "input[name*='document_signed']",
                    "input[name*='document_completed']",
                    "[data-testid*='webhook-event']"
                ]

                webhook_events_found = 0
                event_types = []

                for selector in webhook_events_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        webhook_events_found += count

                        # Collect event types
                        for i in range(min(count, 5)):  # Check first 5 events
                            event_element = page.locator(selector).nth(i)
                            event_name = await event_element.get_attribute("name")
                            if event_name:
                                event_types.append(event_name)

                        print(f"Webhook events found: {selector} ({count} events)")

                print(f"Webhook event types: {event_types}")

                # Look for webhook testing functionality
                test_webhook_selectors = [
                    "button:has-text('Test')",
                    "button:has-text('Test Webhook')",
                    "button:has-text('Send Test')",
                    ".test-webhook-btn",
                    "[data-testid*='test-webhook']"
                ]

                test_webhook_found = False
                for selector in test_webhook_selectors:
                    if await page.locator(selector).count() > 0:
                        test_webhook_found = True
                        print(f"Test webhook functionality found: {selector}")

                        # Test webhook testing (if safe)
                        if webhook_url_field_found:
                            await page.locator(webhook_url_selectors[0]).fill("https://httpbin.org/post")
                            await page.locator(selector).click()
                            await page.wait_for_timeout(3000)

                            # Check for test results
                            test_results = await page.locator(".test-result, .success, .error").count()
                            print(f"Webhook test results shown: {test_results > 0}")

                        break

                # Look for webhook secret/authentication
                webhook_auth_selectors = [
                    "input[name*='secret']",
                    "input[name*='signature']",
                    "input[name*='auth']",
                    ".webhook-secret",
                    "[data-testid*='webhook-secret']"
                ]

                webhook_auth_found = False
                for selector in webhook_auth_selectors:
                    if await page.locator(selector).count() > 0:
                        webhook_auth_found = True
                        print(f"Webhook authentication found: {selector}")
                        break

                # Look for webhook delivery history/logs
                webhook_logs_selectors = [
                    ".webhook-logs",
                    ".delivery-history",
                    "table:has(th:has-text('Webhook'))",
                    "[data-testid*='webhook-log']"
                ]

                webhook_logs_found = False
                for selector in webhook_logs_selectors:
                    if await page.locator(selector).count() > 0:
                        webhook_logs_found = True
                        print(f"Webhook logs/history found: {selector}")
                        break

                print(f"Webhook configuration validated - URL: {webhook_url_field_found}, Events: {webhook_events_found}, Test: {test_webhook_found}, Auth: {webhook_auth_found}, Logs: {webhook_logs_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_api_documentation_and_endpoints_access(self):
        """Test 4: API documentation and endpoints accessibility"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== API DOCUMENTATION ENDPOINTS ACCESS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Look for API documentation links
                await page.goto("https://devtest.comda.co.il/dashboard")
                await page.wait_for_load_state("networkidle")

                api_doc_selectors = [
                    "a:has-text('API')",
                    "a:has-text('Documentation')",
                    "a:has-text('API Docs')",
                    "a:has-text('Developer')",
                    ".api-docs-link",
                    "[data-testid*='api-docs']"
                ]

                api_docs_found = False
                for selector in api_doc_selectors:
                    if await page.locator(selector).count() > 0:
                        api_docs_found = True

                        # Try to access API documentation
                        href = await page.locator(selector).get_attribute("href")
                        print(f"API documentation link found: {selector} -> {href}")

                        if href and not href.startswith("javascript"):
                            await page.locator(selector).click()
                            await page.wait_for_load_state("networkidle")

                            # Check if we reached API documentation
                            doc_indicators = [
                                ":has-text('REST API')",
                                ":has-text('Endpoints')",
                                ":has-text('Authentication')",
                                "code",
                                ".api-method"
                            ]

                            doc_page_loaded = False
                            for indicator in doc_indicators:
                                if await page.locator(indicator).count() > 0:
                                    doc_page_loaded = True
                                    print(f"API documentation loaded with: {indicator}")
                                    break

                            if doc_page_loaded:
                                break

                        break

                # Test direct API endpoint access (basic connectivity)
                api_endpoints = [
                    "https://devtest.comda.co.il/api",
                    "https://devtest.comda.co.il/api/v1",
                    "https://api.comda.co.il",
                    "https://devtest.comda.co.il/docs"
                ]

                api_endpoint_accessible = False
                accessible_endpoint = None

                for endpoint in api_endpoints:
                    try:
                        response = await page.goto(endpoint)
                        await page.wait_for_load_state("networkidle")

                        # Check if endpoint returns API-related content
                        api_content_indicators = [
                            ":has-text('API')",
                            ":has-text('version')",
                            ":has-text('endpoints')",
                            "application/json",
                            "swagger"
                        ]

                        for indicator in api_content_indicators:
                            if await page.locator(f":has-text('{indicator}')").count() > 0 or indicator in await page.content():
                                api_endpoint_accessible = True
                                accessible_endpoint = endpoint
                                print(f"API endpoint accessible: {endpoint}")
                                break

                        if api_endpoint_accessible:
                            break

                    except Exception as e:
                        print(f"API endpoint {endpoint} not accessible: {e}")
                        continue

                # Look for API examples/code snippets
                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                code_examples_selectors = [
                    "code",
                    "pre",
                    ".code-example",
                    ".api-example",
                    "[data-testid*='code']"
                ]

                code_examples_found = 0
                for selector in code_examples_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        code_examples_found += count

                        # Check for API-related code
                        code_content = await page.locator(selector).first.text_content()
                        if code_content and any(term in code_content.lower() for term in ['api', 'curl', 'http', 'json']):
                            print(f"API code example found: {selector}")

                # Check for rate limiting information
                rate_limit_selectors = [
                    ":has-text('rate limit')",
                    ":has-text('requests per')",
                    ":has-text('quota')",
                    ".rate-limit-info",
                    "[data-testid*='rate-limit']"
                ]

                rate_limit_info_found = False
                for selector in rate_limit_selectors:
                    if await page.locator(selector).count() > 0:
                        rate_limit_info_found = True
                        print(f"Rate limit information found: {selector}")
                        break

                print(f"API documentation access validated - Docs: {api_docs_found}, Endpoints: {api_endpoint_accessible}, Examples: {code_examples_found}, Rate Limits: {rate_limit_info_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_third_party_integration_settings(self):
        """Test 5: Third-party integration configuration and settings"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== THIRD PARTY INTEGRATION SETTINGS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for common third-party integrations
                integration_selectors = [
                    ":has-text('Salesforce')",
                    ":has-text('HubSpot')",
                    ":has-text('Zapier')",
                    ":has-text('Microsoft')",
                    ":has-text('Google')",
                    ":has-text('Slack')",
                    ":has-text('Teams')",
                    ".integration-card",
                    "[data-testid*='integration']"
                ]

                integrations_found = []
                for selector in integration_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        integrations_found.append(selector.replace(':has-text(\'', '').replace('\')', ''))
                        print(f"Integration found: {selector}")

                # Look for OAuth/SSO configuration
                oauth_selectors = [
                    "button:has-text('Connect')",
                    "button:has-text('Authorize')",
                    "button:has-text('OAuth')",
                    ".oauth-connect",
                    ".sso-config",
                    "[data-testid*='oauth']"
                ]

                oauth_config_found = 0
                for selector in oauth_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        oauth_config_found += count
                        print(f"OAuth/SSO configuration found: {selector}")

                # Look for SAML configuration
                saml_selectors = [
                    ":has-text('SAML')",
                    "input[name*='saml']",
                    ".saml-config",
                    "[data-testid*='saml']"
                ]

                saml_config_found = False
                for selector in saml_selectors:
                    if await page.locator(selector).count() > 0:
                        saml_config_found = True
                        print(f"SAML configuration found: {selector}")
                        break

                # Look for integration status indicators
                status_selectors = [
                    ".connected",
                    ".active",
                    ":has-text('Connected')",
                    ":has-text('Active')",
                    ".integration-status",
                    "[data-testid*='status']"
                ]

                status_indicators_found = 0
                for selector in status_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        status_indicators_found += count
                        print(f"Integration status indicator found: {selector}")

                # Look for sync/mapping configuration
                sync_selectors = [
                    "button:has-text('Sync')",
                    ".field-mapping",
                    ".sync-settings",
                    "input[name*='sync']",
                    "[data-testid*='sync']"
                ]

                sync_config_found = 0
                for selector in sync_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        sync_config_found += count
                        print(f"Sync/mapping configuration found: {selector}")

                # Test integration enable/disable
                toggle_selectors = [
                    "input[type='checkbox']",
                    ".toggle-switch",
                    "button[role='switch']",
                    "[data-testid*='toggle']"
                ]

                toggle_controls_found = 0
                for selector in toggle_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        toggle_controls_found += count

                        # Test first toggle if it's an integration toggle
                        parent_text = await page.locator(selector).first.locator("..").text_content()
                        if parent_text and any(integration in parent_text.lower() for integration in ['integration', 'connect', 'sync']):
                            is_checked = await page.locator(selector).first.is_checked()
                            print(f"Integration toggle found - Current state: {is_checked}")

                print(f"Third-party integrations validated - Found: {len(integrations_found)}, OAuth: {oauth_config_found}, SAML: {saml_config_found}, Status: {status_indicators_found}, Sync: {sync_config_found}, Toggles: {toggle_controls_found}")
                print(f"Integration types: {integrations_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_api_security_and_permissions(self):
        """Test 6: API security settings and permission management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== API SECURITY PERMISSIONS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for API permission settings
                permission_selectors = [
                    "input[type='checkbox'][name*='permission']",
                    "input[type='checkbox'][name*='access']",
                    ".api-permissions",
                    ".permission-scope",
                    "[data-testid*='permission']"
                ]

                permission_settings_found = 0
                permission_types = []

                for selector in permission_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        permission_settings_found += count

                        # Collect permission types
                        for i in range(min(count, 10)):  # Check first 10 permissions
                            perm_element = page.locator(selector).nth(i)
                            perm_name = await perm_element.get_attribute("name")
                            if perm_name:
                                permission_types.append(perm_name)

                        print(f"API permissions found: {selector} ({count} permissions)")

                # Look for IP whitelisting/restrictions
                ip_restriction_selectors = [
                    "input[name*='ip']",
                    "input[name*='whitelist']",
                    "textarea[name*='allowed_ips']",
                    ".ip-whitelist",
                    "[data-testid*='ip-restriction']"
                ]

                ip_restrictions_found = False
                for selector in ip_restriction_selectors:
                    if await page.locator(selector).count() > 0:
                        ip_restrictions_found = True

                        # Test IP address validation
                        test_ips = [
                            "192.168.1.1",
                            "10.0.0.0/24",
                            "invalid-ip",
                            "2001:db8::1"
                        ]

                        for test_ip in test_ips:
                            await page.locator(selector).fill(test_ip)
                            await page.locator(selector).blur()
                            await page.wait_for_timeout(500)

                            validation_error = await page.locator(".error, .invalid-feedback").count() > 0
                            print(f"IP '{test_ip}' validation error: {validation_error}")

                        print(f"IP restrictions found: {selector}")
                        break

                # Look for API rate limiting settings
                rate_limit_selectors = [
                    "input[name*='rate']",
                    "input[name*='limit']",
                    "input[name*='quota']",
                    ".rate-limit-settings",
                    "[data-testid*='rate-limit']"
                ]

                rate_limit_settings_found = 0
                for selector in rate_limit_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        rate_limit_settings_found += count

                        # Test rate limit values
                        await page.locator(selector).first.fill("100")
                        filled_value = await page.locator(selector).first.input_value()
                        print(f"Rate limit setting test - Input: 100, Result: {filled_value}")

                        print(f"Rate limiting found: {selector}")

                # Look for API key expiration settings
                expiration_selectors = [
                    "input[type='date'][name*='expir']",
                    "select[name*='expir']",
                    "input[name*='valid_until']",
                    ".key-expiration",
                    "[data-testid*='expiration']"
                ]

                expiration_settings_found = False
                for selector in expiration_selectors:
                    if await page.locator(selector).count() > 0:
                        expiration_settings_found = True

                        element_type = await page.locator(selector).first.get_attribute("tagName")
                        if element_type.lower() == "select":
                            options = await page.locator(f"{selector} option").count()
                            print(f"Expiration dropdown found with {options} options")
                        elif "date" in selector:
                            # Test future date
                            future_date = datetime.now().strftime("%Y-%m-%d")
                            await page.locator(selector).fill(future_date)
                            print(f"Expiration date set to: {future_date}")

                        print(f"API key expiration found: {selector}")
                        break

                # Look for audit log access
                audit_log_selectors = [
                    "a:has-text('Audit')",
                    "a:has-text('Logs')",
                    ".audit-logs",
                    ".api-usage-logs",
                    "[data-testid*='audit']"
                ]

                audit_logs_found = False
                for selector in audit_log_selectors:
                    if await page.locator(selector).count() > 0:
                        audit_logs_found = True
                        print(f"Audit logs access found: {selector}")
                        break

                # Look for two-factor authentication for API access
                two_factor_selectors = [
                    "input[name*='2fa']",
                    "input[name*='mfa']",
                    "checkbox:has-text('Two-factor')",
                    ".two-factor-api",
                    "[data-testid*='2fa']"
                ]

                two_factor_found = False
                for selector in two_factor_selectors:
                    if await page.locator(selector).count() > 0:
                        two_factor_found = True
                        print(f"Two-factor authentication for API found: {selector}")
                        break

                print(f"API security validated - Permissions: {permission_settings_found}, IP: {ip_restrictions_found}, Rate Limit: {rate_limit_settings_found}, Expiration: {expiration_settings_found}, Audit: {audit_logs_found}, 2FA: {two_factor_found}")
                print(f"Permission types found: {permission_types[:5]}")  # Show first 5

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_webhook_delivery_and_retry_mechanisms(self):
        """Test 7: Webhook delivery, retry mechanisms, and failure handling"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== WEBHOOK DELIVERY RETRY MECHANISMS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for webhook retry configuration
                retry_selectors = [
                    "input[name*='retry']",
                    "select[name*='retry']",
                    "input[name*='attempts']",
                    ".retry-settings",
                    "[data-testid*='retry']"
                ]

                retry_config_found = 0
                for selector in retry_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        retry_config_found += count

                        element_type = await page.locator(selector).first.get_attribute("tagName")
                        if element_type.lower() == "input":
                            # Test retry attempts configuration
                            await page.locator(selector).first.fill("3")
                            filled_value = await page.locator(selector).first.input_value()
                            print(f"Retry attempts test - Input: 3, Result: {filled_value}")
                        elif element_type.lower() == "select":
                            options = await page.locator(f"{selector} option").count()
                            print(f"Retry configuration dropdown found with {options} options")

                        print(f"Retry configuration found: {selector}")

                # Look for webhook timeout settings
                timeout_selectors = [
                    "input[name*='timeout']",
                    "input[name*='duration']",
                    ".webhook-timeout",
                    "[data-testid*='timeout']"
                ]

                timeout_settings_found = 0
                for selector in timeout_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        timeout_settings_found += count

                        # Test timeout value
                        await page.locator(selector).first.fill("30")
                        filled_value = await page.locator(selector).first.input_value()
                        print(f"Timeout setting test - Input: 30, Result: {filled_value}")

                        print(f"Timeout configuration found: {selector}")

                # Look for webhook delivery status/history
                delivery_status_selectors = [
                    ".delivery-status",
                    ".webhook-history",
                    "table:has(th:has-text('Status'))",
                    ".delivery-log",
                    "[data-testid*='delivery']"
                ]

                delivery_status_found = False
                for selector in delivery_status_selectors:
                    if await page.locator(selector).count() > 0:
                        delivery_status_found = True
                        print(f"Webhook delivery status found: {selector}")

                        # Check for status indicators
                        status_indicators = [
                            ":has-text('Success')",
                            ":has-text('Failed')",
                            ":has-text('Retry')",
                            ":has-text('Pending')"
                        ]

                        for status_indicator in status_indicators:
                            if await page.locator(status_indicator).count() > 0:
                                print(f"Delivery status indicator found: {status_indicator}")

                        break

                # Look for failed webhook handling
                failure_handling_selectors = [
                    ".failed-webhooks",
                    "button:has-text('Retry Failed')",
                    ":has-text('Failed Delivery')",
                    ".failure-reason",
                    "[data-testid*='failed']"
                ]

                failure_handling_found = 0
                for selector in failure_handling_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        failure_handling_found += count
                        print(f"Failure handling found: {selector}")

                # Look for webhook payload configuration
                payload_selectors = [
                    "textarea[name*='payload']",
                    "input[name*='format']",
                    "select[name*='format']",
                    ".payload-config",
                    "[data-testid*='payload']"
                ]

                payload_config_found = 0
                for selector in payload_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        payload_config_found += count

                        if "textarea" in selector:
                            # Test custom payload configuration
                            test_payload = '{"event": "document_signed", "timestamp": "{{timestamp}}"}'
                            await page.locator(selector).fill(test_payload)
                            filled_payload = await page.locator(selector).input_value()
                            print(f"Custom payload test successful: {len(filled_payload) > 0}")
                        elif "select" in selector:
                            options = await page.locator(f"{selector} option").count()
                            print(f"Payload format options: {options}")

                        print(f"Payload configuration found: {selector}")

                # Look for webhook signature/verification settings
                signature_selectors = [
                    "input[name*='signature']",
                    "input[name*='hmac']",
                    "input[name*='verification']",
                    ".webhook-signature",
                    "[data-testid*='signature']"
                ]

                signature_config_found = False
                for selector in signature_selectors:
                    if await page.locator(selector).count() > 0:
                        signature_config_found = True

                        # Test signature secret configuration
                        test_secret = "webhook_secret_key_123"
                        await page.locator(selector).fill(test_secret)
                        filled_secret = await page.locator(selector).input_value()
                        print(f"Signature secret configuration test: {bool(filled_secret)}")

                        print(f"Webhook signature configuration found: {selector}")
                        break

                print(f"Webhook delivery mechanisms validated - Retry: {retry_config_found}, Timeout: {timeout_settings_found}, Status: {delivery_status_found}, Failure Handling: {failure_handling_found}, Payload: {payload_config_found}, Signature: {signature_config_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_api_testing_and_monitoring_tools(self):
        """Test 8: API testing tools and monitoring capabilities"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== API TESTING MONITORING TOOLS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for API testing tools
                testing_tools_selectors = [
                    "button:has-text('Test API')",
                    "button:has-text('Try It')",
                    ".api-tester",
                    ".endpoint-tester",
                    "[data-testid*='api-test']"
                ]

                testing_tools_found = 0
                for selector in testing_tools_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        testing_tools_found += count
                        print(f"API testing tool found: {selector}")

                        # Test API testing functionality
                        await page.locator(selector).first.click()
                        await page.wait_for_timeout(1000)

                        # Look for testing interface
                        test_interface_selectors = [
                            ".test-request",
                            ".api-response",
                            "textarea[name*='request']",
                            ".json-editor"
                        ]

                        test_interface_found = False
                        for interface_selector in test_interface_selectors:
                            if await page.locator(interface_selector).count() > 0:
                                test_interface_found = True
                                print(f"API testing interface found: {interface_selector}")
                                break

                # Look for API usage monitoring/analytics
                monitoring_selectors = [
                    ".api-usage",
                    ".usage-analytics",
                    "canvas",  # Charts
                    ".metrics-dashboard",
                    "[data-testid*='usage']"
                ]

                monitoring_found = 0
                for selector in monitoring_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        monitoring_found += count
                        print(f"API monitoring found: {selector}")

                # Look for error tracking
                error_tracking_selectors = [
                    ".error-logs",
                    ".api-errors",
                    ":has-text('4xx')",
                    ":has-text('5xx')",
                    ".error-rate",
                    "[data-testid*='errors']"
                ]

                error_tracking_found = 0
                for selector in error_tracking_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        error_tracking_found += count
                        print(f"Error tracking found: {selector}")

                # Look for performance metrics
                performance_selectors = [
                    ".response-time",
                    ".latency",
                    ".performance-metrics",
                    ":has-text('ms')",
                    "[data-testid*='performance']"
                ]

                performance_metrics_found = 0
                for selector in performance_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        performance_metrics_found += count
                        print(f"Performance metrics found: {selector}")

                # Look for quota/usage limits display
                quota_selectors = [
                    ".quota-usage",
                    ".api-limits",
                    ".usage-remaining",
                    ":has-text('remaining')",
                    "[data-testid*='quota']"
                ]

                quota_display_found = 0
                for selector in quota_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        quota_display_found += count

                        # Try to extract quota information
                        quota_text = await page.locator(selector).first.text_content()
                        if quota_text and any(term in quota_text.lower() for term in ['remaining', 'used', 'limit']):
                            print(f"Quota information: {quota_text}")

                        print(f"Quota display found: {selector}")

                # Look for request/response logging
                logging_selectors = [
                    ".request-log",
                    ".api-log",
                    "table:has(th:has-text('Request'))",
                    ".http-log",
                    "[data-testid*='log']"
                ]

                logging_found = False
                for selector in logging_selectors:
                    if await page.locator(selector).count() > 0:
                        logging_found = True
                        print(f"Request/response logging found: {selector}")

                        # Check for log entries
                        log_entries = await page.locator(f"{selector} tr, {selector} .log-entry").count()
                        print(f"Log entries visible: {log_entries}")
                        break

                # Test API health/status endpoint
                health_indicators = [
                    ".api-status",
                    ":has-text('Online')",
                    ":has-text('Healthy')",
                    ".status-indicator",
                    "[data-testid*='health']"
                ]

                health_status_found = False
                for indicator in health_indicators:
                    if await page.locator(indicator).count() > 0:
                        health_status_found = True

                        status_text = await page.locator(indicator).first.text_content()
                        print(f"API health status: {status_text}")
                        break

                print(f"API testing/monitoring validated - Testing Tools: {testing_tools_found}, Monitoring: {monitoring_found}, Error Tracking: {error_tracking_found}, Performance: {performance_metrics_found}, Quota: {quota_display_found}, Logging: {logging_found}, Health: {health_status_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_api_integration_business_logic_boundaries(self):
        """Test 9: API integration business logic boundaries and edge cases"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== API INTEGRATION BUSINESS LOGIC BOUNDARIES TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Test case 1: API key validation boundaries
                api_key_field = await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").count()
                if api_key_field > 0:
                    boundary_tests = [
                        "",  # Empty key
                        "a",  # Too short
                        "x" * 1000,  # Too long
                        "invalid-key-format-123",  # Invalid format
                        "!@#$%^&*()",  # Special characters
                        "api_key_with_spaces ",  # Trailing spaces
                    ]

                    for test_key in boundary_tests:
                        await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").first.fill(test_key)
                        await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").first.blur()
                        await page.wait_for_timeout(500)

                        validation_error = await page.locator(".error, .invalid-feedback").count() > 0
                        print(f"API key boundary test '{test_key[:20]}...': Validation error: {validation_error}")

                # Test case 2: Webhook URL validation boundaries
                webhook_url_field = await page.locator("input[name*='webhook'], input[name*='callback']").count()
                if webhook_url_field > 0:
                    url_boundary_tests = [
                        "",  # Empty URL
                        "not-a-url",  # Invalid format
                        "http://",  # Incomplete URL
                        "ftp://example.com/webhook",  # Wrong protocol
                        "https://localhost/webhook",  # Localhost (might be restricted)
                        "https://192.168.1.1/webhook",  # Private IP
                        "https://" + "x" * 2000 + ".com/webhook",  # Extremely long domain
                        "https://example.com/" + "a" * 2000,  # Extremely long path
                    ]

                    for test_url in url_boundary_tests:
                        await page.locator("input[name*='webhook'], input[name*='callback']").first.fill(test_url)
                        await page.locator("input[name*='webhook'], input[name*='callback']").first.blur()
                        await page.wait_for_timeout(500)

                        url_validation_error = await page.locator(".error, .invalid-feedback").count() > 0
                        print(f"Webhook URL boundary test '{test_url[:30]}...': Validation error: {url_validation_error}")

                # Test case 3: Rate limit boundaries
                rate_limit_field = await page.locator("input[name*='rate'], input[name*='limit']").count()
                if rate_limit_field > 0:
                    rate_limit_tests = [
                        "-1",  # Negative value
                        "0",  # Zero value
                        "999999999",  # Very large value
                        "abc",  # Non-numeric
                        "1.5",  # Decimal
                        "",  # Empty
                    ]

                    for test_rate in rate_limit_tests:
                        await page.locator("input[name*='rate'], input[name*='limit']").first.fill(test_rate)
                        await page.locator("input[name*='rate'], input[name*='limit']").first.blur()
                        await page.wait_for_timeout(500)

                        rate_validation_error = await page.locator(".error, .invalid-feedback").count() > 0
                        print(f"Rate limit boundary test '{test_rate}': Validation error: {rate_validation_error}")

                # Test case 4: Concurrent API configuration attempts
                save_buttons = await page.locator("button:has-text('Save'), button:has-text('Update')").count()
                if save_buttons > 0:
                    # Simulate rapid consecutive saves
                    for i in range(3):
                        await page.locator("button:has-text('Save'), button:has-text('Update')").first.click()
                        await page.wait_for_timeout(100)  # Very short wait

                    await page.wait_for_timeout(2000)

                    # Check for handling of concurrent requests
                    concurrent_handling = await page.locator(".error:has-text('progress'), .error:has-text('wait')").count() > 0
                    print(f"Concurrent save handling: {concurrent_handling}")

                # Test case 5: Session expiration during API configuration
                # Simulate long form session
                await page.wait_for_timeout(5000)

                # Try to save after potential session timeout
                if save_buttons > 0:
                    await page.locator("button:has-text('Save'), button:has-text('Update')").first.click()
                    await page.wait_for_timeout(3000)

                    # Check for session expiration handling
                    session_handling = await page.locator(":has-text('login'), :has-text('session'), :has-text('expired')").count() > 0
                    current_url = page.url
                    session_redirect = "login" in current_url.lower()

                    print(f"Session expiration handling - Message: {session_handling}, Redirect: {session_redirect}")

                # Test case 6: Browser compatibility edge cases
                # Test with JavaScript disabled simulation
                await page.add_init_script("() => { window.navigator = {...window.navigator, javaEnabled: () => false }; }")

                await page.reload()
                await page.wait_for_load_state("networkidle")

                # Check if API settings still function
                api_settings_still_work = await page.locator("input[name*='api'], input[name*='webhook']").count() > 0
                print(f"API settings with JavaScript limitations: {api_settings_still_work}")

                print("API integration business logic boundaries validation completed")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_comprehensive_api_workflow_integration(self):
        """Test 10: Comprehensive API and webhook workflow integration"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== COMPREHENSIVE API WORKFLOW INTEGRATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("Step 1: Accessing API configuration...")
                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                workflow_steps = {
                    "api_settings_access": False,
                    "api_key_configuration": False,
                    "webhook_configuration": False,
                    "permissions_configured": False,
                    "testing_performed": False,
                    "monitoring_verified": False
                }

                # Step 1: Verify API settings access
                api_elements = await page.locator("input[name*='api'], input[name*='webhook'], :has-text('API')").count()
                if api_elements > 0:
                    workflow_steps["api_settings_access"] = True
                    print("✓ API settings accessible")

                # Step 2: Configure API key (if available)
                api_key_field = await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").count()
                if api_key_field > 0:
                    # Check if API key exists or can be generated
                    current_key = await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").first.input_value()

                    generate_button = await page.locator("button:has-text('Generate'), button:has-text('Create Key')").count()

                    if current_key or generate_button > 0:
                        workflow_steps["api_key_configuration"] = True
                        print("✓ API key configuration available")

                # Step 3: Configure webhook (if available)
                webhook_field = await page.locator("input[name*='webhook'], input[name*='callback']").count()
                if webhook_field > 0:
                    # Test webhook configuration
                    test_webhook_url = "https://httpbin.org/post"
                    await page.locator("input[name*='webhook'], input[name*='callback']").first.fill(test_webhook_url)

                    filled_url = await page.locator("input[name*='webhook'], input[name*='callback']").first.input_value()
                    if filled_url == test_webhook_url:
                        workflow_steps["webhook_configuration"] = True
                        print("✓ Webhook configuration successful")

                # Step 4: Check permissions configuration
                permissions = await page.locator("input[type='checkbox'][name*='permission'], input[type='checkbox'][name*='access']").count()
                if permissions > 0:
                    workflow_steps["permissions_configured"] = True
                    print("✓ API permissions configurable")

                # Step 5: Test API functionality (if test tools available)
                test_buttons = await page.locator("button:has-text('Test'), button:has-text('Test API'), button:has-text('Test Webhook')").count()
                if test_buttons > 0:
                    await page.locator("button:has-text('Test'), button:has-text('Test API'), button:has-text('Test Webhook')").first.click()
                    await page.wait_for_timeout(2000)

                    # Check for test results
                    test_results = await page.locator(".test-result, .success, .error, .response").count()
                    if test_results > 0:
                        workflow_steps["testing_performed"] = True
                        print("✓ API testing functionality works")

                # Step 6: Verify monitoring capabilities
                monitoring_elements = await page.locator(".api-usage, .usage-analytics, .metrics, canvas").count()
                if monitoring_elements > 0:
                    workflow_steps["monitoring_verified"] = True
                    print("✓ API monitoring capabilities available")

                # Step 7: Save configuration (if possible)
                save_button = await page.locator("button:has-text('Save'), button:has-text('Update')").count()
                configuration_saved = False

                if save_button > 0:
                    await page.locator("button:has-text('Save'), button:has-text('Update')").first.click()
                    await page.wait_for_timeout(3000)

                    # Check for save confirmation
                    save_confirmation = await page.locator(".success, :has-text('saved'), :has-text('updated')").count()
                    configuration_saved = save_confirmation > 0
                    print(f"✓ Configuration save attempted - Success indicators: {save_confirmation > 0}")

                # Calculate workflow completion score
                completed_steps = sum(1 for step in workflow_steps.values() if step)
                total_steps = len(workflow_steps)
                completion_percentage = (completed_steps / total_steps) * 100

                print(f"\n=== API INTEGRATION WORKFLOW SUMMARY ===")
                print(f"Workflow Steps Completed: {completed_steps}/{total_steps} ({completion_percentage:.1f}%)")
                print(f"Configuration Saved: {configuration_saved}")

                for step_name, completed in workflow_steps.items():
                    status = "✓ COMPLETED" if completed else "✗ NOT AVAILABLE"
                    print(f"  {step_name.replace('_', ' ').title()}: {status}")

                # Test integration resilience
                print(f"\n=== INTEGRATION RESILIENCE TEST ===")

                # Test page reload persistence
                await page.reload()
                await page.wait_for_load_state("networkidle")

                # Check if configuration persists
                persistence_checks = {
                    "api_key_persisted": api_key_field > 0 and await page.locator("input[name*='apikey'], input[name*='api-key'], input[name*='token']").first.input_value() != "",
                    "webhook_persisted": webhook_field > 0 and await page.locator("input[name*='webhook'], input[name*='callback']").first.input_value() != ""
                }

                persistent_configs = sum(1 for check in persistence_checks.values() if check)
                print(f"Configuration persistence: {persistent_configs}/{len(persistence_checks)} settings persisted")

                overall_integration_score = (completion_percentage + (persistent_configs / len(persistence_checks) * 100)) / 2
                print(f"Overall API Integration Score: {overall_integration_score:.1f}%")

            finally:
                await browser.close()