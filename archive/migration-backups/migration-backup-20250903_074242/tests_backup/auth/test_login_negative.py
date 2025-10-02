import pytest
from playwright.sync_api import Page
from src.pages.login_page import LoginPage
from src.utils.test_helpers import TestHelpers
import allure


@allure.feature("Login Functionality")
@allure.story("Negative Login Tests")
class TestLoginNegative:
    """Negative test cases for login functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self, page: Page, test_credentials, test_urls, test_settings):
        """Setup for each test"""
        self.login_page = LoginPage(page, test_urls["base_url"])
        self.test_helpers = TestHelpers(page)
        self.credentials = test_credentials
        self.urls = test_urls
        self.settings = test_settings
        
    @allure.title("Test login with invalid email")
    @allure.description("Verify login fails with invalid email address")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_invalid_email(self):
        """Test login with invalid email"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter invalid credentials"):
            invalid_user = self.credentials["invalid_users"][0]
            self.login_page.enter_email(invalid_user["email"])
            self.login_page.enter_password(invalid_user["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify login failed"):
            assert not self.login_page.is_login_successful(), "Login should have failed"
            assert self.login_page.has_error_message(), "Error message should be displayed"
            error_msg = self.login_page.get_error_message()
            assert error_msg, "Error message is empty"
            
    @allure.title("Test login with non-existent user")
    @allure.description("Verify login fails with non-existent user credentials")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter non-existent user credentials"):
            invalid_user = self.credentials["invalid_users"][1]
            self.login_page.enter_email(invalid_user["email"])
            self.login_page.enter_password(invalid_user["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify login failed"):
            assert not self.login_page.is_login_successful(), "Login should have failed"
            assert self.login_page.has_error_message(), "Error message should be displayed"
            error_msg = self.login_page.get_error_message()
            assert error_msg, "Error message is empty"
            
    @allure.title("Test login with empty credentials")
    @allure.description("Verify login fails with empty email and password fields")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_empty_credentials(self):
        """Test login with empty credentials"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Leave fields empty and click login"):
            self.login_page.click_login_button()
            
        with allure.step("Verify validation"):
            # Either error message appears or form validation prevents submission
            assert (not self.login_page.is_login_successful() or 
                   self.login_page.has_error_message()), "Empty form should not allow login"
                   
    @allure.title("Test login with empty password")
    @allure.description("Verify login fails with empty password field")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_empty_password(self):
        """Test login with empty password"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter email but leave password empty"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_email(valid_user["email"])
            # Password field left empty
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Verify login failed"):
            assert (not self.login_page.is_login_successful() or
                   self.login_page.has_error_message()), "Login with empty password should fail"
                   
    @allure.title("Test login with empty email")
    @allure.description("Verify login fails with empty email field")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_empty_email(self):
        """Test login with empty email"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter password but leave email empty"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_password(valid_user["password"])
            # Email field left empty
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Verify login failed"):
            assert (not self.login_page.is_login_successful() or
                   self.login_page.has_error_message()), "Login with empty email should fail"
                   
    @allure.title("Test login with invalid password")
    @allure.description("Verify login fails with correct email but wrong password")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_invalid_password(self):
        """Test login with wrong password"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter valid email with invalid password"):
            valid_user = self.credentials["valid_user"]
            self.login_page.enter_email(valid_user["email"])
            self.login_page.enter_password("wrongpassword123")
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify login failed"):
            assert not self.login_page.is_login_successful(), "Login should have failed"
            assert self.login_page.has_error_message(), "Error message should be displayed"
            
    @allure.title("Test login with SQL injection attempt")
    @allure.description("Verify system is protected against SQL injection in login form")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_sql_injection_attempt(self):
        """Test login with SQL injection attempt"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter SQL injection payload"):
            sql_injection_payload = "admin'; DROP TABLE users; --"
            self.login_page.enter_email(sql_injection_payload)
            self.login_page.enter_password("password")
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify system handled injection safely"):
            assert not self.login_page.is_login_successful(), "SQL injection should not succeed"
            # System should either show error or reject the input
            
    @allure.title("Test login with XSS attempt")
    @allure.description("Verify system is protected against XSS in login form")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_xss_attempt(self):
        """Test login with XSS attempt"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter XSS payload"):
            xss_payload = "<script>alert('XSS')</script>"
            self.login_page.enter_email(xss_payload)
            self.login_page.enter_password("password")
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify system handled XSS safely"):
            assert not self.login_page.is_login_successful(), "XSS payload should not succeed"
            # Check that no alert was executed (page should not have unexpected dialogs)
            
    @allure.title("Test login with extremely long input")
    @allure.description("Verify system handles extremely long input in login fields")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_extremely_long_input(self):
        """Test login with extremely long input"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter extremely long input"):
            long_input = "a" * 10000
            self.login_page.enter_email(long_input)
            self.login_page.enter_password(long_input)
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify system handled long input gracefully"):
            assert not self.login_page.is_login_successful(), "Extremely long input should not succeed"
            # System should handle this gracefully without crashing
            
    @allure.title("Test multiple failed login attempts")
    @allure.description("Verify system behavior with multiple consecutive failed login attempts")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    @pytest.mark.slow
    def test_multiple_failed_login_attempts(self):
        """Test multiple failed login attempts"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        for attempt in range(3):
            with allure.step(f"Attempt {attempt + 1}: Enter invalid credentials"):
                invalid_user = self.credentials["invalid_users"][0]
                self.login_page.clear_login_form()
                self.login_page.enter_email(invalid_user["email"])
                self.login_page.enter_password(invalid_user["password"])
                
            with allure.step(f"Attempt {attempt + 1}: Click login button"):
                self.login_page.click_login_button()
                
            with allure.step(f"Attempt {attempt + 1}: Wait for response"):
                self.login_page.wait_for_login_completion()
                
            with allure.step(f"Attempt {attempt + 1}: Verify login failed"):
                assert not self.login_page.is_login_successful(), f"Attempt {attempt + 1} should have failed"
                
        with allure.step("Verify system behavior after multiple failures"):
            # System might implement rate limiting or account lockout
            # At minimum, it should still show appropriate error messages
            pass
            
    @allure.title("Test login with expired account")
    @allure.description("Verify login fails with expired account")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_expired_account(self):
        """Test login with expired account"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter expired account credentials"):
            expired_account = self.credentials["expired_account"]
            self.login_page.enter_email(expired_account["email"])
            self.login_page.enter_password(expired_account["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify login failed with expired account"):
            assert not self.login_page.is_login_successful(), "Login should have failed for expired account"
            # Error message might not always be shown for security reasons
            
    @allure.title("Test login with real invalid password from settings")
    @allure.description("Verify login fails with configured invalid password")
    @allure.severity(allure.severity_level.CRITICAL)
    @pytest.mark.smoke
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_configured_invalid_password(self):
        """Test login with invalid password from configuration"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter valid email with configured invalid password"):
            valid_user = self.credentials["valid_user"]
            invalid_password = self.settings.get("invalid_password", "12345!")
            self.login_page.enter_email(valid_user["email"])
            self.login_page.enter_password(invalid_password)
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify login failed"):
            assert not self.login_page.is_login_successful(), "Login should have failed with invalid password"
            assert self.login_page.has_error_message(), "Error message should be displayed"
            
    @allure.title("Test login with invalid server cert attempt")
    @allure.description("Verify system handles invalid server certificate ID gracefully")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_invalid_server_cert(self):
        """Test login with invalid server certificate"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Enter credentials with invalid server cert context"):
            # This test simulates what might happen with wrong server cert settings
            invalid_cert_id = self.settings.get("invalid_server_cert_id", "comsign")
            valid_user = self.credentials["valid_user"]
            
            # Use the credentials but in a context that might fail due to cert issues
            self.login_page.enter_email(valid_user["email"])
            self.login_page.enter_password(valid_user["password"])
            
        with allure.step("Click login button"):
            self.login_page.click_login_button()
            
        with allure.step("Wait for response"):
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify system behavior"):
            # Login might succeed or fail depending on server configuration
            # This test mainly ensures the system doesn't crash
            current_url = self.login_page.get_current_url()
            allure.attach(f"Final URL: {current_url}", "Login Result URL", allure.attachment_type.TEXT)
            
    @allure.title("Test login with different environments negative cases")
    @allure.description("Test login failures across different environments")
    @allure.severity(allure.severity_level.NORMAL)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_cross_environment_failures(self):
        """Test login failures across different environments"""
        environments = [
            {"name": "WeSign Dev", "url": self.urls["wesign_dev_url"]},
            {"name": "Management", "url": self.urls["management_login_url"]}
        ]
        
        for env in environments:
            with allure.step(f"Test invalid login on {env['name']} environment"):
                env_login_page = LoginPage(self.login_page.page, env["url"])
                env_login_page.navigate_to_login()
                
                # Use invalid credentials
                invalid_user = self.credentials["invalid_users"][0]
                env_login_page.enter_email(invalid_user["email"])
                env_login_page.enter_password(invalid_user["password"])
                env_login_page.click_login_button()
                env_login_page.wait_for_login_completion()
                
                # Verify failure
                assert not env_login_page.is_login_successful(), f"Login should have failed on {env['name']}"
                current_url = env_login_page.get_current_url()
                allure.attach(f"{env['name']} - Final URL: {current_url}", f"{env['name']} Result", allure.attachment_type.TEXT)
                
    @allure.title("Test login with Hebrew error messages")
    @allure.description("Verify error messages appear correctly in Hebrew interface")
    @allure.severity(allure.severity_level.MINOR)
    @pytest.mark.regression
    @pytest.mark.login
    @pytest.mark.negative
    def test_login_hebrew_error_messages(self):
        """Test error messages in Hebrew interface"""
        with allure.step("Navigate to login page"):
            self.login_page.navigate_to_login()
            
        with allure.step("Check if Hebrew interface is available"):
            page_language = self.login_page.get_page_language()
            
        with allure.step("Trigger error with invalid credentials"):
            invalid_user = self.credentials["invalid_users"][0]
            self.login_page.enter_email(invalid_user["email"])
            self.login_page.enter_password(invalid_user["password"])
            self.login_page.click_login_button()
            self.login_page.wait_for_login_completion()
            
        with allure.step("Verify error message handling"):
            if self.login_page.has_error_message():
                error_msg = self.login_page.get_error_message()
                allure.attach(f"Error message: {error_msg}", "Error Message Content", allure.attachment_type.TEXT)
                allure.attach(f"Page language: {page_language}", "Language Context", allure.attachment_type.TEXT)
                assert len(error_msg) > 0, "Error message should not be empty"
            
        with allure.step("Take screenshot of error state"):
            self.login_page.take_screenshot("hebrew_error_state")