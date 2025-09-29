"""
Authentication Page Object Model - Written from Scratch
Comprehensive POM for WeSign authentication functionality
"""

from playwright.async_api import Page, expect
from .base_page import BasePage
import asyncio


class AuthPage(BasePage):
    """Page Object Model for Authentication/Login functionality"""

    def __init__(self, page: Page):
        super().__init__(page)
        self.base_url = "https://devtest.comda.co.il"

        # Login form selectors (based on actual WeSign HTML)
        self.email_field = 'input[name="email"]'
        self.password_field = 'input[name="password"]'
        self.login_button = 'button[type="submit"], input[type="submit"]'

        # Language interface selectors
        self.language_selector = '[role="combobox"], select[name*="language"], .language-selector'
        self.hebrew_option = 'text=עברית, option[value="he"], [data-lang="he"]'
        self.english_option = 'text=English, option[value="en"], [data-lang="en"]'

        # Form elements
        self.forgot_password_link = 'a[routerlink="forget"]'
        self.remember_me_checkbox = 'input[type="checkbox"][name*="remember"], input[id*="remember"]'

        # Error and validation selectors
        self.error_messages = '.error, .alert-error, [role="alert"], .validation-error'

        # Credentials for different user types
        self.company_user_credentials = {
            "email": "nirk@comsign.co.il",
            "password": "Comsign1!"
        }

    async def navigate(self) -> None:
        """Navigate to the login page"""
        await self.page.goto(f"{self.base_url}/")
        await self.page.wait_for_load_state("domcontentloaded")

    async def is_login_form_visible(self) -> bool:
        """Check if login form is visible"""
        try:
            email_visible = await self.page.locator(self.email_field).first.is_visible()
            password_visible = await self.page.locator(self.password_field).first.is_visible()
            login_button_visible = await self.page.locator(self.login_button).first.is_visible()
            return email_visible and password_visible and login_button_visible
        except:
            return False

    async def enter_credentials(self, email: str, password: str) -> None:
        """Enter email and password credentials"""
        if email:
            await self.page.locator(self.email_field).first.fill(email)
        if password:
            await self.page.locator(self.password_field).first.fill(password)

    async def enter_email(self, email: str) -> None:
        """Enter email only"""
        await self.page.locator(self.email_field).first.fill(email)

    async def enter_password(self, password: str) -> None:
        """Enter password only"""
        await self.page.locator(self.password_field).first.fill(password)

    async def click_login_button(self) -> None:
        """Click the login button"""
        await self.page.locator(self.login_button).first.click()
        await self.page.wait_for_timeout(3000)  # Wait for form submission

    async def login_with_company_user(self) -> None:
        """Login with company user credentials"""
        await self.enter_credentials(
            self.company_user_credentials["email"],
            self.company_user_credentials["password"]
        )
        await self.click_login_button()

    async def login_with_basic_user(self) -> None:
        """Login with basic user credentials (same as company for now)"""
        await self.login_with_company_user()

    async def is_login_successful(self) -> bool:
        """Check if login was successful (reached dashboard)"""
        try:
            await self.page.wait_for_url("**/dashboard**", timeout=10000)
            return "dashboard" in self.page.url
        except:
            # Alternative check: look for dashboard elements
            try:
                dashboard_indicators = [
                    'text=ראשי',
                    'text=מסמכים',
                    '[href*="dashboard"]',
                    'text=Dashboard'
                ]
                for indicator in dashboard_indicators:
                    if await self.page.locator(indicator).count() > 0:
                        return True
                return False
            except:
                return False

    async def is_still_on_login_page(self) -> bool:
        """Check if still on login page (login failed)"""
        current_url = self.page.url
        is_on_login = (
            current_url == self.base_url or
            current_url == f"{self.base_url}/" or
            "login" in current_url.lower()
        )

        # Also check if login form is still visible
        if is_on_login:
            form_visible = await self.is_login_form_visible()
            return form_visible

        return is_on_login

    async def has_error_indication(self) -> bool:
        """Check if there's any error indication on the page"""
        try:
            # Check for explicit error messages
            if await self.page.locator(self.error_messages).count() > 0:
                return True

            # Check HTML5 validation errors
            email_invalid = await self.is_email_field_invalid()
            password_invalid = await self.is_password_field_invalid()

            return email_invalid or password_invalid
        except:
            return False

    async def is_error_message_visible(self) -> bool:
        """Check if error message is visible (alias for has_error_indication)"""
        return await self.has_error_indication()

    async def is_email_field_invalid(self) -> bool:
        """Check if email field has validation error"""
        try:
            email_field = self.page.locator(self.email_field).first
            validity = await email_field.evaluate("element => element.validity.valid")
            return not validity
        except:
            return False

    async def is_password_field_invalid(self) -> bool:
        """Check if password field has validation error"""
        try:
            password_field = self.page.locator(self.password_field).first
            validity = await password_field.evaluate("element => element.validity.valid")
            return not validity
        except:
            return False

    async def set_language(self, language: str) -> None:
        """Set the interface language"""
        try:
            language_selector = self.page.locator(self.language_selector).first

            if await language_selector.count() > 0 and await language_selector.is_visible():
                await language_selector.click()
                await self.page.wait_for_timeout(1000)

                if language.lower() == "hebrew":
                    hebrew_option = self.page.locator(self.hebrew_option).first
                    if await hebrew_option.is_visible():
                        await hebrew_option.click()
                elif language.lower() == "english":
                    english_option = self.page.locator(self.english_option).first
                    if await english_option.is_visible():
                        await english_option.click()

                await self.page.wait_for_timeout(2000)  # Wait for language change
        except:
            # Language switching might not be available
            pass

    async def is_hebrew_interface_active(self) -> bool:
        """Check if Hebrew interface is currently active"""
        try:
            # Check HTML lang attribute
            html_lang = await self.page.get_attribute('html', 'lang')
            if html_lang and 'he' in html_lang:
                return True

            # Check for Hebrew placeholders
            hebrew_placeholders = [
                'input[placeholder*="שם משתמש"]',
                'input[placeholder*="דואר אלקטרוני"]',
                'input[placeholder*="סיסמה"]'
            ]

            for placeholder in hebrew_placeholders:
                if await self.page.locator(placeholder).count() > 0:
                    return True

            return False
        except:
            return False

    async def is_english_interface_available(self) -> bool:
        """Check if English interface is available"""
        try:
            return await self.page.locator(self.english_option).count() > 0
        except:
            return False

    async def is_english_interface_active(self) -> bool:
        """Check if English interface is currently active"""
        try:
            # Check HTML lang attribute
            html_lang = await self.page.get_attribute('html', 'lang')
            if html_lang and 'en' in html_lang:
                return True

            # Check for English placeholders
            english_placeholders = [
                'input[placeholder*="Username"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="Password"]'
            ]

            for placeholder in english_placeholders:
                if await self.page.locator(placeholder).count() > 0:
                    return True

            return False
        except:
            return False

    async def has_rtl_direction(self) -> bool:
        """Check if page has RTL text direction"""
        try:
            direction = await self.page.evaluate("getComputedStyle(document.documentElement).direction")
            return direction == "rtl"
        except:
            return False

    async def has_ltr_direction(self) -> bool:
        """Check if page has LTR text direction"""
        try:
            direction = await self.page.evaluate("getComputedStyle(document.documentElement).direction")
            return direction != "rtl"
        except:
            return True

    async def has_hebrew_placeholders(self) -> bool:
        """Check if Hebrew placeholders are displayed"""
        try:
            hebrew_placeholders = [
                'input[placeholder*="שם משתמש"]',
                'input[placeholder*="דואר אלקטרוני"]',
                'input[placeholder*="סיסמה"]'
            ]

            for placeholder in hebrew_placeholders:
                if await self.page.locator(placeholder).count() > 0:
                    return True

            return False
        except:
            return False

    async def has_english_placeholders(self) -> bool:
        """Check if English placeholders are displayed"""
        try:
            english_placeholders = [
                'input[placeholder*="Username"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="Password"]'
            ]

            for placeholder in english_placeholders:
                if await self.page.locator(placeholder).count() > 0:
                    return True

            return False
        except:
            return False

    async def is_back_to_login(self) -> bool:
        """Check if redirected back to login page"""
        return await self.is_still_on_login_page()

    async def is_forgot_password_visible(self) -> bool:
        """Check if forgot password link is visible"""
        try:
            return await self.page.locator(self.forgot_password_link).count() > 0
        except:
            return False

    async def click_forgot_password(self) -> None:
        """Click the forgot password link"""
        if await self.is_forgot_password_visible():
            await self.page.locator(self.forgot_password_link).first.click()
            await self.page.wait_for_load_state("domcontentloaded")

    async def is_on_password_reset_page(self) -> bool:
        """Check if on password reset page"""
        current_url = self.page.url
        return "forgot" in current_url or "reset" in current_url

    async def enter_reset_email(self, email: str) -> None:
        """Enter email for password reset"""
        reset_email_field = 'input[type="email"], input[name*="email"]'
        await self.page.locator(reset_email_field).fill(email)

    async def submit_reset_request(self) -> None:
        """Submit password reset request"""
        submit_button = 'input[type="submit"], button[type="submit"], button:has-text("Submit")'
        await self.page.locator(submit_button).click()

    async def get_reset_response_message(self) -> str:
        """Get the response message after reset request"""
        try:
            message_selectors = ['.message', '.alert', '.notification', '.response']
            for selector in message_selectors:
                if await self.page.locator(selector).count() > 0:
                    return await self.page.locator(selector).text_content() or ""
            return ""
        except:
            return ""

    # Additional helper methods for extended testing

    async def get_email_field(self):
        """Get the email field locator"""
        return self.page.locator(self.email_field).first

    async def get_password_field(self):
        """Get the password field locator"""
        return self.page.locator(self.password_field).first

    async def get_email_value(self) -> str:
        """Get current email field value"""
        try:
            return await self.page.locator(self.email_field).first.input_value()
        except:
            return ""

    async def has_form_been_submitted(self) -> bool:
        """Check if form has been submitted"""
        try:
            await self.page.wait_for_timeout(2000)
            current_url = self.page.url

            # Form submission indicators
            indicators = [
                "dashboard" in current_url,
                await self.has_error_indication(),
                await self.is_email_field_invalid(),
                await self.is_password_field_invalid()
            ]

            return any(indicators)
        except:
            return False

    # Security testing helpers
    async def is_rate_limited(self) -> bool:
        """Check if rate limiting is active"""
        try:
            rate_limit_indicators = ['.rate-limit', '.too-many-attempts', '.blocked']
            for indicator in rate_limit_indicators:
                if await self.page.locator(indicator).count() > 0:
                    return True
            return False
        except:
            return False

    async def has_rate_limit_message(self) -> bool:
        """Check if rate limit message is displayed"""
        return await self.is_rate_limited()

    async def has_captcha_protection(self) -> bool:
        """Check if CAPTCHA protection is active"""
        try:
            captcha_selectors = ['.captcha', '.recaptcha', '.hcaptcha']
            for selector in captcha_selectors:
                if await self.page.locator(selector).count() > 0:
                    return True
            return False
        except:
            return False

    async def is_account_locked(self) -> bool:
        """Check if account is locked"""
        try:
            lock_indicators = ['.account-locked', '.locked', 'text=locked', 'text=נעול']
            for indicator in lock_indicators:
                if await self.page.locator(indicator).count() > 0:
                    return True
            return False
        except:
            return False

    # Extended functionality for additional test scenarios
    async def has_remember_me_checkbox(self) -> bool:
        """Check if remember me checkbox exists"""
        try:
            return await self.page.locator(self.remember_me_checkbox).count() > 0
        except:
            return False

    async def check_remember_me(self) -> None:
        """Check the remember me checkbox"""
        if await self.has_remember_me_checkbox():
            await self.page.locator(self.remember_me_checkbox).check()

    async def uncheck_remember_me(self) -> None:
        """Uncheck the remember me checkbox"""
        if await self.has_remember_me_checkbox():
            await self.page.locator(self.remember_me_checkbox).uncheck()

    async def has_password_visibility_toggle(self) -> bool:
        """Check if password visibility toggle exists"""
        try:
            toggle_selectors = ['.password-toggle', '[data-toggle="password"]', '.eye-icon']
            for selector in toggle_selectors:
                if await self.page.locator(selector).count() > 0:
                    return True
            return False
        except:
            return False

    async def toggle_password_visibility(self) -> None:
        """Toggle password visibility"""
        if await self.has_password_visibility_toggle():
            toggle_selectors = ['.password-toggle', '[data-toggle="password"]', '.eye-icon']
            for selector in toggle_selectors:
                if await self.page.locator(selector).count() > 0:
                    await self.page.locator(selector).first.click()
                    break

    async def is_password_hidden(self) -> bool:
        """Check if password is hidden"""
        try:
            field_type = await self.page.locator(self.password_field).first.get_attribute("type")
            return field_type == "password"
        except:
            return True

    async def is_password_visible(self) -> bool:
        """Check if password is visible"""
        return not await self.is_password_hidden()

    async def has_password_strength_validation(self) -> bool:
        """Check if password strength validation exists"""
        try:
            strength_indicators = ['.password-strength', '.strength-meter', '.password-requirements']
            for indicator in strength_indicators:
                if await self.page.locator(indicator).count() > 0:
                    return True
            return False
        except:
            return False

    async def has_password_strength_error(self) -> bool:
        """Check if password strength error is shown"""
        try:
            error_indicators = ['.weak-password', '.password-error', '.strength-error']
            for indicator in error_indicators:
                if await self.page.locator(indicator).is_visible():
                    return True
            return False
        except:
            return False

    # Additional methods for comprehensive testing compatibility
    async def is_language_selector_available(self) -> bool:
        """Check if language selector is available"""
        try:
            return await self.page.locator(self.language_selector).count() > 0
        except:
            return False

    async def get_current_language(self) -> str:
        """Get current language setting"""
        try:
            if await self.is_hebrew_interface_active():
                return "hebrew"
            elif await self.is_english_interface_active():
                return "english"
            else:
                return "unknown"
        except:
            return "unknown"

    async def switch_language(self) -> None:
        """Switch between available languages"""
        try:
            current_lang = await self.get_current_language()
            if current_lang == "hebrew" and await self.is_english_interface_available():
                await self.set_language("english")
            elif current_lang == "english":
                await self.set_language("hebrew")
        except:
            pass

    async def get_hebrew_text_elements(self) -> list:
        """Get Hebrew text elements on the page"""
        try:
            hebrew_selectors = [
                'text=שם משתמש',
                'text=סיסמה',
                'text=התחבר',
                'text=דואר אלקטרוני'
            ]
            elements = []
            for selector in hebrew_selectors:
                if await self.page.locator(selector).count() > 0:
                    elements.append(selector)
            return elements
        except:
            return []

    async def get_english_text_elements(self) -> list:
        """Get English text elements on the page"""
        try:
            english_selectors = [
                'text=Username',
                'text=Password',
                'text=Login',
                'text=Sign in',
                'text=Email'
            ]
            elements = []
            for selector in english_selectors:
                if await self.page.locator(selector).count() > 0:
                    elements.append(selector)
            return elements
        except:
            return []

    async def is_rtl_layout_active(self) -> bool:
        """Check if RTL layout is active"""
        return await self.has_rtl_direction()

    async def is_ltr_layout_active(self) -> bool:
        """Check if LTR layout is active"""
        return await self.has_ltr_direction()

    async def is_network_error_visible(self) -> bool:
        """Check if network error message is visible"""
        try:
            network_error_selectors = [
                '.network-error',
                '.connection-error',
                'text=Network Error',
                'text=Connection Failed',
                'text=אין חיבור לאינטרנט'
            ]
            for selector in network_error_selectors:
                if await self.page.locator(selector).count() > 0:
                    return True
            return False
        except:
            return False

    async def is_registration_available(self) -> bool:
        """Check if registration is available"""
        try:
            registration_selectors = [
                'a[href*="register"]',
                'a[href*="signup"]',
                'text=Register',
                'text=Sign Up',
                'text=הרשמה'
            ]
            for selector in registration_selectors:
                if await self.page.locator(selector).count() > 0:
                    return True
            return False
        except:
            return False

    async def navigate_to_registration(self) -> None:
        """Navigate to registration page"""
        try:
            registration_selectors = [
                'a[href*="register"]',
                'a[href*="signup"]',
                'text=Register',
                'text=Sign Up'
            ]
            for selector in registration_selectors:
                if await self.page.locator(selector).count() > 0:
                    await self.page.locator(selector).first.click()
                    await self.page.wait_for_load_state("domcontentloaded")
                    break
        except:
            pass

    async def enter_registration_password(self, password: str) -> None:
        """Enter password for registration"""
        try:
            password_selectors = [
                'input[name="password"]',
                'input[type="password"]',
                '#password'
            ]
            for selector in password_selectors:
                if await self.page.locator(selector).count() > 0:
                    await self.page.locator(selector).first.fill(password)
                    break
        except:
            pass

    async def is_password_weak(self) -> bool:
        """Check if password is detected as weak"""
        try:
            weak_indicators = [
                '.weak-password',
                '.password-weak',
                'text=Weak Password',
                'text=סיסמה חלשה'
            ]
            for indicator in weak_indicators:
                if await self.page.locator(indicator).count() > 0:
                    return True
            return False
        except:
            return False

    async def is_page_loaded(self) -> bool:
        """Check if page is loaded"""
        try:
            await self.page.wait_for_load_state("domcontentloaded", timeout=10000)
            return await self.is_login_form_visible()
        except:
            return False

    async def detect_language_and_layout(self) -> dict:
        """Detect current language and layout information"""
        try:
            return {
                "hebrew_active": await self.is_hebrew_interface_active(),
                "english_active": await self.is_english_interface_active(),
                "rtl_layout": await self.is_rtl_layout_active(),
                "ltr_layout": await self.is_ltr_layout_active(),
                "current_language": await self.get_current_language()
            }
        except:
            return {
                "hebrew_active": False,
                "english_active": False,
                "rtl_layout": False,
                "ltr_layout": True,
                "current_language": "unknown"
            }

    async def test_form_validation(self) -> dict:
        """Test form validation and return results"""
        try:
            validation_results = {
                "empty_email_validation": False,
                "empty_password_validation": False,
                "invalid_email_format": False
            }

            # Test empty email
            await self.enter_credentials("", "somepassword")
            await self.click_login_button()
            validation_results["empty_email_validation"] = await self.is_email_field_invalid()

            # Reset and test empty password
            await self.page.reload()
            await self.enter_credentials("test@example.com", "")
            await self.click_login_button()
            validation_results["empty_password_validation"] = await self.is_password_field_invalid()

            # Reset and test invalid email format
            await self.page.reload()
            await self.enter_credentials("notanemail", "password")
            await self.click_login_button()
            validation_results["invalid_email_format"] = await self.is_email_field_invalid()

            return validation_results
        except:
            return {
                "empty_email_validation": False,
                "empty_password_validation": False,
                "invalid_email_format": False
            }