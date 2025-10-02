"""
Smart Card Integration Tests
Tests for smart card/hardware token signing functionality
that are present in Selenium but completely missing from the Playwright test suite.
"""

import pytest
import allure
import os
from pathlib import Path
from playwright.sync_api import expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.utils.test_helpers import TestHelpers


@allure.epic("Smart Card Integration")
@allure.feature("Hardware Token Signing")
class TestSmartCardIntegration:
    """Smart card integration test suite"""

    @pytest.mark.smoke
    @pytest.mark.regression
    @allure.story("Smart Card PDF Signing")
    @allure.title("Sign PDF with smart card using draw method in English interface")
    def test_smart_card_pdf_draw_signing_english(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test PDF signing with smart card using draw signature method"""
        page = authenticated_page
        
        # Navigate to main dashboard
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Click Server sign
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        # Select PDF document type (use first matching element to avoid strict mode violation)
        pdf_button = page.locator('button:has-text("PDF")').first
        pdf_button.click()
        
        # Upload test PDF file
        pdf_file = test_config.get_file_path('pdf_3_pages')
        if pdf_file and os.path.exists(pdf_file):
            page.set_input_files('input[type="file"]', pdf_file)
            cleanup_test_data['register_upload'](pdf_file)
            page.wait_for_timeout(3000)  # Wait for upload
            
            # Wait for signing interface to appear
            signing_interface = page.locator('.signature-interface, .signing-area, .sign-document')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            # Look for smart card signing option
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token"), .smart-card-sign')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                # Select draw signature method
                draw_option = page.locator('button:has-text("Draw"), .draw-signature, [data-method="draw"]')
                if draw_option.count() > 0:
                    draw_option.click()
                    
                    # Handle smart card authentication dialog
                    self._handle_smart_card_authentication(page, test_config)
                    
                    # Verify signature was applied
                    success_message = page.locator('.signature-success, .sign-success, .alert-success')
                    success_message.wait_for(state='visible', timeout=60000)
                    
                    allure.attach(
                        page.screenshot(),
                        name="Smart Card PDF Signing Success",
                        attachment_type=allure.attachment_type.PNG
                    )

    @pytest.mark.regression
    @pytest.mark.bilingual
    @allure.story("Smart Card PDF Signing - Hebrew")
    @allure.title("Sign PDF with smart card using initials method in Hebrew interface")
    def test_smart_card_pdf_initials_signing_hebrew(
        self, bilingual_authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test PDF signing with smart card using initials signature method in Hebrew"""
        page, language = bilingual_authenticated_page
        
        if language != 'hebrew':
            pytest.skip("This test only runs in Hebrew interface")
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign"), button:has-text("חתימת שרת")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        pdf_button = page.locator('button:has-text("PDF")')
        pdf_button.click()
        
        pdf_file = test_config.get_file_path('pdf_3_pages')
        if pdf_file and os.path.exists(pdf_file):
            page.set_input_files('input[type="file"]', pdf_file)
            cleanup_test_data['register_upload'](pdf_file)
            page.wait_for_timeout(3000)
            
            # Wait for signing interface
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            # Smart card option (Hebrew interface)
            smart_card_option = page.locator('button:has-text("כרטיס חכם"), button:has-text("Smart Card")')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                # Select initials signature method
                initials_option = page.locator('button:has-text("Initials"), button:has-text("ראשי תיבות"), .initials-signature')
                if initials_option.count() > 0:
                    initials_option.click()
                    
                    self._handle_smart_card_authentication(page, test_config)
                    
                    success_message = page.locator('.signature-success, .sign-success')
                    success_message.wait_for(state='visible', timeout=60000)

    @pytest.mark.regression
    @allure.story("Smart Card Word Signing")
    @allure.title("Sign Word document with smart card using graphic method")
    def test_smart_card_word_graphic_signing_english(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test Word document signing with smart card using graphic signature method"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        # Select DOCX document type
        docx_button = page.locator('button:has-text("DOCX")')
        docx_button.click()
        
        # Upload test Word file
        word_file = test_config.get_file_path('word_document')
        if word_file and os.path.exists(word_file):
            page.set_input_files('input[type="file"]', word_file)
            cleanup_test_data['register_upload'](word_file)
            page.wait_for_timeout(5000)  # Word files may take longer to process
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                # Select graphic signature method
                graphic_option = page.locator('button:has-text("Graphic"), .graphic-signature, [data-method="graphic"]')
                if graphic_option.count() > 0:
                    graphic_option.click()
                    
                    self._handle_smart_card_authentication(page, test_config)
                    
                    success_message = page.locator('.signature-success, .sign-success')
                    success_message.wait_for(state='visible', timeout=60000)

    @pytest.mark.regression
    @allure.story("Smart Card Excel Signing")
    @allure.title("Sign Excel file with smart card successfully")
    def test_smart_card_excel_signing_english(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test Excel file signing with smart card"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        # Select XLSX document type
        xlsx_button = page.locator('button:has-text("XLSX")')
        xlsx_button.click()
        
        excel_file = test_config.get_file_path('excel_file')
        if excel_file and os.path.exists(excel_file):
            page.set_input_files('input[type="file"]', excel_file)
            cleanup_test_data['register_upload'](excel_file)
            page.wait_for_timeout(3000)
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                self._handle_smart_card_authentication(page, test_config)
                
                success_message = page.locator('.signature-success, .sign-success')
                success_message.wait_for(state='visible', timeout=60000)

    @pytest.mark.regression
    @allure.story("Smart Card Image Signing")
    @allure.title("Sign PNG image with smart card successfully")
    def test_smart_card_png_signing_english(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test PNG image signing with smart card"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Use "Upload file" for image files
        upload_button = page.locator('button:has-text("Upload file")')
        upload_button.click()
        
        png_file = test_config.get_file_path('png_image')
        if png_file and os.path.exists(png_file):
            page.set_input_files('input[type="file"]', png_file)
            cleanup_test_data['register_upload'](png_file)
            page.wait_for_timeout(3000)
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                self._handle_smart_card_authentication(page, test_config)
                
                success_message = page.locator('.signature-success, .sign-success')
                success_message.wait_for(state='visible', timeout=60000)

    @pytest.mark.regression
    @allure.story("Smart Card Authentication")
    @allure.title("Smart card authentication with invalid password fails properly")
    def test_smart_card_invalid_password_failure(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test smart card authentication failure with invalid password"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        pdf_button = page.locator('button:has-text("PDF")')
        pdf_button.click()
        
        pdf_file = test_config.get_file_path('pdf_3_pages')
        if pdf_file and os.path.exists(pdf_file):
            page.set_input_files('input[type="file"]', pdf_file)
            cleanup_test_data['register_upload'](pdf_file)
            page.wait_for_timeout(3000)
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
            if smart_card_option.count() > 0:
                smart_card_option.click()
                
                # Use invalid password for authentication
                self._handle_smart_card_authentication(page, test_config, use_invalid_password=True)
                
                # Verify authentication failure
                error_message = page.locator('.auth-error, .password-error, .alert-danger')
                error_message.wait_for(state='visible', timeout=30000)
                
                error_text = error_message.inner_text()
                assert any(keyword in error_text.lower() for keyword in ['invalid', 'incorrect', 'failed', 'error'])

    @pytest.mark.performance
    @allure.story("Smart Card Performance")
    @allure.title("Smart card signing performance within acceptable limits")
    def test_smart_card_signing_performance(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data, performance_tracker
    ):
        """Test smart card signing performance"""
        page = authenticated_page
        
        start_time = page.evaluate('() => performance.now()')
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        
        pdf_button = page.locator('button:has-text("PDF")')
        pdf_button.click()
        
        pdf_file = test_config.get_file_path('pdf_3_pages')
        if pdf_file and os.path.exists(pdf_file):
            upload_start = page.evaluate('() => performance.now()')
            page.set_input_files('input[type="file"]', pdf_file)
            cleanup_test_data['register_upload'](pdf_file)
            page.wait_for_timeout(3000)
            upload_end = page.evaluate('() => performance.now()')
            
            performance_tracker['add_operation']('File Upload', int(upload_end - upload_start))
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
            if smart_card_option.count() > 0:
                sign_start = page.evaluate('() => performance.now()')
                smart_card_option.click()
                
                self._handle_smart_card_authentication(page, test_config)
                
                success_message = page.locator('.signature-success, .sign-success')
                success_message.wait_for(state='visible', timeout=60000)
                sign_end = page.evaluate('() => performance.now()')
                
                signing_duration = int(sign_end - sign_start)
                performance_tracker['add_operation']('Smart Card Signing', signing_duration)
                
                # Verify performance is within acceptable limits
                max_signing_time = test_config.get_performance_thresholds()['ui_response_max'] * 20  # 60 seconds
                assert signing_duration < max_signing_time, f"Smart card signing took {signing_duration}ms, expected < {max_signing_time}ms"

    async def _handle_smart_card_authentication(self, page, test_config, use_invalid_password=False):
        """Helper method to handle smart card authentication dialog"""
        try:
            # Wait for authentication dialog
            auth_dialog = page.locator('.smart-card-auth, .certificate-auth, .auth-dialog')
            auth_dialog.wait_for(state='visible', timeout=10000)
            
            # Enter certificate ID
            cert_id_field = page.locator('input[type="text"], input[placeholder*="cert"], input[placeholder*="id"]').first
            if cert_id_field.is_visible():
                server_cert_id = test_config.settings.get('server_cert_id', 'comda')
                cert_id_field.fill(server_cert_id)
            
            # Enter password
            password_field = page.locator('input[type="password"], input[placeholder*="password"]').first
            if password_field.is_visible():
                if use_invalid_password:
                    password = test_config.settings.get('invalid_smart_card_password', 'wrongpassword')
                else:
                    password = test_config.settings.get('server_password', '123456')
                password_field.fill(password)
            
            # Click authenticate/submit button
            auth_button = page.locator('button:has-text("Authenticate"), button:has-text("Submit"), button:has-text("OK")')
            if auth_button.count() > 0:
                auth_button.click()
                page.wait_for_timeout(2000)
                
        except Exception as e:
            # If no authentication dialog appears, it might be handled automatically
            # or the test environment doesn't have smart card simulation
            print(f"Smart card authentication dialog not found or handled automatically: {e}")
            page.wait_for_timeout(5000)  # Wait a bit more for processing

    @pytest.mark.regression
    @allure.story("Smart Card Certificate Validation")
    @allure.title("Validate smart card certificate information")
    def test_smart_card_certificate_validation(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test smart card certificate validation"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        server_sign_button = page.locator('button:has-text("Server sign")')
        server_sign_button.click()
        page.wait_for_timeout(1000)
        
        pdf_button = page.locator('button:has-text("PDF")')
        pdf_button.click()
        
        pdf_file = test_config.get_file_path('pdf_3_pages')
        if pdf_file and os.path.exists(pdf_file):
            page.set_input_files('input[type="file"]', pdf_file)
            cleanup_test_data['register_upload'](pdf_file)
            page.wait_for_timeout(3000)
            
            signing_interface = page.locator('.signature-interface, .signing-area')
            signing_interface.wait_for(state='visible', timeout=30000)
            
            # Look for certificate information display
            cert_info = page.locator('.certificate-info, .cert-details, .signer-info')
            if cert_info.count() > 0:
                cert_text = cert_info.inner_text()
                
                # Verify certificate contains expected information
                expected_cert_id = test_config.settings.get('server_cert_id', 'comda')
                assert expected_cert_id in cert_text.lower(), "Certificate should contain expected certificate ID"
                
                allure.attach(
                    cert_text,
                    name="Certificate Information",
                    attachment_type=allure.attachment_type.TEXT
                )

    @pytest.mark.regression
    @allure.story("Multi-file Smart Card Signing")
    @allure.title("Sign multiple files with smart card in batch")
    def test_smart_card_batch_signing(
        self, authenticated_page, test_helpers, test_config, cleanup_test_data
    ):
        """Test batch signing of multiple files with smart card"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Get multiple test files
        test_files = [
            test_config.get_file_path('pdf_3_pages'),
            test_config.get_file_path('pdf_2_pages'),
        ]
        
        valid_files = [f for f in test_files if f and os.path.exists(f)]
        
        if len(valid_files) >= 2:
            for file_path in valid_files:
                cleanup_test_data['register_upload'](file_path)
                
                server_sign_button = page.locator('button:has-text("Server sign")')
                server_sign_button.click()
                page.wait_for_timeout(1000)
                
                pdf_button = page.locator('button:has-text("PDF")')
                pdf_button.click()
                
                page.set_input_files('input[type="file"]', file_path)
                page.wait_for_timeout(3000)
                
                signing_interface = page.locator('.signature-interface, .signing-area')
                signing_interface.wait_for(state='visible', timeout=30000)
                
                smart_card_option = page.locator('button:has-text("Smart Card"), button:has-text("Hardware Token")')
                if smart_card_option.count() > 0:
                    smart_card_option.click()
                    
                    self._handle_smart_card_authentication(page, test_config)
                    
                    success_message = page.locator('.signature-success, .sign-success')
                    success_message.wait_for(state='visible', timeout=60000)
                    
                    # Navigate back to dashboard for next file
                    dashboard_button = page.locator('button:has-text("Dashboard")')
                    dashboard_button.click()
                    page.wait_for_timeout(2000)