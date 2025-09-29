"""
WeSign Signing Workflows Testing

This module provides comprehensive testing for WeSign's core signing workflows
discovered during comprehensive system exploration.

MAJOR DISCOVERIES: Complete Signing Workflow System
---------------------------------------------------
During comprehensive exploration, we discovered WeSign's complete signing workflow
ecosystem with 3 distinct workflows:

1. "MYSELF" SIGNING WORKFLOW (Self-Signing):
   - Description: "You are the only signer - sign and download your own documents"
   - Entry: Dashboard → "Server sign" → "Myself" tab
   - Features:
     * Server certificate authentication (Certificate ID + Password)
     * Single-user document signing workflow
     * Direct document download capability
     * Edit document functionality (conditional enable/disable)

2. "OTHERS" SIGNING WORKFLOW (Multi-Recipient):
   - Description: Multi-recipient collaborative signing with advanced workflow management
   - Entry: Dashboard → "Assign & send" → "Others" tab
   - Features:
     * Multi-recipient management (unlimited signers)
     * Sequential signing order with drag & drop reordering
     * Dual communication methods:
       - Email delivery with document links
       - SMS delivery with phone number + country code (+972 Israel)
     * Advanced workflow options:
       - Parallel vs Sequential signing modes
       - "Meaning of Signature" feature
       - Contact group integration
     * Individual recipient controls (delete, reorder, edit per signer)
   - CRITICAL BUG DISCOVERED: JavaScript error when switching to SMS

3. "LIVE" SIGNING WORKFLOW (Co-browsing):
   - Description: Real-time co-browsing collaborative signing
   - Entry: Dashboard → Document Selection → "Live" tab
   - Features:
     * Co-browsing technology: "A co-browsing link will be sent by email"
     * Real-time synchronization for live collaboration
     * Single recipient focus (unlike multi-recipient Others workflow)
     * Session-based access with link delivery
     * Data persistence across workflow tab switches

Test Coverage:
- All 3 signing workflow navigation and accessibility
- Workflow-specific feature testing and validation
- Cross-workflow data persistence and consistency
- Communication method testing (Email/SMS)
- JavaScript error reproduction and handling
- Contact integration and group management
- Sequential vs parallel signing mode testing
- Real-time collaboration interface testing
"""

import asyncio
import time
import json
from typing import Dict, List, Any, Optional, Tuple
from playwright.async_api import Page, Browser, BrowserContext
import logging

# Import foundation components
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from foundation import WeSignTestFoundation, WeSignNavigationUtils, WeSignTestDataManager

logger = logging.getLogger(__name__)


