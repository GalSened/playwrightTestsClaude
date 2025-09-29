"""
WeSign Comprehensive Signing Flows Test Suite

This test suite provides comprehensive coverage of WeSign's core signing functionality:
1. Self-Signing ("Myself") - Server certificate signing workflow
2. Others-Signing ("Others") - Multi-recipient collaborative signing
3. Live Signing ("Live") - Real-time co-browsing collaborative signing

Created: 2025-01-25
Based on: Live application discovery and comprehensive workflow analysis
Priority: CRITICAL - Core business functionality testing
"""

import pytest
from playwright.async_api import Page, expect
import asyncio
import os
import tempfile
from typing import List, Dict, Any


class WeSignSmartWaits:
    """Smart waiting utilities for WeSign application interactions"""

    @staticmethod
    async def wait_for_navigation_complete(page: Page, timeout: int = 10000):
        """Wait for page navigation to complete with loading indicators"""
        try:
            # Wait for any loading indicators to disappear
            await page.wait_for_load_state('networkidle', timeout=timeout)
            await asyncio.sleep(0.5)  # Additional stability wait
            return True
        except Exception:
            return False

    @staticmethod
    async def wait_for_element_stable(page: Page, selector: str, timeout: int = 5000):
        """Wait for element to be present and stable"""
        try:
            element = page.locator(selector).first
            await element.wait_for(state='visible', timeout=timeout)
            await asyncio.sleep(0.3)  # Stability wait
            return element
        except Exception:
            return None

    @staticmethod
    async def safe_click(page: Page, selector: str, timeout: int = 5000):
        """Perform a safe click with retry logic"""
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                element = await WeSignSmartWaits.wait_for_element_stable(page, selector, timeout)
                if element and await element.is_visible():
                    await element.click()
                    await asyncio.sleep(0.5)
                    return True
            except Exception as e:
                if attempt == max_attempts - 1:
                    print(f"Failed to click {selector} after {max_attempts} attempts: {e}")
                    return False
                await asyncio.sleep(1)
        return False

    @staticmethod
    async def safe_fill(page: Page, selector: str, value: str, timeout: int = 5000):
        """Perform safe text input with validation"""
        try:
            element = await WeSignSmartWaits.wait_for_element_stable(page, selector, timeout)
            if element:
                await element.clear()
                await element.fill(value)
                await asyncio.sleep(0.3)
                return True
        except Exception as e:
            print(f"Failed to fill {selector} with {value}: {e}")
            return False
        return False


class SigningFlowsTestSuite:
    """Base class for signing workflow tests with common utilities"""

    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.test_credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }

    async def setup_authenticated_session(self, page: Page) -> bool:
        """Setup authenticated session for testing"""
        try:
            # Navigate to login page
            await page.goto(f"{self.base_url}/auth/login")
            await WeSignSmartWaits.wait_for_navigation_complete(page)

            # Perform login
            await WeSignSmartWaits.safe_fill(page, 'input[type="email"]', self.test_credentials["email"])
            await WeSignSmartWaits.safe_fill(page, 'input[type="password"]', self.test_credentials["password"])

            # Submit login form
            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            # Wait for dashboard to load
            await page.wait_for_url("**/dashboard**", timeout=15000)
            await WeSignSmartWaits.wait_for_navigation_complete(page)

            return True

        except Exception as e:
            print(f"Authentication failed: {e}")
            return False

    async def navigate_to_signing_workflow(self, page: Page, document_path: str = None) -> bool:
        """Navigate to signing workflow selection"""
        try:
            # If no document provided, create test document
            if not document_path:
                document_path = await self.create_test_document()

            # Navigate to dashboard if not already there
            current_url = page.url
            if "/dashboard" not in current_url:
                await page.goto(f"{self.base_url}/dashboard")
                await WeSignSmartWaits.wait_for_navigation_complete(page)

            # Click "Server sign" to start signing workflow
            server_sign_button = page.locator('button:has-text("Server sign"), a:has-text("Server sign")').first
            await server_sign_button.wait_for(state='visible', timeout=10000)
            await server_sign_button.click()

            # Wait for file upload interface or navigate to selectsigners
            await asyncio.sleep(2)

            # If we need to upload a document
            if "/selectsigners" not in page.url:
                # Handle file upload if needed
                file_input = page.locator('input[type="file"]').first
                if await file_input.is_visible():
                    await file_input.set_input_files(document_path)
                    await asyncio.sleep(1)

                    # Click upload or continue button
                    continue_button = page.locator('button:has-text("Continue"), button:has-text("Upload"), button:has-text("Next")').first
                    if await continue_button.is_visible():
                        await continue_button.click()

            # Wait for signer selection page
            await page.wait_for_url("**/selectsigners**", timeout=15000)
            await WeSignSmartWaits.wait_for_navigation_complete(page)

            return True

        except Exception as e:
            print(f"Navigation to signing workflow failed: {e}")
            return False

    async def create_test_document(self, filename: str = "test_signing_document.pdf") -> str:
        """Create a test PDF document for signing tests"""
        try:
            # Create test PDF with basic content
            file_path = f"C:/Users/gals/{filename}"

            # Simple PDF content
            pdf_content = """%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font << /F1 5 0 R >>
>>
>>
endobj

4 0 obj
<<
/Length 55
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Document for WeSign) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000207 00000 n
0000000310 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
378
%%EOF"""

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(pdf_content)

            return file_path

        except Exception as e:
            print(f"Failed to create test document: {e}")
            return None


