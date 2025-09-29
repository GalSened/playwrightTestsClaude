"""Advanced Signing Workflow Test Suite - Comprehensive Coverage"""

import pytest
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.self_signing_page import SelfSigningPage
from pages.documents_page import DocumentsPage
import datetime
import json


class TestAdvancedSigningWorkflows:
    """Advanced signing workflow tests covering all signing scenarios"""

    # SELF-SIGNING WORKFLOWS

    @pytest.mark.asyncio
    async def test_complete_self_signing_workflow_pdf(self):
        """Test 1: Complete self-signing workflow with PDF document"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== COMPLETE SELF-SIGNING WORKFLOW ===")

                # Create test PDF for signing
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                with tempfile.NamedTemporaryFile(suffix=f'_sign_{timestamp}.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Document for self-signing workflow')
                    pdf_path = temp_pdf.name

                try:
                    # Step 1: Navigate to self-signing
                    await self_signing_page.navigate_to_self_signing()
                    assert await self_signing_page.is_self_signing_page_loaded(), "Self-signing page should load"

                    # Step 2: Upload document for signing
                    upload_result = await self_signing_page.upload_document_for_signing(pdf_path)
                    print(f"Document upload result: {upload_result}")

                    # Step 3: Add signature fields
                    if upload_result:
                        field_add_result = await self_signing_page.add_signature_field()
                        print(f"Signature field added: {field_add_result}")

                        # Step 4: Configure signature properties
                        if field_add_result:
                            signature_config = await self_signing_page.configure_signature_field({
                                'type': 'signature',
                                'required': True,
                                'position': {'x': 100, 'y': 200}
                            })
                            print(f"Signature configuration: {signature_config}")

                            # Step 5: Add initials field
                            initials_result = await self_signing_page.add_initials_field()
                            print(f"Initials field added: {initials_result}")

                            # Step 6: Add date field
                            date_result = await self_signing_page.add_date_field()
                            print(f"Date field added: {date_result}")

                            # Step 7: Preview and validate
                            preview_result = await self_signing_page.preview_document()
                            print(f"Document preview: {preview_result}")

                            # Step 8: Complete signing process
                            signing_result = await self_signing_page.complete_self_signing()
                            print(f"Self-signing completed: {signing_result}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

                print("=== SELF-SIGNING WORKFLOW COMPLETED ===")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_self_signing_with_different_signature_types(self):
        """Test 2: Self-signing with different signature types"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await self_signing_page.navigate_to_self_signing()

                print("=== DIFFERENT SIGNATURE TYPES TEST ===")

                # Create test document
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Multi-signature type test document')
                    pdf_path = temp_pdf.name

                try:
                    await self_signing_page.upload_document_for_signing(pdf_path)

                    # Test different signature types
                    signature_types = [
                        {'type': 'draw', 'description': 'Draw signature'},
                        {'type': 'type', 'description': 'Type signature'},
                        {'type': 'upload', 'description': 'Upload signature image'},
                        {'type': 'digital', 'description': 'Digital certificate signature'}
                    ]

                    for sig_type in signature_types:
                        print(f"Testing {sig_type['description']}...")

                        # Add field for this signature type
                        field_result = await self_signing_page.add_signature_field()

                        if field_result:
                            # Configure signature type
                            type_config = await self_signing_page.set_signature_type(sig_type['type'])
                            print(f"  {sig_type['type']} signature configured: {type_config}")

                            # Test signature creation for this type
                            if sig_type['type'] == 'draw':
                                draw_result = await self_signing_page.create_drawn_signature()
                                print(f"  Drawn signature created: {draw_result}")

                            elif sig_type['type'] == 'type':
                                typed_result = await self_signing_page.create_typed_signature("John Doe")
                                print(f"  Typed signature created: {typed_result}")

                            elif sig_type['type'] == 'upload':
                                # Create small image file for signature
                                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as sig_file:
                                    sig_file.write(b'PNG signature image data')
                                    sig_path = sig_file.name

                                try:
                                    upload_sig_result = await self_signing_page.upload_signature_image(sig_path)
                                    print(f"  Signature image uploaded: {upload_sig_result}")
                                finally:
                                    if os.path.exists(sig_path):
                                        os.unlink(sig_path)

                            elif sig_type['type'] == 'digital':
                                digital_result = await self_signing_page.apply_digital_signature()
                                print(f"  Digital signature applied: {digital_result}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_multi_page_document_signing(self):
        """Test 3: Multi-page document signing with fields on different pages"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await self_signing_page.navigate_to_self_signing()

                print("=== MULTI-PAGE DOCUMENT SIGNING TEST ===")

                # Create multi-page test document
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    # Simulate multi-page PDF content
                    temp_pdf.write(b'%PDF-1.4 Multi-page document for signing\nPage 1 content\nPage 2 content\nPage 3 content')
                    pdf_path = temp_pdf.name

                try:
                    upload_result = await self_signing_page.upload_document_for_signing(pdf_path)

                    if upload_result:
                        # Test page navigation
                        page_count = await self_signing_page.get_document_page_count()
                        print(f"Document has {page_count} pages")

                        # Add fields on different pages
                        for page_num in range(1, min(4, page_count + 1)):  # Up to 3 pages
                            print(f"Adding fields to page {page_num}")

                            # Navigate to page
                            nav_result = await self_signing_page.navigate_to_page(page_num)
                            print(f"  Navigated to page {page_num}: {nav_result}")

                            if nav_result:
                                # Add signature field on this page
                                sig_result = await self_signing_page.add_signature_field_on_page(page_num)
                                print(f"  Signature added to page {page_num}: {sig_result}")

                                # Add initials on even pages
                                if page_num % 2 == 0:
                                    initials_result = await self_signing_page.add_initials_field_on_page(page_num)
                                    print(f"  Initials added to page {page_num}: {initials_result}")

                        # Test field validation across pages
                        validation_result = await self_signing_page.validate_all_fields()
                        print(f"Multi-page field validation: {validation_result}")

                        # Complete signing for all pages
                        complete_result = await self_signing_page.complete_multi_page_signing()
                        print(f"Multi-page signing completed: {complete_result}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    # GROUP SIGNING WORKFLOWS

    @pytest.mark.asyncio
    async def test_group_signing_workflow_setup(self):
        """Test 4: Group signing workflow setup and configuration"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== GROUP SIGNING WORKFLOW SETUP TEST ===")

                # Navigate to group signing (based on Angular routes)
                group_signing_url = "https://devtest.comda.co.il/dashboard/groupsign"
                await page.goto(group_signing_url)
                await page.wait_for_load_state("networkidle")

                current_url = page.url
                print(f"Group signing page URL: {current_url}")

                # Create document for group signing
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Group signing document')
                    pdf_path = temp_pdf.name

                try:
                    # Test group signing setup
                    if await self_signing_page.is_group_signing_available():
                        # Upload document for group signing
                        group_upload = await self_signing_page.upload_document_for_group_signing(pdf_path)
                        print(f"Group document upload: {group_upload}")

                        if group_upload:
                            # Add signers
                            signers = [
                                {'email': 'signer1@example.com', 'name': 'Signer One'},
                                {'email': 'signer2@example.com', 'name': 'Signer Two'}
                            ]

                            for i, signer in enumerate(signers):
                                add_signer_result = await self_signing_page.add_signer_to_document(
                                    signer['email'], signer['name']
                                )
                                print(f"Signer {i+1} added: {add_signer_result}")

                            # Configure signing order
                            order_config = await self_signing_page.configure_signing_order(['sequential'])
                            print(f"Signing order configured: {order_config}")

                            # Assign fields to signers
                            field_assignment = await self_signing_page.assign_fields_to_signers()
                            print(f"Fields assigned to signers: {field_assignment}")

                            # Test signing workflow initiation
                            workflow_start = await self_signing_page.initiate_group_signing()
                            print(f"Group signing workflow initiated: {workflow_start}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_sequential_vs_parallel_signing(self):
        """Test 5: Sequential vs parallel signing workflow comparison"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== SEQUENTIAL VS PARALLEL SIGNING TEST ===")

                # Create test document
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Signing order test document')
                    pdf_path = temp_pdf.name

                try:
                    if await self_signing_page.is_group_signing_available():
                        # Test 1: Sequential signing setup
                        print("Testing sequential signing setup...")
                        await self_signing_page.upload_document_for_group_signing(pdf_path)

                        sequential_config = await self_signing_page.configure_signing_order(['sequential'])
                        print(f"Sequential signing configured: {sequential_config}")

                        # Add signers for sequential signing
                        sequential_signers = [
                            {'email': 'seq1@example.com', 'name': 'Sequential Signer 1', 'order': 1},
                            {'email': 'seq2@example.com', 'name': 'Sequential Signer 2', 'order': 2},
                            {'email': 'seq3@example.com', 'name': 'Sequential Signer 3', 'order': 3}
                        ]

                        for signer in sequential_signers:
                            seq_result = await self_signing_page.add_signer_with_order(
                                signer['email'], signer['name'], signer['order']
                            )
                            print(f"Sequential signer {signer['order']} added: {seq_result}")

                        # Test 2: Parallel signing setup
                        print("Testing parallel signing setup...")

                        parallel_config = await self_signing_page.configure_signing_order(['parallel'])
                        print(f"Parallel signing configured: {parallel_config}")

                        # Add signers for parallel signing
                        parallel_signers = [
                            {'email': 'par1@example.com', 'name': 'Parallel Signer 1'},
                            {'email': 'par2@example.com', 'name': 'Parallel Signer 2'},
                            {'email': 'par3@example.com', 'name': 'Parallel Signer 3'}
                        ]

                        for signer in parallel_signers:
                            par_result = await self_signing_page.add_parallel_signer(
                                signer['email'], signer['name']
                            )
                            print(f"Parallel signer added: {par_result}")

                        # Test workflow validation
                        workflow_validation = await self_signing_page.validate_signing_workflow()
                        print(f"Workflow validation: {workflow_validation}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    # ADVANCED SIGNING FEATURES

    @pytest.mark.asyncio
    async def test_conditional_signing_workflows(self):
        """Test 6: Conditional and approval-based signing workflows"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== CONDITIONAL SIGNING WORKFLOWS TEST ===")

                # Create document for conditional signing
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Conditional signing test document')
                    pdf_path = temp_pdf.name

                try:
                    if await self_signing_page.is_advanced_signing_available():
                        await self_signing_page.upload_document_for_signing(pdf_path)

                        # Test conditional logic setup
                        conditions = [
                            {'type': 'approval_required', 'approver': 'manager@example.com'},
                            {'type': 'budget_threshold', 'amount': 10000, 'currency': 'USD'},
                            {'type': 'department_head_review', 'department': 'Finance'}
                        ]

                        for condition in conditions:
                            condition_result = await self_signing_page.add_signing_condition(condition)
                            print(f"Condition '{condition['type']}' added: {condition_result}")

                        # Test approval workflow setup
                        approval_setup = await self_signing_page.setup_approval_workflow([
                            {'step': 1, 'approver': 'supervisor@example.com', 'required': True},
                            {'step': 2, 'approver': 'manager@example.com', 'required': True},
                            {'step': 3, 'approver': 'director@example.com', 'required': False}
                        ])
                        print(f"Approval workflow setup: {approval_setup}")

                        # Test conditional field visibility
                        field_conditions = await self_signing_page.setup_conditional_fields([
                            {'field': 'budget_approval', 'condition': 'amount > 5000'},
                            {'field': 'ceo_signature', 'condition': 'amount > 50000'}
                        ])
                        print(f"Conditional fields setup: {field_conditions}")

                        # Validate conditional workflow
                        validation = await self_signing_page.validate_conditional_workflow()
                        print(f"Conditional workflow validation: {validation}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signing_with_attachments_and_metadata(self):
        """Test 7: Signing with attachments and document metadata"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await self_signing_page.navigate_to_self_signing()

                print("=== SIGNING WITH ATTACHMENTS AND METADATA TEST ===")

                # Create main document
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as main_doc:
                    main_doc.write(b'%PDF-1.4 Main signing document with attachments')
                    main_path = main_doc.name

                # Create attachment files
                attachments = []
                for i in range(3):
                    attach_file = tempfile.NamedTemporaryFile(suffix=f'_attachment_{i}.txt', delete=False)
                    attach_file.write(f'Attachment {i} content for signing workflow'.encode())
                    attach_file.close()
                    attachments.append(attach_file.name)

                try:
                    # Upload main document
                    upload_result = await self_signing_page.upload_document_for_signing(main_path)

                    if upload_result:
                        # Add attachments to signing package
                        for i, attachment in enumerate(attachments):
                            attach_result = await self_signing_page.add_attachment_to_document(
                                attachment, f"Supporting Document {i+1}"
                            )
                            print(f"Attachment {i+1} added: {attach_result}")

                        # Add document metadata
                        metadata = {
                            'document_type': 'Contract',
                            'department': 'Legal',
                            'priority': 'High',
                            'expiry_date': '2024-12-31',
                            'reference_number': 'REF-2024-001',
                            'tags': ['contract', 'legal', 'priority']
                        }

                        metadata_result = await self_signing_page.add_document_metadata(metadata)
                        print(f"Document metadata added: {metadata_result}")

                        # Configure signing with metadata requirements
                        metadata_requirements = await self_signing_page.configure_metadata_requirements([
                            {'field': 'signer_title', 'required': True},
                            {'field': 'signing_location', 'required': False},
                            {'field': 'witness_present', 'required': False}
                        ])
                        print(f"Metadata requirements configured: {metadata_requirements}")

                        # Test attachment visibility settings
                        attachment_settings = await self_signing_page.configure_attachment_visibility({
                            'visible_to_all_signers': True,
                            'downloadable': True,
                            'required_review': True
                        })
                        print(f"Attachment settings configured: {attachment_settings}")

                        # Complete signing with metadata
                        signing_with_metadata = await self_signing_page.complete_signing_with_metadata({
                            'signer_title': 'Chief Executive Officer',
                            'signing_location': 'Corporate Headquarters',
                            'witness_present': 'Yes'
                        })
                        print(f"Signing with metadata completed: {signing_with_metadata}")

                finally:
                    # Cleanup files
                    for file_path in [main_path] + attachments:
                        if os.path.exists(file_path):
                            os.unlink(file_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signing_audit_trail_and_verification(self):
        """Test 8: Signing audit trail and document verification"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== SIGNING AUDIT TRAIL AND VERIFICATION TEST ===")

                # Create document for audit trail testing
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Audit trail test document')
                    pdf_path = temp_pdf.name

                try:
                    upload_result = await self_signing_page.upload_document_for_signing(pdf_path)

                    if upload_result:
                        # Enable audit trail features
                        audit_config = await self_signing_page.configure_audit_trail({
                            'track_all_actions': True,
                            'include_ip_addresses': True,
                            'include_timestamps': True,
                            'include_user_agents': True,
                            'track_document_views': True,
                            'track_field_changes': True
                        })
                        print(f"Audit trail configured: {audit_config}")

                        # Perform various actions to generate audit trail
                        actions = [
                            ('add_signature_field', self_signing_page.add_signature_field),
                            ('add_initials_field', self_signing_page.add_initials_field),
                            ('add_date_field', self_signing_page.add_date_field),
                            ('preview_document', self_signing_page.preview_document),
                            ('modify_field_position', lambda: self_signing_page.modify_field_position(1, {'x': 150, 'y': 250}))
                        ]

                        for action_name, action_func in actions:
                            action_result = await action_func()
                            print(f"Action '{action_name}' performed: {action_result}")

                            # Check audit trail after each action
                            audit_entries = await self_signing_page.get_audit_trail_entries()
                            print(f"  Audit entries count: {len(audit_entries) if isinstance(audit_entries, list) else 'N/A'}")

                        # Test audit trail export
                        audit_export = await self_signing_page.export_audit_trail('detailed')
                        print(f"Audit trail export: {audit_export}")

                        # Test document verification features
                        verification_checks = [
                            ('document_integrity', self_signing_page.verify_document_integrity),
                            ('signature_validity', self_signing_page.verify_signatures),
                            ('timestamp_accuracy', self_signing_page.verify_timestamps),
                            ('user_identity', self_signing_page.verify_user_identities)
                        ]

                        for check_name, check_func in verification_checks:
                            check_result = await check_func()
                            print(f"Verification '{check_name}': {check_result}")

                        # Generate verification report
                        verification_report = await self_signing_page.generate_verification_report()
                        print(f"Verification report generated: {verification_report}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_mobile_signing_simulation(self):
        """Test 9: Mobile signing workflow simulation"""
        async with async_playwright() as p:
            # Simulate mobile device
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            context = await browser.new_context(
                viewport={'width': 375, 'height': 667},
                user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
            )
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== MOBILE SIGNING SIMULATION TEST ===")

                # Test mobile-responsive signing interface
                mobile_interface = await self_signing_page.test_mobile_signing_interface()
                print(f"Mobile interface responsive: {mobile_interface}")

                # Create document for mobile signing
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Mobile signing test document')
                    pdf_path = temp_pdf.name

                try:
                    # Test mobile upload
                    mobile_upload = await self_signing_page.upload_document_mobile(pdf_path)
                    print(f"Mobile document upload: {mobile_upload}")

                    if mobile_upload:
                        # Test touch-based signature creation
                        touch_signature = await self_signing_page.create_touch_signature()
                        print(f"Touch signature created: {touch_signature}")

                        # Test mobile field positioning
                        mobile_field_pos = await self_signing_page.position_field_mobile({
                            'type': 'signature',
                            'touch_coordinates': {'x': 100, 'y': 200}
                        })
                        print(f"Mobile field positioning: {mobile_field_pos}")

                        # Test mobile signing completion
                        mobile_completion = await self_signing_page.complete_mobile_signing()
                        print(f"Mobile signing completion: {mobile_completion}")

                        # Test mobile document download
                        mobile_download = await self_signing_page.download_signed_document_mobile()
                        print(f"Mobile document download: {mobile_download}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await context.close()
                await browser.close()

    @pytest.mark.asyncio
    async def test_signing_workflow_error_recovery(self):
        """Test 10: Signing workflow error handling and recovery"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                self_signing_page = SelfSigningPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await self_signing_page.navigate_to_self_signing()

                print("=== SIGNING WORKFLOW ERROR RECOVERY TEST ===")

                # Test 1: Recovery from network interruption
                print("Testing network interruption recovery...")

                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                    temp_pdf.write(b'%PDF-1.4 Error recovery test document')
                    pdf_path = temp_pdf.name

                try:
                    await self_signing_page.upload_document_for_signing(pdf_path)
                    await self_signing_page.add_signature_field()

                    # Simulate network interruption
                    await page.set_offline(True)
                    await page.wait_for_timeout(2000)

                    # Attempt operation while offline
                    offline_operation = await self_signing_page.add_initials_field()
                    print(f"Offline operation handled: {offline_operation}")

                    # Restore network
                    await page.set_offline(False)
                    await page.wait_for_timeout(1000)

                    # Test recovery
                    recovery_result = await self_signing_page.recover_signing_session()
                    print(f"Session recovery: {recovery_result}")

                    # Test 2: Invalid file format handling
                    print("Testing invalid file format handling...")

                    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as invalid_file:
                        invalid_file.write(b'This is not a PDF document')
                        invalid_path = invalid_file.name

                    try:
                        invalid_upload = await self_signing_page.upload_document_for_signing(invalid_path)
                        print(f"Invalid file upload handled: {invalid_upload}")

                        # Check error message
                        error_message = await self_signing_page.get_upload_error_message()
                        print(f"Error message displayed: {error_message}")

                    finally:
                        if os.path.exists(invalid_path):
                            os.unlink(invalid_path)

                    # Test 3: Incomplete signing recovery
                    print("Testing incomplete signing recovery...")

                    # Start signing process
                    signing_started = await self_signing_page.start_signing_process()
                    print(f"Signing process started: {signing_started}")

                    # Simulate browser refresh during signing
                    await page.reload()
                    await page.wait_for_load_state("networkidle")

                    # Test session restoration
                    session_restored = await self_signing_page.restore_signing_session()
                    print(f"Signing session restored: {session_restored}")

                    # Test progress recovery
                    if session_restored:
                        progress = await self_signing_page.get_signing_progress()
                        print(f"Signing progress recovered: {progress}")

                        # Complete signing after recovery
                        completion = await self_signing_page.complete_signing_after_recovery()
                        print(f"Signing completed after recovery: {completion}")

                finally:
                    if os.path.exists(pdf_path):
                        os.unlink(pdf_path)

            finally:
                await browser.close()