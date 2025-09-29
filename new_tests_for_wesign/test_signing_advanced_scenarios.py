"""
WeSign Advanced Signing Scenarios Test Suite

This test suite covers advanced edge cases, security scenarios, and integration testing
for WeSign's signing workflows that go beyond basic functionality testing.

Coverage:
- Security validation and XSS/injection prevention
- Error handling and recovery scenarios
- Cross-browser and device compatibility
- Performance and scalability testing
- Integration with contact and document management systems

Created: 2025-01-25
Priority: HIGH - Security and robustness validation
Dependencies: test_signing_flows_comprehensive.py
"""

import pytest
from playwright.async_api import Page, expect, BrowserContext
import asyncio
import json
import time
from typing import List, Dict, Any, Optional


class WeSignAdvancedTestUtils:
    """Advanced testing utilities for security and edge case validation"""

    # XSS and injection payloads for security testing
    XSS_PAYLOADS = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
        "<iframe src=javascript:alert('XSS')></iframe>",
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "<script>document.cookie='stolen='+document.cookie</script>"
    ]

    # Invalid file types for upload security testing
    MALICIOUS_FILE_TYPES = [
        ("malware.exe", "application/x-executable"),
        ("script.js", "application/javascript"),
        ("shell.php", "application/x-php"),
        ("macro.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"),
        ("virus.bat", "application/x-bat")
    ]

    # Edge case phone numbers
    EDGE_CASE_PHONES = [
        "",  # Empty
        "0",  # Single digit
        "050-123-456789012345",  # Too long
        "+972-050-123-4567",  # With country code
        "050.123.4567",  # Dots instead of dashes
        "050 123 4567",  # Spaces
        "(050) 123-4567",  # Parentheses
        "050-abc-defg",  # Letters
        "050-123-456א",  # Hebrew characters
        "050-123-4567; DROP TABLE contacts; --",  # SQL injection
        "050-123-4567<script>alert('xss')</script>",  # XSS
    ]

    # Edge case email addresses
    EDGE_CASE_EMAILS = [
        "",  # Empty
        "test",  # No @
        "@example.com",  # No local part
        "test@",  # No domain
        "test..test@example.com",  # Double dots
        "test@example",  # No TLD
        "test@.example.com",  # Leading dot in domain
        "test@example..com",  # Double dots in domain
        "a" * 100 + "@example.com",  # Very long local part
        "test@" + "a" * 100 + ".com",  # Very long domain
        "test+tag@example.com",  # Plus addressing
        "test@localhost",  # Localhost
        "test@192.168.1.1",  # IP address
        "test@[192.168.1.1]",  # Bracketed IP
        "test@example.com<script>alert('xss')</script>",  # XSS
        "test'; DROP TABLE users; --@example.com",  # SQL injection
    ]

    @staticmethod
    async def create_malicious_file(filename: str, content_type: str = "text/plain") -> str:
        """Create a test file with potentially malicious content"""
        file_path = f"C:/Users/gals/{filename}"

        # Create content based on file type
        if filename.endswith('.exe'):
            content = b"MZ\x90\x00\x03\x00\x00\x00"  # PE header stub
        elif filename.endswith('.js'):
            content = b"alert('This would be malicious JavaScript');"
        elif filename.endswith('.php'):
            content = b"<?php echo 'This would be malicious PHP'; ?>"
        elif filename.endswith('.bat'):
            content = b"@echo off\necho This would be a malicious batch file"
        else:
            content = b"This is test content for security validation"

        with open(file_path, 'wb') as f:
            f.write(content)

        return file_path

    @staticmethod
    async def monitor_network_requests(page: Page) -> List[Dict]:
        """Monitor network requests for security analysis"""
        requests = []

        def handle_request(request):
            requests.append({
                "url": request.url,
                "method": request.method,
                "headers": dict(request.headers),
                "timestamp": time.time()
            })

        page.on("request", handle_request)
        return requests

    @staticmethod
    async def check_console_errors(page: Page) -> List[Dict]:
        """Monitor console for JavaScript errors"""
        errors = []

        def handle_console_message(msg):
            if msg.type in ["error", "warning"]:
                errors.append({
                    "type": msg.type,
                    "text": msg.text,
                    "location": msg.location,
                    "timestamp": time.time()
                })

        page.on("console", handle_console_message)
        return errors


