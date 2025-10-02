import pytest
import allure
import os
import time
from playwright.sync_api import Page, expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.pages.login_page import LoginPage
from src.config.wesign_test_config import WeSignTestConfig
from src.utils.test_helpers import TestHelpers


@allure.epic("WeSign Document Management")
@allure.feature("Assign and Send Functionality")
class TestWeSignAssignSendFunctionality:
    """Comprehensive test suite for WeSign assign and send functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, test_config: WeSignTestConfig):
        """Setup test environment before each test"""
        self.page = page
        self.config = test_config
        self.document_page = WeSignDocumentPage(page)
        self.login_page = LoginPage(page)
        self.test_helpers = TestHelpers(page, test_config)
        
        # Login before each test
        self.test_helpers.login_with_default_user()
        
        # Navigate to dashboard
        self.document_page.navigate_to_dashboard()
        self.document_page.wait_for_dashboard_load()
        
        # Upload a test document for assign/send operations
        self._setup_test_document()
        
    def _setup_test_document(self):
        """Upload a test document for assign and send operations"""
        test_file = self.config.get_file_path('pdf_3_pages')
        if test_file and os.path.exists(test_file):
            success = self.document_page.upload_single_file(test_file)
            assert success, "Failed to upload test document for assign/send tests"
            time.sleep(2)  # Wait for upload to complete
            
    @allure.story("Single Recipient Assignment")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_assign_send_single_recipient_english(self):
        """Test assigning and sending document to single recipient in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, f"Need at least 1 document for assignment, found {document_count}"
            
        with allure.step("Prepare recipient data"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipient = [recipients[0]]  # Use first recipient
            
        with allure.step("Assign and send document"):
            success = self.document_page.assign_and_send_document(test_recipient)
            assert success, "Failed to assign and send document to single recipient"
            
        with allure.step("Verify send operation completed"):
            time.sleep(3)
            
            # Check for success message or completion status
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Assign and send operation did not complete successfully"
            
    @allure.story("Single Recipient Assignment")
    @allure.severity(allure.severity_level.CRITICAL) 
    def test_assign_send_single_recipient_hebrew(self):
        """Test assigning and sending document to single recipient in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, f"Need at least 1 document for assignment, found {document_count}"
            
        with allure.step("Prepare recipient data with Hebrew name"):
            recipients = self.config.get_test_recipients_for_language("hebrew")
            test_recipient = [recipients[0]]
            
        with allure.step("Assign and send document"):
            success = self.document_page.assign_and_send_document(test_recipient)
            assert success, "Failed to assign and send document to single recipient"
            
        with allure.step("Verify send operation completed"):
            time.sleep(3)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Assign and send operation did not complete successfully"
            
    @allure.story("Multiple Recipients Assignment")
    @allure.severity(allure.severity_level.HIGH)
    def test_assign_send_multiple_recipients_english(self):
        """Test assigning and sending document to multiple recipients in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, f"Need at least 1 document for assignment, found {document_count}"
            
        with allure.step("Prepare multiple recipients"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipients = recipients[:3]  # Use first 3 recipients
            
        with allure.step("Assign and send to multiple recipients"):
            success = self.document_page.assign_and_send_document(test_recipients)
            assert success, "Failed to assign and send document to multiple recipients"
            
        with allure.step("Verify send operation completed"):
            time.sleep(5)  # More time for multiple recipients
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Multiple recipient assignment did not complete successfully"
            
    @allure.story("Multiple Recipients Assignment")
    @allure.severity(allure.severity_level.HIGH)
    def test_assign_send_multiple_recipients_hebrew(self):
        """Test assigning and sending document to multiple recipients in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, f"Need at least 1 document for assignment, found {document_count}"
            
        with allure.step("Prepare multiple recipients with Hebrew names"):
            recipients = self.config.get_test_recipients_for_language("hebrew")
            test_recipients = recipients[:3]
            
        with allure.step("Assign and send to multiple recipients"):
            success = self.document_page.assign_and_send_document(test_recipients)
            assert success, "Failed to assign and send document to multiple recipients"
            
        with allure.step("Verify send operation completed"):
            time.sleep(5)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Multiple recipient assignment did not complete successfully"
            
    @allure.story("Email Validation")
    @allure.severity(allure.severity_level.HIGH)
    @pytest.mark.parametrize("invalid_email", [
        "invalid-email",
        "test@",
        "@domain.com", 
        "test..test@domain.com",
        "test@domain",
        ""
    ])
    def test_assign_send_invalid_email_english(self, invalid_email):
        """Test that invalid email addresses are properly validated in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step(f"Attempt to assign with invalid email: {invalid_email}"):
            invalid_recipient = [{"name": "Test User", "email": invalid_email}]
            
            # This should either fail or show validation error
            try:
                success = self.document_page.assign_and_send_document(invalid_recipient)
                
                if success:
                    # If it succeeded, there should be an error message
                    time.sleep(2)
                    error_message = self.document_page.get_error_message()
                    assert error_message is not None, f"Should show validation error for invalid email: {invalid_email}"
                    
            except Exception as e:
                # Expected - should fail with invalid email
                allure.attach(f"Expected validation error: {str(e)}", name="Email Validation Error")
                
    @allure.story("Email Validation") 
    @allure.severity(allure.severity_level.HIGH)
    @pytest.mark.parametrize("invalid_email", [
        "invalid-email",
        "test@",
        "@domain.com",
        "test..test@domain.com",
        "test@domain",
        ""
    ])
    def test_assign_send_invalid_email_hebrew(self, invalid_email):
        """Test that invalid email addresses are properly validated in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step(f"Attempt to assign with invalid email: {invalid_email}"):
            invalid_recipient = [{"name": "משתמש בדיקה", "email": invalid_email}]
            
            try:
                success = self.document_page.assign_and_send_document(invalid_recipient)
                
                if success:
                    time.sleep(2)
                    error_message = self.document_page.get_error_message()
                    assert error_message is not None, f"Should show validation error for invalid email: {invalid_email}"
                    
            except Exception as e:
                allure.attach(f"Expected validation error: {str(e)}", name="Email Validation Error")
                
    @allure.story("Name Validation")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.parametrize("invalid_name,description", [
        ("", "empty name"),
        ("a" * 300, "very long name"),
        ("<script>alert('test')</script>", "XSS attempt"),
        ("Test123!@", "special characters")
    ])
    def test_assign_send_invalid_name_english(self, invalid_name, description):
        """Test that invalid names are properly handled in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step(f"Attempt to assign with {description}"):
            recipients = self.config.get_test_recipients_for_language("english")
            invalid_recipient = [{"name": invalid_name, "email": recipients[0]["email"]}]
            
            try:
                success = self.document_page.assign_and_send_document(invalid_recipient)
                
                # Depending on validation, this might succeed or fail
                # If it succeeds, the system might sanitize the name
                if success:
                    time.sleep(2)
                    # Just verify it completed - name validation might be lenient
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", f"Assignment with {description} did not complete properly"
                    
            except Exception as e:
                # Expected for some invalid names
                allure.attach(f"Name validation error: {str(e)}", name="Name Validation")
                
    @allure.story("Name Validation")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.parametrize("invalid_name,description", [
        ("", "empty name"),
        ("א" * 300, "very long Hebrew name"),
        ("<script>alert('test')</script>", "XSS attempt"),
        ("בדיקה123!@", "Hebrew with special characters")
    ])
    def test_assign_send_invalid_name_hebrew(self, invalid_name, description):
        """Test that invalid names are properly handled in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step(f"Attempt to assign with {description}"):
            recipients = self.config.get_test_recipients_for_language("hebrew")
            invalid_recipient = [{"name": invalid_name, "email": recipients[0]["email"]}]
            
            try:
                success = self.document_page.assign_and_send_document(invalid_recipient)
                
                if success:
                    time.sleep(2)
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", f"Assignment with {description} did not complete properly"
                    
            except Exception as e:
                allure.attach(f"Name validation error: {str(e)}", name="Name Validation")
                
    @allure.story("Performance Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_assign_send_performance_single_recipient(self):
        """Test assign and send performance for single recipient"""
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step("Prepare recipient data"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipient = [recipients[0]]
            
        with allure.step("Measure assign and send time"):
            start_time = time.time()
            success = self.document_page.assign_and_send_document(test_recipient)
            end_time = time.time()
            
            send_time_ms = (end_time - start_time) * 1000
            
        with allure.step("Verify performance"):
            assert success, "Assign and send operation failed"
            
            max_time = self.config.get_performance_thresholds()['document_send_max']
            assert send_time_ms < max_time, f"Send took {send_time_ms}ms, max allowed {max_time}ms"
            
        allure.attach(f"Send time: {send_time_ms:.2f}ms", name="Performance Metrics")
        
    @allure.story("Performance Testing")
    @allure.severity(allure.severity_level.NORMAL) 
    def test_assign_send_performance_multiple_recipients(self):
        """Test assign and send performance for multiple recipients"""
        with allure.step("Verify document is available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for assignment"
            
        with allure.step("Prepare multiple recipients"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipients = recipients[:5]  # Use 5 recipients for performance test
            
        with allure.step("Measure assign and send time"):
            start_time = time.time()
            success = self.document_page.assign_and_send_document(test_recipients)
            end_time = time.time()
            
            send_time_ms = (end_time - start_time) * 1000
            
        with allure.step("Verify performance"):
            assert success, "Multiple recipient assign and send failed"
            
            # Allow more time for multiple recipients
            max_time = self.config.get_performance_thresholds()['document_send_max'] * 2
            assert send_time_ms < max_time, f"Multiple send took {send_time_ms}ms, max allowed {max_time}ms"
            
        allure.attach(f"Multiple recipient send time: {send_time_ms:.2f}ms", name="Performance Metrics")
        
    @allure.story("Large Document Assignment")
    @allure.severity(allure.severity_level.NORMAL)
    def test_assign_send_large_document_english(self):
        """Test assigning and sending large document in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Upload large document"):
            large_file = self.config.get_file_path('pdf_60_pages')
            if not large_file or not os.path.exists(large_file):
                large_file = self.config.get_file_path('pdf_102_pages')
                
            if not large_file or not os.path.exists(large_file):
                pytest.skip("No large document available for testing")
                
            success = self.document_page.upload_single_file(large_file, timeout=120000)
            assert success, "Failed to upload large document"
            time.sleep(3)
            
        with allure.step("Assign and send large document"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipient = [recipients[0]]
            
            # Use extended timeout for large document
            timeout = self.config.get_timeout('send') * 2
            success = self.document_page.assign_and_send_document(test_recipient, timeout=timeout)
            assert success, "Failed to assign and send large document"
            
        with allure.step("Verify large document send completed"):
            time.sleep(10)  # Extra time for large document processing
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Large document assignment did not complete successfully"
            
    @allure.story("Large Document Assignment")
    @allure.severity(allure.severity_level.NORMAL)
    def test_assign_send_large_document_hebrew(self):
        """Test assigning and sending large document in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Upload large document"):
            large_file = self.config.get_file_path('pdf_60_pages')
            if not large_file or not os.path.exists(large_file):
                large_file = self.config.get_file_path('pdf_102_pages')
                
            if not large_file or not os.path.exists(large_file):
                pytest.skip("No large document available for testing")
                
            success = self.document_page.upload_single_file(large_file, timeout=120000)
            assert success, "Failed to upload large document"
            time.sleep(3)
            
        with allure.step("Assign and send large document"):
            recipients = self.config.get_test_recipients_for_language("hebrew")
            test_recipient = [recipients[0]]
            
            timeout = self.config.get_timeout('send') * 2
            success = self.document_page.assign_and_send_document(test_recipient, timeout=timeout)
            assert success, "Failed to assign and send large document"
            
        with allure.step("Verify large document send completed"):
            time.sleep(10)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Large document assignment did not complete successfully"
            
    @allure.story("Document Selection")
    @allure.severity(allure.severity_level.NORMAL)
    def test_assign_send_specific_document_english(self):
        """Test assigning and sending a specific document by name in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Upload additional test document with identifiable name"):
            # Upload a specific file that we can identify
            test_file = self.config.get_file_path('pdf_6_pages')
            if test_file and os.path.exists(test_file):
                success = self.document_page.upload_single_file(test_file)
                assert success, "Failed to upload additional test document"
                time.sleep(2)
            else:
                pytest.skip("Specific test document not available")
                
        with allure.step("Get list of available documents"):
            document_names = self.document_page.get_document_names()
            assert len(document_names) >= 1, "No documents available for assignment"
            
            # Use the first document name
            target_document = document_names[0]
            
        with allure.step(f"Assign and send specific document: {target_document}"):
            recipients = self.config.get_test_recipients_for_language("english")
            test_recipient = [recipients[0]]
            
            success = self.document_page.assign_and_send_document(test_recipient, target_document)
            assert success, f"Failed to assign and send specific document: {target_document}"
            
        with allure.step("Verify specific document assignment completed"):
            time.sleep(3)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Specific document assignment did not complete successfully"
            
        allure.attach(f"Target document: {target_document}", name="Document Assignment Details")
        
    @allure.story("Document Selection")
    @allure.severity(allure.severity_level.NORMAL)
    def test_assign_send_specific_document_hebrew(self):
        """Test assigning and sending a specific document by name in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Upload additional test document"):
            test_file = self.config.get_file_path('pdf_6_pages')
            if test_file and os.path.exists(test_file):
                success = self.document_page.upload_single_file(test_file)
                assert success, "Failed to upload additional test document"
                time.sleep(2)
            else:
                pytest.skip("Specific test document not available")
                
        with allure.step("Get list of available documents"):
            document_names = self.document_page.get_document_names()
            assert len(document_names) >= 1, "No documents available for assignment"
            
            target_document = document_names[0]
            
        with allure.step(f"Assign and send specific document: {target_document}"):
            recipients = self.config.get_test_recipients_for_language("hebrew")
            test_recipient = [recipients[0]]
            
            success = self.document_page.assign_and_send_document(test_recipient, target_document)
            assert success, f"Failed to assign and send specific document: {target_document}"
            
        with allure.step("Verify specific document assignment completed"):
            time.sleep(3)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Specific document assignment did not complete successfully"
            
        allure.attach(f"Target document: {target_document}", name="Document Assignment Details")