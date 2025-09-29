"""
Foundation Layer Validation Test

This test validates that the foundation layer components are working correctly
before proceeding with Phase 2 implementation.

Tests:
- Authentication utilities functionality
- Navigation utilities functionality
- Test data management functionality
- Package imports and initialization
"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright

# Import foundation components
from foundation import WeSignTestFoundation, WeSignNavigationUtils, WeSignTestDataManager


class TestFoundationValidation:
    """Test class to validate foundation layer functionality."""

    def setup_method(self):
        """Setup for each test method."""
        self.auth = WeSignTestFoundation()
        self.nav = WeSignNavigationUtils()
        self.data_manager = WeSignTestDataManager()

    def test_foundation_imports(self):
        """Test that all foundation components can be imported correctly."""
        # Test imports
        assert WeSignTestFoundation is not None
        assert WeSignNavigationUtils is not None
        assert WeSignTestDataManager is not None

        # Test initialization
        auth = WeSignTestFoundation()
        nav = WeSignNavigationUtils()
        data_mgr = WeSignTestDataManager()

        assert auth.base_url == "https://devtest.comda.co.il"
        assert nav.base_url == "https://devtest.comda.co.il"
        assert data_mgr.test_session_id is not None

        print("✅ Foundation imports and initialization working correctly")

    def test_test_data_creation(self):
        """Test test data creation functionality."""
        # Test document creation
        doc_path = self.data_manager.create_test_document(
            "validation_test_doc",
            "Test content for validation",
            "txt"
        )
        assert doc_path is not None
        assert os.path.exists(doc_path)

        # Test contact data generation
        contacts = self.data_manager.generate_contact_data(5)
        assert len(contacts) == 5
        assert all('full_name' in contact for contact in contacts)
        assert all('email' in contact for contact in contacts)

        # Test XML template data creation
        xml_path = self.data_manager.create_xml_template_data(
            "validation_template",
            {"CLIENT_NAME": "Test Client", "DATE": "2024-01-01"}
        )
        assert xml_path is not None
        assert os.path.exists(xml_path)

        # Test security payloads
        security_data = self.data_manager.create_security_test_payloads()
        assert 'xss_payloads' in security_data
        assert 'sql_injection_payloads' in security_data
        assert len(security_data['xss_payloads']) > 0

        print("✅ Test data creation functionality working correctly")

    def test_navigation_utilities(self):
        """Test navigation utilities configuration."""
        # Test module URLs
        assert 'dashboard' in self.nav.modules
        assert 'contacts' in self.nav.modules
        assert 'templates' in self.nav.modules
        assert 'documents' in self.nav.modules

        # Test sub-features
        assert 'select_signers' in self.nav.sub_features
        assert 'add_contact' in self.nav.sub_features
        assert 'template_upload' in self.nav.sub_features

        # Test utility methods
        modules = self.nav.get_available_modules()
        assert len(modules) == 4
        assert 'dashboard' in modules

        sub_features = self.nav.get_available_sub_features()
        assert len(sub_features) > 5

        print("✅ Navigation utilities configuration working correctly")

    def test_authentication_configuration(self):
        """Test authentication configuration."""
        # Test credentials
        assert self.auth.credentials['email'] == "gals@comda.co.il"
        assert self.auth.credentials['password'] == "Comda159!"

        # Test URLs
        assert self.auth.base_url == "https://devtest.comda.co.il"
        assert self.auth.login_url == "https://devtest.comda.co.il/auth/login"
        assert self.auth.dashboard_url == "https://devtest.comda.co.il/dashboard"

        # Test timeouts
        assert self.auth.default_timeout == 15000
        assert self.auth.login_timeout == 20000

        # Test session info
        session_info = self.auth.get_session_info()
        assert 'is_authenticated' in session_info
        assert 'base_url' in session_info

        print("✅ Authentication configuration working correctly")

    @pytest.mark.asyncio
    async def test_browser_compatibility(self):
        """Test basic browser compatibility with foundation utilities."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # Test basic navigation
                await page.goto("https://example.com")
                await page.wait_for_load_state('networkidle', timeout=10000)

                # Test page stability waiting
                stability_result = await self.auth.wait_for_stable_page(page, timeout=5000)
                assert stability_result == True

                print("✅ Browser compatibility working correctly")

            finally:
                await browser.close()

    def teardown_method(self):
        """Cleanup after each test method."""
        # Cleanup test data
        if hasattr(self, 'data_manager'):
            self.data_manager.cleanup_test_data()

        print("✅ Test cleanup completed")


def main():
    """Run foundation validation tests."""
    print("🧪 WeSign Foundation Layer Validation")
    print("=" * 50)

    # Create test instance
    validator = TestFoundationValidation()

    try:
        # Run tests
        print("\n1. Testing Foundation Imports...")
        validator.setup_method()
        validator.test_foundation_imports()
        validator.teardown_method()

        print("\n2. Testing Test Data Creation...")
        validator.setup_method()
        validator.test_test_data_creation()
        validator.teardown_method()

        print("\n3. Testing Navigation Utilities...")
        validator.setup_method()
        validator.test_navigation_utilities()
        validator.teardown_method()

        print("\n4. Testing Authentication Configuration...")
        validator.setup_method()
        validator.test_authentication_configuration()
        validator.teardown_method()

        print("\n5. Testing Browser Compatibility...")
        validator.setup_method()
        asyncio.run(validator.test_browser_compatibility())
        validator.teardown_method()

        print("\n" + "=" * 50)
        print("🎉 ALL FOUNDATION VALIDATION TESTS PASSED!")
        print("✅ Foundation layer is ready for Phase 2 implementation")
        print("=" * 50)

        return True

    except Exception as e:
        print(f"\n❌ Foundation validation failed: {str(e)}")
        return False


if __name__ == "__main__":
    main()