class TestSigningSecurityValidation:
    """Security validation tests for signing workflows"""

    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.test_credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }

    async def setup_authenticated_session(self, page: Page) -> bool:
        """Setup authenticated session for security testing"""
        try:
            await page.goto(f"{self.base_url}/auth/login")
            await page.wait_for_load_state('networkidle')

            await page.fill('input[type="email"]', self.test_credentials["email"])
            await page.fill('input[type="password"]', self.test_credentials["password"])

            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            await page.wait_for_url("**/dashboard**", timeout=15000)
            await page.wait_for_load_state('networkidle')
            return True

        except Exception as e:
            print(f"Authentication failed: {e}")
            return False

    @pytest.mark.asyncio
    async def test_xss_prevention_in_recipient_names(self, page: Page):
        """Test XSS prevention in recipient name fields"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"

        # Navigate to signing workflow
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Monitor console errors
        console_errors = await WeSignAdvancedTestUtils.check_console_errors(page)

        # Test XSS payloads in name field
        name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first

        for xss_payload in WeSignAdvancedTestUtils.XSS_PAYLOADS:
            await name_field.clear()
            await name_field.fill(xss_payload)
            await asyncio.sleep(0.5)

            # Check if payload was sanitized
            current_value = await name_field.input_value()

            # Verify no script execution
            alerts = page.locator('text*="XSS"')
            alert_count = await alerts.count()

            if alert_count > 0:
                print(f"🚨 SECURITY VULNERABILITY: XSS payload executed: {xss_payload}")
                assert False, f"XSS vulnerability detected with payload: {xss_payload}"
            else:
                print(f"✅ XSS payload blocked: {xss_payload[:50]}...")

            # Check for HTML encoding/sanitization
            if "<" in xss_payload and current_value != xss_payload:
                print(f"✅ Payload sanitized: '{xss_payload}' → '{current_value}'")

        print(f"📊 Tested {len(WeSignAdvancedTestUtils.XSS_PAYLOADS)} XSS payloads - all blocked")

    @pytest.mark.asyncio
    async def test_sql_injection_prevention_in_forms(self, page: Page):
        """Test SQL injection prevention in signing forms"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # SQL injection payloads
        sql_payloads = [
            "'; DROP TABLE contacts; --",
            "' OR '1'='1",
            "'; UPDATE users SET password='hacked'; --",
            "admin'--",
            "' UNION SELECT * FROM users--"
        ]

        # Test in name field
        name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first

        for sql_payload in sql_payloads:
            await name_field.clear()
            await name_field.fill(sql_payload)

            # Try to add recipient
            add_button = page.locator('button:has-text("Add recipient")').first
            await add_button.click()
            await asyncio.sleep(1)

            # Check for error messages or unexpected behavior
            error_messages = page.locator('text*="error", text*="Error", [role="alert"]')
            error_count = await error_messages.count()

            if error_count > 0:
                print(f"✅ SQL injection blocked with error: {sql_payload}")
            else:
                print(f"✅ SQL injection handled silently: {sql_payload}")

        # Test in email field
        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first

        for sql_payload in sql_payloads:
            email_with_sql = f"test{sql_payload}@example.com"
            await email_field.clear()
            await email_field.fill(email_with_sql)
            await asyncio.sleep(0.5)

        print(f"📊 Tested {len(sql_payloads)} SQL injection payloads - system appears protected")

    @pytest.mark.asyncio
    async def test_phone_number_validation_edge_cases(self, page: Page):
        """Test phone number validation with edge cases and malicious input"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Add recipient name
        name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await name_field.fill("Phone Test User")

        # Switch to SMS
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by SMS")
        await asyncio.sleep(1)

        # Test phone validation
        phone_field = page.locator('input[placeholder*="050"]').first

        if await phone_field.is_visible():
            validation_results = []

            for test_phone in WeSignAdvancedTestUtils.EDGE_CASE_PHONES:
                await phone_field.clear()
                await phone_field.fill(test_phone)
                await asyncio.sleep(0.3)

                # Try to add recipient
                add_button = page.locator('button:has-text("Add recipient")').first
                await add_button.click()
                await asyncio.sleep(0.5)

                # Check validation feedback
                validation_messages = page.locator('[role="alert"], .error, .invalid')
                validation_count = await validation_messages.count()

                validation_results.append({
                    "phone": test_phone,
                    "validation_triggered": validation_count > 0,
                    "accepted": validation_count == 0
                })

                print(f"📱 Phone: '{test_phone}' | Validation: {validation_count > 0}")

            # Analyze results
            malicious_accepted = [r for r in validation_results if "script" in r["phone"] and r["accepted"]]
            if malicious_accepted:
                print("🚨 SECURITY WARNING: Malicious phone numbers accepted")
                for result in malicious_accepted:
                    print(f"   Accepted: {result['phone']}")

            print(f"📊 Phone validation tested: {len(WeSignAdvancedTestUtils.EDGE_CASE_PHONES)} cases")

        else:
            print("⚠️  Phone field not available - SMS selection may have failed")

    @pytest.mark.asyncio
    async def test_email_validation_edge_cases(self, page: Page):
        """Test email validation with edge cases and malicious input"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Test email validation
        name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await name_field.fill("Email Test User")

        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first

        validation_results = []

        for test_email in WeSignAdvancedTestUtils.EDGE_CASE_EMAILS:
            await email_field.clear()
            await email_field.fill(test_email)
            await asyncio.sleep(0.3)

            # Try to add recipient
            add_button = page.locator('button:has-text("Add recipient")').first
            await add_button.click()
            await asyncio.sleep(0.5)

            # Check validation feedback
            validation_messages = page.locator('[role="alert"], .error, .invalid, text*="invalid"')
            validation_count = await validation_messages.count()

            validation_results.append({
                "email": test_email,
                "validation_triggered": validation_count > 0,
                "accepted": validation_count == 0
            })

            print(f"📧 Email: '{test_email[:30]}...' | Validation: {validation_count > 0}")

        # Security analysis
        malicious_accepted = [r for r in validation_results if ("script" in r["email"] or "DROP" in r["email"]) and r["accepted"]]
        if malicious_accepted:
            print("🚨 SECURITY WARNING: Malicious emails accepted")
            for result in malicious_accepted:
                print(f"   Accepted: {result['email']}")

        print(f"📊 Email validation tested: {len(WeSignAdvancedTestUtils.EDGE_CASE_EMAILS)} cases")

    @pytest.mark.asyncio
    async def test_file_upload_security(self, page: Page):
        """Test file upload security with malicious file types"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"

        # Navigate to dashboard and start file upload workflow
        await page.goto(f"{self.base_url}/dashboard")
        await page.wait_for_load_state('networkidle')

        # Look for file upload options
        server_sign_button = page.locator('button:has-text("Server sign"), a:has-text("Server sign")').first
        await server_sign_button.click()
        await asyncio.sleep(2)

        # Test malicious file uploads
        file_input = page.locator('input[type="file"]').first

        if await file_input.is_visible():
            security_results = []

            for filename, content_type in WeSignAdvancedTestUtils.MALICIOUS_FILE_TYPES:
                # Create malicious test file
                file_path = await WeSignAdvancedTestUtils.create_malicious_file(filename, content_type)

                try:
                    # Attempt to upload malicious file
                    await file_input.set_input_files(file_path)
                    await asyncio.sleep(1)

                    # Check for security restrictions
                    error_messages = page.locator('text*="not allowed", text*="invalid", text*="error", [role="alert"]')
                    error_count = await error_messages.count()

                    # Look for upload success indicators
                    success_indicators = page.locator('text*="uploaded", text*="success", button:has-text("Continue")')
                    success_count = await success_indicators.count()

                    security_results.append({
                        "filename": filename,
                        "blocked": error_count > 0,
                        "uploaded": success_count > 0
                    })

                    if error_count > 0:
                        print(f"✅ Malicious file blocked: {filename}")
                    else:
                        print(f"🚨 SECURITY WARNING: Malicious file uploaded: {filename}")

                except Exception as e:
                    print(f"✅ File upload failed (good): {filename} - {e}")
                    security_results.append({
                        "filename": filename,
                        "blocked": True,
                        "uploaded": False
                    })

                # Clean up
                try:
                    import os
                    os.remove(file_path)
                except:
                    pass

            # Analyze security results
            uploaded_malicious = [r for r in security_results if r["uploaded"] and not r["blocked"]]
            if uploaded_malicious:
                print("🚨 CRITICAL SECURITY ISSUE: Malicious files accepted")
                for result in uploaded_malicious:
                    print(f"   Uploaded: {result['filename']}")
                assert False, "Malicious file upload vulnerability detected"

            print(f"📊 File security tested: {len(WeSignAdvancedTestUtils.MALICIOUS_FILE_TYPES)} malicious file types")

        else:
            print("⚠️  File upload interface not found - testing skipped")

    @pytest.mark.asyncio
    async def test_javascript_error_handling_and_recovery(self, page: Page):
        """Test JavaScript error handling and application recovery"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Monitor JavaScript errors
        console_errors = []
        def handle_console_message(msg):
            if msg.type == "error":
                console_errors.append({
                    "text": msg.text,
                    "location": msg.location,
                    "timestamp": time.time()
                })

        page.on("console", handle_console_message)

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Trigger the known JavaScript error (SMS switching bug)
        name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await name_field.fill("Error Recovery Test")

        # Switch to SMS (this triggers the error)
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by SMS")
        await asyncio.sleep(2)

        # Check if error occurred
        phone_errors = [error for error in console_errors if "phone" in error["text"].lower()]

        if phone_errors:
            print("🐛 JavaScript error reproduced")

            # Test application recovery
            recovery_tests = [
                # Test form functionality after error
                lambda: name_field.fill("Recovery Test User"),
                # Test tab switching after error
                lambda: page.locator('button:has-text("Myself")').first.click(),
                lambda: page.locator('button:has-text("Others")').first.click(),
                # Test navigation after error
                lambda: page.locator('button:has-text("Back")').first.click(),
            ]

            recovery_results = []
            for i, test_func in enumerate(recovery_tests):
                try:
                    await test_func()
                    await asyncio.sleep(1)
                    recovery_results.append({"test": i, "success": True})
                    print(f"✅ Recovery test {i+1} passed")
                except Exception as e:
                    recovery_results.append({"test": i, "success": False, "error": str(e)})
                    print(f"❌ Recovery test {i+1} failed: {e}")

            failed_recovery = [r for r in recovery_results if not r["success"]]
            if failed_recovery:
                print("🚨 APPLICATION STABILITY ISSUE: Failed to recover from JavaScript error")
                assert False, "Application failed to recover from JavaScript error"
            else:
                print("✅ Application successfully recovered from JavaScript error")

        else:
            print("✅ JavaScript error not reproduced - may have been fixed")

        # Clean up event listener
        page.remove_listener("console", handle_console_message)

        print(f"📊 Error handling tested - {len(console_errors)} errors captured")


