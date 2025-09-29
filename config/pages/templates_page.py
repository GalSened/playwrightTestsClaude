"""
Templates Page Object Model for WeSign Template Testing
Comprehensive page object model following POM pattern for templates functionality
"""

from playwright.sync_api import Page, expect, Locator
from typing import List, Dict, Optional, Union
import time
import logging
from .base_page import BasePage

logger = logging.getLogger(__name__)

class TemplatesPage(BasePage):
    """Page Object Model for WeSign Templates functionality with comprehensive test coverage"""
    
    def __init__(self, page: Page):
        super().__init__(page)
        self.page = page
        
        # Main template elements
        self.templates_container = "div[data-testid='templates-container'], .templates-container, #templates-container"
        self.create_template_button = "button[data-testid='create-template'], .create-template-btn, [class*='create-template']"
        self.template_list = "div[data-testid='template-list'], .template-list, [class*='template-list']"
        self.search_input = "input[data-testid='template-search'], input[placeholder*='search'], input[class*='search']"
        self.filter_dropdown = "select[data-testid='template-filter'], .filter-dropdown, [class*='filter']"
        
        # Template card elements
        self.template_cards = "div[data-testid='template-card'], .template-card, [class*='template-card']"
        self.template_title = "[data-testid='template-title'], .template-title, [class*='template-title']"
        self.template_description = "[data-testid='template-description'], .template-description, [class*='description']"
        self.template_actions = "[data-testid='template-actions'], .template-actions, [class*='actions']"
        self.edit_button = "button[data-testid='edit-template'], .edit-btn, [class*='edit']"
        self.delete_button = "button[data-testid='delete-template'], .delete-btn, [class*='delete']"
        self.duplicate_button = "button[data-testid='duplicate-template'], .duplicate-btn, [class*='duplicate']"
        self.share_button = "button[data-testid='share-template'], .share-btn, [class*='share']"
        
        # Template creation/editing elements
        self.template_name_input = "input[data-testid='template-name'], input[name='template-name'], input[placeholder*='name']"
        self.template_description_textarea = "textarea[data-testid='template-description'], textarea[name='description']"
        self.template_category_select = "select[data-testid='template-category'], select[name='category']"
        self.template_language_select = "select[data-testid='template-language'], select[name='language']"
        self.template_tags_input = "input[data-testid='template-tags'], input[name='tags']"
        
        # Document upload and management
        self.upload_document_area = "[data-testid='upload-area'], .upload-area, [class*='upload']"
        self.file_input = "input[type='file'], input[data-testid='file-upload']"
        self.uploaded_files_list = "[data-testid='uploaded-files'], .uploaded-files, [class*='files-list']"
        self.remove_file_button = "button[data-testid='remove-file'], .remove-file-btn, [class*='remove']"
        
        # Signature and form field elements
        self.signature_fields_panel = "[data-testid='signature-fields'], .signature-fields, [class*='signature-panel']"
        self.add_signature_field = "button[data-testid='add-signature'], .add-signature-btn"
        self.add_text_field = "button[data-testid='add-text-field'], .add-text-field-btn"
        self.add_date_field = "button[data-testid='add-date-field'], .add-date-field-btn"
        self.add_checkbox_field = "button[data-testid='add-checkbox'], .add-checkbox-btn"
        
        # Recipients management
        self.recipients_section = "[data-testid='recipients-section'], .recipients-section"
        self.add_recipient_button = "button[data-testid='add-recipient'], .add-recipient-btn"
        self.recipient_email_input = "input[data-testid='recipient-email'], input[name*='email']"
        self.recipient_name_input = "input[data-testid='recipient-name'], input[name*='name']"
        self.recipient_role_select = "select[data-testid='recipient-role'], select[name*='role']"
        
        # Template settings
        self.template_settings = "[data-testid='template-settings'], .template-settings"
        self.signing_order_toggle = "input[data-testid='signing-order'], input[type='checkbox'][name*='order']"
        self.expiration_date_input = "input[data-testid='expiration-date'], input[type='date'][name*='expiration']"
        self.reminder_settings = "[data-testid='reminder-settings'], .reminder-settings"
        
        # Save and action buttons
        self.save_template_button = "button[data-testid='save-template'], .save-template-btn, button[class*='save']"
        self.save_draft_button = "button[data-testid='save-draft'], .save-draft-btn"
        self.preview_button = "button[data-testid='preview-template'], .preview-btn"
        self.cancel_button = "button[data-testid='cancel'], .cancel-btn"
        
        # Modal and popup elements
        self.confirmation_modal = "[data-testid='confirmation-modal'], .modal, [class*='confirmation']"
        self.confirm_delete_button = "button[data-testid='confirm-delete'], .confirm-delete-btn"
        self.modal_close_button = "button[data-testid='modal-close'], .modal-close, [class*='close']"
        
        # Error and success messages
        self.error_message = "[data-testid='error-message'], .error-message, [class*='error']"
        self.success_message = "[data-testid='success-message'], .success-message, [class*='success']"
        self.validation_errors = "[data-testid='validation-error'], .validation-error, [class*='invalid']"
        
        # Loading states
        self.loading_spinner = "[data-testid='loading'], .loading-spinner, [class*='loading']"
        self.loading_overlay = "[data-testid='loading-overlay'], .loading-overlay"
        
        # Language-specific elements
        self.language_switcher = "[data-testid='language-switcher'], .language-switcher"
        self.hebrew_content = "[dir='rtl'], [lang='he'], [class*='hebrew']"
        self.english_content = "[dir='ltr'], [lang='en'], [class*='english']"

    async def navigate_to_templates(self) -> None:
        """Navigate to templates dashboard"""
        try:
            await self.page.goto("/dashboard/templates")
            await self.wait_for_page_load()
            logger.info("Successfully navigated to templates page")
        except Exception as e:
            logger.error(f"Failed to navigate to templates page: {e}")
            raise

    async def wait_for_templates_to_load(self) -> None:
        """Wait for templates to load completely"""
        try:
            await self.page.wait_for_selector(self.templates_container, timeout=15000)
            await self.page.wait_for_load_state('networkidle')
            logger.info("Templates page loaded successfully")
        except Exception as e:
            logger.error(f"Templates failed to load: {e}")
            raise

    async def get_template_count(self) -> int:
        """Get total number of templates"""
        try:
            elements = await self.page.query_selector_all(self.template_cards)
            count = len(elements)
            logger.info(f"Found {count} templates")
            return count
        except Exception as e:
            logger.error(f"Failed to get template count: {e}")
            return 0

    async def create_new_template(self, name: str, description: str = "", language: str = "English") -> bool:
        """Create a new template"""
        try:
            # Click create template button
            await self.click_element(self.create_template_button)
            await self.wait_for_page_load()
            
            # Fill template details
            await self.fill_input(self.template_name_input, name)
            
            if description:
                await self.fill_input(self.template_description_textarea, description)
            
            # Set language if available
            if await self.page.query_selector(self.template_language_select):
                await self.select_option(self.template_language_select, language)
            
            # Save template
            await self.click_element(self.save_template_button)
            
            # Wait for success confirmation
            await self.wait_for_success_message()
            
            logger.info(f"Successfully created template: {name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create template {name}: {e}")
            return False

    async def search_templates(self, search_term: str) -> List[Dict]:
        """Search for templates by term"""
        try:
            # Clear and enter search term
            await self.fill_input(self.search_input, search_term)
            await self.page.wait_for_timeout(1000)  # Wait for search results
            
            # Get filtered templates
            templates = await self.get_all_templates()
            logger.info(f"Found {len(templates)} templates matching '{search_term}'")
            return templates
            
        except Exception as e:
            logger.error(f"Failed to search templates: {e}")
            return []

    async def get_all_templates(self) -> List[Dict]:
        """Get all visible templates with their details"""
        templates = []
        try:
            template_cards = await self.page.query_selector_all(self.template_cards)
            
            for card in template_cards:
                template_data = {}
                
                # Get template title
                title_elem = await card.query_selector(self.template_title)
                if title_elem:
                    template_data['title'] = await title_elem.inner_text()
                
                # Get template description
                desc_elem = await card.query_selector(self.template_description)
                if desc_elem:
                    template_data['description'] = await desc_elem.inner_text()
                
                # Check if template has actions
                actions_elem = await card.query_selector(self.template_actions)
                template_data['has_actions'] = actions_elem is not None
                
                templates.append(template_data)
            
            logger.info(f"Retrieved {len(templates)} template details")
            return templates
            
        except Exception as e:
            logger.error(f"Failed to get template details: {e}")
            return []

    async def edit_template(self, template_name: str, new_name: str = None, new_description: str = None) -> bool:
        """Edit an existing template"""
        try:
            # Find and click edit button for specific template
            template_card = await self.find_template_by_name(template_name)
            if not template_card:
                logger.error(f"Template '{template_name}' not found")
                return False
            
            edit_btn = await template_card.query_selector(self.edit_button)
            if edit_btn:
                await edit_btn.click()
                await self.wait_for_page_load()
            else:
                logger.error(f"Edit button not found for template '{template_name}'")
                return False
            
            # Update template details
            if new_name:
                await self.fill_input(self.template_name_input, new_name)
            
            if new_description:
                await self.fill_input(self.template_description_textarea, new_description)
            
            # Save changes
            await self.click_element(self.save_template_button)
            await self.wait_for_success_message()
            
            logger.info(f"Successfully edited template: {template_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to edit template {template_name}: {e}")
            return False

    async def delete_template(self, template_name: str) -> bool:
        """Delete a template"""
        try:
            # Find template card
            template_card = await self.find_template_by_name(template_name)
            if not template_card:
                logger.error(f"Template '{template_name}' not found")
                return False
            
            # Click delete button
            delete_btn = await template_card.query_selector(self.delete_button)
            if delete_btn:
                await delete_btn.click()
            else:
                logger.error(f"Delete button not found for template '{template_name}'")
                return False
            
            # Confirm deletion
            await self.page.wait_for_selector(self.confirmation_modal, timeout=5000)
            await self.click_element(self.confirm_delete_button)
            await self.wait_for_success_message()
            
            logger.info(f"Successfully deleted template: {template_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete template {template_name}: {e}")
            return False

    async def duplicate_template(self, template_name: str, new_name: str) -> bool:
        """Duplicate an existing template"""
        try:
            # Find template card
            template_card = await self.find_template_by_name(template_name)
            if not template_card:
                logger.error(f"Template '{template_name}' not found")
                return False
            
            # Click duplicate button
            duplicate_btn = await template_card.query_selector(self.duplicate_button)
            if duplicate_btn:
                await duplicate_btn.click()
                await self.wait_for_page_load()
            else:
                logger.error(f"Duplicate button not found for template '{template_name}'")
                return False
            
            # Update duplicated template name
            await self.fill_input(self.template_name_input, new_name)
            await self.click_element(self.save_template_button)
            await self.wait_for_success_message()
            
            logger.info(f"Successfully duplicated template '{template_name}' as '{new_name}'")
            return True
            
        except Exception as e:
            logger.error(f"Failed to duplicate template {template_name}: {e}")
            return False

    async def add_signature_field_to_template(self, x: int = 100, y: int = 100) -> bool:
        """Add a signature field to template"""
        try:
            # Click add signature field
            await self.click_element(self.add_signature_field)
            
            # Position the field (if drag and drop is available)
            if await self.page.query_selector("[data-testid='signature-field-draggable']"):
                signature_field = await self.page.query_selector("[data-testid='signature-field-draggable']")
                await signature_field.drag_to({"x": x, "y": y})
            
            logger.info(f"Added signature field at position ({x}, {y})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add signature field: {e}")
            return False

    async def add_recipient(self, email: str, name: str, role: str = "Signer") -> bool:
        """Add a recipient to the template"""
        try:
            await self.click_element(self.add_recipient_button)
            
            # Fill recipient details
            await self.fill_input(self.recipient_email_input, email)
            await self.fill_input(self.recipient_name_input, name)
            
            # Set role if dropdown is available
            if await self.page.query_selector(self.recipient_role_select):
                await self.select_option(self.recipient_role_select, role)
            
            logger.info(f"Added recipient: {name} ({email}) as {role}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add recipient {email}: {e}")
            return False

    async def upload_document(self, file_path: str) -> bool:
        """Upload a document to the template"""
        try:
            # Handle file upload
            file_input = await self.page.query_selector(self.file_input)
            if file_input:
                await file_input.set_input_files(file_path)
                await self.page.wait_for_timeout(2000)  # Wait for upload
                
                # Check if file appears in uploaded files list
                uploaded_files = await self.page.query_selector(self.uploaded_files_list)
                if uploaded_files:
                    logger.info(f"Successfully uploaded document: {file_path}")
                    return True
            
            logger.error("File input not found")
            return False
            
        except Exception as e:
            logger.error(f"Failed to upload document {file_path}: {e}")
            return False

    async def switch_language(self, language: str) -> bool:
        """Switch interface language"""
        try:
            language_switcher = await self.page.query_selector(self.language_switcher)
            if language_switcher:
                await language_switcher.click()
                
                # Select language option
                language_option = f"[data-value='{language}'], option[value='{language}']"
                await self.click_element(language_option)
                
                # Wait for language change
                await self.page.wait_for_timeout(2000)
                
                logger.info(f"Switched to language: {language}")
                return True
            
            logger.warning("Language switcher not found")
            return False
            
        except Exception as e:
            logger.error(f"Failed to switch language to {language}: {e}")
            return False

    async def verify_hebrew_support(self) -> bool:
        """Verify Hebrew language support"""
        try:
            # Check for RTL elements or Hebrew content
            hebrew_elements = await self.page.query_selector_all(self.hebrew_content)
            has_hebrew = len(hebrew_elements) > 0
            
            if has_hebrew:
                logger.info("Hebrew language support verified")
            else:
                logger.warning("No Hebrew content found")
            
            return has_hebrew
            
        except Exception as e:
            logger.error(f"Failed to verify Hebrew support: {e}")
            return False

    async def find_template_by_name(self, name: str):
        """Find a template card by name"""
        try:
            template_cards = await self.page.query_selector_all(self.template_cards)
            
            for card in template_cards:
                title_elem = await card.query_selector(self.template_title)
                if title_elem:
                    title_text = await title_elem.inner_text()
                    if name.lower() in title_text.lower():
                        return card
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding template by name: {e}")
            return None

    async def wait_for_success_message(self) -> bool:
        """Wait for success message to appear"""
        try:
            await self.page.wait_for_selector(self.success_message, timeout=10000)
            success_text = await self.page.inner_text(self.success_message)
            logger.info(f"Success message: {success_text}")
            return True
        except Exception as e:
            logger.warning(f"No success message found: {e}")
            return False

    async def wait_for_error_message(self) -> str:
        """Wait for and return error message"""
        try:
            await self.page.wait_for_selector(self.error_message, timeout=5000)
            error_text = await self.page.inner_text(self.error_message)
            logger.info(f"Error message: {error_text}")
            return error_text
        except Exception as e:
            logger.warning(f"No error message found: {e}")
            return ""

    async def verify_template_creation_validation(self, required_fields: List[str]) -> Dict[str, bool]:
        """Verify template creation validation for required fields"""
        results = {}
        
        try:
            # Try to save without filling required fields
            await self.click_element(self.save_template_button)
            
            # Check validation errors for each required field
            for field in required_fields:
                field_selector = getattr(self, f"template_{field}_input", None)
                if field_selector:
                    validation_error = await self.page.query_selector(
                        f"{field_selector} + {self.validation_errors}, {field_selector} ~ {self.validation_errors}"
                    )
                    results[field] = validation_error is not None
            
            logger.info(f"Validation check results: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to verify validation: {e}")
            return results

    async def get_template_performance_metrics(self) -> Dict[str, float]:
        """Get performance metrics for template operations"""
        try:
            performance = await self.page.evaluate("""
                () => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    const paintEntries = performance.getEntriesByType('paint');
                    
                    return {
                        pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
                        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
                    };
                }
            """)
            
            logger.info(f"Performance metrics: {performance}")
            return performance
            
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {e}")
            return {}

    async def verify_accessibility_standards(self) -> Dict[str, bool]:
        """Verify basic accessibility standards"""
        accessibility_checks = {}
        
        try:
            # Check for alt attributes on images
            images_without_alt = await self.page.query_selector_all("img:not([alt])")
            accessibility_checks['images_have_alt'] = len(images_without_alt) == 0
            
            # Check for form labels
            inputs_without_labels = await self.page.query_selector_all("input:not([aria-label]):not([aria-labelledby]):not([title])")
            accessibility_checks['inputs_have_labels'] = len(inputs_without_labels) == 0
            
            # Check for heading hierarchy
            headings = await self.page.query_selector_all("h1, h2, h3, h4, h5, h6")
            accessibility_checks['has_headings'] = len(headings) > 0
            
            # Check for proper contrast (basic color check)
            low_contrast_elements = await self.page.query_selector_all("[style*='color: #fff'][style*='background: #fff']")
            accessibility_checks['proper_contrast'] = len(low_contrast_elements) == 0
            
            logger.info(f"Accessibility checks: {accessibility_checks}")
            return accessibility_checks
            
        except Exception as e:
            logger.error(f"Failed to verify accessibility: {e}")
            return accessibility_checks