import pytest
import asyncio
from playwright.async_api import async_playwright
from typing import Dict, List, Any
from pathlib import Path

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from pages.advanced_others_sign_page import AdvancedOthersSignPage
from pages.login_page import LoginPage
from utils.common_methods import CommonMethods
from config.settings import settings


@pytest.mark.others_signing
@pytest.mark.advanced
class TestAdvancedOthersSigning:
    def _initialize_page_objects(self):
        """Initialize page objects."""
        self.login_page = LoginPage(self.page)
        self.advanced_others_sign_page = AdvancedOthersSignPage(self.page)
        

    async def _cleanup_browser(self):
        """Cleanup browser resources."""
        if hasattr(self, 'browser'):
                await self.browser.close()
        if hasattr(self, 'playwright'):
                await self.playwright.stop()

    async def _setup_browser(self):
        """Setup browser with working direct approach."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1920, "height": 1080}
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(15000)
        self.page.set_default_navigation_timeout(20000)
        
        # Initialize page objects with working page
        self._initialize_page_objects()
        

    """Comprehensive advanced others-signing test suite covering all multi-party signing scenarios"""

    
    @pytest.mark.smoke
    @pytest.mark.asyncio
    async def test_upload_document_for_others_signing_basic(self):
        """Test basic document upload for others signing"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            document_config = {
                'name': 'Others_Sign_Basic_Test',
                'settings': {
                    'signing_order': 'sequential'
                }
            }
            
            result = await self.others_sign_page.upload_document_for_others_signing(document_path, document_config)
            
            assert result['success'] is True
            assert result['document']['name'] == 'Others_Sign_Basic_Test'
            assert result['ready_for_recipients'] is True
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_document_replacement_during_workflow(self):
        """Test document replacement during active workflow"""
        await self._setup_browser()
        try:
            original_document = str(Path("data/sample.pdf").resolve())
            replacement_document = str(Path("data/sample.docx").resolve())
            
            # Upload original document
            upload_result = await self.others_sign_page.upload_document_for_others_signing(original_document)
            assert upload_result['success'] is True
            
            # Replace with new document
            replace_config = {
                'name': 'Replaced_Document',
                'replace_existing': True
            }
            
            replace_result = await self.others_sign_page.upload_document_for_others_signing(replacement_document, replace_config)
            
            assert replace_result['success'] is True
            assert replace_result['document']['name'] == 'Replaced_Document'
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_upload_multiple_document_formats(self):
        """Test uploading different document formats for others signing"""
        await self._setup_browser()
        try:
            document_formats = [
                ("data/sample.pdf", "PDF_Others_Sign"),
                ("data/sample.docx", "Word_Others_Sign"),
                ("data/sample.xlsx", "Excel_Others_Sign"),
                ("data/sample.png", "Image_Others_Sign")
            ]
            
            for doc_path, doc_name in document_formats:
                document_path = str(Path(doc_path).resolve())
                config = {'name': doc_name}
                
                result = await self.others_sign_page.upload_document_for_others_signing(document_path, config)
                assert result['success'] is True, f"Failed for {doc_name}: {result.get('error', 'Unknown error')}"
                
                # Reset for next document
                await self.others_sign_page.navigate_to_others_sign()
        finally:
            await self._cleanup_browser()

    # Single recipient tests
    @pytest.mark.smoke
    @pytest.mark.asyncio
    async def test_add_single_recipient_email(self):
        """Test adding single recipient with email delivery"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'email': 'test.recipient@example.com',
                'name': 'Test Recipient',
                'delivery_method': 'email',
                'authentication': 'none'
            }
            
            result = await self.others_sign_page.add_recipient(recipient_config)
            
            assert result['success'] is True
            assert result['recipient']['email'] == 'test.recipient@example.com'
            assert result['total_recipients'] == 1
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_add_single_recipient_sms(self):
        """Test adding single recipient with SMS delivery"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'phone': '+1-555-123-4567',
                'name': 'SMS Recipient',
                'delivery_method': 'sms',
                'authentication': 'otp'
            }
            
            result = await self.others_sign_page.add_recipient(recipient_config)
            
            assert result['success'] is True
            assert result['recipient']['phone'] == '+1-555-123-4567'
            assert result['recipient']['delivery_method'] == 'sms'
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_add_recipient_with_authentication_otp(self):
        """Test adding recipient with OTP authentication"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'email': 'secure.recipient@example.com',
                'name': 'Secure Recipient',
                'delivery_method': 'email',
                'authentication': 'otp'
            }
            
            result = await self.others_sign_page.add_recipient(recipient_config)
            
            assert result['success'] is True
            assert result['recipient']['authentication'] == 'otp'
        finally:
            await self._cleanup_browser()

    # Multiple recipients tests
    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_add_multiple_recipients_bulk(self):
        """Test adding multiple recipients in bulk"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipients_config = [
                {
                    'email': 'signer1@example.com',
                    'name': 'First Signer',
                    'delivery_method': 'email',
                    'order': 1
                },
                {
                    'email': 'signer2@example.com', 
                    'name': 'Second Signer',
                    'delivery_method': 'email',
                    'order': 2
                },
                {
                    'phone': '+1-555-987-6543',
                    'name': 'SMS Signer',
                    'delivery_method': 'sms',
                    'order': 3
                }
            ]
            
            result = await self.others_sign_page.add_multiple_recipients(recipients_config)
            
            assert result['success'] is True
            assert result['total_processed'] == 3
            assert result['successful'] == 3
            assert result['failed'] == 0
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_mixed_delivery_methods_multiple_recipients(self):
        """Test multiple recipients with different delivery methods"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipients_config = [
                {
                    'email': 'email.signer@example.com',
                    'name': 'Email Signer',
                    'delivery_method': 'email'
                },
                {
                    'phone': '+1-555-111-2222',
                    'name': 'SMS Signer',
                    'delivery_method': 'sms'
                },
                {
                    'email': 'both.signer@example.com',
                    'phone': '+1-555-333-4444',
                    'name': 'Both Methods Signer',
                    'delivery_method': 'email'
                }
            ]
            
            result = await self.others_sign_page.add_multiple_recipients(recipients_config)
            
            assert result['success'] is True
            assert result['successful'] == 3
        finally:
            await self._cleanup_browser()

    # Workflow configuration tests  
    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_configure_sequential_signing_workflow(self):
        """Test configuring sequential signing workflow"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add multiple recipients
            recipients_config = [
                {'email': 'first@example.com', 'name': 'First', 'order': 1},
                {'email': 'second@example.com', 'name': 'Second', 'order': 2}
            ]
            
            await self.others_sign_page.add_multiple_recipients(recipients_config)
            
            # Configure sequential workflow
            workflow_config = {
                'type': 'sequential',
                'notifications': {
                    'send_reminders': True,
                    'reminder_frequency': 'daily'
                }
            }
            
            result = await self.others_sign_page.configure_signing_workflow(workflow_config)
            
            assert result['success'] is True
            assert result['workflow_type'] == 'sequential'
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_configure_parallel_signing_workflow(self):
        """Test configuring parallel signing workflow"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add multiple recipients
            recipients_config = [
                {'email': 'parallel1@example.com', 'name': 'Parallel Signer 1'},
                {'email': 'parallel2@example.com', 'name': 'Parallel Signer 2'},
                {'email': 'parallel3@example.com', 'name': 'Parallel Signer 3'}
            ]
            
            await self.others_sign_page.add_multiple_recipients(recipients_config)
            
            # Configure parallel workflow
            workflow_config = {
                'type': 'parallel',
                'deadlines': {
                    'signing_deadline': '7_days',
                    'send_deadline_warnings': True
                }
            }
            
            result = await self.others_sign_page.configure_signing_workflow(workflow_config)
            
            assert result['success'] is True
            assert result['workflow_type'] == 'parallel'
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_configure_conditional_signing_workflow(self):
        """Test configuring conditional signing workflow"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add recipients with conditions
            recipients_config = [
                {'email': 'approver@example.com', 'name': 'Approver', 'role': 'approver'},
                {'email': 'signer@example.com', 'name': 'Signer', 'role': 'signer'}
            ]
            
            await self.others_sign_page.add_multiple_recipients(recipients_config)
            
            # Configure conditional workflow
            workflow_config = {
                'type': 'conditional',
                'conditions': {
                    'require_approval_first': True,
                    'approval_threshold': 1
                }
            }
            
            result = await self.others_sign_page.configure_signing_workflow(workflow_config)
            
            assert result['success'] is True
            assert result['workflow_type'] == 'conditional'
        finally:
            await self._cleanup_browser()

    # Document sending and tracking tests
    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_send_document_for_signing_immediate(self):
        """Test sending document immediately for signing"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            # Complete setup
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'email': 'immediate.signer@example.com',
                'name': 'Immediate Signer'
            }
            
            await self.others_sign_page.add_recipient(recipient_config)
            
            # Send immediately
            send_config = {
                'immediate_send': True
            }
            
            result = await self.others_sign_page.send_document_for_signing(send_config)
            
            assert result['success'] is True
            assert len(result['recipients']) == 1
            assert 'tracking' in result
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_send_document_with_scheduling(self):
        """Test sending document with scheduling"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'email': 'scheduled.signer@example.com',
                'name': 'Scheduled Signer'
            }
            
            await self.others_sign_page.add_recipient(recipient_config)
            
            # Schedule sending
            send_config = {
                'immediate_send': False,
                'schedule_time': '2025-09-02T10:00:00'
            }
            
            result = await self.others_sign_page.send_document_for_signing(send_config)
            
            assert result['success'] is True
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_track_signing_status(self):
        """Test tracking signing status after sending"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            # Complete workflow
            workflow_result = await self.others_sign_page.complete_others_sign_workflow(
                document_path,
                {
                    'recipients': [
                        {
                            'email': 'tracker.test@example.com',
                            'name': 'Tracking Test Recipient'
                        }
                    ],
                    'send_config': {'immediate_send': True}
                }
            )
            
            assert workflow_result['success'] is True
            
            # Track status (mock tracking ID)
            tracking_id = workflow_result.get('steps', {}).get('send', {}).get('tracking', {}).get('document_id', 'test-tracking-id')
            
            if tracking_id != 'test-tracking-id':
                status_result = await self.others_sign_page.track_signing_status(tracking_id)
                assert status_result['success'] is True
        finally:
            await self._cleanup_browser()

    # Recipient management during workflow
    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_replace_recipient_during_active_workflow(self):
        """Test replacing recipient during active signing workflow"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add initial recipient
            original_recipient = {
                'email': 'original@example.com',
                'name': 'Original Recipient'
            }
            
            await self.others_sign_page.add_recipient(original_recipient)
            
            # Replace recipient
            new_recipient_config = {
                'email': 'replacement@example.com',
                'name': 'Replacement Recipient'
            }
            
            result = await self.others_sign_page.replace_recipient_during_workflow(
                'original@example.com', 
                new_recipient_config
            )
            
            assert result['success'] is True
            assert result['new_recipient']['email'] == 'replacement@example.com'
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_send_reminder_to_specific_recipient(self):
        """Test sending reminder to specific recipient"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            recipient_config = {
                'email': 'reminder.recipient@example.com',
                'name': 'Reminder Recipient'
            }
            
            await self.others_sign_page.add_recipient(recipient_config)
            
            # Send custom reminder
            reminder_config = {
                'custom_message': 'Please remember to sign the important document.'
            }
            
            result = await self.others_sign_page.send_reminder_to_recipient(
                'reminder.recipient@example.com',
                reminder_config
            )
            
            assert result['success'] is True
            assert result['recipient'] == 'reminder.recipient@example.com'
        finally:
            await self._cleanup_browser()

    # Complete workflow tests
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_others_sign_workflow_single_recipient(self):
        """Test complete others-sign workflow with single recipient"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            workflow_config = {
                'document_config': {
                    'name': 'Complete_Workflow_Single'
                },
                'recipients': [
                    {
                        'email': 'single.workflow@example.com',
                        'name': 'Single Workflow Recipient',
                        'delivery_method': 'email'
                    }
                ],
                'send_config': {
                    'immediate_send': True
                }
            }
            
            result = await self.others_sign_page.complete_others_sign_workflow(document_path, workflow_config)
            
            assert result['success'] is True
            assert result['steps']['upload']['success'] is True
            assert result['steps']['recipients']['success'] is True
            assert result['steps']['send']['success'] is True
        finally:
            await self._cleanup_browser()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_others_sign_workflow_multiple_recipients(self):
        """Test complete others-sign workflow with multiple recipients"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            workflow_config = {
                'document_config': {
                    'name': 'Complete_Workflow_Multiple'
                },
                'recipients': [
                    {
                        'email': 'multi1@example.com',
                        'name': 'Multi Recipient 1',
                        'delivery_method': 'email'
                    },
                    {
                        'email': 'multi2@example.com',
                        'name': 'Multi Recipient 2',
                        'delivery_method': 'email'
                    },
                    {
                        'phone': '+1-555-999-8888',
                        'name': 'Multi Recipient 3',
                        'delivery_method': 'sms'
                    }
                ],
                'signing_workflow': {
                    'type': 'sequential'
                },
                'send_config': {
                    'immediate_send': True
                }
            }
            
            result = await self.others_sign_page.complete_others_sign_workflow(document_path, workflow_config)
            
            assert result['success'] is True
            assert len(result['steps']['recipients']['results']) == 3
            assert result['steps']['workflow_setup']['success'] is True
        finally:
            await self._cleanup_browser()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_workflow_with_document_replacement(self):
        """Test complete workflow including document replacement"""
        await self._setup_browser()
        try:
            original_document = str(Path("data/sample.pdf").resolve())
            
            workflow_config = {
                'document_config': {
                    'name': 'Replacement_Workflow',
                    'replace_existing': True
                },
                'recipients': [
                    {
                        'email': 'replacement.test@example.com',
                        'name': 'Replacement Test Recipient'
                    }
                ],
                'send_config': {
                    'immediate_send': True
                }
            }
            
            result = await self.others_sign_page.complete_others_sign_workflow(original_document, workflow_config)
            
            assert result['success'] is True
        finally:
            await self._cleanup_browser()

    # Validation and error handling tests
    @pytest.mark.error_handling
    @pytest.mark.asyncio
    async def test_recipients_validation_no_recipients(self):
        """Test validation when no recipients are configured"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            validation = await self.others_sign_page.validate_recipients_configuration()
            
            assert validation['valid'] is False
            assert validation['recipient_count'] == 0
            assert any('no recipients' in issue.lower() for issue in validation['issues'])
        finally:
            await self._cleanup_browser()

    @pytest.mark.error_handling
    @pytest.mark.asyncio
    async def test_recipients_validation_invalid_email(self):
        """Test validation with invalid email formats"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add recipient with invalid email
            invalid_recipient = {
                'email': 'invalid-email-format',
                'name': 'Invalid Email Recipient'
            }
            
            await self.others_sign_page.add_recipient(invalid_recipient)
            
            validation = await self.others_sign_page.validate_recipients_configuration()
            
            assert validation['valid'] is False
            assert any('invalid email' in issue.lower() for issue in validation['issues'])
        finally:
            await self._cleanup_browser()

    @pytest.mark.error_handling
    @pytest.mark.asyncio
    async def test_recipients_validation_sms_without_phone(self):
        """Test validation with SMS delivery but no phone number"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add recipient with SMS delivery but no phone
            invalid_recipient = {
                'email': 'sms.without.phone@example.com',
                'name': 'SMS Without Phone',
                'delivery_method': 'sms'  # SMS selected but no phone provided
            }
            
            await self.others_sign_page.add_recipient(invalid_recipient)
            
            validation = await self.others_sign_page.validate_recipients_configuration()
            
            assert validation['valid'] is False
            assert any('sms delivery' in issue.lower() and 'no phone' in issue.lower() for issue in validation['issues'])
        finally:
            await self._cleanup_browser()

    @pytest.mark.error_handling
    @pytest.mark.asyncio
    async def test_send_document_without_recipients(self):
        """Test error handling when trying to send document without recipients"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Try to send without adding recipients
            result = await self.others_sign_page.send_document_for_signing()
            
            assert result['success'] is False
            assert 'no recipients' in result['error'].lower()
        finally:
            await self._cleanup_browser()

    # Utility and management tests
    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_recipient_count_tracking(self):
        """Test recipient count tracking"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Initially no recipients
            initial_count = await self.others_sign_page.get_recipient_count()
            assert initial_count == 0
            
            # Add recipients
            recipients = [
                {'email': 'count1@example.com', 'name': 'Count 1'},
                {'email': 'count2@example.com', 'name': 'Count 2'},
                {'email': 'count3@example.com', 'name': 'Count 3'}
            ]
            
            await self.others_sign_page.add_multiple_recipients(recipients)
            
            final_count = await self.others_sign_page.get_recipient_count()
            assert final_count == 3
        finally:
            await self._cleanup_browser()

    @pytest.mark.regression
    @pytest.mark.asyncio
    async def test_clear_all_recipients(self):
        """Test clearing all configured recipients"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Add some recipients
            recipients = [
                {'email': 'clear1@example.com', 'name': 'Clear Test 1'},
                {'email': 'clear2@example.com', 'name': 'Clear Test 2'}
            ]
            
            await self.others_sign_page.add_multiple_recipients(recipients)
            
            before_clear_count = await self.others_sign_page.get_recipient_count()
            assert before_clear_count == 2
            
            # Clear all
            clear_result = await self.others_sign_page.clear_all_recipients()
            assert clear_result['success'] is True
            
            after_clear_count = await self.others_sign_page.get_recipient_count()
            assert after_clear_count == 0
        finally:
            await self._cleanup_browser()

    # Performance tests
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_many_recipients_performance(self):
        """Test performance with many recipients"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Create 20 recipients
            many_recipients = []
            for i in range(20):
                many_recipients.append({
                    'email': f'perf.recipient.{i}@example.com',
                    'name': f'Performance Recipient {i}',
                    'delivery_method': 'email'
                })
            
            start_time = await self.others_sign_page.get_current_timestamp()
            
            result = await self.others_sign_page.add_multiple_recipients(many_recipients)
            
            end_time = await self.others_sign_page.get_current_timestamp()
            
            assert result['success'] is True
            assert result['successful'] == 20
            assert result['failed'] == 0
            
            final_count = await self.others_sign_page.get_recipient_count()
            assert final_count == 20
        finally:
            await self._cleanup_browser()

    @pytest.mark.accessibility
    @pytest.mark.asyncio
    async def test_others_sign_accessibility_features(self):
        """Test accessibility features of others-sign workflow"""
        await self._setup_browser()
        try:
            document_path = str(Path("data/sample.pdf").resolve())
            
            await self.others_sign_page.upload_document_for_others_signing(document_path)
            
            # Test keyboard navigation
            await self.page.keyboard.press('Tab')  # Navigate to add recipient
            await self.page.keyboard.press('Enter')  # Open recipient form
            
            # Test screen reader compatibility (basic check)
            recipient_form = await self.page.query_selector(".recipient-form, [data-testid='recipient-form']")
            if recipient_form:
                # Check for aria-labels or similar accessibility attributes
                email_field = await recipient_form.query_selector("input[name='email'], #recipient-email")
                if email_field:
                    aria_label = await email_field.get_attribute('aria-label')
                    placeholder = await email_field.get_attribute('placeholder')
                    assert aria_label is not None or placeholder is not None, "Email field should have accessibility attributes"
        finally:
            await self._cleanup_browser()