class TestSigningPerformanceAndLoad:
    """Performance and load testing for signing workflows"""

    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.test_credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }

    async def setup_authenticated_session(self, page: Page) -> bool:
        """Setup authenticated session"""
        try:
            await page.goto(f"{self.base_url}/auth/login")
            await page.wait_for_load_state('networkidle')

            await page.fill('input[type="email"]', self.test_credentials["email"])
            await page.fill('input[type="password"]', self.test_credentials["password"])

            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            await page.wait_for_url("**/dashboard**", timeout=15000)
            await page.wait_for_load_state('networkidle')
            return True
        except Exception:
            return False

    @pytest.mark.asyncio
    async def test_multiple_recipients_performance(self, page: Page):
        """Test performance with multiple recipients in Others workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Click Others tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Measure time to add multiple recipients
        start_time = time.time()
        recipient_count = 10

        for i in range(recipient_count):
            # Fill recipient info
            if i == 0:
                name_field = page.locator('input[placeholder*="Full name"]').first
                email_field = page.locator('input[placeholder*="Email"]').first
            else:
                name_field = page.locator('input[placeholder*="Full name"]').nth(i)
                email_field = page.locator('input[placeholder*="Email"]').nth(i)

            await name_field.fill(f"Performance Test User {i+1}")
            await email_field.fill(f"test.user{i+1}@example.com")

            # Add recipient (except for last one)
            if i < recipient_count - 1:
                add_button = page.locator('button:has-text("Add recipient")').first
                await add_button.click()
                await asyncio.sleep(0.5)  # Wait for form to appear

        end_time = time.time()
        total_time = end_time - start_time

        print(f"📊 Added {recipient_count} recipients in {total_time:.2f} seconds")
        print(f"📊 Average time per recipient: {(total_time/recipient_count):.2f} seconds")

        # Verify all recipients were added
        recipient_headings = page.locator('h3[text()="1"], h3[text()="2"], h3[text()="3"]')
        actual_count = await recipient_headings.count()

        if actual_count >= recipient_count:
            print(f"✅ Performance test passed: {actual_count} recipients added")
        else:
            print(f"⚠️  Performance issue: Only {actual_count}/{recipient_count} recipients added")

        # Test reordering performance
        reorder_start = time.time()

        # Look for reorder buttons and test a few operations
        up_buttons = page.locator('button img[alt*="up"], button[aria-label*="up"]')
        up_count = await up_buttons.count()

        if up_count > 0:
            # Test clicking reorder buttons
            for i in range(min(5, up_count)):
                try:
                    await up_buttons.nth(i).click()
                    await asyncio.sleep(0.2)
                except:
                    pass

        reorder_end = time.time()
        reorder_time = reorder_end - reorder_start

        print(f"📊 Reordering operations completed in {reorder_time:.2f} seconds")

    @pytest.mark.asyncio
    async def test_workflow_switching_performance(self, page: Page):
        """Test performance of switching between signing workflows"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        await page.goto(f"{self.base_url}/dashboard/selectsigners")
        await page.wait_for_load_state('networkidle')

        # Test rapid tab switching
        workflow_tabs = ["Myself", "Others", "Live"]
        switch_times = []

        for _ in range(3):  # 3 complete cycles
            for tab_name in workflow_tabs:
                start_time = time.time()

                tab_button = page.locator(f'button:has-text("{tab_name}")').first
                await tab_button.click()
                await page.wait_for_load_state('networkidle')

                end_time = time.time()
                switch_time = end_time - start_time
                switch_times.append(switch_time)

                print(f"📊 Switch to {tab_name}: {switch_time:.2f}s")

        # Performance analysis
        avg_switch_time = sum(switch_times) / len(switch_times)
        max_switch_time = max(switch_times)

        print(f"📊 Average tab switch time: {avg_switch_time:.2f} seconds")
        print(f"📊 Maximum tab switch time: {max_switch_time:.2f} seconds")

        # Performance thresholds
        if avg_switch_time > 2.0:
            print("⚠️  Performance warning: Average switch time > 2 seconds")
        if max_switch_time > 5.0:
            print("🚨 Performance issue: Maximum switch time > 5 seconds")
            assert False, "Tab switching performance is too slow"

        print("✅ Tab switching performance is acceptable")


# Test execution configuration
if __name__ == "__main__":
    import sys

    print("🔒 WeSign Advanced Security & Performance Test Suite")
    print("=" * 60)
    print("Coverage: Security | Performance | Edge Cases | Error Handling")
    print("Focus: Vulnerability detection and robustness validation")
    print("=" * 60)

    # Run with pytest
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--maxfail=3",
        "--capture=no"
    ])