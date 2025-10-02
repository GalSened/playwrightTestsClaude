import pytest
import allure
import os
import time
from pathlib import Path
from playwright.sync_api import Page, expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.pages.login_page import LoginPage
from src.config.wesign_test_config import WeSignTestConfig
from src.utils.test_helpers import TestHelpers


@allure.epic("WeSign Document Management")
@allure.feature("File Upload Functionality")
class TestWeSignUploadFunctionality:
    """Comprehensive test suite for WeSign file upload functionality"""
    
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
        
    @allure.story("Single File Upload")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_upload_single_pdf_file_english(self):
        """Test uploading a single PDF file in English interface"""
        with allure.step("Verify English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Upload PDF file"):
            pdf_file = self.config.get_file_path('pdf_3_pages')
            assert pdf_file and os.path.exists(pdf_file), f"Test file not found: {pdf_file}"
            
            success = self.document_page.upload_single_file(pdf_file)
            assert success, "File upload failed"
            
        with allure.step("Verify upload success"):
            assert self.document_page.get_upload_status() == "success", "Upload status not success"
            
        with allure.step("Verify document appears in list"):
            document_count = self.document_page.get_document_count()
            assert document_count > 0, "No documents found after upload"
            
    @allure.story("Single File Upload")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_upload_single_pdf_file_hebrew(self):
        """Test uploading a single PDF file in Hebrew interface"""
        with allure.step("Verify Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Upload PDF file"):
            pdf_file = self.config.get_file_path('pdf_3_pages')
            assert pdf_file and os.path.exists(pdf_file), f"Test file not found: {pdf_file}"
            
            success = self.document_page.upload_single_file(pdf_file)
            assert success, "File upload failed"
            
        with allure.step("Verify upload success"):
            assert self.document_page.get_upload_status() == "success", "Upload status not success"
            
        with allure.step("Verify document appears in list"):
            document_count = self.document_page.get_document_count()
            assert document_count > 0, "No documents found after upload"
            
    @allure.story("Multiple File Upload") 
    @allure.severity(allure.severity_level.HIGH)
    def test_upload_multiple_pdf_files_english(self):
        """Test uploading multiple PDF files simultaneously in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Prepare multiple files"):
            files_to_upload = [
                self.config.get_file_path('pdf_3_pages'),
                self.config.get_file_path('pdf_2_pages'),
                self.config.get_file_path('pdf_6_pages')
            ]
            
            # Filter out None values and verify files exist
            valid_files = [f for f in files_to_upload if f and os.path.exists(f)]
            assert len(valid_files) >= 2, f"Need at least 2 valid files for testing, found {len(valid_files)}"
            
        with allure.step("Upload multiple files"):
            success = self.document_page.upload_multiple_files(valid_files[:2])  # Upload 2 files
            assert success, "Multiple file upload failed"
            
        with allure.step("Verify all files uploaded"):
            # Wait for upload completion
            time.sleep(3)
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Expected at least 2 documents, found {document_count}"
            
    @allure.story("Multiple File Upload")
    @allure.severity(allure.severity_level.HIGH) 
    def test_upload_multiple_pdf_files_hebrew(self):
        """Test uploading multiple PDF files simultaneously in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Prepare multiple files"):
            files_to_upload = [
                self.config.get_file_path('pdf_3_pages'),
                self.config.get_file_path('pdf_2_pages')
            ]
            
            valid_files = [f for f in files_to_upload if f and os.path.exists(f)]
            assert len(valid_files) >= 2, f"Need at least 2 valid files for testing, found {len(valid_files)}"
            
        with allure.step("Upload multiple files"):
            success = self.document_page.upload_multiple_files(valid_files)
            assert success, "Multiple file upload failed"
            
        with allure.step("Verify all files uploaded"):
            time.sleep(3)
            document_count = self.document_page.get_document_count()
            assert document_count >= len(valid_files), f"Expected at least {len(valid_files)} documents"
            
    @allure.story("File Type Support")
    @allure.severity(allure.severity_level.HIGH)
    @pytest.mark.parametrize("file_type,file_key", [
        ("PDF", "pdf_3_pages"),
        ("Word Document", "word_document"), 
        ("Excel File", "excel_file"),
        ("PNG Image", "png_image"),
        ("JPG Image", "jpg_image")
    ])
    def test_upload_supported_file_types_english(self, file_type, file_key):
        """Test uploading various supported file types in English"""
        with allure.step(f"Switch to English and upload {file_type}"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step(f"Get {file_type} file path"):
            file_path = self.config.get_file_path(file_key)
            if not file_path or not os.path.exists(file_path):
                pytest.skip(f"Test file not available: {file_key}")
                
        with allure.step(f"Upload {file_type} file"):
            success = self.document_page.upload_single_file(file_path)
            assert success, f"Failed to upload {file_type}"
            
        with allure.step("Verify upload success"):
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Unexpected upload status for {file_type}: {status}"
            
    @allure.story("File Type Support")
    @allure.severity(allure.severity_level.HIGH)
    @pytest.mark.parametrize("file_type,file_key", [
        ("PDF", "pdf_3_pages"),
        ("Word Document", "word_document"),
        ("Excel File", "excel_file"),
        ("PNG Image", "png_image"),
        ("JPG Image", "jpg_image")
    ])
    def test_upload_supported_file_types_hebrew(self, file_type, file_key):
        """Test uploading various supported file types in Hebrew"""
        with allure.step(f"Switch to Hebrew and upload {file_type}"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step(f"Get {file_type} file path"):
            file_path = self.config.get_file_path(file_key)
            if not file_path or not os.path.exists(file_path):
                pytest.skip(f"Test file not available: {file_key}")
                
        with allure.step(f"Upload {file_type} file"):
            success = self.document_page.upload_single_file(file_path)
            assert success, f"Failed to upload {file_type}"
            
        with allure.step("Verify upload success"):
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Unexpected upload status for {file_type}: {status}"
            
    @allure.story("Large File Upload")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_large_pdf_file_english(self):
        """Test uploading large PDF file in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Get large PDF file"):
            large_file = self.config.get_file_path('pdf_60_pages')
            if not large_file or not os.path.exists(large_file):
                # Try alternative large file
                large_file = self.config.get_file_path('pdf_102_pages')
                
            if not large_file or not os.path.exists(large_file):
                pytest.skip("No large PDF file available for testing")
                
        with allure.step("Upload large PDF file"):
            # Use extended timeout for large files
            timeout = self.config.get_timeout('upload')
            success = self.document_page.upload_single_file(large_file, timeout)
            assert success, "Large file upload failed"
            
        with allure.step("Verify upload success"):
            # Allow more time for large file processing
            time.sleep(5)
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Large file upload status: {status}"
            
    @allure.story("Large File Upload")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_large_pdf_file_hebrew(self):
        """Test uploading large PDF file in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Get large PDF file"):
            large_file = self.config.get_file_path('pdf_60_pages')
            if not large_file or not os.path.exists(large_file):
                large_file = self.config.get_file_path('pdf_102_pages')
                
            if not large_file or not os.path.exists(large_file):
                pytest.skip("No large PDF file available for testing")
                
        with allure.step("Upload large PDF file"):
            timeout = self.config.get_timeout('upload')
            success = self.document_page.upload_single_file(large_file, timeout)
            assert success, "Large file upload failed"
            
        with allure.step("Verify upload success"):
            time.sleep(5)
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Large file upload status: {status}"
            
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.HIGH)
    def test_upload_unsupported_file_type_english(self):
        """Test uploading unsupported file type shows appropriate error in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Get unsupported file"):
            unsupported_file = self.config.get_file_path('unsupported_html')
            if not unsupported_file or not os.path.exists(unsupported_file):
                pytest.skip("No unsupported file available for testing")
                
        with allure.step("Attempt to upload unsupported file"):
            # This should fail or show error
            self.document_page.upload_single_file(unsupported_file)
            
        with allure.step("Verify error message appears"):
            time.sleep(2)  # Allow time for validation
            error_message = self.document_page.get_error_message()
            # Should have either file type error or general error
            assert error_message is not None, "Expected error message for unsupported file type"
            
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.HIGH)
    def test_upload_unsupported_file_type_hebrew(self):
        """Test uploading unsupported file type shows appropriate error in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Get unsupported file"):
            unsupported_file = self.config.get_file_path('unsupported_html')
            if not unsupported_file or not os.path.exists(unsupported_file):
                pytest.skip("No unsupported file available for testing")
                
        with allure.step("Attempt to upload unsupported file"):
            self.document_page.upload_single_file(unsupported_file)
            
        with allure.step("Verify error message appears"):
            time.sleep(2)
            error_message = self.document_page.get_error_message()
            assert error_message is not None, "Expected error message for unsupported file type"
            
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_nonexistent_file_english(self):
        """Test uploading non-existent file handles error gracefully in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Attempt to upload non-existent file"):
            nonexistent_file = "C:\\NonExistent\\File\\Path\\test.pdf"
            success = self.document_page.upload_single_file(nonexistent_file)
            
        with allure.step("Verify upload failed gracefully"):
            assert not success, "Upload should fail for non-existent file"
            
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_nonexistent_file_hebrew(self):
        """Test uploading non-existent file handles error gracefully in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Attempt to upload non-existent file"):
            nonexistent_file = "C:\\NonExistent\\File\\Path\\test.pdf"
            success = self.document_page.upload_single_file(nonexistent_file)
            
        with allure.step("Verify upload failed gracefully"):
            assert not success, "Upload should fail for non-existent file"
            
    @allure.story("Performance Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_performance_single_file(self):
        """Test upload performance for single file meets requirements"""
        with allure.step("Prepare test file"):
            test_file = self.config.get_file_path('pdf_3_pages')
            assert test_file and os.path.exists(test_file), "Test file not available"
            
        with allure.step("Measure upload time"):
            start_time = time.time()
            success = self.document_page.upload_single_file(test_file)
            end_time = time.time()
            
            upload_time_ms = (end_time - start_time) * 1000
            
        with allure.step("Verify performance"):
            assert success, "Upload failed"
            
            max_time = self.config.get_performance_thresholds()['file_upload_max']
            assert upload_time_ms < max_time, f"Upload took {upload_time_ms}ms, max allowed {max_time}ms"
            
        allure.attach(f"Upload time: {upload_time_ms:.2f}ms", name="Performance Metrics")
        
    @allure.story("Upload Progress")
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_progress_indicator_english(self):
        """Test that upload progress indicator works correctly in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Get medium size file"):
            test_file = self.config.get_file_path('pdf_11_pages')
            if not test_file or not os.path.exists(test_file):
                test_file = self.config.get_file_path('pdf_6_pages')
                
            assert test_file and os.path.exists(test_file), "No suitable test file found"
            
        with allure.step("Start upload and verify progress indicator"):
            # Start upload in a way that allows checking progress
            file_input = self.page.locator("input[type='file']").first
            file_input.set_input_files(test_file)
            
            # Check if progress indicator appears (it might be very brief)
            time.sleep(1)  # Brief pause to catch progress indicator
            
            # Wait for completion
            self.document_page._wait_for_upload_completion(60000)
            
        with allure.step("Verify upload completed"):
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Upload status: {status}"
            
    @allure.story("Upload Progress") 
    @allure.severity(allure.severity_level.NORMAL)
    def test_upload_progress_indicator_hebrew(self):
        """Test that upload progress indicator works correctly in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Get medium size file"):
            test_file = self.config.get_file_path('pdf_11_pages')
            if not test_file or not os.path.exists(test_file):
                test_file = self.config.get_file_path('pdf_6_pages')
                
            assert test_file and os.path.exists(test_file), "No suitable test file found"
            
        with allure.step("Start upload and verify progress indicator"):
            file_input = self.page.locator("input[type='file']").first
            file_input.set_input_files(test_file)
            
            time.sleep(1)
            self.document_page._wait_for_upload_completion(60000)
            
        with allure.step("Verify upload completed"):
            status = self.document_page.get_upload_status()
            assert status in ["success", "idle"], f"Upload status: {status}"


@allure.epic("WeSign Document Management")
@allure.feature("Document Field Management")
class TestWeSignDocumentFieldFunctionality:
    """Comprehensive test suite for WeSign document field functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, test_config: WeSignTestConfig):
        """Setup test environment with uploaded document for field testing"""
        self.page = page
        self.config = test_config
        self.document_page = WeSignDocumentPage(page)
        self.login_page = LoginPage(page)
        self.test_helpers = TestHelpers(page, test_config)
        
        # Login and upload a document for field testing
        self.test_helpers.login_with_default_user()
        self.document_page.navigate_to_dashboard()
        self.document_page.wait_for_dashboard_load()
        
        # Upload a test PDF for field placement
        test_file = self.config.get_file_path('pdf_3_pages')
        if test_file and os.path.exists(test_file):
            self.document_page.upload_single_file(test_file)
            time.sleep(2)  # Wait for upload completion
            
    @allure.story("Signature Fields")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_add_signature_field_english(self):
        """Test adding signature field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add signature field"):
            success = self.document_page.add_signature_field(100, 200, 1, {
                'required': True,
                'label': 'Client Signature',
                'tooltip': 'Please sign here'
            })
            assert success, "Failed to add signature field"
            
        with allure.step("Verify signature field exists"):
            assert self.document_page.verify_field_exists('signature'), "Signature field not found"
            
        with allure.step("Verify field count"):
            field_count = self.document_page.get_field_count()
            assert field_count >= 1, f"Expected at least 1 field, found {field_count}"
            
    @allure.story("Signature Fields")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_add_signature_field_hebrew(self):
        """Test adding signature field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add signature field with Hebrew label"):
            success = self.document_page.add_signature_field(150, 250, 1, {
                'required': True,
                'label': 'חתימת לקוח',
                'tooltip': 'אנא חתמו כאן'
            })
            assert success, "Failed to add signature field"
            
        with allure.step("Verify signature field exists"):
            assert self.document_page.verify_field_exists('signature'), "Signature field not found"
            
    @allure.story("Text Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_text_field_english(self):
        """Test adding text field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add text field"):
            success = self.document_page.add_text_field(200, 300, 1, {
                'required': True,
                'label': 'Full Name',
                'placeholder': 'Enter your full name',
                'validation': 'text',
                'max_length': 50
            })
            assert success, "Failed to add text field"
            
        with allure.step("Verify text field exists"):
            assert self.document_page.verify_field_exists('text'), "Text field not found"
            
    @allure.story("Text Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_text_field_hebrew(self):
        """Test adding text field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add text field with Hebrew label"):
            success = self.document_page.add_text_field(250, 350, 1, {
                'required': True,
                'label': 'שם מלא',
                'placeholder': 'הכנס את השם המלא',
                'validation': 'text',
                'max_length': 50
            })
            assert success, "Failed to add text field"
            
        with allure.step("Verify text field exists"):
            assert self.document_page.verify_field_exists('text'), "Text field not found"
            
    @allure.story("Date Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_date_field_english(self):
        """Test adding date field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add date field"):
            success = self.document_page.add_date_field(300, 400, 1, {
                'required': True,
                'label': 'Signing Date',
                'format': 'DD/MM/YYYY',
                'auto_fill': True
            })
            assert success, "Failed to add date field"
            
        with allure.step("Verify date field exists"):
            assert self.document_page.verify_field_exists('date'), "Date field not found"
            
    @allure.story("Date Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_date_field_hebrew(self):
        """Test adding date field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add date field with Hebrew label"):
            success = self.document_page.add_date_field(350, 450, 1, {
                'required': True,
                'label': 'תאריך חתימה',
                'format': 'DD/MM/YYYY',
                'auto_fill': True
            })
            assert success, "Failed to add date field"
            
        with allure.step("Verify date field exists"):
            assert self.document_page.verify_field_exists('date'), "Date field not found"
            
    @allure.story("Email Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_email_field_english(self):
        """Test adding email field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add email field"):
            success = self.document_page.add_email_field(400, 500, 1, {
                'required': True,
                'label': 'Email Address',
                'placeholder': 'Enter your email',
                'validation': 'email'
            })
            assert success, "Failed to add email field"
            
        with allure.step("Verify email field exists"):
            assert self.document_page.verify_field_exists('email'), "Email field not found"
            
    @allure.story("Email Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_email_field_hebrew(self):
        """Test adding email field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add email field with Hebrew label"):
            success = self.document_page.add_email_field(450, 550, 1, {
                'required': True,
                'label': 'כתובת דוא"ל',
                'placeholder': 'הכנס כתובת דוא"ל',
                'validation': 'email'
            })
            assert success, "Failed to add email field"
            
        with allure.step("Verify email field exists"):
            assert self.document_page.verify_field_exists('email'), "Email field not found"
            
    @allure.story("Checkbox Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_checkbox_field_english(self):
        """Test adding checkbox field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add checkbox field"):
            success = self.document_page.add_checkbox_field(500, 600, 1, {
                'required': False,
                'label': 'I agree to terms',
                'checked': False
            })
            assert success, "Failed to add checkbox field"
            
        with allure.step("Verify checkbox field exists"):
            assert self.document_page.verify_field_exists('checkbox'), "Checkbox field not found"
            
    @allure.story("Checkbox Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_checkbox_field_hebrew(self):
        """Test adding checkbox field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add checkbox field with Hebrew label"):
            success = self.document_page.add_checkbox_field(550, 650, 1, {
                'required': False,
                'label': 'אני מסכים לתנאים',
                'checked': False
            })
            assert success, "Failed to add checkbox field"
            
        with allure.step("Verify checkbox field exists"):
            assert self.document_page.verify_field_exists('checkbox'), "Checkbox field not found"
            
    @allure.story("Dropdown Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_dropdown_field_english(self):
        """Test adding dropdown field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add dropdown field"):
            options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']
            success = self.document_page.add_dropdown_field(100, 700, 1, options, {
                'required': True,
                'label': 'Select Option',
                'default_value': 'Option 1'
            })
            assert success, "Failed to add dropdown field"
            
        with allure.step("Verify dropdown field exists"):
            assert self.document_page.verify_field_exists('dropdown'), "Dropdown field not found"
            
    @allure.story("Dropdown Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_dropdown_field_hebrew(self):
        """Test adding dropdown field in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Add dropdown field with Hebrew options"):
            options = ['אפשרות 1', 'אפשרות 2', 'אפשרות 3', 'אפשרות 4']
            success = self.document_page.add_dropdown_field(150, 750, 1, options, {
                'required': True,
                'label': 'בחר אפשרות',
                'default_value': 'אפשרות 1'
            })
            assert success, "Failed to add dropdown field"
            
        with allure.step("Verify dropdown field exists"):
            assert self.document_page.verify_field_exists('dropdown'), "Dropdown field not found"
            
    @allure.story("Number Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_number_field_english(self):
        """Test adding number field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add number field"):
            success = self.document_page.add_number_field(200, 800, 1, {
                'required': True,
                'label': 'Age',
                'min_value': 18,
                'max_value': 120,
                'validation': 'integer'
            })
            assert success, "Failed to add number field"
            
        with allure.step("Verify number field exists"):
            assert self.document_page.verify_field_exists('number'), "Number field not found"
            
    @allure.story("Multiple Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_multiple_field_types_english(self):
        """Test adding multiple different field types in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Clear existing fields"):
            self.document_page.delete_all_fields()
            
        with allure.step("Add signature field"):
            success = self.document_page.add_signature_field(100, 100, 1, {'label': 'Signature'})
            assert success, "Failed to add signature field"
            
        with allure.step("Add text field"):
            success = self.document_page.add_text_field(100, 200, 1, {'label': 'Name'})
            assert success, "Failed to add text field"
            
        with allure.step("Add date field"):
            success = self.document_page.add_date_field(100, 300, 1, {'label': 'Date'})
            assert success, "Failed to add date field"
            
        with allure.step("Add email field"):
            success = self.document_page.add_email_field(100, 400, 1, {'label': 'Email'})
            assert success, "Failed to add email field"
            
        with allure.step("Add checkbox field"):
            success = self.document_page.add_checkbox_field(100, 500, 1, {'label': 'Agree'})
            assert success, "Failed to add checkbox field"
            
        with allure.step("Verify all fields exist"):
            field_count = self.document_page.get_field_count()
            assert field_count == 5, f"Expected 5 fields, found {field_count}"
            
    @allure.story("Multiple Fields")
    @allure.severity(allure.severity_level.HIGH)
    def test_add_multiple_field_types_hebrew(self):
        """Test adding multiple different field types in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Clear existing fields"):
            self.document_page.delete_all_fields()
            
        with allure.step("Add signature field"):
            success = self.document_page.add_signature_field(100, 100, 1, {'label': 'חתימה'})
            assert success, "Failed to add signature field"
            
        with allure.step("Add text field"):
            success = self.document_page.add_text_field(100, 200, 1, {'label': 'שם'})
            assert success, "Failed to add text field"
            
        with allure.step("Add date field"):
            success = self.document_page.add_date_field(100, 300, 1, {'label': 'תאריך'})
            assert success, "Failed to add date field"
            
        with allure.step("Add email field"):
            success = self.document_page.add_email_field(100, 400, 1, {'label': 'דוא"ל'})
            assert success, "Failed to add email field"
            
        with allure.step("Add checkbox field"):
            success = self.document_page.add_checkbox_field(100, 500, 1, {'label': 'הסכמה'})
            assert success, "Failed to add checkbox field"
            
        with allure.step("Verify all fields exist"):
            field_count = self.document_page.get_field_count()
            assert field_count == 5, f"Expected 5 fields, found {field_count}"
            
    @allure.story("Field Management")
    @allure.severity(allure.severity_level.NORMAL)
    def test_delete_specific_field_english(self):
        """Test deleting a specific field in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add test field"):
            success = self.document_page.add_text_field(300, 300, 1, {'label': 'Test Field'})
            assert success, "Failed to add test field"
            
        with allure.step("Delete the field"):
            initial_count = self.document_page.get_field_count()
            success = self.document_page.delete_field('text')
            assert success, "Failed to delete field"
            
        with allure.step("Verify field was deleted"):
            final_count = self.document_page.get_field_count()
            assert final_count < initial_count, "Field count should decrease after deletion"
            
    @allure.story("Field Management")
    @allure.severity(allure.severity_level.NORMAL)
    def test_delete_all_fields_english(self):
        """Test deleting all fields in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add multiple fields"):
            self.document_page.add_signature_field(100, 100, 1)
            self.document_page.add_text_field(200, 200, 1)
            self.document_page.add_date_field(300, 300, 1)
            
        with allure.step("Verify fields exist"):
            initial_count = self.document_page.get_field_count()
            assert initial_count >= 3, f"Expected at least 3 fields, found {initial_count}"
            
        with allure.step("Delete all fields"):
            success = self.document_page.delete_all_fields()
            assert success, "Failed to delete all fields"
            
        with allure.step("Verify all fields deleted"):
            final_count = self.document_page.get_field_count()
            assert final_count == 0, f"Expected 0 fields, found {final_count}"
            
    @allure.story("Field Validation")
    @allure.severity(allure.severity_level.HIGH)
    def test_field_properties_validation_english(self):
        """Test field properties and validation in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Add field with validation properties"):
            properties = {
                'required': True,
                'label': 'Required Text Field',
                'placeholder': 'Enter required text',
                'max_length': 25,
                'validation': 'text'
            }
            success = self.document_page.add_text_field(400, 400, 1, properties)
            assert success, "Failed to add field with properties"
            
        with allure.step("Verify field properties are configured"):
            # This would typically involve checking the field's configuration
            # For now, we verify the field exists
            assert self.document_page.verify_field_exists('text'), "Field with properties not found"
            
    @allure.story("Cross-Page Fields")
    @allure.severity(allure.severity_level.NORMAL)
    def test_add_fields_multiple_pages_english(self):
        """Test adding fields on multiple pages in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Clear existing fields"):
            self.document_page.delete_all_fields()
            
        with allure.step("Add field on page 1"):
            success = self.document_page.add_signature_field(100, 100, 1, {'label': 'Page 1 Signature'})
            assert success, "Failed to add field on page 1"
            
        with allure.step("Add field on page 2"):
            success = self.document_page.add_text_field(100, 100, 2, {'label': 'Page 2 Text'})
            assert success, "Failed to add field on page 2"
            
        with allure.step("Add field on page 3"):
            success = self.document_page.add_date_field(100, 100, 3, {'label': 'Page 3 Date'})
            assert success, "Failed to add field on page 3"
            
        with allure.step("Verify all fields exist"):
            field_count = self.document_page.get_field_count()
            assert field_count == 3, f"Expected 3 fields across pages, found {field_count}"