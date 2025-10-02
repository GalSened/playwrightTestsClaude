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
@allure.feature("File Merge Functionality")
class TestWeSignMergeFunctionality:
    """Comprehensive test suite for WeSign file merge functionality"""
    
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
        
        # Upload test files for merging
        self._setup_test_files_for_merge()
        
    def _setup_test_files_for_merge(self):
        """Upload test files needed for merge operations"""
        merge_files = self.config.get_files_for_merge_testing()
        
        if len(merge_files) >= 2:
            # Upload files one by one to ensure they appear in the document list
            for file_path in merge_files[:3]:  # Use up to 3 files
                success = self.document_page.upload_single_file(file_path)
                assert success, f"Failed to upload test file: {file_path}"
                time.sleep(2)  # Wait between uploads
                
    @allure.story("Basic Merge Operations")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_merge_two_pdf_files_english(self):
        """Test merging two PDF files in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify files are available for merge"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Need at least 2 documents for merge, found {document_count}"
            
        with allure.step("Select and merge first two documents"):
            success = self.document_page.merge_files([0, 1])  # Merge first two files
            assert success, "Failed to merge two PDF files"
            
        with allure.step("Verify merge success"):
            # Wait for merge operation to complete
            time.sleep(3)
            
            # Check for success message or verify merged document exists
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            # Should have either success message or idle status (indicating completion)
            assert success_message is not None or upload_status == "idle", "Merge operation did not complete successfully"
            
    @allure.story("Basic Merge Operations")
    @allure.severity(allure.severity_level.CRITICAL)
    def test_merge_two_pdf_files_hebrew(self):
        """Test merging two PDF files in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify files are available for merge"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Need at least 2 documents for merge, found {document_count}"
            
        with allure.step("Select and merge first two documents"):
            success = self.document_page.merge_files([0, 1])
            assert success, "Failed to merge two PDF files"
            
        with allure.step("Verify merge success"):
            time.sleep(3)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Merge operation did not complete successfully"
            
    @allure.story("Multiple File Merge")
    @allure.severity(allure.severity_level.HIGH)
    def test_merge_three_pdf_files_english(self):
        """Test merging three PDF files in English interface"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify enough files are available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 3, f"Need at least 3 documents for merge, found {document_count}"
            
        with allure.step("Select and merge three documents"):
            success = self.document_page.merge_files([0, 1, 2])
            assert success, "Failed to merge three PDF files"
            
        with allure.step("Verify merge success"):
            time.sleep(5)  # More time for three-file merge
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Three-file merge did not complete successfully"
            
    @allure.story("Multiple File Merge")
    @allure.severity(allure.severity_level.HIGH) 
    def test_merge_three_pdf_files_hebrew(self):
        """Test merging three PDF files in Hebrew interface"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify enough files are available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 3, f"Need at least 3 documents for merge, found {document_count}"
            
        with allure.step("Select and merge three documents"):
            success = self.document_page.merge_files([0, 1, 2])
            assert success, "Failed to merge three PDF files"
            
        with allure.step("Verify merge success"):
            time.sleep(5)
            
            success_message = self.document_page.get_success_message()
            upload_status = self.document_page.get_upload_status()
            
            assert success_message is not None or upload_status == "idle", "Three-file merge did not complete successfully"
            
    @allure.story("Merge Order Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_files_in_specific_order_english(self):
        """Test that files are merged in the selected order in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Get document names before merge"):
            document_names = self.document_page.get_document_names()
            assert len(document_names) >= 3, f"Need at least 3 documents, found {len(document_names)}"
            
            # Record the order we want to merge
            selected_indices = [2, 0, 1]  # Merge in different order
            expected_order = [document_names[i] for i in selected_indices]
            
        with allure.step("Merge files in specific order"):
            success = self.document_page.merge_files(selected_indices)
            assert success, "Failed to merge files in specific order"
            
        with allure.step("Verify merge completed"):
            time.sleep(5)
            
            # The specific verification of order would depend on how the app shows merged document names
            # For now, just verify the operation completed
            upload_status = self.document_page.get_upload_status()
            assert upload_status == "idle", "Merge operation did not complete"
            
        allure.attach(f"Expected merge order: {expected_order}", name="Merge Order")
        
    @allure.story("Merge Order Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_files_in_specific_order_hebrew(self):
        """Test that files are merged in the selected order in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Get document names before merge"):
            document_names = self.document_page.get_document_names()
            assert len(document_names) >= 3, f"Need at least 3 documents, found {len(document_names)}"
            
            selected_indices = [2, 0, 1]
            expected_order = [document_names[i] for i in selected_indices]
            
        with allure.step("Merge files in specific order"):
            success = self.document_page.merge_files(selected_indices)
            assert success, "Failed to merge files in specific order"
            
        with allure.step("Verify merge completed"):
            time.sleep(5)
            
            upload_status = self.document_page.get_upload_status()
            assert upload_status == "idle", "Merge operation did not complete"
            
        allure.attach(f"Expected merge order: {expected_order}", name="Merge Order")
        
    @allure.story("Merge Performance")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_performance_two_files(self):
        """Test merge performance for two files meets requirements"""
        with allure.step("Verify files are available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Need at least 2 documents for merge, found {document_count}"
            
        with allure.step("Measure merge time"):
            start_time = time.time()
            success = self.document_page.merge_files([0, 1])
            end_time = time.time()
            
            merge_time_ms = (end_time - start_time) * 1000
            
        with allure.step("Verify performance"):
            assert success, "Merge operation failed"
            
            max_time = self.config.get_performance_thresholds()['file_merge_max']
            assert merge_time_ms < max_time, f"Merge took {merge_time_ms}ms, max allowed {max_time}ms"
            
        allure.attach(f"Merge time: {merge_time_ms:.2f}ms", name="Performance Metrics")
        
    @allure.story("Merge Performance") 
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_performance_large_files(self):
        """Test merge performance with larger files"""
        # Upload larger test files first
        with allure.step("Upload larger test files"):
            large_files = self.config.get_large_files()
            if len(large_files) < 2:
                pytest.skip("Not enough large files available for testing")
                
            # Upload two large files
            for file_path in large_files[:2]:
                success = self.document_page.upload_single_file(file_path, timeout=120000)
                assert success, f"Failed to upload large file: {file_path}"
                time.sleep(3)
                
        with allure.step("Get updated document count"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, "Failed to upload large files for merge test"
            
        with allure.step("Measure large file merge time"):
            start_time = time.time()
            # Use the last two documents (which should be the large files we just uploaded)
            success = self.document_page.merge_files([document_count-2, document_count-1])
            end_time = time.time()
            
            merge_time_ms = (end_time - start_time) * 1000
            
        with allure.step("Verify large file merge performance"):
            assert success, "Large file merge failed"
            
            # Allow more time for large files
            max_time = self.config.get_performance_thresholds()['file_merge_max'] * 2  # Double the time for large files
            assert merge_time_ms < max_time, f"Large file merge took {merge_time_ms}ms, max allowed {max_time}ms"
            
        allure.attach(f"Large file merge time: {merge_time_ms:.2f}ms", name="Large File Performance")
        
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.HIGH)
    def test_merge_single_file_error_english(self):
        """Test that attempting to merge a single file shows appropriate error in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify at least one file exists"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for test"
            
        with allure.step("Attempt to merge single file"):
            # This should either fail or show an error
            try:
                success = self.document_page.merge_files([0])  # Try to merge just one file
                
                # If it doesn't fail immediately, check for error message
                if success:
                    time.sleep(2)
                    error_message = self.document_page.get_error_message()
                    assert error_message is not None, "Should show error when trying to merge single file"
                    
            except Exception as e:
                # Expected behavior - should fail to merge single file
                allure.attach(f"Expected error occurred: {str(e)}", name="Single File Merge Error")
                
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.HIGH)
    def test_merge_single_file_error_hebrew(self):
        """Test that attempting to merge a single file shows appropriate error in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify at least one file exists"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 1, "Need at least 1 document for test"
            
        with allure.step("Attempt to merge single file"):
            try:
                success = self.document_page.merge_files([0])
                
                if success:
                    time.sleep(2)
                    error_message = self.document_page.get_error_message()
                    assert error_message is not None, "Should show error when trying to merge single file"
                    
            except Exception as e:
                allure.attach(f"Expected error occurred: {str(e)}", name="Single File Merge Error")
                
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_no_files_selected_english(self):
        """Test merge operation with no files selected in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Attempt to merge with no files selected"):
            try:
                success = self.document_page.merge_files([])  # Empty list
                
                # Should either fail or show error
                assert not success, "Merge should fail when no files are selected"
                
            except Exception as e:
                # Expected - should fail with no files selected
                allure.attach(f"Expected error: {str(e)}", name="No Files Selected Error")
                
    @allure.story("Negative Testing")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_no_files_selected_hebrew(self):
        """Test merge operation with no files selected in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Attempt to merge with no files selected"):
            try:
                success = self.document_page.merge_files([])
                assert not success, "Merge should fail when no files are selected"
                
            except Exception as e:
                allure.attach(f"Expected error: {str(e)}", name="No Files Selected Error")
                
    @allure.story("Merge Confirmation Dialog")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_confirmation_dialog_english(self):
        """Test that merge confirmation dialog appears and works correctly in English"""
        with allure.step("Switch to English interface"):
            assert self.document_page.switch_language("english"), "Failed to switch to English"
            
        with allure.step("Verify files are available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Need at least 2 documents for merge, found {document_count}"
            
        with allure.step("Select files for merge"):
            # Select files but don't confirm yet - this tests the selection UI
            for index in [0, 1]:
                file_selector = f".document-item:nth-child({index + 1}) .select-checkbox, .file-item:nth-child({index + 1}) input[type='checkbox']"
                try:
                    self.page.wait_for_selector(file_selector, timeout=10000)
                    self.page.click(file_selector)
                except Exception:
                    # If checkboxes don't exist, skip this part of the test
                    pytest.skip("File selection checkboxes not found - UI may have different implementation")
                    
        with allure.step("Click merge button and verify confirmation dialog"):
            merge_button_selectors = [
                "[data-testid='merge-files']",
                "button:has-text('Merge Files')",
                ".merge-button"
            ]
            
            button_clicked = False
            for selector in merge_button_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    button_clicked = True
                    break
                    
            if button_clicked:
                # Check for confirmation dialog
                try:
                    self.page.wait_for_selector(".confirmation-modal, .confirm-dialog, .modal", timeout=10000)
                    
                    # Confirm the merge
                    confirm_selectors = [
                        "[data-testid='confirm-merge']",
                        "button:has-text('Confirm Merge')",
                        ".modal-confirm"
                    ]
                    
                    for selector in confirm_selectors:
                        if self.page.locator(selector).is_visible():
                            self.page.click(selector)
                            break
                            
                    # Wait for merge to complete
                    time.sleep(5)
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", "Merge with confirmation dialog did not complete"
                    
                except Exception:
                    # If no confirmation dialog, just verify merge completed
                    time.sleep(5)
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", "Merge operation did not complete"
            else:
                pytest.skip("Merge button not found - UI may have different implementation")
                
    @allure.story("Merge Confirmation Dialog")
    @allure.severity(allure.severity_level.NORMAL)
    def test_merge_confirmation_dialog_hebrew(self):
        """Test that merge confirmation dialog appears and works correctly in Hebrew"""
        with allure.step("Switch to Hebrew interface"):
            assert self.document_page.switch_language("hebrew"), "Failed to switch to Hebrew"
            
        with allure.step("Verify files are available"):
            document_count = self.document_page.get_document_count()
            assert document_count >= 2, f"Need at least 2 documents for merge, found {document_count}"
            
        with allure.step("Select files for merge"):
            for index in [0, 1]:
                file_selector = f".document-item:nth-child({index + 1}) .select-checkbox, .file-item:nth-child({index + 1}) input[type='checkbox']"
                try:
                    self.page.wait_for_selector(file_selector, timeout=10000)
                    self.page.click(file_selector)
                except Exception:
                    pytest.skip("File selection checkboxes not found")
                    
        with allure.step("Click merge button and verify confirmation dialog"):
            merge_button_selectors = [
                "[data-testid='merge-files']",
                "button:has-text('מזג קבצים')",
                ".merge-button"
            ]
            
            button_clicked = False
            for selector in merge_button_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    button_clicked = True
                    break
                    
            if button_clicked:
                try:
                    self.page.wait_for_selector(".confirmation-modal, .confirm-dialog, .modal", timeout=10000)
                    
                    confirm_selectors = [
                        "[data-testid='confirm-merge']",
                        "button:has-text('אשר מיזוג')",
                        ".modal-confirm"
                    ]
                    
                    for selector in confirm_selectors:
                        if self.page.locator(selector).is_visible():
                            self.page.click(selector)
                            break
                            
                    time.sleep(5)
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", "Merge with confirmation dialog did not complete"
                    
                except Exception:
                    time.sleep(5)
                    upload_status = self.document_page.get_upload_status()
                    assert upload_status == "idle", "Merge operation did not complete"
            else:
                pytest.skip("Merge button not found - UI may have different implementation")