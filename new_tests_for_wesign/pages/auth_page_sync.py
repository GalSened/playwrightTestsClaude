"""
Authentication Page Object Model - SYNC VERSION
Simplified SYNC Playwright POM for systematic testing
"""

from playwright.sync_api import Page, expect


class AuthPage:
    """SYNC Page Object Model for Authentication/Login functionality"""

    def __init__(self, page: Page):
        self.page = page
        self.base_url = "https://devtest.comda.co.il"

        # Login form selectors
        self.email_field = 'input[name="email"]'
        self.password_field = 'input[name="password"]'
        self.login_button = 'button[type="submit"], input[type="submit"]'

        # Credentials
        self.company_user_credentials = {
            "email": "nirk@comsign.co.il",
            "password": "Comsign1!"
        }

    def navigate(self) -> None:
        """Navigate to the login page"""
        self.page.goto(f"{self.base_url}/")
        self.page.wait_for_load_state("domcontentloaded")

    def enter_credentials(self, email: str, password: str) -> None:
        """Enter email and password credentials"""
        if email:
            self.page.locator(self.email_field).first.fill(email)
        if password:
            self.page.locator(self.password_field).first.fill(password)

    def click_login_button(self) -> None:
        """Click the login button"""
        self.page.locator(self.login_button).first.click()
        self.page.wait_for_timeout(3000)  # Wait for form submission

    def login_with_company_user(self) -> None:
        """Login with company user credentials"""
        self.enter_credentials(
            self.company_user_credentials["email"],
            self.company_user_credentials["password"]
        )
        self.click_login_button()

    def is_login_successful(self) -> bool:
        """Check if login was successful (reached dashboard)"""
        try:
            self.page.wait_for_url("**/dashboard**", timeout=10000)
            return "dashboard" in self.page.url
        except:
            # Alternative check: look for dashboard elements
            try:
                dashboard_indicators = ['text=ראשי', 'text=מסמכים']
                for indicator in dashboard_indicators:
                    if self.page.locator(indicator).count() > 0:
                        return True
                return False
            except:
                return False
