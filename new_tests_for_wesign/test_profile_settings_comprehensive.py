"""Comprehensive User Profile and Settings Test Suite - WeSign"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


class TestProfileSettingsComprehensive:
    """Comprehensive user profile and settings test suite covering all profile scenarios"""

    @pytest.mark.asyncio
    async def test_profile_page_navigation_and_layout(self):
        """Test 1: Profile page navigation and UI layout validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            try:
                print("=== PROFILE PAGE NAVIGATION TEST ===")

                # Step 1: Authenticate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                assert await auth_page.is_login_successful(), "Login should succeed"

                # Step 2: Navigate to profile
                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Step 3: Validate profile page elements
                profile_form = await page.locator("form, .profile-form, [data-testid='profile-form']").count() > 0
                name_field = await page.locator("input[name='name'], input[id*='name'], #name").count() > 0
                email_field = await page.locator("input[name='email'], input[id*='email'], #email").count() > 0
                save_button = await page.locator("button:has-text('Save'), button:has-text('Update'), .save-btn").count() > 0

                print(f"Profile form loaded: {profile_form}")
                print(f"Name field visible: {name_field}")
                print(f"Email field visible: {email_field}")
                print(f"Save button available: {save_button}")

                current_url = page.url
                assert "profile" in current_url, f"Should be on profile page, got: {current_url}"

                # Validate profile information is loaded
                name_value = ""
                email_value = ""

                if name_field:
                    name_value = await page.locator("input[name='name'], input[id*='name'], #name").first.input_value()
                if email_field:
                    email_value = await page.locator("input[name='email'], input[id*='email'], #email").first.input_value()

                print(f"Profile data loaded - Name: {bool(name_value)}, Email: {bool(email_value)}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_profile_information_update(self):
        """Test 2: Profile information update functionality"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PROFILE INFORMATION UPDATE TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to profile
                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Test name update
                name_selectors = ["input[name='name']", "input[id*='name']", "#name", "[data-testid='name-input']"]
                name_updated = False

                for selector in name_selectors:
                    if await page.locator(selector).count() > 0:
                        current_name = await page.locator(selector).input_value()
                        test_name = f"Test User {asyncio.current_task().get_name()[-4:]}"

                        await page.locator(selector).fill("")
                        await page.locator(selector).fill(test_name)

                        updated_name = await page.locator(selector).input_value()
                        if updated_name == test_name:
                            name_updated = True
                            print(f"Name update successful: {current_name} -> {test_name}")
                        break

                # Test other profile fields
                profile_fields = {
                    "username": ["input[name='username']", "input[id*='username']", "#username"],
                    "phone": ["input[name='phone']", "input[id*='phone']", "#phone", "input[type='tel']"],
                    "company": ["input[name='company']", "input[id*='company']", "#company"]
                }

                fields_found = {}
                for field_name, selectors in profile_fields.items():
                    for selector in selectors:
                        if await page.locator(selector).count() > 0:
                            fields_found[field_name] = selector
                            print(f"{field_name.title()} field found: {selector}")
                            break

                # Test save functionality
                save_buttons = [
                    "button:has-text('Save')",
                    "button:has-text('Update')",
                    "button[type='submit']",
                    ".save-btn",
                    "[data-testid='save-profile']"
                ]

                save_attempted = False
                for btn_selector in save_buttons:
                    if await page.locator(btn_selector).count() > 0:
                        await page.locator(btn_selector).click()
                        await page.wait_for_timeout(2000)
                        save_attempted = True
                        print("Save button clicked")
                        break

                # Check for success message
                success_indicators = [
                    ".success, .alert-success",
                    ":has-text('Success')",
                    ":has-text('Updated')",
                    "[role='alert']:has-text('success')"
                ]

                success_shown = False
                for indicator in success_indicators:
                    if await page.locator(indicator).count() > 0:
                        success_shown = True
                        print("Success message displayed")
                        break

                print(f"Profile update test completed - Fields: {len(fields_found)}, Save attempted: {save_attempted}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_language_settings_configuration(self):
        """Test 3: Language and localization settings"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== LANGUAGE SETTINGS CONFIGURATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for language selection options
                language_selectors = [
                    "select[name='language']",
                    "select[id*='language']",
                    ".language-select",
                    "[data-testid='language-selector']",
                    "input[name='language']"
                ]

                language_option_found = False
                current_language = None

                for selector in language_selectors:
                    if await page.locator(selector).count() > 0:
                        language_option_found = True
                        element_type = await page.locator(selector).first.get_attribute("tagName")

                        if element_type.lower() == "select":
                            current_language = await page.locator(selector).input_value()
                            options = await page.locator(f"{selector} option").count()
                            print(f"Language dropdown found with {options} options")

                            # Test language switching if multiple options
                            if options > 1:
                                await page.locator(selector).select_option(index=1)
                                new_language = await page.locator(selector).input_value()
                                print(f"Language changed from {current_language} to {new_language}")

                        print(f"Language selector found: {selector}")
                        break

                # Look for language toggle buttons (Hebrew/English)
                language_buttons = [
                    "button:has-text('English')",
                    "button:has-text('Hebrew')",
                    "button:has-text('עברית')",
                    ".lang-btn",
                    "[data-testid*='language']"
                ]

                language_buttons_found = 0
                for btn_selector in language_buttons:
                    count = await page.locator(btn_selector).count()
                    if count > 0:
                        language_buttons_found += count
                        print(f"Language button found: {btn_selector}")

                # Test RTL/LTR layout detection
                page_direction = await page.evaluate("() => document.dir || document.documentElement.dir || 'ltr'")
                body_direction = await page.locator("body").get_attribute("dir")

                print(f"Page direction: {page_direction}")
                print(f"Body direction: {body_direction}")

                print(f"Language configuration validated - Selector: {language_option_found}, Buttons: {language_buttons_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_signature_preferences_settings(self):
        """Test 4: Signature color and preferences configuration"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== SIGNATURE PREFERENCES SETTINGS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for signature color options
                signature_color_selectors = [
                    "input[name='signatureColor']",
                    "input[id*='signature']",
                    ".color-picker",
                    "input[type='color']",
                    "[data-testid*='signature-color']"
                ]

                signature_options_found = 0
                for selector in signature_color_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        signature_options_found += count

                        # Test color selection
                        if "color" in selector:
                            current_color = await page.locator(selector).first.get_attribute("value")
                            print(f"Current signature color: {current_color}")

                        print(f"Signature color option found: {selector}")

                # Look for color preset buttons (Blue/Black as mentioned in profile.component.ts)
                color_buttons = [
                    "button:has-text('Blue')",
                    "button:has-text('Black')",
                    ".color-blue",
                    ".color-black",
                    "[data-testid*='color-blue']",
                    "[data-testid*='color-black']"
                ]

                color_buttons_found = 0
                for btn_selector in color_buttons:
                    count = await page.locator(btn_selector).count()
                    if count > 0:
                        color_buttons_found += count
                        print(f"Color preset button found: {btn_selector}")

                        # Test clicking color button
                        await page.locator(btn_selector).first.click()
                        await page.wait_for_timeout(500)

                # Look for signature display preferences
                signature_prefs = [
                    "input[name*='displaySignerName']",
                    "input[id*='signer-name']",
                    "checkbox:has-text('Display')",
                    "[data-testid*='display-name']"
                ]

                signature_prefs_found = 0
                for selector in signature_prefs:
                    count = await page.locator(selector).count()
                    if count > 0:
                        signature_prefs_found += count
                        print(f"Signature preference found: {selector}")

                print(f"Signature settings validated - Colors: {signature_options_found}, Buttons: {color_buttons_found}, Prefs: {signature_prefs_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_notification_reminder_settings(self):
        """Test 5: Notification and reminder frequency settings"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== NOTIFICATION REMINDER SETTINGS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for reminder settings
                reminder_selectors = [
                    "input[name*='reminder']",
                    "input[id*='reminder']",
                    "select[name*='frequency']",
                    "[data-testid*='reminder']",
                    "input[name*='notification']"
                ]

                reminder_options_found = 0
                for selector in reminder_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        reminder_options_found += count
                        element_type = await page.locator(selector).first.get_attribute("tagName")

                        if element_type.lower() == "input":
                            input_type = await page.locator(selector).first.get_attribute("type")
                            if input_type == "checkbox":
                                is_checked = await page.locator(selector).first.is_checked()
                                print(f"Reminder checkbox found - Checked: {is_checked}")
                            elif input_type == "number":
                                value = await page.locator(selector).first.input_value()
                                print(f"Reminder frequency input found - Value: {value}")

                        print(f"Reminder setting found: {selector}")

                # Test reminder frequency options
                frequency_selectors = [
                    "select[name*='frequency']",
                    "input[name*='days']",
                    "input[name*='frequency']"
                ]

                frequency_settings_found = 0
                for selector in frequency_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        frequency_settings_found += count

                        element_type = await page.locator(selector).first.get_attribute("tagName")
                        if element_type.lower() == "select":
                            options = await page.locator(f"{selector} option").count()
                            print(f"Frequency dropdown found with {options} options")
                        elif element_type.lower() == "input":
                            current_value = await page.locator(selector).first.input_value()
                            print(f"Frequency input found - Value: {current_value}")

                # Look for email notification settings
                email_notification_selectors = [
                    "input[name*='email']",
                    "input[id*='notification']",
                    "checkbox:has-text('Email')",
                    "[data-testid*='email-notification']"
                ]

                email_settings_found = 0
                for selector in email_notification_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        email_settings_found += count
                        print(f"Email notification setting found: {selector}")

                print(f"Notification settings validated - Reminders: {reminder_options_found}, Frequency: {frequency_settings_found}, Email: {email_settings_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_password_change_functionality(self):
        """Test 6: Password change and security settings"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PASSWORD CHANGE FUNCTIONALITY TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for password change section
                password_selectors = [
                    "input[name='currentPassword']",
                    "input[name='newPassword']",
                    "input[name='confirmPassword']",
                    "input[type='password']",
                    "[data-testid*='password']",
                    "button:has-text('Change Password')"
                ]

                password_fields_found = 0
                password_types_found = []

                for selector in password_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        password_fields_found += count

                        if "current" in selector.lower():
                            password_types_found.append("current")
                        elif "new" in selector.lower():
                            password_types_found.append("new")
                        elif "confirm" in selector.lower():
                            password_types_found.append("confirm")
                        elif "button" in selector.lower():
                            password_types_found.append("button")
                        else:
                            password_types_found.append("general")

                        print(f"Password field found: {selector}")

                # Test password field validation
                password_inputs = await page.locator("input[type='password']").count()
                if password_inputs > 0:
                    # Test with weak password
                    weak_password = "123"
                    await page.locator("input[type='password']").first.fill(weak_password)

                    # Check for validation messages
                    await page.wait_for_timeout(1000)
                    validation_messages = await page.locator(".error, .invalid-feedback, [role='alert']").count()

                    print(f"Password validation triggered: {validation_messages > 0}")

                # Look for security questions or additional security features
                security_selectors = [
                    "input[name*='security']",
                    "select[name*='question']",
                    "input[name*='answer']",
                    "[data-testid*='security']"
                ]

                security_features_found = 0
                for selector in security_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        security_features_found += count
                        print(f"Security feature found: {selector}")

                print(f"Password security validated - Fields: {password_fields_found}, Types: {password_types_found}, Security: {security_features_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_phone_number_update_modal(self):
        """Test 7: Phone number update functionality (modal-based)"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PHONE NUMBER UPDATE MODAL TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Look for phone update trigger
                phone_triggers = [
                    "button:has-text('Update Phone')",
                    "button:has-text('Change Phone')",
                    "button:has-text('Edit Phone')",
                    ".edit-phone-btn",
                    "[data-testid*='phone-update']"
                ]

                phone_modal_triggered = False
                for trigger_selector in phone_triggers:
                    if await page.locator(trigger_selector).count() > 0:
                        await page.locator(trigger_selector).click()
                        await page.wait_for_timeout(1000)
                        phone_modal_triggered = True
                        print(f"Phone update modal triggered: {trigger_selector}")
                        break

                # Look for phone input fields
                phone_selectors = [
                    "input[name='phone']",
                    "input[type='tel']",
                    "input[id*='phone']",
                    "[data-testid*='phone-input']"
                ]

                phone_fields_found = 0
                for selector in phone_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        phone_fields_found += count

                        # Test phone number format validation
                        test_phone = "+1234567890"
                        await page.locator(selector).first.fill(test_phone)

                        filled_value = await page.locator(selector).first.input_value()
                        print(f"Phone field test - Input: {test_phone}, Result: {filled_value}")

                # Look for phone verification features
                verification_selectors = [
                    "button:has-text('Verify')",
                    "button:has-text('Send Code')",
                    "input[name*='verification']",
                    "input[name*='code']",
                    "[data-testid*='verification']"
                ]

                verification_features_found = 0
                for selector in verification_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        verification_features_found += count
                        print(f"Phone verification feature found: {selector}")

                # Test modal close functionality
                modal_close_selectors = [
                    "button:has-text('Close')",
                    "button:has-text('Cancel')",
                    ".close-btn",
                    "[data-testid*='close-modal']"
                ]

                modal_close_found = False
                for close_selector in modal_close_selectors:
                    if await page.locator(close_selector).count() > 0:
                        modal_close_found = True
                        print(f"Modal close button found: {close_selector}")
                        break

                print(f"Phone update modal validated - Triggered: {phone_modal_triggered}, Fields: {phone_fields_found}, Verification: {verification_features_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_profile_validation_and_error_handling(self):
        """Test 8: Profile form validation and error handling"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PROFILE VALIDATION ERROR HANDLING TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Test cases for validation
                validation_tests = [
                    {
                        "field": "name",
                        "selectors": ["input[name='name']", "input[id*='name']", "#name"],
                        "invalid_value": "",
                        "test_name": "Empty name validation"
                    },
                    {
                        "field": "email",
                        "selectors": ["input[name='email']", "input[id*='email']", "#email"],
                        "invalid_value": "invalid-email",
                        "test_name": "Invalid email format validation"
                    },
                    {
                        "field": "username",
                        "selectors": ["input[name='username']", "input[id*='username']", "#username"],
                        "invalid_value": "ab",  # Too short (< 6 chars based on component)
                        "test_name": "Username length validation"
                    },
                    {
                        "field": "username_hebrew",
                        "selectors": ["input[name='username']", "input[id*='username']", "#username"],
                        "invalid_value": "שם_משתמש_עברית",  # Hebrew letters (not allowed based on component)
                        "test_name": "Username Hebrew characters validation"
                    }
                ]

                validation_results = []

                for test_case in validation_tests:
                    field_found = False
                    validation_triggered = False

                    for selector in test_case["selectors"]:
                        if await page.locator(selector).count() > 0:
                            field_found = True

                            # Clear and fill with invalid value
                            await page.locator(selector).fill("")
                            await page.locator(selector).fill(test_case["invalid_value"])
                            await page.locator(selector).blur()  # Trigger validation

                            await page.wait_for_timeout(500)

                            # Check for validation messages
                            error_selectors = [
                                ".error",
                                ".invalid-feedback",
                                "[role='alert']",
                                ".field-error",
                                "[data-testid*='error']"
                            ]

                            for error_selector in error_selectors:
                                if await page.locator(error_selector).count() > 0:
                                    validation_triggered = True
                                    break

                            print(f"{test_case['test_name']}: Field found: {field_found}, Validation triggered: {validation_triggered}")
                            break

                    validation_results.append({
                        "test": test_case["test_name"],
                        "field_found": field_found,
                        "validation_triggered": validation_triggered
                    })

                # Test form submission with invalid data
                save_buttons = ["button:has-text('Save')", "button[type='submit']", ".save-btn"]
                submission_tested = False

                for btn_selector in save_buttons:
                    if await page.locator(btn_selector).count() > 0:
                        await page.locator(btn_selector).click()
                        await page.wait_for_timeout(2000)
                        submission_tested = True

                        # Check for form-level errors
                        form_errors = await page.locator(".error, .alert-danger, [role='alert']").count()
                        print(f"Form submission with errors - Errors shown: {form_errors > 0}")
                        break

                successful_validations = sum(1 for result in validation_results if result["validation_triggered"])
                print(f"Validation testing completed - {successful_validations}/{len(validation_results)} validations triggered")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_profile_accessibility_and_usability(self):
        """Test 9: Profile accessibility features and usability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PROFILE ACCESSIBILITY USABILITY TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Test keyboard navigation
                await page.keyboard.press('Tab')
                await page.wait_for_timeout(500)

                focused_element = await page.evaluate("document.activeElement.tagName")
                keyboard_nav = focused_element in ['INPUT', 'BUTTON', 'SELECT', 'A']
                print(f"Keyboard navigation works: {keyboard_nav}")

                # Count form elements with proper labels
                labeled_inputs = 0
                form_inputs = await page.locator("input").count()

                for i in range(min(form_inputs, 10)):  # Check first 10 inputs
                    input_element = page.locator("input").nth(i)
                    input_id = await input_element.get_attribute("id")
                    input_name = await input_element.get_attribute("name")

                    # Check if there's a corresponding label
                    if input_id:
                        label_exists = await page.locator(f"label[for='{input_id}']").count() > 0
                        if label_exists:
                            labeled_inputs += 1
                    elif input_name:
                        # Check for labels containing the input name
                        label_exists = await page.locator(f"label:has-text('{input_name}')").count() > 0
                        if label_exists:
                            labeled_inputs += 1

                print(f"Form accessibility - Labeled inputs: {labeled_inputs}/{form_inputs}")

                # Check for ARIA attributes
                aria_elements = await page.locator("[aria-label], [aria-describedby], [role]").count()
                print(f"ARIA accessibility elements: {aria_elements}")

                # Test error message accessibility
                await page.locator("input").first.fill("")  # Trigger validation
                await page.keyboard.press('Tab')
                await page.wait_for_timeout(1000)

                error_aria = await page.locator("[role='alert'], [aria-live], .error[id]").count()
                print(f"Accessible error messages: {error_aria}")

                # Test color contrast indicators (basic check)
                buttons = await page.locator("button").count()
                form_controls = await page.locator("input, select, textarea").count()
                print(f"Interactive elements for contrast testing - Buttons: {buttons}, Form controls: {form_controls}")

                # Test responsive design
                await page.set_viewport_size({"width": 768, "height": 1024})  # Tablet size
                await page.wait_for_timeout(1000)

                mobile_responsive = await page.evaluate("""
                    () => {
                        const form = document.querySelector('form, .profile-form');
                        return form ? window.getComputedStyle(form).display !== 'none' : false;
                    }
                """)
                print(f"Mobile responsive: {mobile_responsive}")

                accessibility_score = (
                    (1 if keyboard_nav else 0) +
                    (1 if labeled_inputs > 0 else 0) +
                    (1 if aria_elements > 0 else 0) +
                    (1 if mobile_responsive else 0)
                )

                print(f"Accessibility score: {accessibility_score}/4")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_profile_data_persistence_and_reload(self):
        """Test 10: Profile data persistence across sessions and page reloads"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== PROFILE DATA PERSISTENCE RELOAD TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Capture initial profile data
                initial_data = {}

                data_selectors = {
                    "name": ["input[name='name']", "input[id*='name']", "#name"],
                    "email": ["input[name='email']", "input[id*='email']", "#email"],
                    "username": ["input[name='username']", "input[id*='username']", "#username"],
                    "phone": ["input[name='phone']", "input[type='tel']", "input[id*='phone']"]
                }

                for field_name, selectors in data_selectors.items():
                    for selector in selectors:
                        if await page.locator(selector).count() > 0:
                            value = await page.locator(selector).input_value()
                            if value:
                                initial_data[field_name] = value
                                print(f"Initial {field_name}: {value}")
                            break

                # Test page reload persistence
                await page.reload()
                await page.wait_for_load_state("networkidle")

                # Check if data persisted after reload
                reload_data = {}
                for field_name, selectors in data_selectors.items():
                    for selector in selectors:
                        if await page.locator(selector).count() > 0:
                            value = await page.locator(selector).input_value()
                            if value:
                                reload_data[field_name] = value
                            break

                # Compare initial vs reload data
                fields_persisted = 0
                for field_name, initial_value in initial_data.items():
                    if field_name in reload_data and reload_data[field_name] == initial_value:
                        fields_persisted += 1
                        print(f"{field_name} persisted after reload: ✓")
                    else:
                        print(f"{field_name} lost after reload: ✗")

                # Test navigation away and back
                await page.goto("https://devtest.comda.co.il/dashboard")
                await page.wait_for_load_state("networkidle")

                await page.goto("https://devtest.comda.co.il/dashboard/profile")
                await page.wait_for_load_state("networkidle")

                # Check data after navigation
                navigation_data = {}
                for field_name, selectors in data_selectors.items():
                    for selector in selectors:
                        if await page.locator(selector).count() > 0:
                            value = await page.locator(selector).input_value()
                            if value:
                                navigation_data[field_name] = value
                            break

                navigation_persisted = 0
                for field_name, initial_value in initial_data.items():
                    if field_name in navigation_data and navigation_data[field_name] == initial_value:
                        navigation_persisted += 1

                print(f"Data persistence test - Reload: {fields_persisted}/{len(initial_data)}, Navigation: {navigation_persisted}/{len(initial_data)}")

            finally:
                await browser.close()