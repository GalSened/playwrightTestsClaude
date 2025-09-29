"""
Base Page Object Model - Written from Scratch
Common functionality for all Page Object Models
"""

from playwright.async_api import Page
from abc import ABC, abstractmethod


class BasePage(ABC):
    """Base class for all Page Object Models"""

    def __init__(self, page: Page):
        self.page = page

    async def navigate_to(self, url: str) -> None:
        """Navigate to a specific URL"""
        await self.page.goto(url)
        await self.page.wait_for_load_state("domcontentloaded")

    async def get_page_title(self) -> str:
        """Get the page title"""
        return await self.page.title()

    async def get_current_url(self) -> str:
        """Get the current URL"""
        return self.page.url

    async def wait_for_element(self, selector: str, timeout: int = 5000) -> None:
        """Wait for an element to appear"""
        await self.page.wait_for_selector(selector, timeout=timeout)

    async def wait_for_element_visible(self, selector: str, timeout: int = 5000) -> None:
        """Wait for an element to be visible"""
        await self.page.wait_for_selector(selector, state="visible", timeout=timeout)

    async def wait_for_element_hidden(self, selector: str, timeout: int = 5000) -> None:
        """Wait for an element to be hidden"""
        await self.page.wait_for_selector(selector, state="hidden", timeout=timeout)

    async def click_element(self, selector: str) -> None:
        """Click an element"""
        await self.page.locator(selector).click()

    async def fill_input(self, selector: str, text: str) -> None:
        """Fill an input field"""
        await self.page.locator(selector).fill(text)

    async def get_element_text(self, selector: str) -> str:
        """Get text content of an element"""
        return await self.page.locator(selector).text_content() or ""

    async def is_element_visible(self, selector: str) -> bool:
        """Check if element is visible"""
        try:
            return await self.page.locator(selector).is_visible()
        except:
            return False

    async def is_element_enabled(self, selector: str) -> bool:
        """Check if element is enabled"""
        try:
            return await self.page.locator(selector).is_enabled()
        except:
            return False

    async def get_element_count(self, selector: str) -> int:
        """Get count of elements matching selector"""
        return await self.page.locator(selector).count()

    async def wait_for_load_state(self, state: str = "domcontentloaded") -> None:
        """Wait for page load state"""
        await self.page.wait_for_load_state(state)

    async def take_screenshot(self, path: str = None) -> bytes:
        """Take a screenshot"""
        if path:
            return await self.page.screenshot(path=path)
        else:
            return await self.page.screenshot()

    # Helper method for debugging
    async def debug_page_state(self) -> dict:
        """Get comprehensive page state for debugging"""
        return {
            "url": await self.get_current_url(),
            "title": await self.get_page_title(),
            "cookies": await self.page.context.cookies(),
            "viewport": await self.page.evaluate("({width: window.innerWidth, height: window.innerHeight})")
        }