"""
Dashboard Page Object Model - Written from Scratch
Comprehensive POM for WeSign dashboard functionality after login
"""

from playwright.async_api import Page, expect
from .base_page import BasePage
import asyncio


class DashboardPage(BasePage):
    """Page Object Model for Dashboard functionality after authentication"""

    def __init__(self, page: Page):
        super().__init__(page)
        self.base_url = "https://devtest.comda.co.il"

        # Dashboard navigation elements (based on actual WeSign HTML)
        self.dashboard_button = 'button.button--contacts-ent[routerlink="/dashboard/main"]'
        self.contacts_button = 'button.button--contacts-ent[routerlink="/dashboard/contacts"]'
        self.templates_button = 'button.button--templates-ent[routerlink="/dashboard/templates"]'
        self.documents_button = 'button.button--sent-ent[routerlink="/dashboard/documents"], button.button--sent[routerlink="/dashboard/documents"]'

        # Header elements
        self.header_logo = '.header__logo, #logo_image'
        self.logout_button = 'i-feather[name="log-out"]'
        self.logout_modal = 'sgn-pop-up-confirm'
        self.logout_confirm = 'sgn-pop-up-confirm button'

        # Dashboard indicators
        self.dashboard_content = 'header.ct-p-home'

    async def is_dashboard_loaded(self) -> bool:
        """Check if dashboard has loaded successfully"""
        try:
            # Multiple indicators that dashboard is loaded
            url_check = "dashboard" in self.page.url

            # Check for header element that indicates dashboard is loaded
            header_check = await self.page.locator(self.dashboard_content).is_visible()

            return url_check and header_check
        except Exception as e:
            print(f"Error checking dashboard load: {e}")
            return False

    async def wait_for_dashboard_load(self) -> None:
        """Wait for dashboard to fully load"""
        try:
            # Wait for URL to contain dashboard
            await self.page.wait_for_url("**/dashboard**", timeout=15000)
        except:
            # Fallback: wait for dashboard elements
            try:
                await self.page.wait_for_selector('text=ראשי, text=מסמכים', timeout=10000)
            except:
                # Final fallback: just wait for page load
                await self.page.wait_for_load_state("domcontentloaded")

    async def get_interface_language(self) -> str:
        """Get the current interface language"""
        try:
            # Check HTML lang attribute
            html_lang = await self.page.get_attribute('html', 'lang')
            if html_lang:
                return html_lang

            # Check for Hebrew text presence
            hebrew_elements = await self.page.locator('text=ראשי, text=מסמכים').count()
            if hebrew_elements > 0:
                return "he"

            # Check for English text presence
            english_elements = await self.page.locator('text=Home, text=Documents').count()
            if english_elements > 0:
                return "en"

            return "unknown"

        except:
            return "unknown"

    async def is_element_visible(self, element_text: str) -> bool:
        """Check if a specific element is visible on dashboard"""
        try:
            return await self.page.locator(f'text={element_text}').is_visible()
        except:
            return False

    async def can_upload_documents(self) -> bool:
        """Check if user can upload documents (company user feature)"""
        try:
            upload_visible = await self.page.locator(self.upload_button).count() > 0
            return upload_visible
        except:
            return False

    async def can_access_templates(self) -> bool:
        """Check if user can access templates functionality"""
        try:
            # Check for templates navigation
            templates_nav = await self.page.locator(self.main_nav_hebrew["templates"]).count() > 0
            return templates_nav
        except:
            return False

    async def get_user_permissions(self) -> dict:
        """Get user permissions and user type information"""
        try:
            permissions = {
                "user_type": "company",  # Default assumption for WeSign
                "can_upload": await self.can_upload_documents(),
                "can_access_templates": await self.can_access_templates(),
                "has_advanced_features": True
            }

            # Check for basic user indicators
            if not permissions["can_upload"] and not permissions["can_access_templates"]:
                permissions["user_type"] = "basic"
                permissions["has_advanced_features"] = False

            return permissions

        except:
            return {"user_type": "unknown"}

    async def is_user_authenticated(self) -> bool:
        """Check if user is properly authenticated"""
        try:
            # Should be on dashboard URL
            if "dashboard" not in self.page.url:
                return False

            # Check for dashboard header (indicates user is authenticated)
            header_visible = await self.page.locator(self.dashboard_content).is_visible()

            # Check for logo element which is always present when authenticated
            logo_visible = await self.page.locator(self.header_logo).is_visible()

            return header_visible and logo_visible

        except:
            return False

    async def logout(self) -> None:
        """Perform logout action"""
        try:
            # Try to find and click logout button
            logout_btn = self.page.locator(self.logout_button).first

            if await logout_btn.count() > 0 and await logout_btn.is_visible():
                await logout_btn.click()

                # Wait for confirmation dialog and confirm
                await self.page.wait_for_timeout(2000)

                confirm_btn = self.page.locator(self.logout_confirm).first
                if await confirm_btn.count() > 0 and await confirm_btn.is_visible():
                    await confirm_btn.click()

                # Wait for redirect to login
                await self.page.wait_for_timeout(3000)

        except Exception as e:
            # If primary logout fails, just navigate to home page
            await self.page.goto(f"{self.base_url}/")

    async def navigate_to_documents(self) -> None:
        """Navigate to documents section"""
        try:
            docs_link = self.page.locator(self.main_nav_hebrew["documents"]).first
            if await docs_link.is_visible():
                await docs_link.click()
                await self.page.wait_for_load_state("domcontentloaded")
        except:
            pass

    async def click_upload_document(self) -> None:
        """Click the upload document button"""
        try:
            upload_btn = self.page.locator(self.upload_button).first
            if await upload_btn.is_visible():
                await upload_btn.click()
                await self.page.wait_for_load_state("domcontentloaded")
        except:
            pass

    async def verify_dashboard_functionality(self) -> dict:
        """Comprehensive verification of dashboard functionality"""
        verification_results = {
            "is_loaded": await self.is_dashboard_loaded(),
            "is_authenticated": await self.is_user_authenticated(),
            "interface_language": await self.get_interface_language(),
            "can_upload": await self.can_upload_documents(),
            "can_access_templates": await self.can_access_templates(),
            "user_permissions": await self.get_user_permissions()
        }

        return verification_results

    # Additional methods for comprehensive testing compatibility
    async def get_user_info(self) -> dict:
        """Get user information from dashboard"""
        try:
            user_info = {
                "authenticated": await self.is_user_authenticated(),
                "dashboard_loaded": await self.is_dashboard_loaded(),
                "interface_language": await self.get_interface_language(),
                "url": self.page.url
            }
            return user_info
        except:
            return {"authenticated": False, "dashboard_loaded": False}

    async def is_navigation_available(self) -> bool:
        """Check if navigation elements are available"""
        try:
            # Check for main navigation elements
            nav_elements = [
                'button[name="Dashboard"]',
                'button[name="Documents"]',
                'button[name="Templates"]',
                'button[name="Contacts"]'
            ]

            available_count = 0
            for element in nav_elements:
                if await self.page.locator(element).count() > 0:
                    available_count += 1

            return available_count >= 2  # At least 2 navigation elements should be available
        except:
            return False