import pytest
from playwright.sync_api import Page, expect
from src.utils.test_helpers import TestHelpers
from src.utils.locators import LocatorHelper
import allure


@allure.feature("Login Functionality")
@allure.story("Positive Login Tests")
class TestLoginPositive:
    """Positive test cases for login functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, test_config, test_helpers):
        """Setup for each test using centralized fixtures"""
        self.page = page
        self.test_helpers = test_helpers
        self.test_config = test_config
        self.locator_helper = LocatorHelper(page)
        
    @allure.title("Test successful login with valid email and password")
    @allure.description("Verify user can login successfully with valid email and password")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_with_email_success(self):
        """Test successful login using email and centralized locators"""
        page = self.page
        
        with allure.step("Navigate to login page"):
            page.goto(self.test_config.urls['base_url'])
            page.wait_for_load_state('networkidle')
            
        with allure.step("Verify login form is displayed using centralized locators"):
            # Use centralized locators for form validation
            username_field = self.locator_helper.wait_for_element_with_fallbacks('login', 'username_input', timeout=10000)
            expect(username_field).to_be_visible()
            allure.attach("Username field verified", name="Form Validation", attachment_type=allure.attachment_type.TEXT)
            
            password_field = self.locator_helper.wait_for_element_with_fallbacks('login', 'password_input', timeout=10000)
            expect(password_field).to_be_visible()
            allure.attach("Password field verified", name="Form Validation", attachment_type=allure.attachment_type.TEXT)
            
            login_button = self.locator_helper.wait_for_element_with_fallbacks('login', 'login_button', timeout=10000)
            expect(login_button).to_be_visible()
            allure.attach("Login button verified", name="Form Validation", attachment_type=allure.attachment_type.TEXT)
            
        with allure.step("Enter valid credentials"):
            company_user = self.test_config.get_user_credentials('company_user')
            assert company_user, "Company user credentials not found in config"
            
            # Fill username using centralized locators
            success = self.locator_helper.fill_with_fallbacks('login', 'username_input', company_user['email'], timeout=10000)
            assert success, "Failed to fill username field"
            
            # Fill password using centralized locators
            success = self.locator_helper.fill_with_fallbacks('login', 'password_input', company_user['password'], timeout=10000)
            assert success, "Failed to fill password field"
            
        with allure.step("Click login button and verify success"):
            # Click login using centralized locators
            success = self.locator_helper.click_with_fallbacks('login', 'login_button', timeout=10000)
            assert success, "Failed to click login button"
            
            # Wait for navigation to dashboard
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(3000)
            
            # Strong assertion - verify we're now on dashboard
            current_url = page.url
            assert 'dashboard' in current_url or 'main' in current_url, f"Login did not redirect to dashboard. Current URL: {current_url}"
            allure.attach(f"Successfully logged in. Current URL: {current_url}", name="Login Success", attachment_type=allure.attachment_type.TEXT)
            
    @allure.title("Test successful login with valid username and password")
    @allure.description("Verify user can login successfully with valid username and password")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_with_username_success(self):
        """Test successful login using username"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Verify login form is displayed"):
            form_fields = self.login_page.validate_form_fields_present()
            assert form_fields["email_field"], "Email/Username field is not visible"
            assert form_fields["password_field"], "Password field is not visible"
            assert form_fields["login_button"], "Login button is not visible"
            
        with allure.step("Enter valid credentials"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_username(valid_user["username"])
            self.login_page.enter_password(valid_user["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for login completion"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"
            
    @allure.title("Test login and logout functionality")
    @allure.description("Verify user can login successfully and then logout")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_logout_success(self):
        """Test complete login-logout flow"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Perform login"):
            valid_user = self.credentials["valid_user"]
            self.login_page.login_with_email(valid_user["email"], valid_user["password"])
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            
        with allure.step("Perform logout"):
            self.login_page.logout()
            
        with allure.step("Verify successful logout"):
            # Should be redirected back to login page
            self.test_helpers.wait_for_url_contains("login")
            form_fields = self.login_page.validate_form_fields_present()
            assert form_fields["login_button"], "Not redirected to login page after logout"
            
    @allure.title("Test remember me functionality")
    @allure.description("Verify remember me checkbox functionality")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_remember_me_functionality(self):
        """Test remember me checkbox"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Check remember me checkbox if present"):
            if self.login_page.is_visible(self.login_page.remember_me):
                initial_state = self.login_page.is_remember_me_checked()
                self.login_page.click_remember_me()
                new_state = self.login_page.is_remember_me_checked()
                assert initial_state != new_state, "Remember me checkbox state did not change"
            else:
                pytest.skip("Remember me checkbox not present on page")
                
    @allure.title("Test login form validation - all fields present")
    @allure.description("Verify all required login form fields are present and visible")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_form_elements_present(self):
        """Test that all login form elements are present"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Verify form elements are present"):
            form_fields = self.login_page.validate_form_fields_present()
            
            assert form_fields["email_field"], "Email/Username field is missing"
            assert form_fields["password_field"], "Password field is missing"  
            assert form_fields["login_button"], "Login button is missing"
            
        with allure.step("Verify page title"):
            page_title = self.login_page.get_page_title()
            assert page_title, "Page title is empty"
            
    @allure.title("Test login page accessibility")
    @allure.description("Verify login page basic accessibility features")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression  
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_page_accessibility(self):
        """Test basic accessibility features of login page"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Test keyboard navigation"):
            # Tab through form elements
            self.login_page.press_key("Tab")
            # Verify focus is on first form element (email/username)
            
        with allure.step("Test form labels and placeholders"):
            email_input = self.login_page.get_active_email_input()
            password_input = self.login_page.get_active_password_input()
            
            # Check if inputs have labels or placeholders
            email_placeholder = self.login_page.get_element_attribute(email_input, "placeholder")
            password_placeholder = self.login_page.get_element_attribute(password_input, "placeholder")
            
            assert email_placeholder or self.login_page.get_element_attribute(email_input, "aria-label"), "Email field lacks accessibility attributes"
            assert password_placeholder or self.login_page.get_element_attribute(password_input, "aria-label"), "Password field lacks accessibility attributes"
            
    @allure.title("Test login with management user on main site")
    @allure.description("Verify management user can login successfully on main site")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_management_user_success(self):
        """Test successful login with management user"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Verify login form is displayed"):
            form_fields = self.login_page.validate_form_fields_present()
            assert form_fields["email_field"], "Email/Username field is not visible"
            assert form_fields["password_field"], "Password field is not visible"
            assert form_fields["login_button"], "Login button is not visible"
            
        with allure.step("Enter management user credentials"):
            management_user = self.credentials["management_user"]
            self.login_page.enter_email(management_user["email"])
            self.login_page.enter_password(management_user["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for login completion"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"
            current_url = self.login_page.get_current_url()
            assert any(success_path in current_url for success_path in ["/dashboard", "/home", "/main"]), f"Not redirected to dashboard. Current URL: {current_url}"
            
    @allure.title("Test login with basic user")
    @allure.description("Verify basic user can login successfully")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_basic_user_success(self):
        """Test successful login with basic user"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter basic user credentials"):
            basic_user = self.credentials["basic_user"]
            self.login_page.login_with_email(basic_user["email"], basic_user["password"])
            
        with allure.step("Wait for login completion"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"
            
    @allure.title("Test login with editor user")
    @allure.description("Verify editor user can login successfully")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_editor_user_success(self):
        """Test successful login with editor user"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter editor user credentials"):
            editor_user = self.credentials["editor_user"]
            self.login_page.login_with_email(editor_user["email"], editor_user["password"])
            
        with allure.step("Wait for login completion"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"
            
    @allure.title("Test login on WeSign Dev environment")
    @allure.description("Verify user can login successfully on WeSign Dev environment")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_wesign_dev_success(self):
        """Test successful login on WeSign Dev environment"""
        with allure.step("Navigate to WeSign Dev login page"):
            wesign_dev_login_page = LoginPage(self.login_page.page, self.urls["wesign_dev_url"])
            wesign_dev_login_page.navigate_to_login()
            
        with allure.step("Verify login form is displayed"):
            form_fields = wesign_dev_login_page.validate_form_fields_present()
            assert form_fields["email_field"], "Email/Username field is not visible"
            assert form_fields["password_field"], "Password field is not visible"
            assert form_fields["login_button"], "Login button is not visible"
            
        with allure.step("Enter valid credentials"):
            valid_user = self.credentials["valid_user"]
            wesign_dev_login_page.enter_email(valid_user["email"])
            wesign_dev_login_page.enter_password(valid_user["password"])
            
        with allure.step("Click login button"):
            wesign_dev_login_page.click_login_button()
            
        with allure.step("Wait for login completion"):
            wesign_dev_login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert wesign_dev_login_page.is_login_successful(), "Login was not successful on WeSign Dev"
            assert not wesign_dev_login_page.has_error_message(), f"Unexpected error: {wesign_dev_login_page.get_error_message()}"
            current_url = wesign_dev_login_page.get_current_url()
            assert self.urls["wesign_dev_url"].split("://")[1].split("/")[0] in current_url, f"Not on WeSign Dev domain. Current URL: {current_url}"
            
    @allure.title("Test login on management interface")
    @allure.description("Verify management user can login to management interface")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_management_interface_success(self):
        """Test successful login on management interface"""
        with allure.step("Navigate to management login page"):
            management_login_page = LoginPage(self.login_page.page, self.urls["management_login_url"])
            management_login_page.navigate_to_login()
            
        with allure.step("Verify login form is displayed"):
            form_fields = management_login_page.validate_form_fields_present()
            assert form_fields["email_field"], "Email/Username field is not visible"
            assert form_fields["password_field"], "Password field is not visible"
            assert form_fields["login_button"], "Login button is not visible"
            
        with allure.step("Enter management credentials"):
            management_user = self.credentials["management_user"]
            management_login_page.enter_email(management_user["email"])
            management_login_page.enter_password(management_user["password"])
            
        with allure.step("Click login button"):
            management_login_page.click_login_button()
            
        with allure.step("Wait for login completion"):
            management_login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert management_login_page.is_login_successful(), "Login was not successful on management interface"
            assert not management_login_page.has_error_message(), f"Unexpected error: {management_login_page.get_error_message()}"
            current_url = management_login_page.get_current_url()
            assert ":10443" in current_url, f"Not on management port. Current URL: {current_url}"
            
    @allure.title("Test login with Hebrew interface")
    @allure.description("Verify login works correctly with Hebrew interface")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_hebrew_interface_success(self):
        """Test login with Hebrew interface"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Check page language"):
            page_language = self.login_page.get_page_language()
            allure.attach(f"Detected page language: {page_language}", "Language Detection", allure.attachment_type.TEXT)
            
        with allure.step("Perform login"):
            valid_user = self.credentials["valid_user"]
            self.login_page.login_with_email(valid_user["email"], valid_user["password"])
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify successful login"):
            assert self.login_page.is_login_successful(), "Login was not successful"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"
            
    @allure.title("Test login with real timeout settings")
    @allure.description("Verify login respects timeout settings from configuration")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_with_configured_timeouts(self):
        """Test login using configured timeout values"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Use configured timeout values"):
            max_wait_time = self.settings.get("max_wait_time", 5) * 1000  # Convert to milliseconds
            
        with allure.step("Perform login with timeout"):
            valid_user = self.credentials["valid_user"]
            self.login_page.login_with_email(valid_user["email"], valid_user["password"])
            self.login_page.wait_for_login_completion(timeout=max_wait_time)
            
        with allure.step("Verify successful login within timeout"):
            assert self.login_page.is_login_successful(), "Login was not successful within configured timeout"
            assert not self.login_page.has_error_message(), f"Unexpected error: {self.login_page.get_error_message()}"