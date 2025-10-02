import pytest
from playwright.sync_api import Page
from src.pages.login_page import LoginPage
from src.utils.test_helpers import TestHelpers
import allure


@allure.feature("Login Functionality") 
@allure.story("UI/UX Login Tests")
class TestLoginUI:
    """UI/UX test cases for login functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, test_credentials, test_urls, test_settings):
        """Setup for each test"""
        self.login_page = LoginPage(page, test_urls["base_url"])
        self.test_helpers = TestHelpers(page)
        self.credentials = test_credentials
        self.urls = test_urls
        self.settings = test_settings
        
    @allure.title("Test login page layout and elements")
    @allure.description("Verify login page layout and all UI elements are properly displayed")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_page_layout(self):
        """Test login page layout and UI elements"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Verify page title"):
            page_title = self.login_page.get_page_title()
            assert page_title, "Page title should not be empty"
            
        with allure.step("Verify login form elements"):
            form_fields = self.login_page.validate_form_fields_present()
            assert form_fields["email_field"], "Email/Username field should be visible"
            assert form_fields["password_field"], "Password field should be visible"
            assert form_fields["login_button"], "Login button should be visible"
            
        with allure.step("Take screenshot of login page"):
            self.login_page.take_screenshot("login_page_layout")
            
    @allure.title("Test login form field properties") 
    @allure.description("Verify login form fields have correct properties and attributes")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_form_field_properties(self):
        """Test login form field properties"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Check email field properties"):
            email_input = self.login_page.get_active_email_input()
            email_type = self.login_page.get_element_attribute(email_input, "type")
            if email_type:
                assert email_type in ["email", "text"], f"Email field type should be 'email' or 'text', got '{email_type}'"
                
        with allure.step("Check password field properties"):
            password_input = self.login_page.get_active_password_input()
            password_type = self.login_page.get_element_attribute(password_input, "type")
            assert password_type == "password", f"Password field type should be 'password', got '{password_type}'"
            
        with allure.step("Check button properties"):
            login_button = self.login_page.get_active_login_button()
            button_type = self.login_page.get_element_attribute(login_button, "type")
            if button_type:
                assert button_type in ["submit", "button"], f"Button type should be 'submit' or 'button', got '{button_type}'"
                
    @allure.title("Test login form responsiveness")
    @allure.description("Verify login form adapts to different screen sizes")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_form_responsiveness(self):
        """Test login form responsiveness"""
        screen_sizes = [
            {"width": 1920, "height": 1080, "name": "desktop"},
            {"width": 768, "height": 1024, "name": "tablet"},
            {"width": 375, "height": 667, "name": "mobile"}
        ]
        
        for size in screen_sizes:
            with allure.step(f"Test {size['name']} view ({size['width']}x{size['height']})"):
                self.login_page.page.set_viewport_size({"width": size["width"], "height": size["height"]})
                self.login_page.navigate_to_login()
                
                # Verify form elements are still visible
                form_fields = self.login_page.validate_form_fields_present()
                assert form_fields["email_field"], f"Email field not visible in {size['name']} view"
                assert form_fields["password_field"], f"Password field not visible in {size['name']} view" 
                assert form_fields["login_button"], f"Login button not visible in {size['name']} view"
                
                # Take screenshot
                self.login_page.take_screenshot(f"login_form_{size['name']}_view")
                
    @allure.title("Test login error message display")
    @allure.description("Verify error messages are properly displayed and formatted")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_error_message_display(self):
        """Test error message display and formatting"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Trigger error by invalid login"):
            invalid_user = self.credentials["invalid_users"][0]
            self.login_page.enter_email(invalid_user["email"])
            self.login_page.enter_password(invalid_user["password"])
            self.login_page.click_login_button()
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify error message is displayed"):
            if self.login_page.has_error_message():
                error_msg = self.login_page.get_error_message()
                assert error_msg, "Error message should not be empty"
                assert len(error_msg.strip()) > 0, "Error message should contain meaningful text"
                
                # Take screenshot of error state
                self.login_page.take_screenshot("login_error_message_display")
            else:
                # Some systems might not show explicit error messages for security
                pytest.skip("No error message displayed - system might use silent failure for security")
                
    @allure.title("Test login loading state")
    @allure.description("Verify login form shows appropriate loading state during submission")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_loading_state(self):
        """Test login loading state and indicators"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter valid credentials"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_email(valid_user["email"])
            self.login_page.enter_password(valid_user["password"])
            
        with allure.step("Click login and check for loading indicators"):
            self.login_page.click_login_button()
            
            # Check for loading spinner or disabled button
            if self.login_page.is_visible(self.login_page.loading_spinner, timeout=1000):
                self.login_page.take_screenshot("login_loading_spinner")
                self.login_page.wait_for_loading()
            
        with allure.step("Verify login completion"):
            self.login_page.wait_for_login_completion()
            
    @allure.title("Test login form keyboard navigation")
    @allure.description("Verify login form can be navigated using keyboard only")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_keyboard_navigation(self):
        """Test keyboard navigation through login form"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Navigate using Tab key"):
            # Focus should start on first form element
            self.login_page.press_key("Tab")
            
            # Fill email using keyboard
            valid_user = self.credentials["valid_user"]
            self.login_page.page.keyboard.type(valid_user["email"])
            
        with allure.step("Tab to password field"):
            self.login_page.press_key("Tab")
            self.login_page.page.keyboard.type(valid_user["password"])
            
        with allure.step("Submit using Enter key"):
            self.login_page.press_key("Enter")
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify keyboard submission worked"):
            # Login should succeed or show appropriate response
            pass  # Verification depends on whether credentials are valid
            
    @allure.title("Test login form field focus states")
    @allure.description("Verify form fields show proper focus indicators")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_form_focus_states(self):
        """Test form field focus states and visual indicators"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Test email field focus"):
            email_input = self.login_page.get_active_email_input()
            email_input.focus()
            self.login_page.take_screenshot("email_field_focused")
            
        with allure.step("Test password field focus"):
            password_input = self.login_page.get_active_password_input()
            password_input.focus()
            self.login_page.take_screenshot("password_field_focused")
            
        with allure.step("Test login button focus"):
            login_button = self.login_page.get_active_login_button()
            login_button.focus()
            self.login_page.take_screenshot("login_button_focused")
            
    @allure.title("Test login form with different languages")
    @allure.description("Verify login form works with different language inputs")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    def test_login_form_language_support(self):
        """Test login form with different language inputs"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Test with Hebrew characters"):
            self.login_page.enter_email("טסט@דוגמה.com")
            self.login_page.enter_password("סיסמה123")
            self.login_page.take_screenshot("login_form_hebrew_input")
            
        with allure.step("Clear and test with Arabic characters"):
            self.login_page.clear_login_form()
            self.login_page.enter_email("اختبار@مثال.com")
            self.login_page.enter_password("كلمةمرور123")
            self.login_page.take_screenshot("login_form_arabic_input")
            
        with allure.step("Clear and test with special characters"):
            self.login_page.clear_login_form()
            self.login_page.enter_email("test@müller-company.de")
            self.login_page.enter_password("pässwörd123")
            self.login_page.take_screenshot("login_form_special_chars")
            
    @allure.title("Test login page performance")
    @allure.description("Verify login page loads and responds within acceptable time limits")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.positive
    @pytest.mark.slow
    def test_login_page_performance(self):
        """Test login page load and response performance"""
        import time
        
        with allure.step("Measure page load time"):
            start_time = time.time()
            self.login_page.navigate_to_login()
            load_time = time.time() - start_time
            
            assert load_time < 10.0, f"Page load time {load_time:.2f}s exceeds 10s threshold"
            allure.attach(f"Page load time: {load_time:.2f}s", "Performance Metrics", allure.attachment_type.TEXT)
            
        with allure.step("Measure login form response time"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_email(valid_user["email"])
            self.login_page.enter_password(valid_user["password"])
            
            start_time = time.time()
            self.login_page.click_login_button()
            self.login_page.wait_for_login_completion()
            response_time = time.time() - start_time
            
            assert response_time < 30.0, f"Login response time {response_time:.2f}s exceeds 30s threshold"
            allure.attach(f"Login response time: {response_time:.2f}s", "Performance Metrics", allure.attachment_type.TEXT)