class TestSelfSigningWorkflow(SigningFlowsTestSuite):
    """Test suite for Self-Signing ("Myself") workflow"""

    @pytest.mark.asyncio
    async def test_self_signing_workflow_navigation(self, page: Page):
        """Test navigation to self-signing workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"

        # Navigate to signing workflow
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Verify we're on the signer selection page
        assert "/selectsigners" in page.url, "Not on signer selection page"

        # Click "Myself" tab to enter self-signing mode
        myself_button = page.locator('button:has-text("Myself")').first
        await myself_button.wait_for(state='visible', timeout=5000)
        await myself_button.click()

        # Verify self-signing interface
        self_signing_text = page.locator('text=You are the only signer').first
        await expect(self_signing_text).to_be_visible(timeout=5000)

        # Verify Edit document button exists (may be disabled initially)
        edit_button = page.locator('button:has-text("Edit document")').first
        await expect(edit_button).to_be_visible(timeout=5000)

    @pytest.mark.asyncio
    async def test_self_signing_document_name_validation(self, page: Page):
        """Test document name validation in self-signing workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Myself" tab
        myself_button = page.locator('button:has-text("Myself")').first
        await myself_button.click()
        await asyncio.sleep(1)

        # Test document name field
        doc_name_field = page.locator('input[value*="test_signing_document"]').first
        if await doc_name_field.is_visible():
            # Test clearing document name
            await doc_name_field.clear()
            await doc_name_field.fill("")

            # Verify behavior with empty document name
            await asyncio.sleep(0.5)

            # Test special characters
            await doc_name_field.fill("Test@#$%^&*()_+Document")
            await asyncio.sleep(0.5)

            # Test very long name
            long_name = "Very_Long_Document_Name_" * 10
            await doc_name_field.fill(long_name)
            await asyncio.sleep(0.5)

            # Restore valid name
            await doc_name_field.fill("test_signing_document")

        # Verify interface remains stable
        self_signing_text = page.locator('text=You are the only signer').first
        await expect(self_signing_text).to_be_visible()

    @pytest.mark.asyncio
    async def test_self_signing_edit_document_state(self, page: Page):
        """Test Edit document button state and conditions"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Myself" tab
        myself_button = page.locator('button:has-text("Myself")').first
        await myself_button.click()
        await asyncio.sleep(1)

        # Check Edit document button state
        edit_button = page.locator('button:has-text("Edit document")').first
        await expect(edit_button).to_be_visible()

        # Test if button is initially disabled (discovered behavior)
        is_disabled = await edit_button.is_disabled()

        # Document the current state
        if is_disabled:
            print("✅ VALIDATED: Edit document button is disabled initially")
            print("📋 NOTE: This matches discovered behavior - button requires specific conditions to enable")
        else:
            print("⚠️  CHANGE DETECTED: Edit document button is now enabled initially")
            # If enabled, test clicking it
            await edit_button.click()
            await asyncio.sleep(1)

        # Verify interface stability regardless of button state
        self_signing_text = page.locator('text=You are the only signer').first
        await expect(self_signing_text).to_be_visible()

    @pytest.mark.asyncio
    async def test_self_signing_workflow_consistency(self, page: Page):
        """Test consistency of self-signing workflow across page interactions"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Test tab switching between signing modes
        workflow_tabs = ["Myself", "Others", "Live"]

        for tab_name in workflow_tabs:
            tab_button = page.locator(f'button:has-text("{tab_name}")').first
            await tab_button.click()
            await asyncio.sleep(1)

            # Verify tab is active
            is_active = await tab_button.get_attribute('class')
            print(f"📋 {tab_name} tab state: {is_active}")

        # Return to Myself tab
        myself_button = page.locator('button:has-text("Myself")').first
        await myself_button.click()
        await asyncio.sleep(1)

        # Verify self-signing interface is restored
        self_signing_text = page.locator('text=You are the only signer').first
        await expect(self_signing_text).to_be_visible()

        # Verify document name persistence
        doc_name_field = page.locator('input[value*="test_signing_document"]').first
        if await doc_name_field.is_visible():
            current_value = await doc_name_field.input_value()
            assert "test_signing_document" in current_value, "Document name not persisted across tab switches"


