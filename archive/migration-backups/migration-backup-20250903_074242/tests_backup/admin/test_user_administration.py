"""
User Administration Tests
Tests for user management, group administration, and system administration
that are present in Selenium but missing from the Playwright test suite.
"""

import pytest
import allure
from playwright.sync_api import expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.utils.test_helpers import TestHelpers


@allure.epic("User Administration")
@allure.feature("User Management and System Administration")
class TestUserAdministration:
    """User administration test suite"""

    @pytest.mark.smoke
    @pytest.mark.regression
    @allure.story("User Profile Management")
    @allure.title("Change user password successfully")
    def test_change_user_password_success(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test changing user password through profile management"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Navigate to profile/settings
        profile_menu = page.locator('.user-menu, .profile-menu, .account-menu')
        if profile_menu.count() == 0:
            # Look for user icon or profile link
            user_icon = page.locator('.user-icon, .profile-link, img[alt*="profile"]')
            if user_icon.count() > 0:
                user_icon.click()
                page.wait_for_timeout(1000)
        
        # Find profile/settings link
        settings_link = page.locator('a:has-text("Settings"), a:has-text("Profile"), a:has-text("Account")')
        if settings_link.count() > 0:
            settings_link.click()
            page.wait_for_timeout(2000)
            
            # Look for password change section
            password_section = page.locator('.password-section, .change-password, .security-settings')
            if password_section.count() > 0:
                password_section.scroll_into_view_if_needed()
                
                # Fill password change form
                current_password = page.locator('input[type="password"]').first
                if current_password.is_visible():
                    current_password.fill(test_config.settings.get('company_user_password', 'Comsign1!'))
                
                new_password = page.locator('input[type="password"]').nth(1)
                if new_password.is_visible():
                    new_password.fill('NewPassword123!')
                
                confirm_password = page.locator('input[type="password"]').nth(2)
                if confirm_password.is_visible():
                    confirm_password.fill('NewPassword123!')
                
                # Submit password change
                save_button = page.locator('button:has-text("Save"), button:has-text("Update"), button:has-text("Change")')
                save_button.click()
                page.wait_for_timeout(3000)
                
                # Verify success message
                success_message = page.locator('.success, .password-changed, .alert-success')
                expect(success_message).to_be_visible()
                
                # Change back to original password for cleanup
                page.wait_for_timeout(1000)
                current_password.fill('NewPassword123!')
                new_password.fill(test_config.settings.get('company_user_password', 'Comsign1!'))
                confirm_password.fill(test_config.settings.get('company_user_password', 'Comsign1!'))
                save_button.click()
                page.wait_for_timeout(2000)

    @pytest.mark.regression
    @allure.story("User Profile Information")
    @allure.title("Update user profile information successfully")
    def test_update_user_profile_info_success(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test updating user profile information"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Navigate to profile settings
        profile_link = page.locator('a:has-text("Profile"), .profile-link, .user-settings')
        if profile_link.count() > 0:
            profile_link.click()
            page.wait_for_timeout(2000)
            
            # Update profile fields
            profile_form = page.locator('.profile-form, .user-info-form')
            if profile_form.count() > 0:
                # Update display name
                display_name = page.locator('input[name*="name"], input[placeholder*="name"]').first
                if display_name.is_visible():
                    original_name = display_name.input_value()
                    display_name.clear()
                    display_name.fill('Updated Test User')
                
                # Update phone number
                phone_field = page.locator('input[name*="phone"], input[type="tel"]')
                if phone_field.count() > 0 and phone_field.is_visible():
                    phone_field.clear()
                    phone_field.fill('0551234567')
                
                # Update company/organization
                company_field = page.locator('input[name*="company"], input[placeholder*="company"]')
                if company_field.count() > 0 and company_field.is_visible():
                    company_field.clear()
                    company_field.fill('Updated Test Company')
                
                # Save changes
                save_button = page.locator('button:has-text("Save"), button:has-text("Update")')
                save_button.click()
                page.wait_for_timeout(3000)
                
                # Verify update success
                success_message = page.locator('.success, .profile-updated, .alert-success')
                expect(success_message).to_be_visible()
                
                # Verify updated information is displayed
                if original_name:
                    expect(page.locator(f'text="Updated Test User"')).to_be_visible()

    @pytest.mark.regression
    @allure.story("Group Management")
    @allure.title("Switch between user groups successfully")
    def test_switch_user_groups_success(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test switching between user groups"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Look for group selector
        group_selector = page.locator('.group-selector, .switch-group, select[name*="group"]')
        if group_selector.count() > 0:
            # Get current group
            current_group = group_selector.input_value() if group_selector.get_attribute('tagName') != 'SELECT' else group_selector.first.locator('option[selected]').inner_text()
            
            # Switch to different group
            if group_selector.get_attribute('tagName') == 'SELECT':
                options = group_selector.locator('option').count()
                if options > 1:
                    group_selector.select_option(index=1)
                    page.wait_for_timeout(3000)
                    
                    # Verify group switch
                    group_indicator = page.locator('.current-group, .active-group')
                    if group_indicator.count() > 0:
                        new_group = group_indicator.inner_text()
                        assert new_group != current_group, "Group should have changed"
            else:
                # Click group switcher
                group_selector.click()
                page.wait_for_timeout(1000)
                
                # Select different group from dropdown
                group_options = page.locator('.group-option, .group-item')
                if group_options.count() > 1:
                    group_options.nth(1).click()
                    page.wait_for_timeout(3000)
                    
                    # Verify group switch success
                    success_message = page.locator('.group-switched, .success')
                    if success_message.count() > 0:
                        expect(success_message).to_be_visible()

    @pytest.mark.regression
    @allure.story("User Capacity Management")
    @allure.title("Manage user capacity and limits")
    def test_user_capacity_management(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test managing user capacity and usage limits"""
        page = authenticated_page
        
        # Navigate to management URL if available
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Check if login is required for management interface
        login_form = page.locator('.login-form, form[action*="login"]')
        if login_form.count() > 0:
            # Login to management interface
            username_field = page.locator('input[name*="username"], input[name*="email"]')
            if username_field.is_visible():
                username_field.fill(test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            
            password_field = page.locator('input[type="password"]')
            if password_field.is_visible():
                password_field.fill(test_config.settings.get('management_user_password', '123456'))
            
            login_button = page.locator('button:has-text("Login"), button[type="submit"]')
            login_button.click()
            page.wait_for_timeout(3000)
        
        # Look for user management section
        user_management = page.locator('.user-management, .users, .capacity-management')
        if user_management.count() > 0:
            user_management.click()
            page.wait_for_timeout(2000)
            
            # Find capacity settings
            capacity_section = page.locator('.capacity-settings, .user-limits, .quota-management')
            if capacity_section.count() > 0:
                capacity_section.scroll_into_view_if_needed()
                
                # Check capacity information
                capacity_info = page.locator('.capacity-info, .usage-stats, .quota-display')
                if capacity_info.count() > 0:
                    capacity_text = capacity_info.inner_text()
                    
                    # Should contain capacity-related information
                    capacity_keywords = ['limit', 'usage', 'capacity', 'quota', 'documents', 'signatures']
                    has_capacity_info = any(keyword in capacity_text.lower() for keyword in capacity_keywords)
                    assert has_capacity_info, f"Capacity section should contain relevant information: {capacity_text}"
                    
                    allure.attach(
                        capacity_text,
                        name="User Capacity Information",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.regression
    @allure.story("User Reports")
    @allure.title("Generate and view user activity reports")
    def test_user_activity_reports(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test generating and viewing user activity reports"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Look for reports section
        reports_link = page.locator('a:has-text("Reports"), .reports, .analytics')
        if reports_link.count() > 0:
            reports_link.click()
            page.wait_for_timeout(2000)
            
            # Generate user activity report
            user_report_button = page.locator('button:has-text("User Activity"), button:has-text("Activity Report"), .user-report')
            if user_report_button.count() > 0:
                user_report_button.click()
                page.wait_for_timeout(3000)
                
                # Check report generation
                report_content = page.locator('.report-content, .activity-report, .report-data')
                if report_content.count() > 0:
                    expect(report_content).to_be_visible()
                    
                    report_text = report_content.inner_text()
                    
                    # Report should contain activity information
                    activity_keywords = ['login', 'document', 'signature', 'activity', 'timestamp']
                    has_activity_data = any(keyword in report_text.lower() for keyword in activity_keywords)
                    
                    if has_activity_data:
                        allure.attach(
                            report_text,
                            name="User Activity Report",
                            attachment_type=allure.attachment_type.TEXT
                        )
                
                # Test report download if available
                download_button = page.locator('button:has-text("Download"), a:has-text("Export"), .download-report')
                if download_button.count() > 0:
                    async with page.expect_download() as download_info:
                        download_button.click()
                    
                    download = download_info.value
                    assert download.suggested_filename, "Report download should have a filename"

    @pytest.mark.regression
    @allure.story("User and Group Administration")
    @allure.title("Administer users and groups through management interface")
    def test_users_and_groups_administration(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test administering users and groups"""
        page = authenticated_page
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login if needed
        login_form = page.locator('.login-form, form[action*="login"]')
        if login_form.count() > 0:
            username_field = page.locator('input[name*="username"], input[name*="email"]')
            if username_field.is_visible():
                username_field.fill(test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            
            password_field = page.locator('input[type="password"]')
            if password_field.is_visible():
                password_field.fill(test_config.settings.get('management_user_password', '123456'))
            
            login_button = page.locator('button:has-text("Login"), input[type="submit"]')
            login_button.click()
            page.wait_for_timeout(3000)
        
        # Navigate to users and groups
        users_groups_link = page.locator('a:has-text("Users"), a:has-text("Groups"), .user-management')
        if users_groups_link.count() > 0:
            users_groups_link.click()
            page.wait_for_timeout(2000)
            
            # Check users list
            users_table = page.locator('.users-table, .users-list, table')
            if users_table.count() > 0:
                expect(users_table).to_be_visible()
                
                # Look for user management actions
                user_actions = page.locator('.user-actions, .edit-user, .manage-user')
                if user_actions.count() > 0:
                    user_actions.first.scroll_into_view_if_needed()
                    
                    # Test viewing user details
                    view_button = page.locator('button:has-text("View"), a:has-text("Details")')
                    if view_button.count() > 0:
                        view_button.first.click()
                        page.wait_for_timeout(2000)
                        
                        user_details = page.locator('.user-details, .user-info')
                        if user_details.count() > 0:
                            expect(user_details).to_be_visible()
                            
                            details_text = user_details.inner_text()
                            user_keywords = ['email', 'name', 'group', 'status', 'role']
                            has_user_info = any(keyword in details_text.lower() for keyword in user_keywords)
                            assert has_user_info, f"User details should contain user information: {details_text}"

    @pytest.mark.regression
    @allure.story("System Administration")
    @allure.title("Perform system maintenance and cleanup tasks")
    def test_system_maintenance_cleanup(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test system maintenance and cleanup tasks"""
        page = authenticated_page
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login to management interface
        login_form = page.locator('.login-form, form[action*="login"]')
        if login_form.count() > 0:
            page.fill('input[name*="username"], input[name*="email"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button:has-text("Login"), input[type="submit"]')
            page.wait_for_timeout(3000)
        
        # Look for maintenance/admin section
        maintenance_link = page.locator('a:has-text("Maintenance"), a:has-text("System"), a:has-text("Admin")')
        if maintenance_link.count() > 0:
            maintenance_link.click()
            page.wait_for_timeout(2000)
            
            # Check for cleanup options
            cleanup_section = page.locator('.cleanup, .maintenance-tasks, .system-tasks')
            if cleanup_section.count() > 0:
                cleanup_section.scroll_into_view_if_needed()
                
                # Look for cleanup jobs
                cleanup_buttons = page.locator('button:has-text("Clean"), button:has-text("Purge"), .cleanup-task')
                if cleanup_buttons.count() > 0:
                    # Don't actually run cleanup in tests, just verify the interface exists
                    cleanup_text = cleanup_buttons.first.inner_text()
                    cleanup_keywords = ['clean', 'purge', 'delete', 'remove', 'maintenance']
                    has_cleanup = any(keyword in cleanup_text.lower() for keyword in cleanup_keywords)
                    assert has_cleanup, f"Cleanup interface should be available: {cleanup_text}"
                    
                    allure.attach(
                        cleanup_text,
                        name="System Maintenance Interface",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.regression
    @allure.story("Password Reset")
    @allure.title("Password reset functionality works correctly")
    def test_password_reset_functionality(
        self, page, test_helpers, test_config
    ):
        """Test password reset functionality from login page"""
        # Navigate to login page
        page.goto(f"{test_config.urls['base_url']}login")
        page.wait_for_load_state('networkidle')
        
        # Look for forgot password link
        forgot_password_link = page.locator('a:has-text("Forgot"), a:has-text("Reset"), .forgot-password')
        if forgot_password_link.count() > 0:
            forgot_password_link.click()
            page.wait_for_timeout(2000)
            
            # Fill password reset form
            email_field = page.locator('input[type="email"], input[name*="email"]')
            if email_field.is_visible():
                email_field.fill(test_config.settings.get('basic_user', 'test@example.com'))
                
                # Submit reset request
                reset_button = page.locator('button:has-text("Reset"), button:has-text("Send"), input[type="submit"]')
                reset_button.click()
                page.wait_for_timeout(3000)
                
                # Verify reset confirmation message
                confirmation = page.locator('.reset-sent, .email-sent, .success')
                expect(confirmation).to_be_visible()
                
                confirmation_text = confirmation.inner_text()
                reset_keywords = ['sent', 'email', 'reset', 'check', 'instructions']
                has_reset_confirmation = any(keyword in confirmation_text.lower() for keyword in reset_keywords)
                assert has_reset_confirmation, f"Reset confirmation should indicate email was sent: {confirmation_text}"

    @pytest.mark.regression
    @allure.story("User Permissions")
    @allure.title("Verify user permission levels and access control")
    def test_user_permission_levels(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test user permission levels and access control"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Check user role/permission information
        user_info = page.locator('.user-info, .user-role, .permission-level')
        if user_info.count() > 0:
            role_text = user_info.inner_text()
            
            # Should indicate user role/permissions
            role_keywords = ['admin', 'user', 'editor', 'manager', 'basic', 'premium']
            has_role_info = any(keyword in role_text.lower() for keyword in role_keywords)
            
            if has_role_info:
                allure.attach(
                    role_text,
                    name="User Role/Permission Information",
                    attachment_type=allure.attachment_type.TEXT
                )
        
        # Test access to restricted features based on user type
        restricted_features = page.locator('.premium-feature, .admin-only, .restricted')
        if restricted_features.count() > 0:
            for i in range(restricted_features.count()):
                feature = restricted_features.nth(i)
                
                # Try to access restricted feature
                try:
                    feature.click()
                    page.wait_for_timeout(1000)
                    
                    # Check for access denied or upgrade message
                    access_denied = page.locator('.access-denied, .upgrade-required, .permission-denied')
                    if access_denied.count() > 0:
                        expect(access_denied).to_be_visible()
                        break
                        
                except Exception:
                    # Feature might be truly restricted and not clickable
                    pass

    @pytest.mark.performance
    @allure.story("Administration Performance")
    @allure.title("Administration interface performance within limits")
    def test_administration_performance(
        self, authenticated_page, test_helpers, test_config, performance_tracker
    ):
        """Test administration interface performance"""
        page = authenticated_page
        
        # Track loading of management interface
        load_start = page.evaluate('() => performance.now()')
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        load_end = page.evaluate('() => performance.now()')
        load_time = int(load_end - load_start)
        performance_tracker['add_operation']('Management Interface Load', load_time)
        
        # Test user list loading performance
        users_link = page.locator('a:has-text("Users"), .user-management')
        if users_link.count() > 0:
            list_start = page.evaluate('() => performance.now()')
            
            users_link.click()
            
            users_table = page.locator('.users-table, .users-list')
            users_table.wait_for(state='visible', timeout=15000)
            
            list_end = page.evaluate('() => performance.now()')
            list_time = int(list_end - list_start)
            performance_tracker['add_operation']('User List Load', list_time)
            
            # Verify performance thresholds
            thresholds = test_config.get_performance_thresholds()
            assert load_time < thresholds['page_load_max'], f"Management load took {load_time}ms, expected < {thresholds['page_load_max']}ms"
            assert list_time < thresholds['ui_response_max'], f"User list load took {list_time}ms, expected < {thresholds['ui_response_max']}ms"