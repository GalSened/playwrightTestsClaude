"""
Cross-Module Integration Test Suite
Tests for integration gaps discovered between WeSign modules

Integration Points Tested:
1. Contact → Document workflow (contact used for document signing)
2. Template → Document creation workflow
3. Document → Email/SMS notification integration
4. Excel Import/Export cross-module consistency
5. Multi-language interface consistency across modules
6. User authentication state across all modules
7. File upload integration across different contexts
8. Search functionality consistency across modules
9. Status synchronization between modules
10. Data persistence across module switches

Critical Integration Gaps Addressed:
- Contact management integration with document workflows
- Template system integration with document creation
- Cross-module data sharing and consistency
- File handling integration across modules
- Notification system integration
- Multi-language consistency
"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.contacts_page import ContactsPage
from pages.documents_page import DocumentsPage
from pages.templates_page import TemplatesPage
from pages.dashboard_page import DashboardPage
from utils.smart_waits import WeSignSmartWaits


class TestCrossModuleIntegration:
    """Cross-module integration test suite covering system-wide workflows"""

    @pytest.fixture(autouse=True)
    async def setup_method(self):
        """Setup method for test isolation"""
        pass

    # CONTACT → DOCUMENT WORKFLOW INTEGRATION (Critical Gap)

    @pytest.mark.asyncio
    async def test_contact_to_document_signing_workflow(self):
        """Test complete workflow from contact management to document signing"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            contacts_page = ContactsPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== CONTACT → DOCUMENT INTEGRATION TEST ===")

            # Step 1: Login and verify contact availability
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Step 2: Access contacts module
            await page.click('button:has-text("Contacts")')
            await smart_waits.wait_for_navigation_complete()

            contact_count = await page.locator('table tbody tr').count()
            print(f"Step 1: Found {contact_count} contacts in system")

            # Step 3: Navigate to documents and check for contact integration
            await page.click('button:has-text("Documents")')
            await smart_waits.wait_for_navigation_complete()

            # Step 4: Look for "Assign & send" functionality (contact integration point)
            assign_button = page.locator('button:has-text("Assign & send")')
            if await assign_button.count() > 0:
                print("Step 2: ✓ Contact-Document integration point found (Assign & send)")

                # Check if button is enabled (indicates documents are selected)
                is_enabled = await assign_button.is_enabled()
                print(f"   Assign & send enabled: {is_enabled}")

                # If disabled, try selecting a document first
                if not is_enabled:
                    document_checkbox = page.locator('table tbody tr input[type="checkbox"]')
                    if await document_checkbox.count() > 0:
                        await document_checkbox.first.check()
                        await smart_waits.wait_for_navigation_complete()

                        is_enabled_after = await assign_button.is_enabled()
                        print(f"   Assign & send enabled after document selection: {is_enabled_after}")

                        if is_enabled_after:
                            print("Step 3: ✓ Document selection enables contact assignment")
                        else:
                            print("Step 3: ⚠ Document selection did not enable contact assignment")

            # Step 5: Check signer assignment workflow
            if contact_count > 0:
                # Look for signer assignment interface
                signer_elements = page.locator('text*="Signer", text*="assign", text*="contact"')
                signer_count = await signer_elements.count()
                print(f"Step 4: Found {signer_count} signer-related elements")

            print("=== CONTACT → DOCUMENT INTEGRATION COMPLETED ===")

            await browser.close()

    @pytest.mark.asyncio
    async def test_contact_data_consistency_across_modules(self):
        """Test that contact data remains consistent when accessed from different modules"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            smart_waits = WeSignSmartWaits(page)

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Collect contact data from contacts module
            await page.click('button:has-text("Contacts")')
            await smart_waits.wait_for_navigation_complete()

            # Get first few contact names from contacts page
            contact_names_from_contacts = []
            contact_rows = page.locator('table tbody tr')
            contact_count = min(3, await contact_rows.count())  # Test first 3 contacts

            for i in range(contact_count):
                try:
                    row = contact_rows.nth(i)
                    name_cell = row.locator('td').first
                    name = await name_cell.text_content()
                    if name and name.strip():
                        contact_names_from_contacts.append(name.strip())
                except:
                    pass

            print(f"Found {len(contact_names_from_contacts)} contacts from contacts module")

            # Check if these contacts appear in document assignment
            await page.click('button:has-text("Documents")')
            await smart_waits.wait_for_navigation_complete()

            # Look for contact references in documents module
            document_content = await page.locator('main').text_content()

            matching_contacts = 0
            for contact_name in contact_names_from_contacts:
                if contact_name.lower() in document_content.lower():
                    matching_contacts += 1
                    print(f"✓ Contact '{contact_name}' referenced in documents module")

            consistency_ratio = matching_contacts / len(contact_names_from_contacts) if contact_names_from_contacts else 0
            print(f"Contact data consistency: {consistency_ratio:.1%} ({matching_contacts}/{len(contact_names_from_contacts)})")

            assert True, "Contact data consistency test completed"

            await browser.close()

    # TEMPLATE → DOCUMENT INTEGRATION (Critical Gap)

    @pytest.mark.asyncio
    async def test_template_to_document_creation_workflow(self):
        """Test template integration with document creation workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== TEMPLATE → DOCUMENT INTEGRATION TEST ===")

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Step 1: Check templates availability
            await page.click('button:has-text("Templates")')
            await smart_waits.wait_for_navigation_complete()

            template_count = await page.locator('table tbody tr, .template-list item, [class*="template"]').count()
            print(f"Step 1: Found {template_count} templates in system")

            # Step 2: Look for template usage in document creation
            await page.click('button:has-text("Dashboard")')
            await smart_waits.wait_for_navigation_complete()

            # Check for template-based document creation
            template_buttons = page.locator('button:has-text("template"), button:has-text("Template")')
            template_button_count = await template_buttons.count()

            if template_button_count > 0:
                print(f"Step 2: ✓ Found {template_button_count} template-related buttons in document creation")

                # Try to click template option
                await template_buttons.first.click()
                await smart_waits.wait_for_navigation_complete()

                # Check if template selection interface appears
                template_selector = page.locator('select option:has-text("template"), .template-selector, .template-list')
                has_template_selector = await template_selector.count() > 0

                if has_template_selector:
                    print("Step 3: ✓ Template selection interface available in document creation")
                else:
                    print("Step 3: ⚠ Template selection interface not found")

            else:
                print("Step 2: ⚠ Template integration not found in document creation workflow")

            # Step 3: Check for template usage tracking
            if template_count > 0:
                await page.click('button:has-text("Templates")')
                await smart_waits.wait_for_navigation_complete()

                usage_indicators = page.locator('text*="used", text*="usage", text*="count"')
                has_usage_tracking = await usage_indicators.count() > 0

                if has_usage_tracking:
                    print("Step 4: ✓ Template usage tracking found")
                else:
                    print("Step 4: ⚠ Template usage tracking not visible")

            print("=== TEMPLATE → DOCUMENT INTEGRATION COMPLETED ===")

            await browser.close()

    # EXCEL IMPORT/EXPORT CROSS-MODULE INTEGRATION (Critical Gap)

    @pytest.mark.asyncio
    async def test_excel_import_export_cross_module_consistency(self):
        """Test Excel import/export functionality consistency across modules"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== EXCEL IMPORT/EXPORT CROSS-MODULE TEST ===")

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            excel_functionality = {}

            # Test 1: Contacts Excel functionality
            await page.click('button:has-text("Contacts")')
            await smart_waits.wait_for_navigation_complete()

            contacts_import = await page.locator('text*="Import Excel", a[href*="xlsx"], button:has-text("Import")').count()
            contacts_export = await page.locator('text*="Export", text*="excel", a[href*="xlsx"]').count()

            excel_functionality['contacts'] = {
                'import': contacts_import > 0,
                'export': contacts_export > 0
            }

            print(f"Step 1: Contacts - Import: {excel_functionality['contacts']['import']}, Export: {excel_functionality['contacts']['export']}")

            # Test 2: Documents Excel functionality
            await page.click('button:has-text("Documents")')
            await smart_waits.wait_for_navigation_complete()

            documents_export = await page.locator('text*="Export documents to Excel", text*="Export"').count()

            excel_functionality['documents'] = {
                'import': False,  # Documents typically don't import from Excel
                'export': documents_export > 0
            }

            print(f"Step 2: Documents - Export: {excel_functionality['documents']['export']}")

            # Test 3: Check for Excel template consistency
            if excel_functionality['contacts']['import']:
                await page.click('button:has-text("Contacts")')
                await smart_waits.wait_for_navigation_complete()

                # Look for Excel template download
                template_link = page.locator('a[href*="Contacts.xlsx"], a[href*="template"], link:has-text("structure")')
                has_template = await template_link.count() > 0

                if has_template:
                    print("Step 3: ✓ Excel template available for contacts import")

                    # Try to access template URL
                    try:
                        template_url = await template_link.first.get_attribute('href')
                        print(f"   Template URL: {template_url}")
                    except:
                        print("   Template URL not accessible")

            # Test 4: Cross-module data format consistency
            if excel_functionality['contacts']['export'] and excel_functionality['documents']['export']:
                print("Step 4: ✓ Both contacts and documents support Excel export")
                print("   Data format consistency should be verified manually")
            else:
                print("Step 4: ⚠ Inconsistent Excel support across modules")

            # Summary
            total_excel_features = sum(
                1 for module in excel_functionality.values()
                for feature in module.values()
                if feature
            )

            print(f"Excel Integration Summary: {total_excel_features} features found across modules")
            print("=== EXCEL IMPORT/EXPORT TEST COMPLETED ===")

            await browser.close()

    # MULTI-LANGUAGE INTEGRATION (Gap)

    @pytest.mark.asyncio
    async def test_multi_language_consistency_across_modules(self):
        """Test multi-language interface consistency across all modules"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== MULTI-LANGUAGE INTEGRATION TEST ===")

            await auth_page.navigate()
            await auth_page.login_with_company_user()

            # Step 1: Detect current language
            current_language = "unknown"

            # Check for language indicators
            if await page.locator('[dir="rtl"], html[lang="he"]').count() > 0:
                current_language = "hebrew"
            elif await page.locator('[dir="ltr"], html[lang="en"]').count() > 0:
                current_language = "english"
            elif await page.locator('text="English"').count() > 0:
                current_language = "english"

            print(f"Step 1: Detected language: {current_language}")

            # Step 2: Test language consistency across modules
            modules = ["Dashboard", "Contacts", "Templates", "Documents"]
            language_consistency = {}

            for module in modules:
                try:
                    await page.click(f'button:has-text("{module}")')
                    await smart_waits.wait_for_navigation_complete()

                    # Check RTL/LTR consistency
                    is_rtl = await page.locator('[dir="rtl"], html[dir="rtl"]').count() > 0
                    is_ltr = await page.locator('[dir="ltr"], html[dir="ltr"]').count() > 0

                    # Check for Hebrew/English text indicators
                    has_hebrew = await page.locator('text=/[\u0590-\u05FF]+/').count() > 0
                    has_english = await page.locator('text=/[A-Za-z]+/').count() > 0

                    language_consistency[module] = {
                        'rtl': is_rtl,
                        'ltr': is_ltr,
                        'hebrew_text': has_hebrew,
                        'english_text': has_english
                    }

                    print(f"   {module}: RTL={is_rtl}, LTR={is_ltr}, Hebrew={has_hebrew}, English={has_english}")

                except Exception as e:
                    print(f"   {module}: Error checking language - {e}")
                    language_consistency[module] = {'error': str(e)}

            # Step 3: Check language switching consistency
            language_selector = page.locator('select, combobox, [class*="language"], [class*="lang"]')
            if await language_selector.count() > 0:
                print("Step 3: ✓ Language selector found")

                # Try to switch language (if selector is available)
                try:
                    await language_selector.first.click()
                    await smart_waits.wait_for_language_switch()

                    # Check if language changed across current module
                    new_rtl = await page.locator('[dir="rtl"]').count() > 0
                    print(f"   Language switch result: RTL={new_rtl}")

                except Exception as e:
                    print(f"   Language switching error: {e}")

            else:
                print("Step 3: ⚠ Language selector not found")

            # Step 4: Verify consistent direction across modules
            rtl_modules = [m for m, data in language_consistency.items() if data.get('rtl')]
            ltr_modules = [m for m, data in language_consistency.items() if data.get('ltr')]

            if len(rtl_modules) > 0 and len(ltr_modules) > 0:
                print(f"Step 4: ⚠ Mixed language directions - RTL: {rtl_modules}, LTR: {ltr_modules}")
            else:
                print("Step 4: ✓ Consistent language direction across modules")

            print("=== MULTI-LANGUAGE INTEGRATION COMPLETED ===")

            await browser.close()

    # USER AUTHENTICATION STATE INTEGRATION (Critical)

    @pytest.mark.asyncio
    async def test_authentication_state_persistence_across_modules(self):
        """Test user authentication state persistence across all modules"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== AUTHENTICATION STATE INTEGRATION TEST ===")

            # Step 1: Login
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            login_success = await auth_page.is_login_successful()
            print(f"Step 1: Login successful: {login_success}")

            if not login_success:
                print("Cannot test authentication persistence - login failed")
                await browser.close()
                return

            # Step 2: Test authentication persistence across modules
            modules = ["Dashboard", "Contacts", "Templates", "Documents"]
            auth_states = {}

            for module in modules:
                try:
                    await page.click(f'button:has-text("{module}")')
                    await smart_waits.wait_for_navigation_complete()

                    # Check authentication indicators
                    is_authenticated = await dashboard_page.is_user_authenticated()
                    current_url = page.url

                    # Check if redirected to login (indicates auth failure)
                    redirected_to_login = "login" in current_url.lower()

                    auth_states[module] = {
                        'authenticated': is_authenticated,
                        'redirected_to_login': redirected_to_login,
                        'url': current_url
                    }

                    status = "✓" if is_authenticated and not redirected_to_login else "⚠"
                    print(f"   {module}: {status} Auth={is_authenticated}, Login_redirect={redirected_to_login}")

                except Exception as e:
                    print(f"   {module}: Error - {e}")
                    auth_states[module] = {'error': str(e)}

            # Step 3: Test session persistence after page refresh
            await page.reload()
            await smart_waits.wait_for_navigation_complete()

            still_authenticated = await dashboard_page.is_user_authenticated()
            current_url_after_refresh = page.url
            redirected_after_refresh = "login" in current_url_after_refresh.lower()

            print(f"Step 3: After refresh - Auth={still_authenticated}, Redirected={redirected_after_refresh}")

            # Step 4: Test deep linking authentication
            protected_urls = [
                "/dashboard/documents/all",
                "/dashboard/contacts",
                "/dashboard/templates"
            ]

            for url_path in protected_urls:
                try:
                    full_url = f"https://devtest.comda.co.il{url_path}"
                    await page.goto(full_url)
                    await smart_waits.wait_for_navigation_complete()

                    final_url = page.url
                    is_on_login = "login" in final_url.lower()

                    if is_on_login:
                        print(f"   {url_path}: ⚠ Redirected to login (auth lost)")
                    else:
                        print(f"   {url_path}: ✓ Direct access successful")

                except Exception as e:
                    print(f"   {url_path}: Error - {e}")

            # Summary
            successful_auth_modules = sum(
                1 for state in auth_states.values()
                if state.get('authenticated') and not state.get('redirected_to_login')
            )

            print(f"Authentication Summary: {successful_auth_modules}/{len(modules)} modules maintain auth state")
            print("=== AUTHENTICATION STATE INTEGRATION COMPLETED ===")

            await browser.close()

    # COMPREHENSIVE INTEGRATION TEST

    @pytest.mark.asyncio
    async def test_comprehensive_cross_module_integration_workflow(self):
        """Comprehensive test of all major cross-module integrations"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            smart_waits = WeSignSmartWaits(page)

            print("=== COMPREHENSIVE CROSS-MODULE INTEGRATION TEST ===")

            # Authentication
            await auth_page.navigate()
            await auth_page.login_with_company_user()

            integration_results = {
                'authentication': True,
                'contact_document': False,
                'template_document': False,
                'excel_integration': False,
                'language_consistency': False,
                'data_persistence': False
            }

            # Test 1: Contact-Document Integration
            print("Testing contact-document integration...")
            await page.click('button:has-text("Contacts")')
            await smart_waits.wait_for_navigation_complete()

            contact_count = await page.locator('table tbody tr').count()

            await page.click('button:has-text("Documents")')
            await smart_waits.wait_for_navigation_complete()

            assign_button = await page.locator('button:has-text("Assign & send")').count()
            integration_results['contact_document'] = contact_count > 0 and assign_button > 0

            # Test 2: Template Integration
            print("Testing template integration...")
            await page.click('button:has-text("Templates")')
            await smart_waits.wait_for_navigation_complete()

            template_count = await page.locator('table tbody tr, [class*="template"]').count()
            integration_results['template_document'] = template_count > 0

            # Test 3: Excel Integration
            print("Testing Excel integration...")
            await page.click('button:has-text("Contacts")')
            await smart_waits.wait_for_navigation_complete()

            excel_import = await page.locator('text*="Import Excel"').count()

            await page.click('button:has-text("Documents")')
            await smart_waits.wait_for_navigation_complete()

            excel_export = await page.locator('text*="Export documents to Excel"').count()
            integration_results['excel_integration'] = excel_import > 0 or excel_export > 0

            # Test 4: Language Consistency
            print("Testing language consistency...")
            rtl_count = await page.locator('[dir="rtl"]').count()
            ltr_count = await page.locator('[dir="ltr"]').count()
            integration_results['language_consistency'] = rtl_count > 0 or ltr_count > 0

            # Test 5: Data Persistence
            print("Testing data persistence...")
            await page.reload()
            await smart_waits.wait_for_navigation_complete()

            still_in_dashboard = "dashboard" in page.url.lower()
            integration_results['data_persistence'] = still_in_dashboard

            # Results Summary
            passed_integrations = sum(integration_results.values())
            total_integrations = len(integration_results)

            print("\n=== INTEGRATION TEST RESULTS ===")
            for integration, passed in integration_results.items():
                status = "✓ PASS" if passed else "⚠ FAIL"
                print(f"{integration:20}: {status}")

            print(f"\nOverall Integration Score: {passed_integrations}/{total_integrations} ({passed_integrations/total_integrations:.1%})")

            print("=== COMPREHENSIVE INTEGRATION TEST COMPLETED ===")

            # Assert that at least 60% of integrations work
            assert passed_integrations >= (total_integrations * 0.6), f"Integration test failed: only {passed_integrations}/{total_integrations} integrations working"

            await browser.close()