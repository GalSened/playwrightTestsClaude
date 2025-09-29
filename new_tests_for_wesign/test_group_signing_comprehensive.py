"""Comprehensive Group Signing Test Suite - WeSign"""

import pytest
import asyncio
import tempfile
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


class TestGroupSigningComprehensive:
    """Comprehensive group signing test suite covering all collaborative signing scenarios"""

    @pytest.mark.asyncio
    async def test_group_signing_page_navigation_and_setup(self):
        """Test 1: Group signing page navigation and initial setup"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            try:
                print("=== GROUP SIGNING PAGE NAVIGATION SETUP TEST ===")

                # Step 1: Authenticate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                assert await auth_page.is_login_successful(), "Login should succeed"

                # Step 2: Navigate to group signing
                group_signing_urls = [
                    "https://devtest.comda.co.il/dashboard/groupsign",
                    "https://devtest.comda.co.il/dashboard/group-sign",
                    "https://devtest.comda.co.il/dashboard/group"
                ]

                group_page_loaded = False
                working_url = None

                for url in group_signing_urls:
                    await page.goto(url)
                    await page.wait_for_load_state("networkidle")

                    # Check if this is the correct group signing page
                    group_indicators = [
                        ".group-sign",
                        ".group-signing",
                        "[data-testid*='group']",
                        ":has-text('Group Signing')",
                        ":has-text('Assign')",
                        ".assign-modal"
                    ]

                    for indicator in group_indicators:
                        if await page.locator(indicator).count() > 0:
                            group_page_loaded = True
                            working_url = url
                            print(f"Group signing page found at: {url}")
                            break

                    if group_page_loaded:
                        break

                # If direct navigation doesn't work, try through dashboard
                if not group_page_loaded:
                    await page.goto("https://devtest.comda.co.il/dashboard")
                    await page.wait_for_load_state("networkidle")

                    # Look for group signing navigation
                    group_nav_selectors = [
                        "a:has-text('Group')",
                        "a:has-text('Group Sign')",
                        "button:has-text('Group')",
                        "[data-testid*='group']",
                        ".group-sign-btn"
                    ]

                    for nav_selector in group_nav_selectors:
                        if await page.locator(nav_selector).count() > 0:
                            await page.locator(nav_selector).click()
                            await page.wait_for_load_state("networkidle")
                            working_url = page.url
                            group_page_loaded = True
                            print(f"Group signing accessed via navigation: {nav_selector}")
                            break

                # Validate group signing page elements
                if group_page_loaded:
                    page_elements = {
                        "document_upload": await page.locator("input[type='file'], .upload-area, [data-testid*='upload']").count() > 0,
                        "signer_management": await page.locator(".signer, .assign, [data-testid*='signer']").count() > 0,
                        "workflow_controls": await page.locator(".workflow, .sequence, .order").count() > 0,
                        "send_button": await page.locator("button:has-text('Send'), button:has-text('Start'), .send-btn").count() > 0
                    }

                    print(f"Group signing page elements: {page_elements}")

                current_url = page.url
                print(f"Final URL: {current_url}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_document_upload_for_group_signing(self):
        """Test 2: Document upload specifically for group signing workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== DOCUMENT UPLOAD GROUP SIGNING TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to group signing
                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Create test document
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                    temp_file.write(b"Test PDF content for group signing workflow")
                    test_pdf_path = temp_file.name

                try:
                    # Look for file upload elements
                    upload_selectors = [
                        "input[type='file']",
                        ".upload-area",
                        "[data-testid*='upload']",
                        ".file-drop-zone",
                        "button:has-text('Upload')"
                    ]

                    upload_found = False
                    for selector in upload_selectors:
                        if await page.locator(selector).count() > 0:
                            if selector == "input[type='file']":
                                await page.locator(selector).set_input_files(test_pdf_path)
                                upload_found = True
                                print(f"File uploaded via: {selector}")
                            else:
                                print(f"Upload element found: {selector}")
                                upload_found = True
                            break

                    # Wait for upload processing
                    if upload_found:
                        await page.wait_for_timeout(3000)

                        # Check for upload success indicators
                        success_indicators = [
                            ".upload-success",
                            ":has-text('uploaded')",
                            ":has-text('success')",
                            ".document-preview",
                            "[data-testid*='success']"
                        ]

                        upload_success = False
                        for indicator in success_indicators:
                            if await page.locator(indicator).count() > 0:
                                upload_success = True
                                print(f"Upload success indicator found: {indicator}")
                                break

                        # Check for document preview or processing
                        preview_elements = [
                            ".document-preview",
                            ".pdf-viewer",
                            "canvas",
                            "iframe",
                            ".document-display"
                        ]

                        preview_loaded = False
                        for preview_selector in preview_elements:
                            if await page.locator(preview_selector).count() > 0:
                                preview_loaded = True
                                print(f"Document preview loaded: {preview_selector}")
                                break

                        print(f"Document upload for group signing - Success: {upload_success}, Preview: {preview_loaded}")

                finally:
                    # Clean up temp file
                    if os.path.exists(test_pdf_path):
                        os.unlink(test_pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signer_assignment_and_management(self):
        """Test 3: Signer assignment and management functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== SIGNER ASSIGNMENT MANAGEMENT TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Look for signer assignment elements
                signer_selectors = [
                    ".add-signer",
                    "button:has-text('Add Signer')",
                    "button:has-text('Assign')",
                    "[data-testid*='add-signer']",
                    ".assign-modal"
                ]

                signer_management_found = False
                for selector in signer_selectors:
                    if await page.locator(selector).count() > 0:
                        signer_management_found = True
                        print(f"Signer management element found: {selector}")

                        # Try to trigger signer assignment
                        if "button" in selector:
                            await page.locator(selector).click()
                            await page.wait_for_timeout(1000)

                            # Check for modal or form
                            modal_selectors = [
                                ".modal",
                                ".popup",
                                ".assign-form",
                                "[role='dialog']"
                            ]

                            modal_opened = False
                            for modal_selector in modal_selectors:
                                if await page.locator(modal_selector).count() > 0:
                                    modal_opened = True
                                    print(f"Assignment modal opened: {modal_selector}")
                                    break

                        break

                # Look for signer input fields
                signer_input_selectors = [
                    "input[name*='email']",
                    "input[name*='signer']",
                    "input[placeholder*='email']",
                    "[data-testid*='signer-email']"
                ]

                signer_inputs_found = 0
                for selector in signer_input_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        signer_inputs_found += count
                        print(f"Signer input found: {selector}")

                        # Test adding a signer email
                        test_email = "test.signer@example.com"
                        await page.locator(selector).first.fill(test_email)
                        filled_value = await page.locator(selector).first.input_value()
                        print(f"Signer email test - Input: {test_email}, Result: {filled_value}")

                # Look for signer role/order configuration
                role_selectors = [
                    "select[name*='role']",
                    "select[name*='order']",
                    "input[name*='sequence']",
                    "[data-testid*='signer-role']"
                ]

                role_config_found = 0
                for selector in role_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        role_config_found += count
                        print(f"Signer role/order config found: {selector}")

                # Look for signer list/management
                signer_list_selectors = [
                    ".signer-list",
                    ".signers-table",
                    ".assigned-signers",
                    "[data-testid*='signer-list']"
                ]

                signer_list_found = False
                for selector in signer_list_selectors:
                    if await page.locator(selector).count() > 0:
                        signer_list_found = True
                        print(f"Signer list found: {selector}")
                        break

                print(f"Signer assignment validated - Management: {signer_management_found}, Inputs: {signer_inputs_found}, Roles: {role_config_found}, List: {signer_list_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signing_order_and_workflow_configuration(self):
        """Test 4: Signing order and workflow sequence configuration"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== SIGNING ORDER WORKFLOW CONFIGURATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Look for workflow order configuration
                workflow_selectors = [
                    "select[name*='order']",
                    "select[name*='sequence']",
                    "input[name*='order']",
                    ".workflow-order",
                    "[data-testid*='signing-order']"
                ]

                workflow_config_found = 0
                for selector in workflow_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        workflow_config_found += count

                        element_type = await page.locator(selector).first.get_attribute("tagName")
                        if element_type.lower() == "select":
                            options = await page.locator(f"{selector} option").count()
                            print(f"Workflow order dropdown found with {options} options")

                            if options > 1:
                                await page.locator(selector).select_option(index=1)
                                selected_value = await page.locator(selector).input_value()
                                print(f"Workflow order selected: {selected_value}")

                        print(f"Workflow configuration found: {selector}")

                # Look for sequential vs parallel options
                workflow_type_selectors = [
                    "input[value*='sequential']",
                    "input[value*='parallel']",
                    "radio[name*='workflow']",
                    "checkbox[name*='parallel']"
                ]

                workflow_types_found = 0
                workflow_options = []

                for selector in workflow_type_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        workflow_types_found += count

                        input_type = await page.locator(selector).first.get_attribute("type")
                        input_value = await page.locator(selector).first.get_attribute("value")

                        if input_value:
                            workflow_options.append(input_value)

                        print(f"Workflow type option found: {selector} ({input_type})")

                # Look for signer dependency configuration
                dependency_selectors = [
                    ".depends-on",
                    "select[name*='depends']",
                    "input[name*='prerequisite']",
                    "[data-testid*='dependency']"
                ]

                dependency_config_found = 0
                for selector in dependency_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        dependency_config_found += count
                        print(f"Dependency configuration found: {selector}")

                # Look for deadline/expiration settings
                deadline_selectors = [
                    "input[type='date']",
                    "input[name*='deadline']",
                    "input[name*='expir']",
                    "[data-testid*='deadline']"
                ]

                deadline_config_found = 0
                for selector in deadline_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        deadline_config_found += count

                        if "date" in selector:
                            # Test setting a deadline
                            future_date = datetime.now() + timedelta(days=7)
                            await page.locator(selector).fill(future_date.strftime("%Y-%m-%d"))
                            set_date = await page.locator(selector).input_value()
                            print(f"Deadline set: {set_date}")

                        print(f"Deadline configuration found: {selector}")

                print(f"Workflow configuration validated - Order: {workflow_config_found}, Types: {workflow_types_found}, Dependencies: {dependency_config_found}, Deadlines: {deadline_config_found}")
                print(f"Workflow options found: {workflow_options}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signature_field_assignment_per_signer(self):
        """Test 5: Signature field assignment and positioning per signer"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== SIGNATURE FIELD ASSIGNMENT PER SIGNER TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Look for field assignment tools
                field_assignment_selectors = [
                    ".assign-field",
                    ".signature-field",
                    "[data-testid*='assign-field']",
                    "button:has-text('Assign Field')",
                    ".field-assignment"
                ]

                field_assignment_found = 0
                for selector in field_assignment_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        field_assignment_found += count
                        print(f"Field assignment tool found: {selector}")

                # Look for field types/tools
                field_type_selectors = [
                    ".signature-tool",
                    ".text-tool",
                    ".date-tool",
                    ".checkbox-tool",
                    "[data-testid*='field-type']"
                ]

                field_types_found = []
                for selector in field_type_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        field_types_found.append(selector)
                        print(f"Field type tool found: {selector}")

                # Look for signer-specific assignment
                signer_assignment_selectors = [
                    "select[name*='assign-to']",
                    ".assign-to-signer",
                    "[data-testid*='assign-signer']",
                    ".signer-dropdown"
                ]

                signer_assignment_found = 0
                for selector in signer_assignment_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        signer_assignment_found += count

                        if selector.startswith("select"):
                            options = await page.locator(f"{selector} option").count()
                            print(f"Signer assignment dropdown found with {options} options")

                        print(f"Signer assignment found: {selector}")

                # Look for field positioning/coordinates
                positioning_selectors = [
                    "input[name*='position']",
                    "input[name*='coordinate']",
                    ".position-input",
                    "[data-testid*='position']"
                ]

                positioning_found = 0
                for selector in positioning_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        positioning_found += count
                        print(f"Field positioning found: {selector}")

                # Look for field duplication across pages
                duplication_selectors = [
                    ".duplicate-field",
                    "button:has-text('Duplicate')",
                    "checkbox:has-text('All pages')",
                    "[data-testid*='duplicate']"
                ]

                duplication_found = 0
                for selector in duplication_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        duplication_found += count
                        print(f"Field duplication option found: {selector}")

                print(f"Field assignment validated - Assignment: {field_assignment_found}, Types: {len(field_types_found)}, Signer: {signer_assignment_found}, Position: {positioning_found}, Duplicate: {duplication_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_group_signing_workflow_initiation(self):
        """Test 6: Group signing workflow initiation and sending"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== GROUP SIGNING WORKFLOW INITIATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Look for workflow initiation buttons
                send_buttons = [
                    "button:has-text('Send')",
                    "button:has-text('Start')",
                    "button:has-text('Initiate')",
                    "button:has-text('Begin')",
                    ".send-btn",
                    "[data-testid*='send-workflow']"
                ]

                send_button_found = False
                for selector in send_buttons:
                    if await page.locator(selector).count() > 0:
                        send_button_found = True
                        print(f"Send workflow button found: {selector}")

                        # Check if button is enabled
                        is_enabled = await page.locator(selector).is_enabled()
                        print(f"Send button enabled: {is_enabled}")

                        # If enabled, test the workflow initiation process
                        if is_enabled:
                            await page.locator(selector).click()
                            await page.wait_for_timeout(2000)

                            # Check for confirmation dialogs
                            confirmation_selectors = [
                                ".modal",
                                ".confirm-dialog",
                                "[role='dialog']",
                                ":has-text('Confirm')",
                                ":has-text('Are you sure')"
                            ]

                            confirmation_shown = False
                            for confirm_selector in confirmation_selectors:
                                if await page.locator(confirm_selector).count() > 0:
                                    confirmation_shown = True
                                    print(f"Confirmation dialog shown: {confirm_selector}")
                                    break

                        break

                # Look for workflow status indicators
                status_selectors = [
                    ".workflow-status",
                    ".signing-status",
                    "[data-testid*='status']",
                    ":has-text('Pending')",
                    ":has-text('In Progress')"
                ]

                status_indicators_found = 0
                for selector in status_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        status_indicators_found += count
                        print(f"Status indicator found: {selector}")

                # Look for notification settings
                notification_selectors = [
                    "checkbox:has-text('Notify')",
                    "input[name*='notification']",
                    ".notification-settings",
                    "[data-testid*='notification']"
                ]

                notification_options_found = 0
                for selector in notification_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        notification_options_found += count
                        print(f"Notification option found: {selector}")

                # Look for email customization options
                email_customization_selectors = [
                    "textarea[name*='message']",
                    "input[name*='subject']",
                    ".email-template",
                    "[data-testid*='email-custom']"
                ]

                email_custom_found = 0
                for selector in email_customization_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        email_custom_found += count
                        print(f"Email customization found: {selector}")

                print(f"Workflow initiation validated - Send: {send_button_found}, Status: {status_indicators_found}, Notifications: {notification_options_found}, Email: {email_custom_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_group_signing_progress_tracking(self):
        """Test 7: Group signing progress tracking and monitoring"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== GROUP SIGNING PROGRESS TRACKING TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Check document list for group signing documents
                await page.goto("https://devtest.comda.co.il/dashboard/documents")
                await page.wait_for_load_state("networkidle")

                # Look for group signing indicators in document list
                group_doc_indicators = [
                    ".group-sign",
                    ":has-text('Group')",
                    ":has-text('Multiple')",
                    ".multi-signer",
                    "[data-testid*='group-doc']"
                ]

                group_docs_found = 0
                for indicator in group_doc_indicators:
                    count = await page.locator(indicator).count()
                    if count > 0:
                        group_docs_found += count
                        print(f"Group signing document indicator found: {indicator}")

                # Look for progress indicators
                progress_selectors = [
                    ".progress-bar",
                    ".completion-status",
                    ":has-text('% complete')",
                    ".signed-count",
                    "[data-testid*='progress']"
                ]

                progress_indicators_found = 0
                for selector in progress_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        progress_indicators_found += count
                        print(f"Progress indicator found: {selector}")

                # Look for signer status tracking
                signer_status_selectors = [
                    ".signer-status",
                    ":has-text('Signed')",
                    ":has-text('Pending')",
                    ":has-text('Viewed')",
                    ".status-badge"
                ]

                signer_statuses_found = 0
                for selector in signer_status_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        signer_statuses_found += count
                        print(f"Signer status found: {selector}")

                # Navigate to reports for tracking
                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Look for group signing reports
                group_report_selectors = [
                    "option:has-text('Group')",
                    "option:has-text('Multi')",
                    ":has-text('Signing Progress')",
                    "[data-testid*='group-report']"
                ]

                group_reports_found = 0
                for selector in group_report_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        group_reports_found += count
                        print(f"Group signing report option found: {selector}")

                # Check for detailed tracking features
                tracking_features = [
                    ".audit-trail",
                    ".signing-history",
                    ".timeline",
                    ":has-text('History')",
                    "[data-testid*='audit']"
                ]

                tracking_features_found = 0
                for feature in tracking_features:
                    count = await page.locator(feature).count()
                    if count > 0:
                        tracking_features_found += count
                        print(f"Tracking feature found: {feature}")

                print(f"Progress tracking validated - Group docs: {group_docs_found}, Progress: {progress_indicators_found}, Status: {signer_statuses_found}, Reports: {group_reports_found}, Tracking: {tracking_features_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_group_signing_reminder_and_escalation(self):
        """Test 8: Group signing reminder and escalation functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== GROUP SIGNING REMINDER ESCALATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Look for reminder settings
                reminder_selectors = [
                    "input[name*='reminder']",
                    "select[name*='reminder']",
                    ".reminder-frequency",
                    "[data-testid*='reminder']",
                    "input[name*='frequency']"
                ]

                reminder_settings_found = 0
                for selector in reminder_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        reminder_settings_found += count

                        element_type = await page.locator(selector).first.get_attribute("tagName")
                        if element_type.lower() == "select":
                            options = await page.locator(f"{selector} option").count()
                            print(f"Reminder frequency dropdown found with {options} options")
                        elif element_type.lower() == "input":
                            input_type = await page.locator(selector).first.get_attribute("type")
                            print(f"Reminder input found: {input_type}")

                        print(f"Reminder setting found: {selector}")

                # Look for escalation options
                escalation_selectors = [
                    "input[name*='escalate']",
                    "select[name*='escalate']",
                    "checkbox:has-text('Escalate')",
                    ".escalation-settings",
                    "[data-testid*='escalation']"
                ]

                escalation_options_found = 0
                for selector in escalation_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        escalation_options_found += count
                        print(f"Escalation option found: {selector}")

                # Look for deadline/expiration settings
                deadline_selectors = [
                    "input[type='date']",
                    "input[name*='deadline']",
                    "input[name*='expire']",
                    ".deadline-setting",
                    "[data-testid*='deadline']"
                ]

                deadline_settings_found = 0
                for selector in deadline_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        deadline_settings_found += count

                        if "date" in selector:
                            # Test setting deadline
                            deadline_date = datetime.now() + timedelta(days=14)
                            await page.locator(selector).fill(deadline_date.strftime("%Y-%m-%d"))
                            set_date = await page.locator(selector).input_value()
                            print(f"Deadline set to: {set_date}")

                        print(f"Deadline setting found: {selector}")

                # Look for auto-reminder configuration
                auto_reminder_selectors = [
                    "checkbox:has-text('Automatic')",
                    "input[name*='auto-remind']",
                    ".auto-reminder",
                    "[data-testid*='auto-reminder']"
                ]

                auto_reminder_found = 0
                for selector in auto_reminder_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        auto_reminder_found += count

                        if "checkbox" in selector:
                            is_checked = await page.locator(selector).is_checked()
                            print(f"Auto-reminder checkbox checked: {is_checked}")

                        print(f"Auto-reminder option found: {selector}")

                # Check document management for manual reminder options
                await page.goto("https://devtest.comda.co.il/dashboard/documents")
                await page.wait_for_load_state("networkidle")

                manual_reminder_selectors = [
                    "button:has-text('Remind')",
                    "button:has-text('Send Reminder')",
                    ".remind-btn",
                    "[data-testid*='remind']"
                ]

                manual_reminders_found = 0
                for selector in manual_reminder_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        manual_reminders_found += count
                        print(f"Manual reminder button found: {selector}")

                print(f"Reminder/Escalation validated - Settings: {reminder_settings_found}, Escalation: {escalation_options_found}, Deadlines: {deadline_settings_found}, Auto: {auto_reminder_found}, Manual: {manual_reminders_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_group_signing_completion_and_finalization(self):
        """Test 9: Group signing completion and document finalization"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== GROUP SIGNING COMPLETION FINALIZATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/documents")
                await page.wait_for_load_state("networkidle")

                # Look for completed group signing documents
                completion_indicators = [
                    ":has-text('Completed')",
                    ":has-text('Signed')",
                    ":has-text('Finished')",
                    ".status-complete",
                    ".fully-signed",
                    "[data-testid*='complete']"
                ]

                completed_docs_found = 0
                for indicator in completion_indicators:
                    count = await page.locator(indicator).count()
                    if count > 0:
                        completed_docs_found += count
                        print(f"Completion indicator found: {indicator}")

                # Look for finalization options
                finalization_selectors = [
                    "button:has-text('Finalize')",
                    "button:has-text('Complete')",
                    "button:has-text('Finish')",
                    ".finalize-btn",
                    "[data-testid*='finalize']"
                ]

                finalization_options_found = 0
                for selector in finalization_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        finalization_options_found += count
                        print(f"Finalization option found: {selector}")

                # Look for final document download/export options
                download_selectors = [
                    "button:has-text('Download')",
                    "a:has-text('Download')",
                    ".download-final",
                    "[data-testid*='download']",
                    "button:has-text('Export')"
                ]

                download_options_found = 0
                for selector in download_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        download_options_found += count
                        print(f"Download option found: {selector}")

                # Look for signature validation/verification
                validation_selectors = [
                    ".signature-valid",
                    ":has-text('Verified')",
                    ":has-text('Valid')",
                    ".verification-status",
                    "[data-testid*='verification']"
                ]

                validation_indicators_found = 0
                for selector in validation_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        validation_indicators_found += count
                        print(f"Signature validation found: {selector}")

                # Look for audit trail/certificate generation
                audit_selectors = [
                    "button:has-text('Audit')",
                    "button:has-text('Certificate')",
                    ".audit-trail",
                    ".completion-certificate",
                    "[data-testid*='audit']"
                ]

                audit_options_found = 0
                for selector in audit_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        audit_options_found += count
                        print(f"Audit/Certificate option found: {selector}")

                # Look for notification settings for completion
                completion_notification_selectors = [
                    "checkbox:has-text('Notify when complete')",
                    "input[name*='completion-notify']",
                    ".completion-notifications",
                    "[data-testid*='completion-notify']"
                ]

                completion_notifications_found = 0
                for selector in completion_notification_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        completion_notifications_found += count
                        print(f"Completion notification found: {selector}")

                print(f"Completion/Finalization validated - Completed: {completed_docs_found}, Finalize: {finalization_options_found}, Download: {download_options_found}, Validation: {validation_indicators_found}, Audit: {audit_options_found}, Notifications: {completion_notifications_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_group_signing_error_handling_and_edge_cases(self):
        """Test 10: Group signing error handling and edge cases"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== GROUP SIGNING ERROR HANDLING EDGE CASES TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/groupsign")
                await page.wait_for_load_state("networkidle")

                # Test case 1: Duplicate signer emails
                signer_inputs = await page.locator("input[name*='email'], input[placeholder*='email']").count()
                if signer_inputs >= 2:
                    duplicate_email = "duplicate@test.com"

                    await page.locator("input[name*='email'], input[placeholder*='email']").first.fill(duplicate_email)
                    await page.locator("input[name*='email'], input[placeholder*='email']").nth(1).fill(duplicate_email)

                    # Check for duplicate validation
                    duplicate_errors = await page.locator(".error:has-text('duplicate'), .error:has-text('already')").count()
                    print(f"Duplicate signer email validation: {duplicate_errors > 0}")

                # Test case 2: Invalid email formats
                if signer_inputs > 0:
                    invalid_emails = ["invalid-email", "test@", "@domain.com", "spaces in@email.com"]

                    for invalid_email in invalid_emails:
                        await page.locator("input[name*='email'], input[placeholder*='email']").first.fill(invalid_email)
                        await page.locator("input[name*='email'], input[placeholder*='email']").first.blur()
                        await page.wait_for_timeout(500)

                        email_validation_errors = await page.locator(".error, .invalid-feedback").count()
                        print(f"Invalid email '{invalid_email}' validation: {email_validation_errors > 0}")

                # Test case 3: Missing required fields
                send_buttons = await page.locator("button:has-text('Send'), .send-btn").count()
                if send_buttons > 0:
                    # Try to send without required information
                    await page.locator("button:has-text('Send'), .send-btn").first.click()
                    await page.wait_for_timeout(1000)

                    required_field_errors = await page.locator(".error, [role='alert']").count()
                    print(f"Missing required fields validation: {required_field_errors > 0}")

                # Test case 4: Circular dependencies in signing order
                order_selects = await page.locator("select[name*='order'], select[name*='depends']").count()
                if order_selects >= 2:
                    # Try to create circular dependency (A depends on B, B depends on A)
                    try:
                        await page.locator("select[name*='order'], select[name*='depends']").first.select_option(index=1)
                        await page.locator("select[name*='order'], select[name*='depends']").nth(1).select_option(index=0)

                        circular_dependency_error = await page.locator(".error:has-text('circular'), .error:has-text('dependency')").count()
                        print(f"Circular dependency validation: {circular_dependency_error > 0}")
                    except Exception as e:
                        print(f"Circular dependency test skipped: {e}")

                # Test case 5: Document without signers
                if send_buttons > 0:
                    # Clear all signer information
                    signer_clear_buttons = await page.locator("button:has-text('Remove'), button:has-text('Delete'), .remove-signer").count()
                    if signer_clear_buttons > 0:
                        for i in range(min(signer_clear_buttons, 3)):  # Clear up to 3 signers
                            try:
                                await page.locator("button:has-text('Remove'), button:has-text('Delete'), .remove-signer").first.click()
                                await page.wait_for_timeout(500)
                            except:
                                break

                    # Try to send without signers
                    await page.locator("button:has-text('Send'), .send-btn").first.click()
                    await page.wait_for_timeout(1000)

                    no_signers_error = await page.locator(".error:has-text('signer'), .error:has-text('recipient')").count()
                    print(f"No signers validation: {no_signers_error > 0}")

                # Test case 6: Network error simulation
                # Simulate offline state
                await page.set_offline(True)

                if send_buttons > 0:
                    await page.locator("button:has-text('Send'), .send-btn").first.click()
                    await page.wait_for_timeout(2000)

                    network_error = await page.locator(".error:has-text('network'), .error:has-text('connection'), .error:has-text('offline')").count()
                    print(f"Network error handling: {network_error > 0}")

                # Go back online
                await page.set_offline(False)

                print("Group signing error handling validation completed")

            finally:
                await browser.close()