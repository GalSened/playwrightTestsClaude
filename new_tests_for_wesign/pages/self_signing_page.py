"""
Self-Signing Page Object Model for WeSign Testing
Comprehensive page class for self-signing workflow automation

Based on WeSign selectors and patterns observed in production environment.
Supports multi-format document signing (PDF, Word, Excel, images) with various signature types.
"""

from playwright.sync_api import Page, expect
import time
import os
from typing import Dict, Any


class SelfSigningPage:
    def __init__(self, page: Page):
        self.page = page

    # Navigation and Document Upload
    def navigate_to_documents(self):
        """Navigate to Documents page from main navigation"""
        self.page.click("//a[contains(@href, '/documents') or contains(@href, '/mydocuments')]")
        self.page.wait_for_load_state()

    def upload_document_for_self_signing(self, file_path: str):
        """Upload document file for self-signing workflow using real WeSign selectors"""
        # Upload file using WeSign's file input selector
        file_input = "input[type='file'][accept*='image']"  # From self-sign-upload.component.html
        self.page.set_input_files(file_input, file_path)

        # Click upload/next button using WeSign's actual selector
        next_button = "//button[contains(@class, 'ws_button--small') and not(contains(@class, 'outline'))]"
        self.page.wait_for_selector(next_button, timeout=10000)
        self.page.click(next_button)

        # Wait for field placement interface to load
        self.page.wait_for_selector(".ct-p-edit-document", timeout=15000)

    # Document Field Management
    def add_signature_field_to_document(self):
        """Add signature field to uploaded document using real WeSign selectors"""
        # Wait for document to load and click on document to add signature field
        document_area = ".ct-c-document .doc__image"  # From self-sign-place-fields.component.html
        self.page.wait_for_selector(document_area, timeout=10000)
        self.page.click(document_area)

        # Wait for signature field to be added - actual WeSign signature field selector
        signature_field = ".ct-c-field.is-signature"  # From signature-field.component.html
        self.page.wait_for_selector(signature_field, timeout=5000)

    def add_initials_field_to_document(self):
        """Add initials field to uploaded document"""
        # Click on initials field tool
        initials_tool = "//*[@name='initials' or contains(@class, 'initials-tool')]"
        self.page.click(initials_tool)

        # Place initials field on document
        document_canvas = "//div[contains(@class, 'document-canvas') or contains(@class, 'pdf-viewer')]"
        self.page.click(document_canvas)

    def add_text_field_to_document(self, field_name: str):
        """Add text input field to document"""
        # Click on text field tool
        text_tool = "//*[contains(@class, 'text-field-tool') or contains(@name, 'text')]"
        self.page.click(text_tool)

        # Place text field on document
        document_canvas = "//div[contains(@class, 'document-canvas') or contains(@class, 'pdf-viewer')]"
        self.page.click(document_canvas)

        # Set field name if needed
        if field_name:
            field_name_input = "//input[contains(@placeholder, 'Field Name') or contains(@name, 'fieldName')]"
            self.page.fill(field_name_input, field_name)

    def add_date_field_to_document(self):
        """Add date field to document"""
        date_tool = "//*[contains(@class, 'date-field-tool') or contains(@name, 'date')]"
        self.page.click(date_tool)

        document_canvas = "//div[contains(@class, 'document-canvas') or contains(@class, 'pdf-viewer')]"
        self.page.click(document_canvas)

    # Signing Process
    def start_signing_process(self):
        """Start the actual signing process using real WeSign selectors"""
        # Click Next/Finish button from field placement page
        finish_button = "//button[contains(text(), 'TEMPLATE.FINISH') or contains(@class, 'ct-button')]"
        self.page.wait_for_selector(finish_button, timeout=10000)
        self.page.click(finish_button)
        self.page.wait_for_load_state()

    def sign_with_drawn_signature(self):
        """Sign document by drawing signature using real WeSign selectors"""
        # Wait for signature field to be clickable (real WeSign selector)
        signature_field = ".ct-c-field.is-signature i-feather[name='feather']"  # From signature-field.component.html
        self.page.wait_for_selector(signature_field, timeout=60000)
        self.page.click(signature_field)

        # Wait for signing pad to appear
        signing_pad = ".ct-c-signature-panel.ct-is-shown"  # From sign-pad.component.html
        self.page.wait_for_selector(signing_pad, timeout=10000)

        # Select Draw tab (active by default)
        draw_tab = "button[id='drawButton']"  # From sign-pad.component.html
        if self.page.is_visible(draw_tab):
            self.page.click(draw_tab)

        # Draw signature on canvas using ngx-signature-pad
        canvas = "ngx-signature-pad canvas"
        self.page.wait_for_selector(canvas)

        # Simulate drawing by clicking multiple points
        canvas_element = self.page.locator(canvas)
        box = canvas_element.bounding_box()
        if box:
            # Draw a simple signature pattern
            points = [
                (box['x'] + 50, box['y'] + 30),
                (box['x'] + 100, box['y'] + 40),
                (box['x'] + 150, box['y'] + 35),
                (box['x'] + 200, box['y'] + 45)
            ]
            for point in points:
                self.page.mouse.click(point[0], point[1])

        # Apply signature using real WeSign button selector
        sign_button = "//button[contains(@class, 'ct-button--primary') and contains(text(), 'BUTTONS.SIGN')]"
        self.page.click(sign_button)

    def sign_with_typed_signature(self, signature_text: str):
        """Sign document with typed signature"""
        signature_field = "//*[@name='feather' or contains(@class, 'signature-field')]"
        self.page.wait_for_selector(signature_field, timeout=60000)
        self.page.click(signature_field)

        # Select Type tab
        type_tab = "//button[contains(text(), 'Type') or contains(@class, 'type-tab')]"
        self.page.click(type_tab)

        # Type signature text
        text_input = "//input[contains(@class, 'signature-text') or contains(@placeholder, 'signature')]"
        self.page.fill(text_input, signature_text)

        # Apply signature
        apply_button = "//button[contains(@class, 'apply') or contains(text(), 'Apply')]"
        self.page.click(apply_button)

    def sign_with_initials(self):
        """Sign document using initials with real WeSign selectors"""
        # Wait for signature field to be clickable
        signature_field = ".ct-c-field.is-signature i-feather[name='feather']"
        self.page.wait_for_selector(signature_field, timeout=60000)
        self.page.click(signature_field)

        # Wait for signing pad and select Initials tab
        signing_pad = ".ct-c-signature-panel.ct-is-shown"
        self.page.wait_for_selector(signing_pad, timeout=10000)

        # Click Initials tab (real WeSign selector)
        initials_tab = "//button[contains(text(), 'SIGN_PAD.INITIALS') and contains(@class, 'tablinks')]"
        self.page.click(initials_tab)

        # Click on existing initials canvas - real WeSign selector
        existing_initials = "button.ct-c-initials canvas"  # From sign-pad.component.html
        if self.page.is_visible(existing_initials):
            self.page.click(f"({existing_initials})[1]")

        # Apply initials using real WeSign button selector
        sign_button = "//button[contains(@class, 'ct-button--primary') and contains(text(), 'BUTTONS.SIGN')]"
        self.page.click(sign_button)

    def fill_text_field(self, field_text: str):
        """Fill text field in document"""
        text_field = "//input[contains(@class, 'text-field') or @type='text']"
        self.page.fill(text_field, field_text)

    def fill_date_field(self, date_value: str):
        """Fill date field in document"""
        date_field = "//input[contains(@class, 'date-field') or @type='date']"
        self.page.fill(date_field, date_value)

    # Completion and Validation
    def complete_signing_process(self):
        """Complete the signing process"""
        # Click Finish button
        finish_button = "//button[contains(@class, 'ct-button--titlebar-primary') or contains(text(), 'Finish') or contains(text(), 'סיום')]"
        self.page.wait_for_selector(finish_button, timeout=40000)
        self.page.click(finish_button)

        # Wait for completion page
        self.page.wait_for_selector("//h2[contains(text(), 'Document Signed') or contains(text(), 'המסמך נחתם')]", timeout=30000)

    def validate_document_signed_successfully(self):
        """Validate that document was signed successfully"""
        success_message = "//div[contains(@class, 'success') or contains(text(), 'signed successfully')]"
        expect(self.page.locator(success_message)).to_be_visible(timeout=30000)

    def download_signed_document(self):
        """Download the signed document"""
        download_button = "//button[contains(@class, 'download') or contains(text(), 'Download')]"

        with self.page.expect_download() as download_info:
            self.page.click(download_button)

        return download_info.value

    # Advanced Features
    def set_signature_meaning(self, meaning_index: int):
        """Set meaning/purpose of signature from dropdown"""
        meaning_dropdown = "#meaningOfSignature"
        if self.page.is_visible(meaning_dropdown):
            self.page.select_option(meaning_dropdown, index=meaning_index)

            # Submit meaning
            submit_button = "//button[contains(@class, 'ct-button--primary')]"
            self.page.click(submit_button)

    def save_signature_for_future_use(self):
        """Save signature for future use checkbox"""
        save_checkbox = "//span[contains(@class, 'ct-checkbox__checkmark')]"
        self.page.click(save_checkbox)

    def apply_signature_to_all_fields(self):
        """Apply signature to all similar fields in document"""
        apply_all_checkbox = "(//span[@class='ct-checkbox__checkmark'])[2]"
        self.page.click(apply_all_checkbox)

    # Multi-format Support
    def handle_pdf_document_signing(self, file_path: str):
        """Complete workflow for PDF document signing"""
        self.upload_document_for_self_signing(file_path)
        self.add_signature_field_to_document()
        self.start_signing_process()
        self.sign_with_drawn_signature()
        self.complete_signing_process()

    def handle_word_document_signing(self, file_path: str):
        """Complete workflow for Word document signing"""
        self.upload_document_for_self_signing(file_path)
        self.add_signature_field_to_document()
        self.start_signing_process()
        self.sign_with_typed_signature("John Doe")
        self.complete_signing_process()

    def handle_excel_document_signing(self, file_path: str):
        """Complete workflow for Excel document signing"""
        self.upload_document_for_self_signing(file_path)
        self.add_signature_field_to_document()
        self.start_signing_process()
        self.sign_with_initials()
        self.complete_signing_process()

    def handle_image_document_signing(self, file_path: str):
        """Complete workflow for image document signing"""
        self.upload_document_for_self_signing(file_path)
        self.add_signature_field_to_document()
        self.start_signing_process()
        self.sign_with_drawn_signature()
        self.complete_signing_process()

    # Error Handling and Recovery
    def handle_otp_authentication_if_required(self, otp_code: str = "123456"):
        """Handle OTP authentication during signing if required"""
        otp_field = "//*[@id='auth' or contains(@name, 'otp')]"
        if self.page.is_visible(otp_field, timeout=5000):
            # Send OTP first
            send_otp_button = "//a[contains(@class, 'send-otp')]"
            if self.page.is_visible(send_otp_button):
                self.page.click(send_otp_button)
                time.sleep(2)

            # Enter OTP code
            self.page.fill(otp_field, otp_code)

            # Submit OTP
            submit_button = "//input[contains(@class, 'ct-button--titlebar-primary') or @type='submit']"
            self.page.click(submit_button)

    def handle_contact_signature_save_dialog(self, save_contact: bool = True):
        """Handle save contact signature dialog"""
        dialog_selector = "//div[contains(@class, 'pop-up-message')]"
        if self.page.is_visible(dialog_selector, timeout=5000):
            if save_contact:
                yes_button = "//button[contains(text(), 'Yes') or contains(text(), 'כן')]"
                self.page.click(yes_button)
            else:
                no_button = "//button[contains(text(), 'No') or contains(text(), 'לא')]"
                self.page.click(no_button)

    # Validation Methods
    def validate_signature_field_added(self):
        """Validate that signature field was added to document"""
        signature_field = "//*[@name='feather' or contains(@class, 'signature-field')]"
        expect(self.page.locator(signature_field)).to_be_visible()

    def validate_document_canvas_loaded(self):
        """Validate that document canvas is loaded and ready"""
        canvas = "//div[contains(@class, 'document-canvas') or contains(@class, 'pdf-viewer')]"
        expect(self.page.locator(canvas)).to_be_visible()

    def validate_signing_interface_loaded(self):
        """Validate that signing interface is properly loaded"""
        signature_field = "//*[@name='feather']"
        self.page.wait_for_selector(signature_field, timeout=60000)
        expect(self.page.locator(signature_field)).to_be_visible()

    def get_document_status(self) -> str:
        """Get current document status"""
        status_element = "//span[contains(@class, 'status') or contains(@class, 'document-state')]"
        if self.page.is_visible(status_element):
            return self.page.inner_text(status_element)
        return "unknown"

    # Multi-language Support
    def switch_to_hebrew_interface(self):
        """Switch interface to Hebrew"""
        language_button = "//button[contains(@class, 'language') or contains(@title, 'Hebrew')]"
        if self.page.is_visible(language_button):
            self.page.click(language_button)
            hebrew_option = "//option[@value='he' or contains(text(), 'עברית')]"
            if self.page.is_visible(hebrew_option):
                self.page.click(hebrew_option)

    def switch_to_english_interface(self):
        """Switch interface to English"""
        language_button = "//button[contains(@class, 'language') or contains(@title, 'English')]"
        if self.page.is_visible(language_button):
            self.page.click(language_button)
            english_option = "//option[@value='en' or contains(text(), 'English')]"
            if self.page.is_visible(english_option):
                self.page.click(english_option)