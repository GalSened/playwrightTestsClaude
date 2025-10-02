from playwright.sync_api import Page, Locator, expect
from .base_page import BasePage
from typing import List, Optional
import time
import json
import os


class WeSignDocumentPage(BasePage):
    """Page Object Model for WeSign Document Management functionality"""
    
    def __init__(self, page: Page):
        super().__init__(page)
        self.page_url = f"{self.base_url}/dashboard/main"
        
        # Upload section selectors
        self.upload_file_button = page.locator("[data-testid='upload-file-button'], input[type='file'], .upload-button, button:has-text('העלה קובץ'), button:has-text('Upload File')")
        self.upload_area = page.locator(".upload-area, .file-upload-zone, .dropzone, .upload-section")
        self.file_input = page.locator("input[type='file']")
        self.upload_progress = page.locator(".upload-progress, .progress-bar, .uploading")
        
        # Merge files section selectors
        self.merge_files_button = page.locator("[data-testid='merge-files'], button:has-text('מזג קבצים'), button:has-text('Merge Files'), .merge-button")
        self.selected_files_list = page.locator(".selected-files, .file-list, .merge-file-list")
        self.merge_confirm_button = page.locator("[data-testid='confirm-merge'], button:has-text('אשר מיזוג'), button:has-text('Confirm Merge')")
        
        # Assign and send section selectors
        self.assign_send_button = page.locator("[data-testid='assign-send'], button:has-text('הקצה ושלח'), button:has-text('Assign and Send')")
        self.recipient_email_input = page.locator("[data-testid='recipient-email'], input[name='email'], input[placeholder*='email'], input[placeholder*='מייל']")
        self.recipient_name_input = page.locator("[data-testid='recipient-name'], input[name='name'], input[placeholder*='name'], input[placeholder*='שם']")
        self.add_recipient_button = page.locator("[data-testid='add-recipient'], button:has-text('הוסף נמען'), button:has-text('Add Recipient')")
        self.send_document_button = page.locator("[data-testid='send-document'], button:has-text('שלח מסמך'), button:has-text('Send Document')")
        
        # Document list and management
        self.document_list = page.locator(".document-list, .documents-grid, .file-grid")
        self.document_item = page.locator(".document-item, .file-item, .document-card")
        self.document_name = page.locator(".document-name, .file-name, .document-title")
        
        # Status and feedback elements
        self.success_message = page.locator(".success-message, .alert-success, .notification-success, .toast-success")
        self.error_message = page.locator(".error-message, .alert-error, .notification-error, .toast-error")
        self.loading_spinner = page.locator(".loading, .spinner, .loader, .uploading-indicator")
        
        # Language toggle
        self.language_toggle = page.locator("[data-testid='language-toggle'], .language-selector, .lang-switch")
        
        # Navigation elements
        self.dashboard_nav = page.locator("[data-testid='dashboard'], a[href*='dashboard'], .nav-dashboard")
        self.documents_nav = page.locator("[data-testid='documents'], a[href*='documents'], .nav-documents")
        
        # File type validation
        self.file_type_error = page.locator(".file-type-error, .invalid-file-type, .unsupported-file")
        self.file_size_error = page.locator(".file-size-error, .file-too-large, .size-limit-exceeded")
        
        # Modals and dialogs
        self.confirmation_modal = page.locator(".confirmation-modal, .confirm-dialog, .modal")
        self.modal_confirm_button = page.locator(".modal-confirm, .confirm-button, button:has-text('אשר'), button:has-text('Confirm')")
        self.modal_cancel_button = page.locator(".modal-cancel, .cancel-button, button:has-text('בטל'), button:has-text('Cancel')")
        
        # Document field selectors - comprehensive field support
        self.field_panel = page.locator(".field-panel, .fields-sidebar, .document-fields, .field-toolbox")
        self.field_toolbox = page.locator(".field-toolbox, .fields-toolbar, .signature-tools")
        
        # Signature fields
        self.signature_field_button = page.locator("[data-field-type='signature'], .signature-field, button:has-text('חתימה'), button:has-text('Signature')")
        self.initial_field_button = page.locator("[data-field-type='initial'], .initial-field, button:has-text('ראשי תיבות'), button:has-text('Initial')")
        self.date_field_button = page.locator("[data-field-type='date'], .date-field, button:has-text('תאריך'), button:has-text('Date')")
        
        # Text fields
        self.text_field_button = page.locator("[data-field-type='text'], .text-field, button:has-text('טקסט'), button:has-text('Text')")
        self.name_field_button = page.locator("[data-field-type='name'], .name-field, button:has-text('שם'), button:has-text('Name')")
        self.email_field_button = page.locator("[data-field-type='email'], .email-field, button:has-text('אימייל'), button:has-text('Email')")
        self.company_field_button = page.locator("[data-field-type='company'], .company-field, button:has-text('חברה'), button:has-text('Company')")
        self.title_field_button = page.locator("[data-field-type='title'], .title-field, button:has-text('תפקיד'), button:has-text('Title')")
        
        # Numeric fields
        self.number_field_button = page.locator("[data-field-type='number'], .number-field, button:has-text('מספר'), button:has-text('Number')")
        self.phone_field_button = page.locator("[data-field-type='phone'], .phone-field, button:has-text('טלפון'), button:has-text('Phone')")
        self.id_number_field_button = page.locator("[data-field-type='id'], .id-field, button:has-text('ת.ז'), button:has-text('ID Number')")
        
        # Selection fields
        self.checkbox_field_button = page.locator("[data-field-type='checkbox'], .checkbox-field, button:has-text('תיבת סימון'), button:has-text('Checkbox')")
        self.radio_field_button = page.locator("[data-field-type='radio'], .radio-field, button:has-text('בחירה'), button:has-text('Radio')")
        self.dropdown_field_button = page.locator("[data-field-type='dropdown'], .dropdown-field, button:has-text('רשימה'), button:has-text('Dropdown')")
        
        # Special fields
        self.attachment_field_button = page.locator("[data-field-type='attachment'], .attachment-field, button:has-text('קובץ מצורף'), button:has-text('Attachment')")
        self.seal_field_button = page.locator("[data-field-type='seal'], .seal-field, button:has-text('חותמת'), button:has-text('Seal')")
        self.photo_field_button = page.locator("[data-field-type='photo'], .photo-field, button:has-text('תמונה'), button:has-text('Photo')")
        
        # Field placement and editing
        self.document_canvas = page.locator(".document-canvas, .pdf-viewer, .document-viewer, .page-container")
        self.placed_field = page.locator(".placed-field, .document-field, .field-element")
        self.field_properties_panel = page.locator(".field-properties, .field-settings, .property-panel")
        
        # Field property inputs
        self.field_label_input = page.locator("input[name='label'], input[placeholder*='label'], input[placeholder*='תווית']")
        self.field_placeholder_input = page.locator("input[name='placeholder'], input[placeholder*='placeholder'], input[placeholder*='מקום מסמן']")
        self.field_required_checkbox = page.locator("input[name='required'], input[type='checkbox'][id*='required']")
        self.field_width_input = page.locator("input[name='width'], input[placeholder*='width'], input[placeholder*='רוחב']")
        self.field_height_input = page.locator("input[name='height'], input[placeholder*='height'], input[placeholder*='גובה']")
        
        # Field validation settings
        self.field_min_length_input = page.locator("input[name='minLength'], input[placeholder*='min'], input[placeholder*='מינימום']")
        self.field_max_length_input = page.locator("input[name='maxLength'], input[placeholder*='max'], input[placeholder*='מקסימום']")
        self.field_pattern_input = page.locator("input[name='pattern'], input[placeholder*='pattern'], input[placeholder*='תבנית']")
        
        # Multi-option field settings (dropdown, radio)
        self.field_options_input = page.locator("textarea[name='options'], .field-options, .option-list")
        self.add_option_button = page.locator(".add-option, button:has-text('הוסף אפשרות'), button:has-text('Add Option')")
        self.option_input = page.locator(".option-input, input[name*='option']")
        
        # Field assignment
        self.assign_field_dropdown = page.locator(".assign-to-signer, .field-assignee, select[name='assignee']")
        self.signer_option = page.locator("option[value*='signer'], .signer-option")
        
        # Field actions
        self.save_field_button = page.locator(".save-field, button:has-text('שמור שדה'), button:has-text('Save Field')")
        self.delete_field_button = page.locator(".delete-field, button:has-text('מחק שדה'), button:has-text('Delete Field')")
        self.duplicate_field_button = page.locator(".duplicate-field, button:has-text('שכפל שדה'), button:has-text('Duplicate Field')")
        
        # Field validation messages
        self.field_validation_error = page.locator(".field-error, .validation-error, .field-invalid")
        self.required_field_error = page.locator(".required-field-error, .field-required-error")
        
    def navigate_to_dashboard(self) -> None:
        """Navigate to WeSign dashboard"""
        self.navigate_to(self.page_url)
        self.wait_for_page_load()
        
    def wait_for_dashboard_load(self) -> None:
        """Wait for dashboard to load completely"""
        # Wait for main elements to be visible
        self.page.wait_for_load_state("networkidle")
        # Wait for either upload button or document area to be visible
        self.page.wait_for_selector("input[type='file'], .upload-button, .document-area", timeout=self.timeout)
        
    def upload_single_file(self, file_path: str, timeout: int = 60000) -> bool:
        """
        Upload a single file to WeSign
        
        Args:
            file_path: Path to the file to upload
            timeout: Maximum wait time in milliseconds
            
        Returns:
            bool: True if upload successful, False otherwise
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
                
            # Wait for upload area to be ready
            self.page.wait_for_selector("input[type='file']", timeout=timeout)
            
            # Find the file input element
            file_input = self.page.locator("input[type='file']").first
            
            # Upload the file
            file_input.set_input_files(file_path)
            
            # Wait for upload to complete
            self._wait_for_upload_completion(timeout)
            
            return True
            
        except Exception as e:
            print(f"Error uploading file: {str(e)}")
            return False
            
    def upload_multiple_files(self, file_paths: List[str], timeout: int = 120000) -> bool:
        """
        Upload multiple files to WeSign
        
        Args:
            file_paths: List of file paths to upload
            timeout: Maximum wait time in milliseconds
            
        Returns:
            bool: True if all uploads successful, False otherwise
        """
        try:
            # Verify all files exist
            for file_path in file_paths:
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"File not found: {file_path}")
                    
            # Wait for upload area to be ready
            self.page.wait_for_selector("input[type='file']", timeout=timeout)
            
            # Find the file input element
            file_input = self.page.locator("input[type='file']").first
            
            # Upload all files at once
            file_input.set_input_files(file_paths)
            
            # Wait for all uploads to complete
            self._wait_for_upload_completion(timeout)
            
            return True
            
        except Exception as e:
            print(f"Error uploading files: {str(e)}")
            return False
            
    def merge_files(self, file_indices: List[int], timeout: int = 60000) -> bool:
        """
        Merge selected files
        
        Args:
            file_indices: List of file indices to merge (0-based)
            timeout: Maximum wait time in milliseconds
            
        Returns:
            bool: True if merge successful, False otherwise
        """
        try:
            # Select files for merging
            for index in file_indices:
                file_selector = f".document-item:nth-child({index + 1}) .select-checkbox, .file-item:nth-child({index + 1}) input[type='checkbox']"
                self.page.wait_for_selector(file_selector, timeout=10000)
                self.page.click(file_selector)
                
            # Click merge files button
            merge_button_selectors = [
                "[data-testid='merge-files']",
                "button:has-text('מזג קבצים')",
                "button:has-text('Merge Files')",
                ".merge-button"
            ]
            
            for selector in merge_button_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
                    
            # Wait for merge confirmation dialog
            self.page.wait_for_selector(".confirmation-modal, .confirm-dialog", timeout=10000)
            
            # Confirm merge
            confirm_selectors = [
                "[data-testid='confirm-merge']",
                "button:has-text('אשר מיזוג')",
                "button:has-text('Confirm Merge')",
                ".modal-confirm"
            ]
            
            for selector in confirm_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
                    
            # Wait for merge to complete
            self._wait_for_operation_completion("merge", timeout)
            
            return True
            
        except Exception as e:
            print(f"Error merging files: {str(e)}")
            return False
            
    def assign_and_send_document(self, recipients: List[dict], document_name: str = None, timeout: int = 60000) -> bool:
        """
        Assign and send document to recipients
        
        Args:
            recipients: List of recipient dicts with 'name' and 'email' keys
            document_name: Name of document to assign (if None, uses first available)
            timeout: Maximum wait time in milliseconds
            
        Returns:
            bool: True if assignment successful, False otherwise
        """
        try:
            # Select document if specified
            if document_name:
                self._select_document_by_name(document_name)
                
            # Click assign and send button
            assign_send_selectors = [
                "[data-testid='assign-send']",
                "button:has-text('הקצה ושלח')",
                "button:has-text('Assign and Send')",
                ".assign-send-button"
            ]
            
            for selector in assign_send_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
                    
            # Wait for assignment form to load
            self.page.wait_for_selector("input[name='email'], input[placeholder*='email']", timeout=15000)
            
            # Add recipients
            for recipient in recipients:
                self._add_recipient(recipient['name'], recipient['email'])
                
            # Send the document
            send_selectors = [
                "[data-testid='send-document']",
                "button:has-text('שלח מסמך')",
                "button:has-text('Send Document')",
                ".send-button"
            ]
            
            for selector in send_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
                    
            # Wait for send confirmation
            self._wait_for_operation_completion("send", timeout)
            
            return True
            
        except Exception as e:
            print(f"Error assigning and sending document: {str(e)}")
            return False
            
    def switch_language(self, language: str = "hebrew") -> bool:
        """
        Switch application language
        
        Args:
            language: Target language ("hebrew" or "english")
            
        Returns:
            bool: True if language switched successfully
        """
        try:
            # Look for language toggle button
            language_selectors = [
                "[data-testid='language-toggle']",
                ".language-selector",
                ".lang-switch",
                "button:has-text('EN')",
                "button:has-text('HE')",
                "button:has-text('עברית')",
                "button:has-text('English')"
            ]
            
            for selector in language_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    
                    # Wait for language change to take effect
                    self.page.wait_for_timeout(2000)
                    
                    # Verify language change by checking for language-specific text
                    if language == "hebrew":
                        return self._verify_hebrew_interface()
                    else:
                        return self._verify_english_interface()
                        
            return False
            
        except Exception as e:
            print(f"Error switching language: {str(e)}")
            return False
            
    def get_upload_status(self) -> str:
        """
        Get current upload status
        
        Returns:
            str: Upload status ("idle", "uploading", "success", "error")
        """
        try:
            # Check for loading/uploading indicators
            if self.is_visible(self.loading_spinner, timeout=1000):
                return "uploading"
                
            # Check for success message
            if self.is_visible(self.success_message, timeout=1000):
                return "success"
                
            # Check for error message
            if self.is_visible(self.error_message, timeout=1000):
                return "error"
                
            return "idle"
            
        except Exception:
            return "unknown"
            
    def get_error_message(self) -> Optional[str]:
        """Get current error message if any"""
        try:
            error_elements = [
                self.error_message,
                self.file_type_error,
                self.file_size_error
            ]
            
            for element in error_elements:
                if self.is_visible(element, timeout=1000):
                    return self.get_text(element)
                    
            return None
            
        except Exception:
            return None
            
    def get_success_message(self) -> Optional[str]:
        """Get current success message if any"""
        try:
            if self.is_visible(self.success_message, timeout=1000):
                return self.get_text(self.success_message)
            return None
            
        except Exception:
            return None
            
    def get_document_count(self) -> int:
        """Get total number of documents in the list"""
        try:
            self.document_item.first.wait_for(state="visible", timeout=5000)
            return self.document_item.count()
        except Exception:
            return 0
            
    def get_document_names(self) -> List[str]:
        """Get list of all document names"""
        try:
            names = []
            count = self.get_document_count()
            for i in range(count):
                name_element = self.document_name.nth(i)
                if name_element.is_visible():
                    names.append(self.get_text(name_element))
            return names
        except Exception:
            return []
            
    def is_file_type_supported(self, file_path: str) -> bool:
        """
        Check if file type is supported by attempting upload
        
        Args:
            file_path: Path to file to check
            
        Returns:
            bool: True if supported, False otherwise
        """
        try:
            # Attempt to upload file
            self.upload_single_file(file_path)
            
            # Check for file type error
            self.page.wait_for_timeout(2000)  # Wait for validation
            
            if self.is_visible(self.file_type_error, timeout=3000):
                return False
                
            return True
            
        except Exception:
            return False
            
    # Private helper methods
    def _wait_for_upload_completion(self, timeout: int) -> None:
        """Wait for upload operation to complete"""
        # Wait for upload progress to disappear
        try:
            if self.is_visible(self.upload_progress, timeout=5000):
                self.upload_progress.wait_for(state="hidden", timeout=timeout)
        except Exception:
            pass
            
        # Wait for loading spinner to disappear
        try:
            if self.is_visible(self.loading_spinner, timeout=5000):
                self.loading_spinner.wait_for(state="hidden", timeout=timeout)
        except Exception:
            pass
            
        # Wait for either success or error message
        success_or_error = f"{self.success_message.locator}, {self.error_message.locator}"
        try:
            self.page.wait_for_selector(success_or_error, timeout=timeout)
        except Exception:
            pass
            
    def _wait_for_operation_completion(self, operation: str, timeout: int) -> None:
        """Wait for any operation to complete"""
        self.page.wait_for_load_state("networkidle", timeout=timeout)
        
        # Wait for loading indicators to disappear
        try:
            if self.is_visible(self.loading_spinner, timeout=5000):
                self.loading_spinner.wait_for(state="hidden", timeout=timeout)
        except Exception:
            pass
            
    def _select_document_by_name(self, document_name: str) -> None:
        """Select a document by its name"""
        document_selector = f".document-item:has-text('{document_name}'), .file-item:has-text('{document_name}')"
        self.page.wait_for_selector(document_selector, timeout=10000)
        self.page.click(document_selector)
        
    def _add_recipient(self, name: str, email: str) -> None:
        """Add a recipient to the assignment form"""
        # Fill name if field exists
        name_selectors = [
            "[data-testid='recipient-name']",
            "input[name='name']",
            "input[placeholder*='name']",
            "input[placeholder*='שם']"
        ]
        
        for selector in name_selectors:
            if self.page.locator(selector).is_visible():
                self.page.fill(selector, name)
                break
                
        # Fill email
        email_selectors = [
            "[data-testid='recipient-email']",
            "input[name='email']",
            "input[placeholder*='email']",
            "input[placeholder*='מייל']"
        ]
        
        for selector in email_selectors:
            if self.page.locator(selector).is_visible():
                self.page.fill(selector, email)
                break
                
        # Click add recipient if button exists
        add_selectors = [
            "[data-testid='add-recipient']",
            "button:has-text('הוסף נמען')",
            "button:has-text('Add Recipient')",
            ".add-recipient-button"
        ]
        
        for selector in add_selectors:
            if self.page.locator(selector).is_visible():
                self.page.click(selector)
                break
                
    def _verify_hebrew_interface(self) -> bool:
        """Verify that interface is in Hebrew"""
        hebrew_indicators = [
            "העלה קובץ",
            "מזג קבצים", 
            "הקצה ושלח",
            "מסמכים",
            "לוח בקרה"
        ]
        
        page_content = self.page.content()
        return any(indicator in page_content for indicator in hebrew_indicators)
        
    def _verify_english_interface(self) -> bool:
        """Verify that interface is in English"""
        english_indicators = [
            "Upload File",
            "Merge Files",
            "Assign and Send", 
            "Documents",
            "Dashboard"
        ]
        
        page_content = self.page.content()
        return any(indicator in page_content for indicator in english_indicators)
    
    # ==================== COMPREHENSIVE FIELD METHODS ====================
    
    def wait_for_field_toolbox(self, timeout: int = 30000) -> bool:
        """Wait for field toolbox to be visible"""
        try:
            self.page.wait_for_selector(".field-toolbox, .fields-toolbar, .signature-tools", timeout=timeout)
            return True
        except Exception:
            return False
            
    def add_signature_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """
        Add a signature field to the document
        
        Args:
            x: X coordinate on the page
            y: Y coordinate on the page  
            page_number: Page number (1-based)
            properties: Field properties dict
            
        Returns:
            bool: True if field added successfully
        """
        try:
            # Wait for field toolbox
            if not self.wait_for_field_toolbox():
                return False
                
            # Click signature field button
            signature_selectors = [
                "[data-field-type='signature']",
                ".signature-field",
                "button:has-text('חתימה')",
                "button:has-text('Signature')"
            ]
            
            for selector in signature_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            # Place field on document
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding signature field: {str(e)}")
            return False
            
    def add_text_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a text field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            text_selectors = [
                "[data-field-type='text']",
                ".text-field", 
                "button:has-text('טקסט')",
                "button:has-text('Text')"
            ]
            
            for selector in text_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding text field: {str(e)}")
            return False
            
    def add_date_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a date field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            date_selectors = [
                "[data-field-type='date']",
                ".date-field",
                "button:has-text('תאריך')",
                "button:has-text('Date')"
            ]
            
            for selector in date_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding date field: {str(e)}")
            return False
            
    def add_checkbox_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a checkbox field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            checkbox_selectors = [
                "[data-field-type='checkbox']",
                ".checkbox-field",
                "button:has-text('תיבת סימון')",
                "button:has-text('Checkbox')"
            ]
            
            for selector in checkbox_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding checkbox field: {str(e)}")
            return False
            
    def add_dropdown_field(self, x: int, y: int, page_number: int = 1, options: List[str] = None, properties: dict = None) -> bool:
        """Add a dropdown field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            dropdown_selectors = [
                "[data-field-type='dropdown']",
                ".dropdown-field",
                "button:has-text('רשימה')",
                "button:has-text('Dropdown')"
            ]
            
            for selector in dropdown_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            # Place field and configure options
            if self._place_field_on_document(x, y, page_number, properties):
                if options:
                    return self._configure_dropdown_options(options)
                return True
            return False
            
        except Exception as e:
            print(f"Error adding dropdown field: {str(e)}")
            return False
            
    def add_initial_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add an initial field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            initial_selectors = [
                "[data-field-type='initial']",
                ".initial-field",
                "button:has-text('ראשי תיבות')",
                "button:has-text('Initial')"
            ]
            
            for selector in initial_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding initial field: {str(e)}")
            return False
            
    def add_name_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a name field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            name_selectors = [
                "[data-field-type='name']",
                ".name-field",
                "button:has-text('שם')",
                "button:has-text('Name')"
            ]
            
            for selector in name_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding name field: {str(e)}")
            return False
            
    def add_email_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add an email field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            email_selectors = [
                "[data-field-type='email']",
                ".email-field",
                "button:has-text('אימייל')",
                "button:has-text('Email')"
            ]
            
            for selector in email_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding email field: {str(e)}")
            return False
            
    def add_phone_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a phone field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            phone_selectors = [
                "[data-field-type='phone']",
                ".phone-field",
                "button:has-text('טלפון')",
                "button:has-text('Phone')"
            ]
            
            for selector in phone_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding phone field: {str(e)}")
            return False
            
    def add_number_field(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Add a number field to the document"""
        try:
            if not self.wait_for_field_toolbox():
                return False
                
            number_selectors = [
                "[data-field-type='number']",
                ".number-field",
                "button:has-text('מספר')",
                "button:has-text('Number')"
            ]
            
            for selector in number_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    break
            else:
                return False
                
            return self._place_field_on_document(x, y, page_number, properties)
            
        except Exception as e:
            print(f"Error adding number field: {str(e)}")
            return False
            
    def _place_field_on_document(self, x: int, y: int, page_number: int = 1, properties: dict = None) -> bool:
        """Place field on document at specified coordinates"""
        try:
            # Wait for document canvas
            canvas_selectors = [
                ".document-canvas",
                ".pdf-viewer", 
                ".document-viewer",
                ".page-container"
            ]
            
            canvas = None
            for selector in canvas_selectors:
                if self.page.locator(selector).is_visible():
                    canvas = self.page.locator(selector).first
                    break
                    
            if not canvas:
                return False
                
            # Click at specified coordinates to place field
            canvas.click(position={"x": x, "y": y})
            
            # Wait for field properties panel if properties provided
            if properties:
                return self._configure_field_properties(properties)
                
            # Otherwise just save the field
            return self._save_field()
            
        except Exception as e:
            print(f"Error placing field: {str(e)}")
            return False
            
    def _configure_field_properties(self, properties: dict) -> bool:
        """Configure field properties"""
        try:
            # Wait for properties panel
            self.page.wait_for_selector(".field-properties, .field-settings, .property-panel", timeout=10000)
            
            # Configure label
            if 'label' in properties:
                label_selectors = [
                    "input[name='label']",
                    "input[placeholder*='label']", 
                    "input[placeholder*='תווית']"
                ]
                for selector in label_selectors:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, properties['label'])
                        break
                        
            # Configure placeholder
            if 'placeholder' in properties:
                placeholder_selectors = [
                    "input[name='placeholder']",
                    "input[placeholder*='placeholder']",
                    "input[placeholder*='מקום מסמן']"
                ]
                for selector in placeholder_selectors:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, properties['placeholder'])
                        break
                        
            # Configure required
            if 'required' in properties and properties['required']:
                required_selectors = [
                    "input[name='required']",
                    "input[type='checkbox'][id*='required']"
                ]
                for selector in required_selectors:
                    if self.page.locator(selector).is_visible():
                        if not self.page.locator(selector).is_checked():
                            self.page.check(selector)
                        break
                        
            # Configure dimensions
            if 'width' in properties:
                width_selectors = [
                    "input[name='width']",
                    "input[placeholder*='width']",
                    "input[placeholder*='רוחב']"
                ]
                for selector in width_selectors:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, str(properties['width']))
                        break
                        
            if 'height' in properties:
                height_selectors = [
                    "input[name='height']", 
                    "input[placeholder*='height']",
                    "input[placeholder*='גובה']"
                ]
                for selector in height_selectors:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, str(properties['height']))
                        break
                        
            # Configure validation
            if 'minLength' in properties:
                self._set_field_property("input[name='minLength'], input[placeholder*='min']", str(properties['minLength']))
                
            if 'maxLength' in properties:
                self._set_field_property("input[name='maxLength'], input[placeholder*='max']", str(properties['maxLength']))
                
            if 'pattern' in properties:
                self._set_field_property("input[name='pattern'], input[placeholder*='pattern']", properties['pattern'])
                
            return self._save_field()
            
        except Exception as e:
            print(f"Error configuring field properties: {str(e)}")
            return False
            
    def _configure_dropdown_options(self, options: List[str]) -> bool:
        """Configure dropdown field options"""
        try:
            # Look for options configuration area
            options_selectors = [
                "textarea[name='options']",
                ".field-options",
                ".option-list"
            ]
            
            for selector in options_selectors:
                if self.page.locator(selector).is_visible():
                    # Join options with newlines or commas
                    options_text = "\n".join(options)
                    self.page.fill(selector, options_text)
                    return True
                    
            # Alternative: Add options one by one
            for option in options:
                add_selectors = [
                    ".add-option",
                    "button:has-text('הוסף אפשרות')",
                    "button:has-text('Add Option')"
                ]
                
                for selector in add_selectors:
                    if self.page.locator(selector).is_visible():
                        self.page.click(selector)
                        
                        # Fill option input
                        option_input_selectors = [
                            ".option-input",
                            "input[name*='option']"
                        ]
                        
                        for input_selector in option_input_selectors:
                            if self.page.locator(input_selector).last.is_visible():
                                self.page.fill(f"{input_selector}:last-child", option)
                                break
                        break
                        
            return True
            
        except Exception as e:
            print(f"Error configuring dropdown options: {str(e)}")
            return False
            
    def _set_field_property(self, selectors: str, value: str) -> bool:
        """Set a field property value"""
        try:
            for selector in selectors.split(", "):
                if self.page.locator(selector).is_visible():
                    self.page.fill(selector, value)
                    return True
            return False
            
        except Exception:
            return False
            
    def _save_field(self) -> bool:
        """Save the current field"""
        try:
            save_selectors = [
                ".save-field",
                "button:has-text('שמור שדה')",
                "button:has-text('Save Field')",
                ".confirm-field",
                "button:has-text('אישור')",
                "button:has-text('OK')"
            ]
            
            for selector in save_selectors:
                if self.page.locator(selector).is_visible():
                    self.page.click(selector)
                    time.sleep(1)  # Brief pause for save
                    return True
                    
            # Sometimes no explicit save is needed
            return True
            
        except Exception as e:
            print(f"Error saving field: {str(e)}")
            return False
            
    def get_field_count(self) -> int:
        """Get the number of fields placed on the document"""
        try:
            field_selectors = [
                ".placed-field",
                ".document-field",
                ".field-element"
            ]
            
            for selector in field_selectors:
                fields = self.page.locator(selector).all()
                if fields:
                    return len(fields)
                    
            return 0
            
        except Exception:
            return 0
            
    def verify_field_exists(self, field_type: str) -> bool:
        """Verify that a specific field type exists on the document"""
        try:
            field_type_selectors = {
                'signature': "[data-field-type='signature'], .signature-field",
                'text': "[data-field-type='text'], .text-field", 
                'date': "[data-field-type='date'], .date-field",
                'checkbox': "[data-field-type='checkbox'], .checkbox-field",
                'dropdown': "[data-field-type='dropdown'], .dropdown-field",
                'initial': "[data-field-type='initial'], .initial-field",
                'name': "[data-field-type='name'], .name-field",
                'email': "[data-field-type='email'], .email-field",
                'phone': "[data-field-type='phone'], .phone-field",
                'number': "[data-field-type='number'], .number-field"
            }
            
            selector = field_type_selectors.get(field_type.lower())
            if selector:
                return self.page.locator(selector).count() > 0
                
            return False
            
        except Exception:
            return False
            
    def delete_all_fields(self) -> bool:
        """Delete all fields from the document"""
        try:
            field_selectors = [
                ".placed-field",
                ".document-field", 
                ".field-element"
            ]
            
            for selector in field_selectors:
                fields = self.page.locator(selector).all()
                for field in fields:
                    try:
                        # Right click to open context menu
                        field.click(button="right")
                        
                        # Look for delete option
                        delete_selectors = [
                            "button:has-text('מחק')",
                            "button:has-text('Delete')",
                            ".delete-field",
                            ".remove-field"
                        ]
                        
                        for delete_selector in delete_selectors:
                            if self.page.locator(delete_selector).is_visible():
                                self.page.click(delete_selector)
                                time.sleep(0.5)
                                break
                                
                    except Exception:
                        continue
                        
            return self.get_field_count() == 0
            
        except Exception as e:
            print(f"Error deleting fields: {str(e)}")
            return False