class TestSigningWorkflows:
    """
    Comprehensive testing for WeSign's Signing Workflows.

    This class tests all 3 signing workflows discovered during comprehensive
    system exploration: Myself (self-signing), Others (multi-recipient),
    and Live (co-browsing) workflows.
    """

    def __init__(self):
        """Initialize signing workflows testing utilities."""
        self.auth = WeSignTestFoundation()
        self.nav = WeSignNavigationUtils()
        self.data_manager = WeSignTestDataManager()

        # Signing workflow configuration discovered during exploration
        self.signing_workflows = {
            "myself": {
                "name": "Myself",
                "description": "You are the only signer - sign and download your own documents",
                "entry_path": "Server sign → Myself tab",
                "features": [
                    "Server certificate authentication",
                    "Single-user signing workflow",
                    "Direct document download",
                    "Edit document functionality"
                ],
                "authentication_required": "Certificate ID + Password"
            },
            "others": {
                "name": "Others",
                "description": "Multi-recipient collaborative signing with advanced workflow management",
                "entry_path": "Assign & send → Others tab",
                "features": [
                    "Multi-recipient management",
                    "Sequential signing order with drag & drop",
                    "Email delivery with document links",
                    "SMS delivery with phone + country code",
                    "Parallel vs Sequential signing modes",
                    "Meaning of Signature feature",
                    "Contact group integration",
                    "Individual recipient controls"
                ],
                "known_bug": "JavaScript error when switching to SMS"
            },
            "live": {
                "name": "Live",
                "description": "Real-time co-browsing collaborative signing",
                "entry_path": "Document Selection → Live tab",
                "features": [
                    "Co-browsing technology",
                    "Real-time synchronization",
                    "Single recipient focus",
                    "Session-based access with link delivery",
                    "Data persistence across tabs"
                ],
                "technology": "Co-browsing link sent by email"
            }
        }

        # Communication methods discovered
        self.communication_methods = {
            "email": {
                "method": "Email",
                "description": "Send document by Email",
                "required_fields": ["recipient_email"],
                "default_country_code": None
            },
            "sms": {
                "method": "SMS",
                "description": "Send document by SMS",
                "required_fields": ["recipient_phone"],
                "default_country_code": "+972",  # Israel (discovered during exploration)
                "known_issues": ["JavaScript error when switching from email to SMS"]
            }
        }

        # Test recipients for workflow testing
        self.test_recipients = [
            {
                "name": "Test Recipient 1",
                "email": "test.recipient.1@example.com",
                "phone": "050-1234-567",
                "role": "Primary Signer"
            },
            {
                "name": "Test Recipient 2",
                "email": "test.recipient.2@example.com",
                "phone": "050-2345-678",
                "role": "Secondary Signer"
            },
            {
                "name": "Test Recipient 3",
                "email": "test.recipient.3@example.com",
                "phone": "050-3456-789",
                "role": "Witness"
            }
        ]

    async def setup_test_session(self, page: Page) -> bool:
        """
        Setup test session for signing workflows testing.

        Args:
            page: Playwright page instance

        Returns:
            bool: True if setup successful, False otherwise
        """
        try:
            logger.info("🚀 Setting up signing workflows test session...")

            # Authenticate
            if not await self.auth.ensure_authenticated(page):
                logger.error("❌ Authentication failed during setup")
                return False

            # Navigate to dashboard
            if not await self.nav.navigate_to_module(page, "dashboard"):
                logger.error("❌ Dashboard navigation failed during setup")
                return False

            logger.info("✅ Signing workflows test session setup complete")
            return True

        except Exception as e:
            logger.error(f"❌ Signing workflows test session setup error: {str(e)}")
            return False

    async def test_signing_workflow_navigation(self, page: Page) -> Dict[str, Any]:
        """
        Test navigation to all 3 signing workflows.

        This verifies that all discovered signing workflows are accessible
        and properly configured.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing test results
        """
        test_results = {
            "test_name": "Signing Workflow Navigation",
            "status": "pending",
            "details": {},
            "errors": []
        }

        try:
            logger.info("🧭 Testing signing workflow navigation...")

            workflow_navigation_results = {}

            # Test navigation to each signing workflow
            for workflow_id, workflow_config in self.signing_workflows.items():
                logger.info(f"   → Testing navigation to {workflow_config['name']} workflow...")

                workflow_result = {
                    "workflow_name": workflow_config["name"],
                    "navigation_successful": False,
                    "tab_found": False,
                    "tab_clickable": False,
                    "workflow_interface_loaded": False
                }

                # Navigate to signing workflow base
                try:
                    navigation_success = await self.nav.navigate_to_signing_workflow(page, workflow_id)
                    workflow_result["navigation_successful"] = navigation_success

                    if navigation_success:
                        # Verify workflow tab is present and clickable
                        tab_button = page.locator(f'button:has-text("{workflow_config["name"]}")').first

                        if await tab_button.is_visible():
                            workflow_result["tab_found"] = True

                            if await tab_button.is_enabled():
                                workflow_result["tab_clickable"] = True

                                # Click the tab and verify interface loads
                                await tab_button.click()
                                await asyncio.sleep(2)

                                # Look for workflow-specific interface elements
                                interface_indicators = await self._get_workflow_interface_indicators(workflow_id)

                                interface_loaded = False
                                for indicator in interface_indicators:
                                    element = await self.nav.wait_for_element_stable(page, indicator, timeout=3000)
                                    if element:
                                        interface_loaded = True
                                        break

                                workflow_result["workflow_interface_loaded"] = interface_loaded

                                if interface_loaded:
                                    logger.info(f"   ✅ {workflow_config['name']} workflow accessible and functional")
                                else:
                                    logger.info(f"   ⚠️  {workflow_config['name']} workflow accessible but interface unclear")
                            else:
                                logger.info(f"   ⚠️  {workflow_config['name']} tab found but not clickable")
                        else:
                            logger.info(f"   ❌ {workflow_config['name']} tab not found")
                    else:
                        logger.info(f"   ❌ Navigation to {workflow_config['name']} workflow failed")

                except Exception as e:
                    workflow_result["error"] = str(e)
                    logger.error(f"   ❌ Error testing {workflow_config['name']} workflow: {str(e)}")

                workflow_navigation_results[workflow_id] = workflow_result

            test_results["details"]["workflow_navigation_results"] = workflow_navigation_results

            # Calculate overall navigation success
            accessible_workflows = sum(1 for result in workflow_navigation_results.values()
                                     if result["navigation_successful"] and result["tab_found"])
            total_workflows = len(workflow_navigation_results)

            test_results["details"]["accessibility_rate"] = f"{accessible_workflows}/{total_workflows}"

            if accessible_workflows == total_workflows:
                test_results["status"] = "passed"
                logger.info("   ✅ Signing workflow navigation test PASSED")
            elif accessible_workflows >= 2:  # At least 2 out of 3 workflows accessible
                test_results["status"] = "partial"
                logger.info("   ⚠️  Signing workflow navigation test PARTIAL")
            else:
                test_results["status"] = "failed"
                logger.info("   ❌ Signing workflow navigation test FAILED")

        except Exception as e:
            test_results["status"] = "failed"
            test_results["errors"].append(str(e))
            logger.error(f"   ❌ Signing workflow navigation test error: {str(e)}")

        return test_results

    async def _get_workflow_interface_indicators(self, workflow_id: str) -> List[str]:
        """
        Get interface indicators for specific workflow.

        Args:
            workflow_id: ID of the workflow ("myself", "others", "live")

        Returns:
            List of CSS selectors to look for workflow interface elements
        """
        if workflow_id == "myself":
            return [
                'input[placeholder*="Certificate"]',
                'input[placeholder*="Password"]',
                'button:has-text("Sign")',
                '.certificate-auth',
                '.self-signing-interface'
            ]
        elif workflow_id == "others":
            return [
                'input[placeholder*="Full name"]',
                'input[placeholder*="Email"]',
                'select',  # Communication method dropdown
                'button:has-text("Add Recipient")',
                '.recipient-form',
                '.multi-recipient-interface'
            ]
        elif workflow_id == "live":
            return [
                'input[placeholder*="Email"]',
                'button:has-text("Send Link")',
                'text="co-browsing"',
                'text="live"',
                '.live-signing-interface',
                '.cobrowsing-interface'
            ]
        else:
            return []

    async def test_others_workflow_features(self, page: Page) -> Dict[str, Any]:
        """
        Test "Others" workflow comprehensive features.

        This tests the multi-recipient workflow with all discovered features:
        - Multi-recipient management
        - Email/SMS communication methods
        - Sequential signing order
        - Contact integration
        - JavaScript error reproduction

        Args:
            page: Playwright page instance

        Returns:
            Dict containing test results
        """
        test_results = {
            "test_name": "Others Workflow Features",
            "status": "pending",
            "details": {},
            "errors": []
        }

        try:
            logger.info("👥 Testing Others workflow comprehensive features...")

            # Navigate to Others workflow
            others_navigation = await self.nav.navigate_to_signing_workflow(page, "others")
            if not others_navigation:
                test_results["status"] = "failed"
                test_results["errors"].append("Failed to navigate to Others workflow")
                return test_results

            # Test recipient management
            logger.info("   → Testing recipient management...")
            recipient_management_result = await self._test_recipient_management(page)
            test_results["details"]["recipient_management"] = recipient_management_result

            # Test communication methods (Email/SMS)
            logger.info("   → Testing communication methods...")
            communication_result = await self._test_communication_methods(page)
            test_results["details"]["communication_methods"] = communication_result

            # Test JavaScript error reproduction (discovered bug)
            logger.info("   → Testing JavaScript error reproduction...")
            js_error_result = await self._test_javascript_error_reproduction(page)
            test_results["details"]["javascript_error_testing"] = js_error_result

            # Test advanced features
            logger.info("   → Testing advanced workflow features...")
            advanced_features_result = await self._test_others_advanced_features(page)
            test_results["details"]["advanced_features"] = advanced_features_result

            # Calculate overall Others workflow test result
            feature_tests = [
                recipient_management_result,
                communication_result,
                js_error_result,
                advanced_features_result
            ]

            passed_features = sum(1 for test in feature_tests if test.get("status") == "passed")
            partial_features = sum(1 for test in feature_tests if test.get("status") == "partial")
            total_features = len(feature_tests)

            if passed_features >= 3:  # At least 3 out of 4 feature areas working
                test_results["status"] = "passed"
                logger.info("   ✅ Others workflow features test PASSED")
            elif passed_features + partial_features >= 3:
                test_results["status"] = "partial"
                logger.info("   ⚠️  Others workflow features test PARTIAL")
            else:
                test_results["status"] = "failed"
                logger.info("   ❌ Others workflow features test FAILED")

        except Exception as e:
            test_results["status"] = "failed"
            test_results["errors"].append(str(e))
            logger.error(f"   ❌ Others workflow features test error: {str(e)}")

        return test_results

    async def _test_recipient_management(self, page: Page) -> Dict[str, Any]:
        """Test multi-recipient management functionality."""
        result = {
            "status": "pending",
            "recipients_added": 0,
            "form_fields_working": False,
            "recipient_controls_found": False
        }

        try:
            # Test adding recipients
            for i, recipient in enumerate(self.test_recipients[:2]):  # Test with 2 recipients
                logger.info(f"   → Adding recipient {i+1}: {recipient['name']}")

                # Fill recipient form
                name_filled = await self.nav.safe_fill(page, 'input[placeholder*="Full name"]', recipient["name"])
                email_filled = await self.nav.safe_fill(page, 'input[placeholder*="Email"]', recipient["email"])

                if name_filled and email_filled:
                    result["recipients_added"] += 1
                    result["form_fields_working"] = True

                    # Look for "Add Recipient" or similar button
                    add_buttons = [
                        'button:has-text("Add Recipient")',
                        'button:has-text("Add")',
                        'button:has-text("+")',
                        '.add-recipient-btn'
                    ]

                    for button_selector in add_buttons:
                        if await self.nav.safe_click(page, button_selector):
                            await asyncio.sleep(1)
                            break

                await asyncio.sleep(1)

            # Look for recipient control features
            control_selectors = [
                '.recipient-controls',
                'button:has-text("Delete")',
                'button:has-text("Remove")',
                '.drag-handle',
                '.recipient-reorder'
            ]

            for selector in control_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    result["recipient_controls_found"] = True
                    break

            # Determine result status
            if result["recipients_added"] >= 2 and result["form_fields_working"]:
                result["status"] = "passed"
            elif result["recipients_added"] >= 1:
                result["status"] = "partial"
            else:
                result["status"] = "failed"

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    async def _test_communication_methods(self, page: Page) -> Dict[str, Any]:
        """Test Email/SMS communication methods and switching."""
        result = {
            "status": "pending",
            "email_method_working": False,
            "sms_method_working": False,
            "method_switching_working": False,
            "phone_field_appears": False
        }

        try:
            # Test Email method (default)
            logger.info("   → Testing Email communication method...")
            email_field = page.locator('input[placeholder*="Email"]').first
            if await email_field.is_visible():
                result["email_method_working"] = True

            # Test SMS method switching
            logger.info("   → Testing SMS communication method switching...")
            comm_select = page.locator('select').first
            if await comm_select.is_visible():
                # Switch to SMS
                try:
                    await comm_select.select_option("Send document by SMS")
                    await asyncio.sleep(2)
                    result["method_switching_working"] = True

                    # Check if phone field appears
                    phone_field = page.locator('input[placeholder*="050"], input[placeholder*="phone"]').first
                    if await phone_field.is_visible():
                        result["phone_field_appears"] = True
                        result["sms_method_working"] = True

                        # Test phone number input
                        await phone_field.fill("050-123-4567")
                        await asyncio.sleep(1)

                except Exception as e:
                    logger.warning(f"   ⚠️  SMS switching error (expected): {str(e)}")
                    # This might be the known JavaScript error
                    result["method_switching_attempted"] = True

            # Determine result status
            if result["email_method_working"] and result["sms_method_working"]:
                result["status"] = "passed"
            elif result["email_method_working"] or result["method_switching_working"]:
                result["status"] = "partial"
            else:
                result["status"] = "failed"

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    async def _test_javascript_error_reproduction(self, page: Page) -> Dict[str, Any]:
        """Test JavaScript error reproduction (discovered bug)."""
        result = {
            "status": "pending",
            "error_monitoring_active": False,
            "error_reproduced": False,
            "error_details": [],
            "recovery_tested": False
        }

        try:
            # Setup console error monitoring
            console_errors = []

            def handle_console_error(msg):
                if msg.type == "error":
                    console_errors.append({
                        "text": msg.text,
                        "timestamp": time.time()
                    })

            page.on("console", handle_console_error)
            result["error_monitoring_active"] = True

            # Attempt to reproduce the known JavaScript error
            logger.info("   → Attempting to reproduce SMS switching JavaScript error...")

            # Fill a name field first
            await self.nav.safe_fill(page, 'input[placeholder*="Full name"]', "JS Error Test")
            await asyncio.sleep(1)

            # Try to switch communication method to SMS (should trigger error)
            comm_select = page.locator('select').first
            if await comm_select.is_visible():
                try:
                    await comm_select.select_option("Send document by SMS")
                    await asyncio.sleep(3)  # Wait for error to occur

                    # Check for specific JavaScript errors
                    phone_errors = [error for error in console_errors
                                  if "phone" in error["text"].lower() or
                                     "undefined" in error["text"].lower()]

                    if phone_errors:
                        result["error_reproduced"] = True
                        result["error_details"] = phone_errors
                        logger.info("   ✅ JavaScript error successfully reproduced")
                    else:
                        logger.info("   ⚠️  JavaScript error not reproduced (might be fixed)")

                except Exception as e:
                    # The exception itself might be the error we're looking for
                    logger.info(f"   ⚠️  Exception during SMS switch (expected): {str(e)}")

            # Test application recovery
            logger.info("   → Testing application recovery after error...")
            try:
                # Try to navigate away and back
                await page.reload()
                await asyncio.sleep(2)
                result["recovery_tested"] = True
            except Exception as e:
                logger.warning(f"   ⚠️  Recovery test failed: {str(e)}")

            # Cleanup
            page.remove_listener("console", handle_console_error)

            # Determine result status
            if result["error_monitoring_active"]:
                if result["error_reproduced"]:
                    result["status"] = "passed"  # Successfully reproduced known bug
                    logger.info("   ✅ Bug reproduction test successful")
                else:
                    result["status"] = "partial"  # Monitoring worked but error not reproduced
                    logger.info("   ⚠️  Bug might be fixed or conditions different")
            else:
                result["status"] = "failed"

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            if "handle_console_error" in locals():
                page.remove_listener("console", handle_console_error)

        return result

    async def _test_others_advanced_features(self, page: Page) -> Dict[str, Any]:
        """Test advanced features of Others workflow."""
        result = {
            "status": "pending",
            "contact_integration_found": False,
            "signing_order_found": False,
            "meaning_of_signature_found": False,
            "parallel_sequential_options_found": False
        }

        try:
            # Look for contact integration features
            logger.info("   → Testing contact integration...")
            contact_selectors = [
                'button:has-text("Add Contact")',
                'button:has-text("Contact")',
                '.contact-selector',
                '.contact-integration'
            ]

            for selector in contact_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    result["contact_integration_found"] = True
                    break

            # Look for signing order controls
            logger.info("   → Testing signing order controls...")
            order_selectors = [
                '.drag-handle',
                '.signing-order',
                'button:has-text("Reorder")',
                '.recipient-order'
            ]

            for selector in order_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    result["signing_order_found"] = True
                    break

            # Look for "Meaning of Signature" feature
            logger.info("   → Testing meaning of signature feature...")
            meaning_selectors = [
                'text="Meaning of Signature"',
                'label:has-text("Meaning")',
                '.signature-meaning',
                'input[placeholder*="meaning"]'
            ]

            for selector in meaning_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    result["meaning_of_signature_found"] = True
                    break

            # Look for parallel/sequential signing options
            logger.info("   → Testing parallel/sequential signing options...")
            mode_selectors = [
                'input[type="radio"][value*="parallel"]',
                'input[type="radio"][value*="sequential"]',
                'button:has-text("Parallel")',
                'button:has-text("Sequential")',
                '.signing-mode'
            ]

            for selector in mode_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    result["parallel_sequential_options_found"] = True
                    break

            # Determine result status
            advanced_features_found = sum([
                result["contact_integration_found"],
                result["signing_order_found"],
                result["meaning_of_signature_found"],
                result["parallel_sequential_options_found"]
            ])

            if advanced_features_found >= 3:
                result["status"] = "passed"
            elif advanced_features_found >= 2:
                result["status"] = "partial"
            else:
                result["status"] = "failed"

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    async def test_live_workflow_features(self, page: Page) -> Dict[str, Any]:
        """
        Test "Live" workflow co-browsing features.

        This tests the real-time collaborative signing workflow.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing test results
        """
        test_results = {
            "test_name": "Live Workflow Features",
            "status": "pending",
            "details": {},
            "errors": []
        }

        try:
            logger.info("🔴 Testing Live workflow co-browsing features...")

            # Navigate to Live workflow
            live_navigation = await self.nav.navigate_to_signing_workflow(page, "live")
            if not live_navigation:
                test_results["status"] = "failed"
                test_results["errors"].append("Failed to navigate to Live workflow")
                return test_results

            # Test co-browsing interface
            logger.info("   → Testing co-browsing interface...")
            cobrowsing_result = {
                "interface_found": False,
                "email_field_working": False,
                "send_link_button_found": False,
                "cobrowsing_description_found": False
            }

            # Look for co-browsing interface elements
            cobrowsing_indicators = [
                'text="co-browsing"',
                'text="Co-browsing"',
                'text="live collaboration"',
                'text="real-time"',
                '.cobrowsing-interface',
                '.live-signing'
            ]

            for indicator in cobrowsing_indicators:
                element = await self.nav.wait_for_element_stable(page, indicator, timeout=3000)
                if element:
                    cobrowsing_result["interface_found"] = True
                    logger.info(f"   ✅ Found co-browsing interface: {indicator}")
                    break

            # Test email field for co-browsing link
            email_field = page.locator('input[placeholder*="Email"], input[type="email"]').first
            if await email_field.is_visible():
                cobrowsing_result["email_field_working"] = True
                await email_field.fill("test.cobrowsing@example.com")

            # Look for send link button
            send_link_selectors = [
                'button:has-text("Send Link")',
                'button:has-text("Send")',
                'button:has-text("Start")',
                '.send-link-btn'
            ]

            for selector in send_link_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    cobrowsing_result["send_link_button_found"] = True
                    break

            # Look for co-browsing description text
            description_texts = [
                "co-browsing link will be sent",
                "real-time collaboration",
                "live signing session"
            ]

            page_content = await page.content()
            for text in description_texts:
                if text.lower() in page_content.lower():
                    cobrowsing_result["cobrowsing_description_found"] = True
                    break

            test_results["details"]["cobrowsing_interface"] = cobrowsing_result

            # Test session management features
            logger.info("   → Testing session management features...")
            session_result = {
                "session_controls_found": False,
                "data_persistence_tested": False,
                "real_time_indicators_found": False
            }

            # Look for session controls
            session_selectors = [
                '.session-controls',
                'button:has-text("Start Session")',
                'button:has-text("End Session")',
                '.live-session-status'
            ]

            for selector in session_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    session_result["session_controls_found"] = True
                    break

            # Test data persistence by switching tabs and returning
            try:
                # Navigate to another workflow tab
                await self.nav.navigate_to_signing_workflow(page, "others")
                await asyncio.sleep(1)

                # Navigate back to Live
                await self.nav.navigate_to_signing_workflow(page, "live")
                await asyncio.sleep(1)

                # Check if email field value persisted
                email_field_after = page.locator('input[placeholder*="Email"], input[type="email"]').first
                if await email_field_after.is_visible():
                    field_value = await email_field_after.input_value()
                    if "test.cobrowsing@example.com" in field_value:
                        session_result["data_persistence_tested"] = True
                        logger.info("   ✅ Data persistence across tab switches verified")

            except Exception as e:
                logger.warning(f"   ⚠️  Data persistence test failed: {str(e)}")

            test_results["details"]["session_management"] = session_result

            # Calculate overall Live workflow test result
            if (cobrowsing_result["interface_found"] and
                (cobrowsing_result["email_field_working"] or cobrowsing_result["send_link_button_found"])):
                test_results["status"] = "passed"
                logger.info("   ✅ Live workflow features test PASSED")
            elif cobrowsing_result["interface_found"]:
                test_results["status"] = "partial"
                logger.info("   ⚠️  Live workflow features test PARTIAL")
            else:
                test_results["status"] = "failed"
                logger.info("   ❌ Live workflow features test FAILED")

        except Exception as e:
            test_results["status"] = "failed"
            test_results["errors"].append(str(e))
            logger.error(f"   ❌ Live workflow features test error: {str(e)}")

        return test_results

    async def test_myself_workflow_features(self, page: Page) -> Dict[str, Any]:
        """
        Test "Myself" workflow self-signing features.

        This tests the server certificate authentication and self-signing workflow.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing test results
        """
        test_results = {
            "test_name": "Myself Workflow Features",
            "status": "pending",
            "details": {},
            "errors": []
        }

        try:
            logger.info("🔑 Testing Myself workflow self-signing features...")

            # Navigate to Myself workflow
            myself_navigation = await self.nav.navigate_to_signing_workflow(page, "myself")
            if not myself_navigation:
                test_results["status"] = "failed"
                test_results["errors"].append("Failed to navigate to Myself workflow")
                return test_results

            # Test certificate authentication interface
            logger.info("   → Testing certificate authentication interface...")
            auth_result = {
                "certificate_field_found": False,
                "password_field_found": False,
                "sign_button_found": False,
                "auth_interface_complete": False
            }

            # Look for certificate ID field
            cert_selectors = [
                'input[placeholder*="Certificate"]',
                'input[placeholder*="ID"]',
                'input[name*="certificate"]',
                '.certificate-input'
            ]

            for selector in cert_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=3000)
                if element:
                    auth_result["certificate_field_found"] = True
                    logger.info(f"   ✅ Found certificate field: {selector}")
                    break

            # Look for password field
            password_selectors = [
                'input[type="password"]',
                'input[placeholder*="Password"]',
                '.password-input'
            ]

            for selector in password_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    auth_result["password_field_found"] = True
                    logger.info(f"   ✅ Found password field: {selector}")
                    break

            # Look for sign button
            sign_selectors = [
                'button:has-text("Sign")',
                'button:has-text("Start Signing")',
                '.sign-button',
                '.self-sign-btn'
            ]

            for selector in sign_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    auth_result["sign_button_found"] = True
                    logger.info(f"   ✅ Found sign button: {selector}")
                    break

            # Check if complete authentication interface is present
            auth_result["auth_interface_complete"] = (
                auth_result["certificate_field_found"] and
                auth_result["password_field_found"] and
                auth_result["sign_button_found"]
            )

            test_results["details"]["authentication_interface"] = auth_result

            # Test self-signing workflow features
            logger.info("   → Testing self-signing workflow features...")
            workflow_result = {
                "document_selection_found": False,
                "edit_document_option_found": False,
                "download_option_found": False,
                "single_user_interface": True
            }

            # Look for document selection interface
            doc_selection_selectors = [
                'input[type="file"]',
                'button:has-text("Upload Document")',
                'button:has-text("Select Document")',
                '.document-selector'
            ]

            for selector in doc_selection_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    workflow_result["document_selection_found"] = True
                    break

            # Look for edit document functionality
            edit_selectors = [
                'button:has-text("Edit Document")',
                'button:has-text("Edit")',
                '.edit-document',
                'checkbox:has-text("Edit")'
            ]

            for selector in edit_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    workflow_result["edit_document_option_found"] = True
                    break

            # Look for download functionality
            download_selectors = [
                'button:has-text("Download")',
                'a:has-text("Download")',
                '.download-btn',
                'text="download"'
            ]

            for selector in download_selectors:
                element = await self.nav.wait_for_element_stable(page, selector, timeout=2000)
                if element:
                    workflow_result["download_option_found"] = True
                    break

            # Verify single-user interface (no recipient fields)
            recipient_indicators = [
                'input[placeholder*="recipient"]',
                'input[placeholder*="email"]',
                'button:has-text("Add Recipient")'
            ]

            for indicator in recipient_indicators:
                element = await self.nav.wait_for_element_stable(page, indicator, timeout=1000)
                if element:
                    workflow_result["single_user_interface"] = False
                    break

            test_results["details"]["workflow_features"] = workflow_result

            # Calculate overall Myself workflow test result
            if (auth_result["auth_interface_complete"] and
                workflow_result["single_user_interface"]):
                test_results["status"] = "passed"
                logger.info("   ✅ Myself workflow features test PASSED")
            elif auth_result["certificate_field_found"] or auth_result["password_field_found"]:
                test_results["status"] = "partial"
                logger.info("   ⚠️  Myself workflow features test PARTIAL")
            else:
                test_results["status"] = "failed"
                logger.info("   ❌ Myself workflow features test FAILED")

        except Exception as e:
            test_results["status"] = "failed"
            test_results["errors"].append(str(e))
            logger.error(f"   ❌ Myself workflow features test error: {str(e)}")

        return test_results

    async def run_comprehensive_signing_workflows_tests(self, page: Page) -> Dict[str, Any]:
        """
        Run comprehensive signing workflows testing suite.

        This executes all signing workflow tests and provides a complete
        assessment of WeSign's core signing functionality.

        Args:
            page: Playwright page instance

        Returns:
            Dict containing comprehensive test results
        """
        comprehensive_results = {
            "test_suite": "Signing Workflows Comprehensive Testing",
            "start_time": time.time(),
            "setup_successful": False,
            "test_results": [],
            "summary": {},
            "overall_status": "pending"
        }

        try:
            logger.info("🧪 Running comprehensive signing workflows test suite...")

            # Setup test session
            setup_success = await self.setup_test_session(page)
            comprehensive_results["setup_successful"] = setup_success

            if not setup_success:
                comprehensive_results["overall_status"] = "failed"
                comprehensive_results["summary"]["error"] = "Test session setup failed"
                return comprehensive_results

            # Execute all signing workflow tests
            test_methods = [
                self.test_signing_workflow_navigation,
                self.test_myself_workflow_features,
                self.test_others_workflow_features,
                self.test_live_workflow_features
            ]

            for test_method in test_methods:
                logger.info(f"   → Running {test_method.__name__}...")
                test_result = await test_method(page)
                comprehensive_results["test_results"].append(test_result)

            # Calculate summary
            total_tests = len(comprehensive_results["test_results"])
            passed_tests = sum(1 for result in comprehensive_results["test_results"]
                             if result["status"] == "passed")
            partial_tests = sum(1 for result in comprehensive_results["test_results"]
                              if result["status"] == "partial")
            failed_tests = sum(1 for result in comprehensive_results["test_results"]
                             if result["status"] == "failed")

            comprehensive_results["summary"] = {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "partial_tests": partial_tests,
                "failed_tests": failed_tests,
                "success_rate": f"{passed_tests}/{total_tests}",
                "completion_time": time.time() - comprehensive_results["start_time"],
                "discovered_workflows": list(self.signing_workflows.keys()),
                "tested_features": [
                    "Workflow navigation and accessibility",
                    "Certificate authentication (Myself)",
                    "Multi-recipient management (Others)",
                    "Email/SMS communication methods",
                    "JavaScript error reproduction",
                    "Co-browsing interface (Live)",
                    "Session management and data persistence"
                ]
            }

            # Determine overall status
            if passed_tests == total_tests:
                comprehensive_results["overall_status"] = "passed"
                logger.info("🎉 Signing workflows comprehensive testing PASSED")
            elif passed_tests + partial_tests >= total_tests * 0.75:  # 75% threshold
                comprehensive_results["overall_status"] = "partial"
                logger.info("⚠️  Signing workflows comprehensive testing PARTIAL")
            else:
                comprehensive_results["overall_status"] = "failed"
                logger.info("❌ Signing workflows comprehensive testing FAILED")

        except Exception as e:
            comprehensive_results["overall_status"] = "failed"
            comprehensive_results["summary"]["error"] = str(e)
            logger.error(f"❌ Comprehensive signing workflows testing error: {str(e)}")

        finally:
            # Cleanup test data
            self.data_manager.cleanup_test_data()

        return comprehensive_results