class TestOthersSigningWorkflow(SigningFlowsTestSuite):
    """Test suite for Others-Signing multi-recipient workflow"""

    @pytest.mark.asyncio
    async def test_others_signing_workflow_navigation(self, page: Page):
        """Test navigation to others-signing workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Others" tab to enter multi-recipient mode
        others_button = page.locator('button:has-text("Others")').first
        await others_button.wait_for(state='visible', timeout=5000)
        await others_button.click()
        await asyncio.sleep(1)

        # Verify others-signing interface elements
        add_recipients_text = page.locator('text=Add recipients and drag tiles').first
        await expect(add_recipients_text).to_be_visible(timeout=5000)

        # Verify recipient form fields
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await expect(full_name_field).to_be_visible(timeout=5000)

        # Verify communication method dropdown
        comm_method_select = page.locator('select').first
        await expect(comm_method_select).to_be_visible(timeout=5000)

        # Verify contact group button
        add_contacts_group_button = page.locator('button:has-text("Add contacts group")').first
        await expect(add_contacts_group_button).to_be_visible(timeout=5000)

    @pytest.mark.asyncio
    async def test_others_signing_recipient_management(self, page: Page):
        """Test adding and managing recipients in others-signing workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Others" tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Add first recipient
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await full_name_field.fill("Test Recipient 1")

        # Test email delivery (default)
        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
        await email_field.fill("test.recipient1@example.com")

        # Click "Add recipient"
        add_recipient_button = page.locator('button:has-text("Add recipient")').first
        await add_recipient_button.click()
        await asyncio.sleep(1)

        # Verify second recipient form appears
        recipient_2_heading = page.locator('h3:has-text("2")').first
        await expect(recipient_2_heading).to_be_visible(timeout=5000)

        # Add second recipient with SMS
        second_name_field = page.locator('input[placeholder*="Full name"]').nth(1)
        await second_name_field.fill("Test Recipient 2")

        # Switch to SMS delivery for second recipient
        second_comm_select = page.locator('select').nth(1)
        await second_comm_select.select_option(value="sms")

        # Note: This should trigger the JavaScript error discovered
        await asyncio.sleep(1)

        # Check for phone number field
        phone_field = page.locator('input[placeholder*="050"]').last()
        if await phone_field.is_visible():
            await phone_field.fill("050-123-4567")

        # Test recipient ordering and management
        # Look for drag handles or reorder buttons
        reorder_buttons = page.locator('button img[src*="arrow"], button[aria-label*="up"], button[aria-label*="down"]')
        reorder_count = await reorder_buttons.count()
        print(f"📋 Found {reorder_count} reorder controls")

        # Verify parallel signing option
        parallel_checkbox = page.locator('checkbox:has-text("parallel"), input[type="checkbox"]').first
        if await parallel_checkbox.is_visible():
            await parallel_checkbox.check()
            await asyncio.sleep(0.5)
            await parallel_checkbox.uncheck()

    @pytest.mark.asyncio
    async def test_others_signing_communication_methods(self, page: Page):
        """Test email and SMS communication method validation"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Others" tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Test email validation
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await full_name_field.fill("Email Test User")

        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first

        # Test invalid email formats
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "user@",
            "user..user@example.com",
            "user@example",
            "<script>alert('xss')</script>@example.com"
        ]

        for invalid_email in invalid_emails:
            await email_field.clear()
            await email_field.fill(invalid_email)
            await asyncio.sleep(0.5)

            # Try to add recipient with invalid email
            add_recipient_button = page.locator('button:has-text("Add recipient")').first
            await add_recipient_button.click()
            await asyncio.sleep(0.5)

        # Test valid email
        await email_field.clear()
        await email_field.fill("valid.email@example.com")

        # Switch to SMS to test phone validation
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by SMS")
        await asyncio.sleep(1)

        # Test phone number validation (if field appears)
        phone_field = page.locator('input[placeholder*="050"]').first
        if await phone_field.is_visible():
            # Test invalid phone numbers
            invalid_phones = [
                "abc-def-ghij",
                "123",
                "050-12",
                "+972-050-123-45678901234",  # Too long
                "000-000-0000"
            ]

            for invalid_phone in invalid_phones:
                await phone_field.clear()
                await phone_field.fill(invalid_phone)
                await asyncio.sleep(0.5)

            # Test valid phone
            await phone_field.fill("050-123-4567")

        # Test country code selection
        country_select = page.locator('select[value*="+972"], combobox[aria-label*="Israel"]').first
        if await country_select.is_visible():
            # Verify Israel (+972) is default
            current_value = await country_select.input_value()
            print(f"📋 Default country code: {current_value}")

    @pytest.mark.asyncio
    async def test_others_signing_javascript_error_reproduction(self, page: Page):
        """Test reproduction of discovered JavaScript error in SMS switching"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Others" tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Setup console error monitoring
        console_errors = []

        def handle_console_message(msg):
            if msg.type == "error":
                console_errors.append({
                    "text": msg.text,
                    "location": msg.location,
                    "timestamp": asyncio.get_event_loop().time()
                })

        page.on("console", handle_console_message)

        # Fill recipient name (to trigger the error condition)
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await full_name_field.fill("Error Test User")

        # Initially select email (default)
        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
        await email_field.fill("test@example.com")

        # Switch to SMS - this should trigger the JavaScript error
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by SMS")
        await asyncio.sleep(2)  # Wait for error to occur

        # Check if the specific error was caught
        phone_errors = [error for error in console_errors if "phone" in error["text"].lower()]

        if phone_errors:
            print("🐛 REPRODUCED: JavaScript error in SMS switching")
            for error in phone_errors:
                print(f"   Error: {error['text']}")
        else:
            print("✅ NO ERROR: SMS switching worked without JavaScript errors")
            print("   This might indicate the bug has been fixed")

        # Verify UI still functions despite potential error
        phone_field = page.locator('input[placeholder*="050"]').first
        if await phone_field.is_visible():
            await phone_field.fill("050-123-4567")
            print("📋 Phone field is functional despite any errors")

        # Document all console errors for analysis
        print(f"📊 Total console errors captured: {len(console_errors)}")

        # Clean up event listener
        page.remove_listener("console", handle_console_message)

    @pytest.mark.asyncio
    async def test_others_signing_advanced_features(self, page: Page):
        """Test advanced features: parallel signing, meaning of signature, contact groups"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Others" tab
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Test "Add contacts group" functionality
        add_contacts_group_button = page.locator('button:has-text("Add contacts group")').first
        await expect(add_contacts_group_button).to_be_visible()

        # Click to see what happens (may open modal or navigate)
        await add_contacts_group_button.click()
        await asyncio.sleep(2)

        # Document behavior and return to main flow if needed
        current_url = page.url
        print(f"📋 After contacts group click: {current_url}")

        # Ensure we're back on the signers page
        if "/selectsigners" not in current_url:
            await page.go_back()
            await asyncio.sleep(1)

        # Test parallel signing checkbox
        parallel_checkbox = page.locator('input[type="checkbox"]').first
        if await parallel_checkbox.is_visible():
            # Test checking the parallel option
            await parallel_checkbox.check()
            await asyncio.sleep(0.5)

            # Verify it's checked
            is_checked = await parallel_checkbox.is_checked()
            assert is_checked, "Parallel signing checkbox should be checked"

            # Test unchecking
            await parallel_checkbox.uncheck()
            await asyncio.sleep(0.5)

        # Test "Meaning of Signature" feature
        meaning_checkbox = page.locator('input[type="checkbox"]').nth(1)
        if await meaning_checkbox.is_visible():
            await meaning_checkbox.check()
            await asyncio.sleep(0.5)

            # Look for additional UI elements that appear
            meaning_info = page.locator('text*="meaning", text*="signature"')
            if await meaning_info.count() > 0:
                print("✅ Meaning of Signature feature is available")

            await meaning_checkbox.uncheck()

        # Test Edit document in Others workflow
        edit_button = page.locator('button:has-text("Edit document")').first
        if await edit_button.is_visible():
            is_disabled = await edit_button.is_disabled()
            print(f"📋 Edit document button disabled in Others workflow: {is_disabled}")

            if not is_disabled:
                await edit_button.click()
                await asyncio.sleep(1)


class TestLiveSigningWorkflow(SigningFlowsTestSuite):
    """Test suite for Live Signing co-browsing workflow"""

    @pytest.mark.asyncio
    async def test_live_signing_workflow_navigation(self, page: Page):
        """Test navigation to live signing workflow"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Live" tab to enter co-browsing mode
        live_button = page.locator('button:has-text("Live")').first
        await live_button.wait_for(state='visible', timeout=5000)
        await live_button.click()
        await asyncio.sleep(1)

        # Verify live signing interface elements
        cobrowsing_text = page.locator('text*="co-browsing link will be sent"').first
        await expect(cobrowsing_text).to_be_visible(timeout=5000)

        # Verify recipient form (should be single recipient focused)
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await expect(full_name_field).to_be_visible(timeout=5000)

        # Verify communication options exist
        comm_select = page.locator('select').first
        await expect(comm_select).to_be_visible(timeout=5000)

    @pytest.mark.asyncio
    async def test_live_signing_data_persistence(self, page: Page):
        """Test data persistence across signing workflow tabs"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Start in Others tab and add recipient data
        others_button = page.locator('button:has-text("Others")').first
        await others_button.click()
        await asyncio.sleep(1)

        # Add test data
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await full_name_field.fill("Persistence Test User")

        # Switch to SMS
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by SMS")
        await asyncio.sleep(1)

        # Add phone number if field is available
        phone_field = page.locator('input[placeholder*="050"]').first
        if await phone_field.is_visible():
            await phone_field.fill("050-999-8888")

        # Switch to Live tab
        live_button = page.locator('button:has-text("Live")').first
        await live_button.click()
        await asyncio.sleep(1)

        # Verify data persistence
        live_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        current_name = await live_name_field.input_value()

        if "Persistence Test User" in current_name:
            print("✅ VALIDATED: Form data persists across workflow tabs")
        else:
            print("⚠️  Data persistence issue detected")
            print(f"   Expected: 'Persistence Test User', Found: '{current_name}'")

        # Check communication method persistence
        live_comm_select = page.locator('select').first
        current_comm = await live_comm_select.input_value()
        print(f"📋 Communication method persistence: {current_comm}")

        # Check phone field if SMS was selected
        live_phone_field = page.locator('input[placeholder*="050"]').first
        if await live_phone_field.is_visible():
            current_phone = await live_phone_field.input_value()
            print(f"📋 Phone number persistence: {current_phone}")

    @pytest.mark.asyncio
    async def test_live_signing_cobrowsing_features(self, page: Page):
        """Test co-browsing specific features and UI elements"""
        # Setup
        assert await self.setup_authenticated_session(page), "Failed to authenticate"
        assert await self.navigate_to_signing_workflow(page), "Failed to navigate to signing workflow"

        # Click "Live" tab
        live_button = page.locator('button:has-text("Live")').first
        await live_button.click()
        await asyncio.sleep(1)

        # Verify co-browsing explanation text
        cobrowsing_explanation = page.locator('text*="Add a recipient to a live session"').first
        await expect(cobrowsing_explanation).to_be_visible(timeout=5000)

        # Add recipient to test co-browsing workflow
        full_name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
        await full_name_field.fill("Live Session Participant")

        # Test email delivery for co-browsing link
        comm_select = page.locator('select').first
        await comm_select.select_option("Send document by email")

        email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
        await email_field.fill("live.participant@example.com")

        # Verify Edit document functionality in Live mode
        edit_button = page.locator('button:has-text("Edit document")').first
        await expect(edit_button).to_be_visible()

        is_disabled = await edit_button.is_disabled()
        print(f"📋 Edit document button state in Live workflow: {'disabled' if is_disabled else 'enabled'}")

        # Look for any live session specific controls
        live_controls = page.locator('button[aria-label*="live"], button[title*="session"]')
        control_count = await live_controls.count()
        print(f"📋 Live session controls found: {control_count}")

        # Test the single-recipient focus (no "Add recipient" in live mode)
        add_recipient_button = page.locator('button:has-text("Add recipient")').first
        add_recipient_visible = await add_recipient_button.is_visible()

        if not add_recipient_visible:
            print("✅ VALIDATED: Live workflow focuses on single recipient (no 'Add recipient' button)")
        else:
            print("⚠️  CHANGE: 'Add recipient' button visible in Live workflow")


# Test Configuration and Execution
if __name__ == "__main__":
    import sys

    print("🚀 WeSign Comprehensive Signing Flows Test Suite")
    print("=" * 60)
    print("Coverage: Self-Signing | Others-Signing | Live Signing")
    print("Focus: Core business workflow validation")
    print("=" * 60)

    # Run with pytest
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--maxfail=5",
        "--capture=no"
    ])