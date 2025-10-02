from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class TestConfig(BaseSettings):
    """Test configuration settings"""
    
    # URLs
    base_url: str = Field(default="https://devtest.comda.co.il", env="BASE_URL")
    login_url: str = Field(default="https://devtest.comda.co.il/login", env="LOGIN_URL")
    
    # Credentials
    test_email: str = Field(default="test@example.com", env="TEST_EMAIL")
    test_username: str = Field(default="testuser", env="TEST_USERNAME")
    test_password: str = Field(default="password123", env="TEST_PASSWORD")
    
    # Browser settings
    headless: bool = Field(default=False, env="HEADLESS")
    browser: str = Field(default="chromium", env="BROWSER")
    slow_mo: int = Field(default=100, env="SLOW_MO")
    timeout: int = Field(default=30000, env="TIMEOUT")
    
    # Test settings
    screenshot_on_failure: bool = Field(default=True, env="SCREENSHOT_ON_FAILURE")
    video_recording: bool = Field(default=True, env="VIDEO_RECORDING")
    trace_on_failure: bool = Field(default=True, env="TRACE_ON_FAILURE")
    
    # Directories
    artifacts_dir: str = Field(default="artifacts", env="ARTIFACTS_DIR")
    screenshots_dir: str = Field(default="artifacts/screenshots", env="SCREENSHOTS_DIR")
    videos_dir: str = Field(default="artifacts/videos", env="VIDEOS_DIR")
    traces_dir: str = Field(default="artifacts/traces", env="TRACES_DIR")
    reports_dir: str = Field(default="reports", env="REPORTS_DIR")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global config instance
config = TestConfig()


class TestData:
    """Test data for various test scenarios"""
    
    @staticmethod
    def get_valid_credentials():
        """Get valid user credentials"""
        return {
            "email": config.test_email,
            "username": config.test_username,
            "password": config.test_password
        }
    
    @staticmethod
    def get_invalid_credentials():
        """Get invalid user credentials for negative testing"""
        return [
            {"email": "invalid@test.com", "password": "wrongpass", "description": "Invalid email and password"},
            {"email": "nonexistent@test.com", "password": "anypass", "description": "Non-existent user"},
            {"email": "", "password": "", "description": "Empty credentials"},
            {"email": config.test_email, "password": "", "description": "Valid email, empty password"},
            {"email": "", "password": config.test_password, "description": "Empty email, valid password"},
            {"email": "admin'; DROP TABLE users; --", "password": "password", "description": "SQL injection attempt"},
            {"email": "<script>alert('XSS')</script>", "password": "password", "description": "XSS attempt"},
            {"email": "a" * 1000, "password": "b" * 1000, "description": "Extremely long input"}
        ]
    
    @staticmethod
    def get_test_urls():
        """Get test URLs"""
        return {
            "base_url": config.base_url,
            "login_url": config.login_url,
            "expected_success_urls": [
                f"{config.base_url}/dashboard",
                f"{config.base_url}/home",
                f"{config.base_url}/main"
            ]
        }
    
    @staticmethod
    def get_browser_configs():
        """Get browser configuration options"""
        return {
            "viewport_sizes": [
                {"width": 1920, "height": 1080, "name": "desktop_hd"},
                {"width": 1366, "height": 768, "name": "desktop_standard"},
                {"width": 1024, "height": 768, "name": "tablet_landscape"},
                {"width": 768, "height": 1024, "name": "tablet_portrait"},
                {"width": 414, "height": 896, "name": "mobile_large"},
                {"width": 375, "height": 667, "name": "mobile_standard"},
                {"width": 320, "height": 568, "name": "mobile_small"}
            ],
            "browsers": ["chromium", "firefox", "webkit"],
            "timeout_settings": {
                "short": 5000,
                "medium": 15000,
                "long": 30000,
                "extra_long": 60000
            }
        }
    
    @staticmethod
    def get_localization_data():
        """Get localization test data"""
        return {
            "languages": [
                {"code": "en", "name": "English"},
                {"code": "he", "name": "Hebrew"},
                {"code": "ar", "name": "Arabic"}
            ],
            "test_inputs": {
                "hebrew": {
                    "email": "טסט@דוגמה.com",
                    "password": "סיסמה123"
                },
                "arabic": {
                    "email": "اختبار@مثال.com", 
                    "password": "كلمةمرور123"
                },
                "special_chars": {
                    "email": "test@müller-company.de",
                    "password": "pässwörd123"
                },
                "emoji": {
                    "email": "test@😀.com",
                    "password": "🔒password123"
                }
            }
        }