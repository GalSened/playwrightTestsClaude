from playwright.sync_api import Page, Locator
from .base_page import BasePage
from typing import Dict, Optional
import os


class LoginPage(BasePage):
    """Page Object Model for Login Page"""
    
    def __init__(self, page: Page, base_url: str = None):
        super().__init__(page)
        self.base_url = base_url or os.getenv("BASE_URL", "https://devtest.comda.co.il/")
        self.login_url = f"{self.base_url.rstrip('/')}/login" if not self.base_url.endswith('/login') else self.base_url
        self._init_locators()
        
    def _init_locators(self) -> None:
        """Initialize all locators for the login page with self-healing capabilities"""
        # Primary login form elements based on actual DOM structure
        self.login_form = self.page.locator('form, div:has(input[name="email"]), div:has(input[type="email"])')
        
        # Multiple email input selectors for self-healing
        self.email_input = self.page.locator('''
            input[name="email"], 
            input[placeholder*="Username"], 
            input[placeholder*="Email"], 
            input[placeholder*="email"],
            input[placeholder*="אימייל"],
            input[placeholder*="שם משתמש"],
            input[id*="email"],
            input[id*="username"],
            input[id*="user"],
            input[class*="email"],
            input[class*="username"],
            input[type="email"]
        ''')
        
        # Multiple username input selectors
        self.username_input = self.page.locator('''
            input[name="email"], 
            input[name="username"],
            input[placeholder*="Username"], 
            input[placeholder*="שם משתמש"],
            input[id*="username"],
            input[id*="user"],
            input[class*="username"]
        ''')
        
        # Multiple password input selectors for self-healing
        self.password_input = self.page.locator('''
            input[name="password"], 
            input[placeholder*="Password"], 
            input[placeholder*="password"],
            input[placeholder*="סיסמה"],
            input[id*="password"],
            input[id*="pwd"],
            input[class*="password"],
            input[type="password"]
        ''')
        
        # Multiple login button selectors for self-healing
        self.login_button = self.page.locator('''
            input[type="submit"][value*="Sign in"], 
            input[type="submit"][value*="Login"],
            input[type="submit"][value*="כניסה"],
            input#loginInput,
            button[type="submit"]:has-text("Sign in"),
            button[type="submit"]:has-text("Login"),
            button[type="submit"]:has-text("כניסה"),
            button:has-text("Sign in"),
            button:has-text("Login"),
            button:has-text("כניסה"),
            input[value*="Sign"],
            input[value*="Login"],
            button[class*="login"],
            button[class*="submit"]
        ''')
        
        # Alternative login form selectors with more options
        self.email_field_alt = self.page.locator('input[type="email"], input[autocomplete="email"], input[autocomplete="username"]')
        self.password_field_alt = self.page.locator('input[type="password"], input[autocomplete="current-password"]')  
        self.submit_button_alt = self.page.locator('input[type="submit"], button[type="submit"], button:not([type])')
        self.username_field_alt = self.page.locator('input[autocomplete="username"], input[name="username"]')
        
        # Enhanced error message locators with self-healing
        self.error_message = self.page.locator('''
            .error, .error-message, .alert-danger, .text-danger, .text-error,
            .alert-error, .message-error, .login-error, .auth-error,
            [data-testid="error"], [data-test="error"], [class*="error"],
            [class*="alert"], [class*="message"], .invalid-feedback,
            .form-error, .field-error, div:has-text("שגיאה"), div:has-text("Error")
        ''')
        self.email_error = self.page.locator('''
            .email-error, #email-error, [data-testid="email-error"], 
            [data-test="email-error"], .field-error[data-field="email"],
            input[name="email"] + .error, input[type="email"] + .error
        ''')
        self.password_error = self.page.locator('''
            .password-error, #password-error, [data-testid="password-error"],
            [data-test="password-error"], .field-error[data-field="password"],
            input[name="password"] + .error, input[type="password"] + .error
        ''')
        self.form_error = self.page.locator('''
            .form-error, .login-error, [data-testid="form-error"], 
            .form-message, .auth-error, .login-message,
            form .error, .form .alert, .login-form .error
        ''')
        
        # Success indicators
        self.success_indicator = self.page.locator('.dashboard, .home, [data-testid="dashboard"], .main-content')
        self.user_menu = self.page.locator('.user-menu, .profile-menu, [data-testid="user-menu"]')
        self.logout_button = self.page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("יציאה")')
        
        # Loading indicators
        self.loading_spinner = self.page.locator('.loading, .spinner, [data-testid="loading"]')
        
        # Remember me checkbox
        self.remember_me = self.page.locator('input[name="rememberme"], input[type="checkbox"]')
        
        # Language selector
        self.language_selector = self.page.locator('.language-selector, [data-testid="language"], select[name="language"]')
        
        # Forgot password link
        self.forgot_password = self.page.locator('a:has-text("Forgot Password"), a:has-text("שכחתי סיסמה")')
        
        # Registration link
        self.register_link = self.page.locator('a:has-text("Register"), a:has-text("Sign Up"), a:has-text("הרשמה")')
        
    def navigate_to_login(self) -> None:
        """Navigate to login page"""
        self.navigate_to(self.login_url)
        self.wait_for_page_load()
        
    def get_active_email_input(self) -> Locator:
        """Get the active email input field"""
        for locator in [self.email_input, self.email_field_alt]:
            if self.is_visible(locator, timeout=2000):
                return locator
        return self.email_input  # fallback
        
    def get_active_username_input(self) -> Locator:
        """Get the active username input field"""
        for locator in [self.username_input, self.username_field_alt]:
            if self.is_visible(locator, timeout=2000):
                return locator
        return self.username_input  # fallback
        
    def get_active_password_input(self) -> Locator:
        """Get the active password input field"""
        for locator in [self.password_input, self.password_field_alt]:
            if self.is_visible(locator, timeout=2000):
                return locator
        return self.password_input  # fallback
        
    def get_active_login_button(self) -> Locator:
        """Get the active login button"""
        for locator in [self.login_button, self.submit_button_alt]:
            if self.is_visible(locator, timeout=2000):
                return locator
        return self.login_button  # fallback
        
    def enter_email(self, email: str) -> None:
        """Enter email in email field"""
        email_input = self.get_active_email_input()
        self.fill_input(email_input, email)
        
    def enter_username(self, username: str) -> None:
        """Enter username in username field"""
        username_input = self.get_active_username_input()
        self.fill_input(username_input, username)
        
    def enter_password(self, password: str) -> None:
        """Enter password in password field"""
        password_input = self.get_active_password_input()
        self.fill_input(password_input, password)
        
    def click_login_button(self) -> None:
        """Click login button"""
        login_button = self.get_active_login_button()
        self.click_element(login_button)
        
    def login_with_email(self, email: str, password: str) -> None:
        """Complete login flow using email"""
        self.enter_email(email)
        self.enter_password(password)
        self.click_login_button()
        
    def login_with_username(self, username: str, password: str) -> None:
        """Complete login flow using username"""
        self.enter_username(username)
        self.enter_password(password)
        self.click_login_button()
        
    def wait_for_login_completion(self, timeout: Optional[int] = None) -> None:
        """Wait for login process to complete"""
        timeout = timeout or self.timeout
        # Wait for either success or error
        try:
            self.page.wait_for_function(
                """() => {
                    return document.location.href.includes('/dashboard') ||
                           document.location.href.includes('/home') ||
                           document.querySelector('.error, .error-message, [data-testid="error"]') ||
                           document.querySelector('.dashboard, .home, [data-testid="dashboard"]');
                }""",
                timeout=timeout
            )
        except Exception:
            pass  # Continue with verification
            
    def is_login_successful(self) -> bool:
        """Check if login was successful"""
        # Check for dashboard or success indicators
        success_indicators = [
            lambda: "/dashboard" in self.get_current_url(),
            lambda: "/home" in self.get_current_url(),
            lambda: "/main" in self.get_current_url(),
            lambda: self.is_visible(self.success_indicator, timeout=3000),
            lambda: self.is_visible(self.user_menu, timeout=3000),
            lambda: self.is_visible(self.logout_button, timeout=3000)
        ]
        
        return any(indicator() for indicator in success_indicators)
        
    def get_error_message(self) -> str:
        """Get error message text"""
        error_locators = [
            self.error_message,
            self.form_error,
            self.email_error,
            self.password_error
        ]
        
        for locator in error_locators:
            if self.is_visible(locator, timeout=2000):
                return self.get_text(locator)
                
        return ""
        
    def has_error_message(self) -> bool:
        """Check if error message is displayed"""
        return bool(self.get_error_message())
        
    def clear_login_form(self) -> None:
        """Clear all login form fields"""
        try:
            if self.is_visible(self.get_active_email_input(), timeout=1000):
                self.get_active_email_input().clear()
        except:
            pass
            
        try:
            if self.is_visible(self.get_active_username_input(), timeout=1000):
                self.get_active_username_input().clear()
        except:
            pass
            
        try:
            if self.is_visible(self.get_active_password_input(), timeout=1000):
                self.get_active_password_input().clear()
        except:
            pass
            
    def is_remember_me_checked(self) -> bool:
        """Check if remember me checkbox is checked"""
        if self.is_visible(self.remember_me, timeout=2000):
            return self.remember_me.is_checked()
        return False
        
    def click_remember_me(self) -> None:
        """Click remember me checkbox"""
        if self.is_visible(self.remember_me):
            self.click_element(self.remember_me)
            
    def click_forgot_password(self) -> None:
        """Click forgot password link"""
        if self.is_visible(self.forgot_password):
            self.click_element(self.forgot_password)
            
    def wait_for_loading(self) -> None:
        """Wait for loading spinner to disappear"""
        if self.is_visible(self.loading_spinner, timeout=2000):
            self.loading_spinner.wait_for(state="hidden", timeout=self.timeout)
            
    def get_page_language(self) -> str:
        """Detect page language"""
        page_content = self.page.content()
        if any(hebrew_text in page_content for hebrew_text in ["כניסה", "סיסמה", "אימייל", "שם משתמש"]):
            return "hebrew"
        return "english"
        
    def validate_form_fields_present(self) -> Dict[str, bool]:
        """Validate that required form fields are present"""
        return {
            "email_field": (self.is_visible(self.get_active_email_input(), timeout=2000) or 
                           self.is_visible(self.get_active_username_input(), timeout=2000)),
            "password_field": self.is_visible(self.get_active_password_input(), timeout=2000),
            "login_button": self.is_visible(self.get_active_login_button(), timeout=2000)
        }
        
    def logout(self) -> None:
        """Perform logout if logged in"""
        if self.is_visible(self.logout_button):
            self.click_element(self.logout_button)
            self.wait_for_page_load()