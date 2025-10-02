from playwright.sync_api import Page, Locator
from abc import ABC
import os
from typing import Optional


class BasePage(ABC):
    """Base page class containing common methods for all pages"""
    
    def __init__(self, page: Page):
        self.page = page
        self.timeout = 30000
        self.base_url = os.getenv("BASE_URL", "https://devtest.comda.co.il")
        
    def navigate_to(self, url: str) -> None:
        """Navigate to a specific URL"""
        self.page.goto(url, wait_until="networkidle", timeout=self.timeout)
        
    def wait_for_page_load(self) -> None:
        """Wait for page to load completely"""
        self.page.wait_for_load_state("networkidle", timeout=self.timeout)
        
    def click_element(self, locator: Locator, timeout: Optional[int] = None) -> None:
        """Click on an element with wait"""
        timeout = timeout or self.timeout
        locator.wait_for(state="visible", timeout=timeout)
        locator.click(timeout=timeout)
        
    def fill_input(self, locator: Locator, text: str, timeout: Optional[int] = None) -> None:
        """Fill input field with text"""
        timeout = timeout or self.timeout
        locator.wait_for(state="visible", timeout=timeout)
        locator.clear()
        locator.fill(text, timeout=timeout)
        
    def get_text(self, locator: Locator, timeout: Optional[int] = None) -> str:
        """Get text content of an element"""
        timeout = timeout or self.timeout
        locator.wait_for(state="visible", timeout=timeout)
        return locator.text_content(timeout=timeout) or ""
        
    def is_visible(self, locator: Locator, timeout: int = 5000) -> bool:
        """Check if element is visible"""
        try:
            locator.wait_for(state="visible", timeout=timeout)
            return True
        except Exception:
            return False
            
    def is_hidden(self, locator: Locator, timeout: int = 5000) -> bool:
        """Check if element is hidden"""
        try:
            locator.wait_for(state="hidden", timeout=timeout)
            return True
        except Exception:
            return False
            
    def wait_for_url_contains(self, url_part: str, timeout: Optional[int] = None) -> None:
        """Wait for URL to contain specific text"""
        timeout = timeout or self.timeout
        self.page.wait_for_url(f"**/*{url_part}*", timeout=timeout)
        
    def get_current_url(self) -> str:
        """Get current page URL"""
        return self.page.url
        
    def take_screenshot(self, name: str) -> str:
        """Take screenshot and return path"""
        screenshot_path = f"artifacts/screenshots/{name}.png"
        self.page.screenshot(path=screenshot_path, full_page=True)
        return screenshot_path
        
    def scroll_to_element(self, locator: Locator) -> None:
        """Scroll to element"""
        locator.scroll_into_view_if_needed()
        
    def wait_for_element_stable(self, locator: Locator, timeout: Optional[int] = None) -> None:
        """Wait for element to be stable (not moving)"""
        timeout = timeout or self.timeout
        locator.wait_for(state="visible", timeout=timeout)
        # Wait a bit more for animations to complete
        self.page.wait_for_timeout(500)
        
    def get_page_title(self) -> str:
        """Get page title"""
        return self.page.title()
        
    def press_key(self, key: str) -> None:
        """Press a key"""
        self.page.keyboard.press(key)
        
    def get_element_attribute(self, locator: Locator, attribute: str) -> Optional[str]:
        """Get element attribute value"""
        return locator.get_attribute(attribute)
        
    def hover_element(self, locator: Locator, timeout: Optional[int] = None) -> None:
        """Hover over an element"""
        timeout = timeout or self.timeout
        locator.wait_for(state="visible", timeout=timeout)
        locator.hover(timeout=timeout)