"""
Templates Page Object Model - Written from Scratch
Comprehensive POM for WeSign templates functionality based on real codebase analysis
"""

from playwright.async_api import Page, expect
from .base_page import BasePage
import asyncio
from pathlib import Path


class TemplatesPage(BasePage):
    """Page Object Model for Templates functionality in WeSign platform"""

    def __init__(self, page: Page):
        super().__init__(page)
        self.base_url = "https://devtest.comda.co.il"

        # Templates navigation and main elements (based on actual WeSign HTML)
        self.templates_title = 'h1:has-text("תבניות"), h1:has-text("Templates")'
        self.back_button = 'button.ct-button--titlebar-outline'
        self.sign_button = 'button.ct-button--titlebar-primary'

        # Template creation elements
        self.add_new_template_button = 'li:has-text("תבנית חדשה"), li:has-text("NEW")'
        self.upload_template_modal = 'sgn-upload-template'

        # Search and filter elements
        self.search_input = 'input[type="search"]'
        self.search_loading_indicator = 'input.loading'

        # Template actions
        self.delete_batch_button = 'button i-feather[name="trash-2"]'
        self.delete_confirm_modal = 'sgn-pop-up-confirm'

        # Template list elements
        self.templates_container = '.main__content'
        self.template_items = '.template-item, .template-card, [data-item="template"]'
        self.template_checkboxes = 'input[type="checkbox"]'

        # Single link functionality
        self.single_link_component = 'sgn-single-link'

        # File input for upload
        self.file_input = 'input[type="file"]'
        self.upload_submit = 'button[type="submit"], input[type="submit"]'

        # Template status indicators
        self.template_status = '.template-status, .status-indicator'
        self.template_actions_menu = '.template-actions, .actions-menu'

        # Pagination and navigation
        self.pagination_container = '.pagination, .page-nav'
        self.next_page_button = 'button:has-text("Next"), button:has-text("הבא")'
        self.prev_page_button = 'button:has-text("Previous"), button:has-text("קודם")'

        # Template editor elements
        self.template_editor = '.template-editor'
        self.field_overlay = '.field-overlay'
        self.drag_drop_area = '.drag-drop, .drop-zone'

        # Template sharing
        self.share_url_input = 'input[readonly]'
        self.copy_url_button = 'button:has-text("Copy"), button:has-text("העתק")'

        # File type support
        self.supported_formats = {
            'pdf': '.pdf',
            'doc': '.doc',
            'docx': '.docx',
            'xlsx': '.xlsx',
            'png': '.png',
            'jpg': '.jpg'
        }

        # Error and success messages
        self.error_messages = '.error, .alert-error, [role="alert"], .validation-error'
        self.success_messages = '.success, .alert-success, .success-message'

    async def navigate_to_templates(self) -> None:
        """Navigate to templates page"""
        try:
            await self.page.goto(f"{self.base_url}/dashboard/templates")
            await self.page.wait_for_load_state("domcontentloaded")
        except Exception as e:
            print(f"Error navigating to templates: {e}")
            # Alternative: try clicking navigation link
            templates_nav = self.page.locator('button:has-text("תבניות"), button:has-text("Templates")').first
            if await templates_nav.is_visible():
                await templates_nav.click()
                await self.page.wait_for_load_state("domcontentloaded")

    async def is_templates_page_loaded(self) -> bool:
        """Check if templates page has loaded successfully"""
        try:
            # Check URL contains templates
            url_check = "templates" in self.page.url

            # Check for templates title
            title_visible = await self.page.locator(self.templates_title).is_visible()

            # Check for main content area
            content_visible = await self.page.locator(self.templates_container).is_visible()

            return url_check or title_visible or content_visible
        except Exception as e:
            print(f"Error checking templates page load: {e}")
            return False

    async def is_add_template_available(self) -> bool:
        """Check if user can add new templates"""
        try:
            add_button = await self.page.locator(self.add_new_template_button).is_visible()
            return add_button
        except Exception as e:
            print(f"Error checking add template availability: {e}")
            return False

    async def click_add_new_template(self) -> None:
        """Click add new template button"""
        try:
            add_button = self.page.locator(self.add_new_template_button).first
            await add_button.click()
            await self.page.wait_for_timeout(1000)  # Wait for modal to appear
        except Exception as e:
            print(f"Error clicking add new template: {e}")

    async def upload_template_file(self, file_path: str) -> bool:
        """Upload a template file"""
        try:
            if not Path(file_path).exists():
                print(f"File not found: {file_path}")
                return False

            # Look for file input
            file_input = self.page.locator(self.file_input).first
            await file_input.set_input_files(file_path)

            # Submit upload if submit button exists
            submit_button = self.page.locator(self.upload_submit).first
            if await submit_button.is_visible():
                await submit_button.click()

            await self.page.wait_for_timeout(2000)  # Wait for upload processing
            return True

        except Exception as e:
            print(f"Error uploading template file: {e}")
            return False

    async def search_templates(self, search_term: str) -> None:
        """Search templates by term"""
        try:
            search_box = self.page.locator(self.search_input).first
            await search_box.clear()
            await search_box.fill(search_term)
            await search_box.press("Enter")

            # Wait for search to complete
            await self.page.wait_for_timeout(1000)
        except Exception as e:
            print(f"Error searching templates: {e}")

    async def get_templates_list(self) -> list:
        """Get list of templates"""
        try:
            # Wait for templates to load
            await self.page.wait_for_timeout(2000)

            # Count template items
            template_items = await self.page.locator(self.template_items).count()

            templates = []
            for i in range(template_items):
                try:
                    item = self.page.locator(self.template_items).nth(i)
                    # Get template name/info if visible
                    text_content = await item.inner_text()
                    templates.append({
                        'index': i,
                        'name': text_content[:100] if text_content else f"Template_{i}",  # Truncate long names
                        'visible': await item.is_visible()
                    })
                except:
                    templates.append({
                        'index': i,
                        'name': f"Template_{i}",
                        'visible': False
                    })

            return templates
        except Exception as e:
            print(f"Error getting templates list: {e}")
            return []

    async def count_templates(self) -> int:
        """Count visible templates"""
        try:
            count = await self.page.locator(self.template_items).count()
            return count
        except Exception as e:
            print(f"Error counting templates: {e}")
            return 0

    async def select_template(self, template_index: int) -> bool:
        """Select a template by index"""
        try:
            template_item = self.page.locator(self.template_items).nth(template_index)

            # Try to find checkbox within template item
            checkbox = template_item.locator('input[type="checkbox"]').first
            if await checkbox.is_visible():
                await checkbox.check()
                return True
            else:
                # If no checkbox, try clicking the template itself
                await template_item.click()
                return True

        except Exception as e:
            print(f"Error selecting template: {e}")
            return False

    async def delete_selected_templates(self) -> bool:
        """Delete selected templates"""
        try:
            delete_button = self.page.locator(self.delete_batch_button).first
            if await delete_button.is_visible():
                await delete_button.click()

                # Confirm deletion
                await self.page.wait_for_timeout(1000)
                confirm_button = self.page.locator('button:has-text("Submit"), button:has-text("אישור")').first
                if await confirm_button.is_visible():
                    await confirm_button.click()

                await self.page.wait_for_timeout(2000)  # Wait for deletion to complete
                return True

        except Exception as e:
            print(f"Error deleting templates: {e}")

        return False

    async def has_upload_error(self) -> bool:
        """Check if there's an upload error"""
        try:
            error_visible = await self.page.locator(self.error_messages).is_visible()
            return error_visible
        except Exception as e:
            print(f"Error checking upload error: {e}")
            return False

    async def has_upload_success(self) -> bool:
        """Check if upload was successful"""
        try:
            success_visible = await self.page.locator(self.success_messages).is_visible()
            return success_visible
        except Exception as e:
            print(f"Error checking upload success: {e}")
            return False

    async def get_error_message(self) -> str:
        """Get error message text"""
        try:
            error_element = self.page.locator(self.error_messages).first
            if await error_element.is_visible():
                return await error_element.inner_text()
        except Exception as e:
            print(f"Error getting error message: {e}")

        return "No error message found"

    async def get_success_message(self) -> str:
        """Get success message text"""
        try:
            success_element = self.page.locator(self.success_messages).first
            if await success_element.is_visible():
                return await success_element.inner_text()
        except Exception as e:
            print(f"Error getting success message: {e}")

        return "No success message found"

    async def click_sign_templates(self) -> bool:
        """Click sign templates button"""
        try:
            sign_button = self.page.locator(self.sign_button).first
            if await sign_button.is_visible() and not await sign_button.is_disabled():
                await sign_button.click()
                await self.page.wait_for_timeout(2000)
                return True
        except Exception as e:
            print(f"Error clicking sign templates: {e}")

        return False

    async def is_upload_modal_visible(self) -> bool:
        """Check if upload modal is visible"""
        try:
            modal_visible = await self.page.locator(self.upload_template_modal).is_visible()
            return modal_visible
        except Exception as e:
            print(f"Error checking upload modal: {e}")
            return False

    async def close_upload_modal(self) -> None:
        """Close upload modal"""
        try:
            # Look for close button or click outside modal
            close_button = self.page.locator('button:has-text("Close"), button:has-text("סגור"), .modal-close').first
            if await close_button.is_visible():
                await close_button.click()
            else:
                # Press Escape key
                await self.page.keyboard.press("Escape")

            await self.page.wait_for_timeout(1000)
        except Exception as e:
            print(f"Error closing upload modal: {e}")

    async def verify_templates_page_functionality(self) -> dict:
        """Verify comprehensive templates page functionality"""
        try:
            results = {
                "is_loaded": await self.is_templates_page_loaded(),
                "can_add_templates": await self.is_add_template_available(),
                "templates_count": await self.count_templates(),
                "has_search": await self.page.locator(self.search_input).is_visible(),
                "has_errors": await self.has_upload_error(),
                "page_url": self.page.url
            }
            return results
        except Exception as e:
            print(f"Error verifying templates page: {e}")
            return {
                "is_loaded": False,
                "can_add_templates": False,
                "templates_count": 0,
                "has_search": False,
                "has_errors": False,
                "page_url": self.page.url,
                "error": str(e)
            }

    async def get_template_info(self, template_name: str) -> dict:
        """Get information about a specific template"""
        try:
            templates = await self.get_templates_list()
            for template in templates:
                if template_name.lower() in template['name'].lower():
                    return template

            return {"error": "Template not found", "name": template_name}
        except Exception as e:
            print(f"Error getting template info: {e}")
            return {"error": str(e), "name": template_name}

    async def wait_for_template_operation(self, timeout: int = 5000) -> None:
        """Wait for template operation to complete"""
        try:
            # Wait for loading indicators to disappear
            await self.page.wait_for_timeout(timeout)

            # Check if any loading spinners are gone
            loading_elements = self.page.locator('.loading, .spinner, .uploading')
            await loading_elements.wait_for(state="hidden", timeout=timeout)
        except:
            # Continue even if loading indicators don't disappear
            pass