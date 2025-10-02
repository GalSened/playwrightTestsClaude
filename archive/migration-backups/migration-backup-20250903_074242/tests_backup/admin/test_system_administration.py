"""
System Administration and Compliance Tests
Tests for system administration, audit trails, compliance, and legal workflows
that are present in Selenium but missing from the Playwright test suite.
"""

import pytest
import allure
from playwright.sync_api import expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.utils.test_helpers import TestHelpers


@allure.epic("System Administration")
@allure.feature("System Maintenance and Compliance")
class TestSystemAdministration:
    """System administration and compliance test suite"""

    @pytest.mark.regression
    @allure.story("Database Management")
    @allure.title("Validate database cleanup jobs execution")
    def test_database_cleanup_jobs_validation(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test database cleanup job validation and execution"""
        page = authenticated_page
        
        # Navigate to management interface
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login to management interface if needed
        login_form = page.locator('.login-form, form[action*="login"]')
        if login_form.count() > 0:
            page.fill('input[name*="username"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button:has-text("Login")')
            page.wait_for_timeout(3000)
        
        # Navigate to database management
        db_management = page.locator('a:has-text("Database"), a:has-text("Jobs"), .database-management')
        if db_management.count() > 0:
            db_management.click()
            page.wait_for_timeout(2000)
            
            # Look for cleanup jobs
            cleanup_jobs = page.locator('.cleanup-job, .maintenance-job, .scheduled-job')
            if cleanup_jobs.count() > 0:
                # Check job status
                job_status = page.locator('.job-status, .status-indicator')
                if job_status.count() > 0:
                    status_text = job_status.first.inner_text()
                    
                    # Status should indicate job state
                    status_keywords = ['running', 'completed', 'scheduled', 'failed', 'pending']
                    has_status = any(keyword in status_text.lower() for keyword in status_keywords)
                    assert has_status, f"Job status should be recognizable: {status_text}"
                    
                    allure.attach(
                        status_text,
                        name="Database Cleanup Job Status",
                        attachment_type=allure.attachment_type.TEXT
                    )
                
                # Check for job execution button (but don't execute in test)
                execute_button = page.locator('button:has-text("Execute"), button:has-text("Run"), .execute-job')
                if execute_button.count() > 0:
                    expect(execute_button).to_be_visible()

    @pytest.mark.regression
    @allure.story("User Data Retention")
    @allure.title("Validate user data retention policies after document completion")
    def test_user_data_retention_policies(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test user data retention policies and cleanup after document completion"""
        page = authenticated_page
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login if needed
        login_form = page.locator('.login-form')
        if login_form.count() > 0:
            page.fill('input[name*="username"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)
        
        # Navigate to data retention settings
        retention_settings = page.locator('a:has-text("Retention"), a:has-text("Data Policy"), .data-retention')
        if retention_settings.count() > 0:
            retention_settings.click()
            page.wait_for_timeout(2000)
            
            # Check retention policy configuration
            policy_config = page.locator('.retention-policy, .data-policy, .cleanup-policy')
            if policy_config.count() > 0:
                policy_text = policy_config.inner_text()
                
                # Should contain retention period information
                retention_keywords = ['days', 'months', 'delete', 'retention', 'cleanup', 'expire']
                has_retention_info = any(keyword in policy_text.lower() for keyword in retention_keywords)
                assert has_retention_info, f"Retention policy should contain timing information: {policy_text}"
                
                # Look for 13-month retention policy (based on Selenium tests)
                has_13_months = '13' in policy_text and 'month' in policy_text.lower()
                if has_13_months:
                    allure.attach(
                        policy_text,
                        name="13-Month Retention Policy Detected",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.regression
    @allure.story("Template Lifecycle Management")
    @allure.title("Manage template lifecycle and automatic deletion")
    def test_template_lifecycle_management(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test template lifecycle management and automatic deletion policies"""
        page = authenticated_page
        
        # Navigate to templates section
        page.goto(f"{test_config.urls['base_url']}templates")
        page.wait_for_load_state('networkidle')
        
        # Look for template management interface
        template_management = page.locator('.template-management, .template-admin, .lifecycle-management')
        if template_management.count() > 0:
            template_management.scroll_into_view_if_needed()
            
            # Check for template expiration settings
            expiration_settings = page.locator('.expiration-settings, .template-expiry, .lifecycle-policy')
            if expiration_settings.count() > 0:
                expiration_text = expiration_settings.inner_text()
                
                # Should contain expiration information
                expiry_keywords = ['expir', 'delete', 'lifecycle', 'automatic', 'policy']
                has_expiry_info = any(keyword in expiration_text.lower() for keyword in expiry_keywords)
                assert has_expiry_info, f"Template expiration settings should be available: {expiration_text}"
        
        # Check individual template lifecycle information
        templates_list = page.locator('.templates-list, .template-grid, .template-item')
        if templates_list.count() > 0:
            template_items = page.locator('.template-item, .template-card')
            if template_items.count() > 0:
                # Check first template for lifecycle info
                first_template = template_items.first
                template_info = first_template.inner_text()
                
                # Look for creation date, expiry date, or status
                lifecycle_keywords = ['created', 'expires', 'status', 'active', 'archived']
                has_lifecycle_info = any(keyword in template_info.lower() for keyword in lifecycle_keywords)
                
                if has_lifecycle_info:
                    allure.attach(
                        template_info,
                        name="Template Lifecycle Information",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.regression
    @allure.story("Audit Trail")
    @allure.title("Generate and verify audit trail functionality")
    def test_audit_trail_functionality(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test audit trail generation and verification"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Look for audit trail or logs section
        audit_link = page.locator('a:has-text("Audit"), a:has-text("Logs"), a:has-text("Trail"), .audit-trail')
        if audit_link.count() > 0:
            audit_link.click()
            page.wait_for_timeout(2000)
            
            # Check audit trail interface
            audit_interface = page.locator('.audit-interface, .audit-log, .trail-viewer')
            if audit_interface.count() > 0:
                expect(audit_interface).to_be_visible()
                
                # Look for audit entries
                audit_entries = page.locator('.audit-entry, .log-entry, .trail-entry')
                if audit_entries.count() > 0:
                    # Check first audit entry
                    first_entry = audit_entries.first
                    entry_text = first_entry.inner_text()
                    
                    # Should contain audit information
                    audit_keywords = ['user', 'action', 'timestamp', 'event', 'login', 'document', 'change']
                    has_audit_info = any(keyword in entry_text.lower() for keyword in audit_keywords)
                    assert has_audit_info, f"Audit entry should contain relevant information: {entry_text}"
                    
                    allure.attach(
                        entry_text,
                        name="Audit Trail Entry",
                        attachment_type=allure.attachment_type.TEXT
                    )
                
                # Test audit trail filtering if available
                filter_options = page.locator('.audit-filter, .log-filter, select[name*="filter"]')
                if filter_options.count() > 0:
                    # Try filtering by action type
                    filter_options.first.click()
                    page.wait_for_timeout(1000)
                    
                    filter_items = page.locator('.filter-option, option')
                    if filter_items.count() > 1:
                        filter_items.nth(1).click()
                        page.wait_for_timeout(2000)
                        
                        # Verify filtered results
                        filtered_entries = page.locator('.audit-entry, .log-entry')
                        if filtered_entries.count() > 0:
                            assert filtered_entries.count() <= audit_entries.count(), "Filtering should reduce or maintain entry count"

    @pytest.mark.regression
    @allure.story("Terms and Conditions")
    @allure.title("Validate terms and conditions acceptance workflow")
    def test_terms_conditions_acceptance(
        self, page, test_helpers, test_config
    ):
        """Test terms and conditions acceptance workflow"""
        # Navigate to terms page
        terms_url = f"{test_config.urls['base_url']}terms"
        page.goto(terms_url)
        page.wait_for_load_state('networkidle')
        
        # Check terms and conditions content
        terms_content = page.locator('.terms-content, .legal-content, .terms-text')
        if terms_content.count() > 0:
            expect(terms_content).to_be_visible()
            
            content_text = terms_content.inner_text()
            
            # Should contain legal terms
            legal_keywords = ['terms', 'conditions', 'agreement', 'service', 'privacy', 'liability']
            has_legal_content = any(keyword in content_text.lower() for keyword in legal_keywords)
            assert has_legal_content, f"Terms content should contain legal information: {content_text[:200]}"
            
            # Look for acceptance mechanism
            accept_button = page.locator('button:has-text("Accept"), button:has-text("Agree"), .accept-terms')
            if accept_button.count() > 0:
                # Test acceptance (but don't actually accept in test)
                expect(accept_button).to_be_visible()
                
                # Check if acceptance is required before proceeding
                acceptance_required = page.locator('.acceptance-required, .must-accept')
                if acceptance_required.count() > 0:
                    expect(acceptance_required).to_be_visible()

    @pytest.mark.regression
    @allure.story("Legal Compliance")
    @allure.title("Verify legal compliance validation workflows")
    def test_legal_compliance_validation(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test legal compliance validation workflows"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Look for compliance section
        compliance_link = page.locator('a:has-text("Compliance"), a:has-text("Legal"), .compliance')
        if compliance_link.count() > 0:
            compliance_link.click()
            page.wait_for_timeout(2000)
            
            # Check compliance dashboard
            compliance_dashboard = page.locator('.compliance-dashboard, .legal-dashboard')
            if compliance_dashboard.count() > 0:
                expect(compliance_dashboard).to_be_visible()
                
                # Look for compliance status indicators
                compliance_status = page.locator('.compliance-status, .legal-status, .validation-status')
                if compliance_status.count() > 0:
                    status_text = compliance_status.inner_text()
                    
                    # Should indicate compliance state
                    compliance_keywords = ['compliant', 'valid', 'approved', 'verified', 'status']
                    has_compliance_info = any(keyword in status_text.lower() for keyword in compliance_keywords)
                    assert has_compliance_info, f"Compliance status should be indicated: {status_text}"
                    
                    allure.attach(
                        status_text,
                        name="Legal Compliance Status",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.regression
    @allure.story("Document Retention Policies")
    @allure.title("Validate document retention and deletion policies")
    def test_document_retention_policies(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test document retention and deletion policies"""
        page = authenticated_page
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login if needed
        login_form = page.locator('.login-form')
        if login_form.count() > 0:
            page.fill('input[name*="username"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)
        
        # Navigate to document management
        doc_management = page.locator('a:has-text("Documents"), .document-management')
        if doc_management.count() > 0:
            doc_management.click()
            page.wait_for_timeout(2000)
            
            # Look for retention policy settings
            retention_policy = page.locator('.retention-policy, .document-policy, .deletion-policy')
            if retention_policy.count() > 0:
                policy_text = retention_policy.inner_text()
                
                # Should contain retention timing information
                retention_keywords = ['retain', 'delete', 'days', 'months', 'years', 'policy']
                has_retention_policy = any(keyword in policy_text.lower() for keyword in retention_keywords)
                assert has_retention_policy, f"Document retention policy should be defined: {policy_text}"
                
                # Check for automatic deletion configuration
                auto_delete = page.locator('.auto-delete, .automatic-deletion, .scheduled-deletion')
                if auto_delete.count() > 0:
                    delete_text = auto_delete.inner_text()
                    
                    delete_keywords = ['automatic', 'scheduled', 'delete', 'remove']
                    has_auto_delete = any(keyword in delete_text.lower() for keyword in delete_keywords)
                    
                    if has_auto_delete:
                        allure.attach(
                            delete_text,
                            name="Automatic Document Deletion Policy",
                            attachment_type=allure.attachment_type.TEXT
                        )

    @pytest.mark.regression
    @allure.story("System Monitoring")
    @allure.title("Monitor system performance and health")
    def test_system_monitoring_health(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test system monitoring and health checks"""
        page = authenticated_page
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        # Login if needed
        login_form = page.locator('.login-form')
        if login_form.count() > 0:
            page.fill('input[name*="username"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)
        
        # Look for monitoring dashboard
        monitoring_link = page.locator('a:has-text("Monitor"), a:has-text("Health"), a:has-text("Status"), .monitoring')
        if monitoring_link.count() > 0:
            monitoring_link.click()
            page.wait_for_timeout(2000)
            
            # Check system health indicators
            health_indicators = page.locator('.health-indicator, .status-indicator, .system-status')
            if health_indicators.count() > 0:
                for i in range(min(3, health_indicators.count())):
                    indicator = health_indicators.nth(i)
                    indicator_text = indicator.inner_text()
                    
                    # Should show system component status
                    status_keywords = ['online', 'offline', 'healthy', 'warning', 'error', 'ok', 'running']
                    has_status = any(keyword in indicator_text.lower() for keyword in status_keywords)
                    
                    if has_status:
                        allure.attach(
                            indicator_text,
                            name=f"System Health Indicator {i+1}",
                            attachment_type=allure.attachment_type.TEXT
                        )
            
            # Check performance metrics if available
            performance_metrics = page.locator('.performance-metrics, .system-metrics, .resource-usage')
            if performance_metrics.count() > 0:
                metrics_text = performance_metrics.inner_text()
                
                # Should contain performance data
                metrics_keywords = ['cpu', 'memory', 'disk', 'network', 'usage', 'load', 'response']
                has_metrics = any(keyword in metrics_text.lower() for keyword in metrics_keywords)
                
                if has_metrics:
                    allure.attach(
                        metrics_text,
                        name="System Performance Metrics",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.performance
    @allure.story("System Performance")
    @allure.title("System administration performance within acceptable limits")
    def test_system_administration_performance(
        self, authenticated_page, test_helpers, test_config, performance_tracker
    ):
        """Test system administration interface performance"""
        page = authenticated_page
        
        # Track management interface loading
        load_start = page.evaluate('() => performance.now()')
        
        management_url = test_config.settings.get('management_url', 'https://devtest.comda.co.il:10443/')
        page.goto(management_url)
        page.wait_for_load_state('networkidle')
        
        load_end = page.evaluate('() => performance.now()')
        load_time = int(load_end - load_start)
        performance_tracker['add_operation']('System Admin Interface Load', load_time)
        
        # Login and track authentication performance
        login_form = page.locator('.login-form')
        if login_form.count() > 0:
            auth_start = page.evaluate('() => performance.now()')
            
            page.fill('input[name*="username"]', test_config.settings.get('management_user_email', 'systemadmin@comda.co.il'))
            page.fill('input[type="password"]', test_config.settings.get('management_user_password', '123456'))
            page.click('button[type="submit"]')
            page.wait_for_load_state('networkidle')
            
            auth_end = page.evaluate('() => performance.now()')
            auth_time = int(auth_end - auth_start)
            performance_tracker['add_operation']('Admin Authentication', auth_time)
            
            # Track database query performance
            db_link = page.locator('a:has-text("Database"), a:has-text("Users")')
            if db_link.count() > 0:
                query_start = page.evaluate('() => performance.now()')
                
                db_link.first.click()
                page.wait_for_load_state('networkidle')
                
                query_end = page.evaluate('() => performance.now()')
                query_time = int(query_end - query_start)
                performance_tracker['add_operation']('Database Query Response', query_time)
                
                # Verify performance thresholds
                thresholds = test_config.get_performance_thresholds()
                assert load_time < thresholds['page_load_max'] * 2, f"Admin interface load took {load_time}ms"
                assert auth_time < thresholds['ui_response_max'] * 3, f"Admin authentication took {auth_time}ms"
                assert query_time < thresholds['ui_response_max'] * 2, f"Database query took {query_time}ms"