"""
Smart Wait Utilities for Playwright Tests
Replacement for hard waits with conditional, event-driven waits
"""

from playwright.async_api import Page, Locator
import asyncio
from typing import Optional, Union, List, Dict, Any
from enum import Enum


class WaitCondition(Enum):
    """Common wait conditions for UI interactions"""
    ELEMENT_VISIBLE = "visible"
    ELEMENT_HIDDEN = "hidden"
    ELEMENT_ATTACHED = "attached"
    ELEMENT_DETACHED = "detached"
    ELEMENT_ENABLED = "enabled"
    ELEMENT_DISABLED = "disabled"
    TEXT_CONTENT = "text_content"
    URL_CHANGE = "url_change"
    NETWORK_IDLE = "network_idle"
    LOADING_COMPLETE = "loading_complete"


class SmartWaits:
    """Smart waiting utilities to replace hard timeout waits"""

    def __init__(self, page: Page, default_timeout: int = 10000):
        self.page = page
        self.default_timeout = default_timeout

    async def wait_for_element_state(
        self,
        selector: str,
        condition: WaitCondition,
        timeout: int = None,
        text_content: str = None
    ) -> bool:
        """
        Wait for element to reach specific state

        Args:
            selector: Element selector
            condition: WaitCondition to wait for
            timeout: Max wait time (ms)
            text_content: Expected text content (for TEXT_CONTENT condition)

        Returns:
            bool: True if condition met, False if timeout
        """
        timeout = timeout or self.default_timeout

        try:
            locator = self.page.locator(selector).first

            if condition == WaitCondition.ELEMENT_VISIBLE:
                await locator.wait_for(state="visible", timeout=timeout)
            elif condition == WaitCondition.ELEMENT_HIDDEN:
                await locator.wait_for(state="hidden", timeout=timeout)
            elif condition == WaitCondition.ELEMENT_ATTACHED:
                await locator.wait_for(state="attached", timeout=timeout)
            elif condition == WaitCondition.ELEMENT_DETACHED:
                await locator.wait_for(state="detached", timeout=timeout)
            elif condition == WaitCondition.TEXT_CONTENT and text_content:
                await self.page.wait_for_function(
                    f"document.querySelector('{selector}')?.textContent?.includes('{text_content}')",
                    timeout=timeout
                )

            return True

        except Exception as e:
            print(f"Wait condition failed for {selector}: {e}")
            return False

    async def wait_for_navigation_complete(self, timeout: int = None) -> bool:
        """
        Wait for page navigation to complete
        Replaces: await page.wait_for_timeout(3000) after navigation
        """
        timeout = timeout or self.default_timeout

        try:
            # Wait for network to be idle (no requests for 500ms)
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
            return True
        except Exception as e:
            print(f"Navigation wait failed: {e}")
            return False

    async def wait_for_form_submission(
        self,
        form_selector: str = "form",
        success_indicator: str = None,
        error_indicator: str = None,
        timeout: int = None
    ) -> Dict[str, Any]:
        """
        Wait for form submission to complete
        Replaces: await page.wait_for_timeout(2000) after form submit

        Returns:
            Dict with status and indicators found
        """
        timeout = timeout or self.default_timeout

        result = {
            "success": False,
            "error": False,
            "status": "timeout",
            "indicators_found": []
        }

        try:
            # Wait for either success or error indicator
            conditions = []

            if success_indicator:
                conditions.append(f"document.querySelector('{success_indicator}')")
            if error_indicator:
                conditions.append(f"document.querySelector('{error_indicator}')")

            if conditions:
                # Wait for any success/error indicator to appear
                await self.page.wait_for_function(
                    f"({' || '.join(conditions)})",
                    timeout=timeout
                )

                # Check which indicators are present
                if success_indicator and await self.page.locator(success_indicator).count() > 0:
                    result["success"] = True
                    result["status"] = "success"
                    result["indicators_found"].append(success_indicator)

                if error_indicator and await self.page.locator(error_indicator).count() > 0:
                    result["error"] = True
                    result["status"] = "error"
                    result["indicators_found"].append(error_indicator)
            else:
                # Fallback: wait for network idle
                await self.page.wait_for_load_state("networkidle", timeout=timeout)
                result["status"] = "network_idle"

            return result

        except Exception as e:
            print(f"Form submission wait failed: {e}")
            result["status"] = "timeout"
            return result

    async def wait_for_file_upload_complete(
        self,
        upload_button_selector: str = None,
        progress_indicator: str = None,
        success_indicator: str = None,
        timeout: int = 30000  # File uploads can take longer
    ) -> bool:
        """
        Wait for file upload to complete
        Replaces: await page.wait_for_timeout(5000) after file upload
        """
        try:
            # Wait for upload progress to start (if indicator exists)
            if progress_indicator:
                await self.wait_for_element_state(progress_indicator, WaitCondition.ELEMENT_VISIBLE, 5000)
                # Then wait for progress to finish (element disappears)
                await self.wait_for_element_state(progress_indicator, WaitCondition.ELEMENT_HIDDEN, timeout)

            # Wait for success indicator
            if success_indicator:
                await self.wait_for_element_state(success_indicator, WaitCondition.ELEMENT_VISIBLE, 5000)

            # Always wait for network to be idle
            await self.page.wait_for_load_state("networkidle", timeout=10000)
            return True

        except Exception as e:
            print(f"File upload wait failed: {e}")
            return False

    async def wait_for_dynamic_content(
        self,
        container_selector: str,
        min_items: int = 1,
        item_selector: str = None,
        timeout: int = None
    ) -> bool:
        """
        Wait for dynamic content to load (lists, search results, etc.)
        Replaces: await page.wait_for_timeout(2000) after search/filter
        """
        timeout = timeout or self.default_timeout

        try:
            if item_selector:
                # Wait for specific number of items to appear
                await self.page.wait_for_function(
                    f"document.querySelectorAll('{container_selector} {item_selector}').length >= {min_items}",
                    timeout=timeout
                )
            else:
                # Just wait for container to have content
                await self.page.wait_for_function(
                    f"document.querySelector('{container_selector}')?.children?.length >= {min_items}",
                    timeout=timeout
                )

            return True

        except Exception as e:
            print(f"Dynamic content wait failed: {e}")
            return False

    async def wait_for_api_response(
        self,
        api_pattern: str,
        method: str = "GET",
        timeout: int = None
    ) -> bool:
        """
        Wait for specific API response
        Replaces: await page.wait_for_timeout(1000) after API calls
        """
        timeout = timeout or self.default_timeout

        try:
            async with self.page.expect_response(
                lambda response: api_pattern in response.url and response.request.method == method,
                timeout=timeout
            ) as response_info:
                response = await response_info.value
                return response.ok

        except Exception as e:
            print(f"API response wait failed: {e}")
            return False

    async def wait_for_modal_interaction(
        self,
        modal_selector: str,
        action: str = "appear",  # "appear" or "disappear"
        backdrop_selector: str = ".modal-backdrop, .overlay",
        timeout: int = None
    ) -> bool:
        """
        Wait for modal to appear or disappear
        Replaces: await page.wait_for_timeout(1000) for modal interactions
        """
        timeout = timeout or self.default_timeout

        try:
            if action == "appear":
                # Wait for modal to be visible
                await self.wait_for_element_state(modal_selector, WaitCondition.ELEMENT_VISIBLE, timeout)
            elif action == "disappear":
                # Wait for modal to be hidden
                await self.wait_for_element_state(modal_selector, WaitCondition.ELEMENT_HIDDEN, timeout)

                # Also wait for backdrop to disappear if present
                if await self.page.locator(backdrop_selector).count() > 0:
                    await self.wait_for_element_state(backdrop_selector, WaitCondition.ELEMENT_HIDDEN, timeout)

            return True

        except Exception as e:
            print(f"Modal interaction wait failed: {e}")
            return False

    async def wait_for_language_change(
        self,
        language_indicators: List[str],
        timeout: int = None
    ) -> str:
        """
        Wait for language change to complete
        Replaces: await page.wait_for_timeout(1000) after language switch

        Returns:
            str: Detected language or "unknown"
        """
        timeout = timeout or self.default_timeout

        try:
            # Wait for any language indicator to appear
            conditions = [f"document.querySelector('{indicator}')" for indicator in language_indicators]

            await self.page.wait_for_function(
                f"({' || '.join(conditions)})",
                timeout=timeout
            )

            # Determine which language is active
            for indicator in language_indicators:
                if await self.page.locator(indicator).count() > 0:
                    return indicator

            return "unknown"

        except Exception as e:
            print(f"Language change wait failed: {e}")
            return "unknown"

    async def wait_with_retry(
        self,
        condition_func,
        max_attempts: int = 3,
        retry_delay: int = 1000,
        timeout_per_attempt: int = None
    ) -> bool:
        """
        Retry a wait condition multiple times
        Useful for flaky elements or network conditions
        """
        timeout_per_attempt = timeout_per_attempt or (self.default_timeout // max_attempts)

        for attempt in range(max_attempts):
            try:
                result = await condition_func(timeout_per_attempt)
                if result:
                    return True
            except Exception as e:
                print(f"Wait attempt {attempt + 1} failed: {e}")

                if attempt < max_attempts - 1:
                    await asyncio.sleep(retry_delay / 1000)  # Convert to seconds

        return False


class WeSignSmartWaits(SmartWaits):
    """WeSign-specific smart wait utilities"""

    def __init__(self, page: Page):
        super().__init__(page, default_timeout=15000)  # WeSign can be slower

    async def wait_for_dashboard_load(self) -> bool:
        """Wait for WeSign dashboard to fully load"""
        return await self.wait_for_element_state(
            "header.ct-p-home, .dashboard-content",
            WaitCondition.ELEMENT_VISIBLE,
            20000
        )

    async def wait_for_document_upload(self) -> bool:
        """Wait for document upload to complete in WeSign"""
        try:
            # Wait for any progress indicators to appear and then disappear
            progress_selectors = [".upload-progress", ".progress-bar", "[class*='progress']", "[class*='upload']"]

            # First wait for progress to start (optional)
            for selector in progress_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=2000)
                    # Then wait for it to disappear
                    await self.page.wait_for_selector(selector, state="hidden", timeout=25000)
                    break
                except:
                    continue

            # Wait for network to be idle
            await self.page.wait_for_load_state("networkidle", timeout=15000)
            return True

        except Exception:
            # Fallback: just wait for network idle
            try:
                await self.page.wait_for_load_state("networkidle", timeout=10000)
                return True
            except:
                return False

    async def wait_for_login_result(self) -> Dict[str, Any]:
        """Wait for login attempt to complete"""
        try:
            # Wait for either navigation to dashboard OR error message
            await asyncio.wait_for(
                self.page.wait_for_url("**/dashboard**", timeout=10000),
                timeout=12.0
            )
            return {"success": True, "status": "success", "error": False, "indicators_found": ["dashboard_url"]}
        except (asyncio.TimeoutError, Exception):
            # Check for error indicators
            error_selectors = [
                ".error-message",
                ".alert-danger",
                "[class*='error']",
                "[class*='danger']"
            ]

            for selector in error_selectors:
                if await self.page.locator(selector).count() > 0:
                    return {"success": False, "error": True, "status": "error", "indicators_found": [selector]}

            # Default: assume we're still on login page (login failed)
            return {"success": False, "error": False, "status": "login_page", "indicators_found": []}

    async def wait_for_template_operation(self) -> bool:
        """Wait for template-related operations"""
        return await self.wait_for_element_state(
            ".template-list, .templates-container",
            WaitCondition.ELEMENT_VISIBLE,
            timeout=10000
        )

    async def wait_for_language_switch(self) -> str:
        """Wait for WeSign language switch to complete"""
        try:
            # Wait for page to stabilize after language switch
            await self.page.wait_for_load_state("networkidle", timeout=10000)

            # Check for Hebrew indicators (more reliable than text selectors)
            if await self.page.locator("[dir='rtl'], html[lang='he']").count() > 0:
                return "hebrew"
            elif await self.page.locator("[dir='ltr'], html[lang='en']").count() > 0:
                return "english"
            else:
                return "unknown"
        except Exception:
            return "unknown"