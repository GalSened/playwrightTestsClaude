"""
WeSign Test Configuration
Centralized configuration for all WeSign tests
"""
import os
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class WeSignConfig:
    """WeSign standardized test configuration"""
    
    # Standardized Credentials
    USERNAME: str = "wesign"
    PASSWORD: str = "Comsign1!"
    URL: str = "https://devtest.comda.co.il"
    
    # Browser Configuration
    DEFAULT_BROWSER: str = "chromium"
    HEADLESS: bool = True
    
    # Test Execution Settings
    DEFAULT_TIMEOUT: int = 30000  # 30 seconds
    RETRY_COUNT: int = 2
    
    # Viewport Settings
    VIEWPORT_WIDTH: int = 1920
    VIEWPORT_HEIGHT: int = 1080
    
    # Language Settings
    DEFAULT_LANGUAGE: str = "english"
    SUPPORTED_LANGUAGES: list = None
    
    def __post_init__(self):
        if self.SUPPORTED_LANGUAGES is None:
            self.SUPPORTED_LANGUAGES = ["english", "hebrew"]
    
    def get_login_data(self) -> Dict[str, str]:
        """Get standardized login credentials"""
        return {
            "username": self.USERNAME,
            "password": self.PASSWORD,
            "url": self.URL
        }
    
    def get_browser_config(self) -> Dict[str, Any]:
        """Get browser configuration"""
        return {
            "browser": self.DEFAULT_BROWSER,
            "headless": self.HEADLESS,
            "viewport": {
                "width": self.VIEWPORT_WIDTH,
                "height": self.VIEWPORT_HEIGHT
            },
            "timeout": self.DEFAULT_TIMEOUT
        }
    
    def get_test_environment(self) -> str:
        """Get test environment URL"""
        return self.URL
    
    @classmethod
    def from_env(cls) -> 'WeSignConfig':
        """Create config from environment variables with fallbacks"""
        return cls(
            USERNAME=os.getenv("WESIGN_USERNAME", cls.USERNAME),
            PASSWORD=os.getenv("WESIGN_PASSWORD", cls.PASSWORD),
            URL=os.getenv("WESIGN_URL", cls.URL),
            DEFAULT_BROWSER=os.getenv("WESIGN_BROWSER", cls.DEFAULT_BROWSER),
            HEADLESS=os.getenv("WESIGN_HEADLESS", "true").lower() == "true",
            DEFAULT_TIMEOUT=int(os.getenv("WESIGN_TIMEOUT", cls.DEFAULT_TIMEOUT)),
        )

# Global configuration instance
WESIGN_CONFIG = WeSignConfig.from_env()

# Convenience functions for easy import
def get_login_credentials():
    """Get login credentials as dict"""
    return WESIGN_CONFIG.get_login_data()

def get_base_url():
    """Get base URL for tests"""
    return WESIGN_CONFIG.URL

def get_browser_settings():
    """Get browser configuration"""
    return WESIGN_CONFIG.get_browser_config()