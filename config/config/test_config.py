from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class TestConfig(BaseSettings):
    """Test configuration settings"""
    
    # URLs
    base_url: str = Field(default="https://devtest.comda.co.il", env="BASE_URL")
    wesign_base_url: str = Field(default="https://devtest.comda.co.il/", env="WESIGN_BASE_URL")
    wesign_api_url: str = Field(default="https://devtest.comda.co.il/api/", env="WESIGN_API_URL")
    login_url: str = Field(default="https://devtest.comda.co.il/login", env="LOGIN_URL")
    
    # Environment
    test_env: str = Field(default="development", env="TEST_ENV")
    
    # Credentials
    test_email: str = Field(default="test@example.com", env="TEST_EMAIL")
    test_username: str = Field(default="testuser", env="TEST_USERNAME")
    test_password: str = Field(default="password123", env="TEST_PASSWORD")
    
    # WeSign User Credentials
    company_user_email: str = Field(default="test@company.com", env="COMPANY_USER_EMAIL")
    company_user_password: str = Field(default="Test123!", env="COMPANY_USER_PASSWORD")
    basic_user_email: str = Field(default="basic@test.com", env="BASIC_USER_EMAIL")
    basic_user_password: str = Field(default="Test123!", env="BASIC_USER_PASSWORD")
    editor_user_email: str = Field(default="editor@test.com", env="EDITOR_USER_EMAIL")
    editor_user_password: str = Field(default="Test123!", env="EDITOR_USER_PASSWORD")
    management_user_email: str = Field(default="manager@test.com", env="MANAGEMENT_USER_EMAIL")
    management_user_password: str = Field(default="Test123!", env="MANAGEMENT_USER_PASSWORD")
    
    # Feature Flags
    enable_self_healing: bool = Field(default=True, env="ENABLE_SELF_HEALING")
    enable_bilingual: bool = Field(default=True, env="ENABLE_BILINGUAL")
    enable_performance_monitoring: bool = Field(default=True, env="ENABLE_PERFORMANCE_MONITORING")
    enable_realtime_reports: bool = Field(default=True, env="ENABLE_REALTIME_REPORTS")
    
    # Timeouts and Performance
    default_timeout: int = Field(default=60000, env="DEFAULT_TIMEOUT")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    ui_response_timeout: int = Field(default=10000, env="UI_RESPONSE_TIMEOUT")
    file_upload_timeout: int = Field(default=30000, env="FILE_UPLOAD_TIMEOUT")
    document_send_timeout: int = Field(default=15000, env="DOCUMENT_SEND_TIMEOUT")
    page_load_timeout: int = Field(default=8000, env="PAGE_LOAD_TIMEOUT")
    
    # Service URLs
    healing_service_url: str = Field(default="http://localhost:8081", env="HEALING_SERVICE_URL")
    qa_intelligence_url: str = Field(default="http://localhost:8082", env="QA_INTELLIGENCE_URL")
    
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
        extra = "allow"  # Allow extra fields to prevent validation errors


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