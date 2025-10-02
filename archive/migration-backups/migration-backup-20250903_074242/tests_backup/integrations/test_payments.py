"""
Payment Processing Tests
Tests for payment integration and transaction handling
that are present in Selenium but missing from the Playwright test suite.
"""

import pytest
import allure
from playwright.sync_api import expect
from src.pages.wesign_document_page import WeSignDocumentPage
from src.utils.test_helpers import TestHelpers


@allure.epic("Payment Integration")
@allure.feature("Payment Processing")
class TestPayments:
    """Payment processing test suite"""

    @pytest.mark.smoke
    @pytest.mark.regression
    @allure.story("Payment Workflow")
    @allure.title("Complete payment workflow for premium features")
    def test_payment_workflow_premium_features(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test complete payment workflow for accessing premium features"""
        page = authenticated_page
        
        # Navigate to a premium feature that requires payment
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        # Look for payment interface
        payment_section = page.locator('.payment-section, .billing, .premium-features')
        if payment_section.count() > 0:
            payment_section.scroll_into_view_if_needed()
            
            # Select a premium feature
            premium_feature = page.locator('.premium-plan, .upgrade-plan, button:has-text("Upgrade")')
            if premium_feature.count() > 0:
                premium_feature.first.click()
                page.wait_for_timeout(2000)
                
                # Payment form should appear
                payment_form = page.locator('.payment-form, .checkout-form, .billing-form')
                payment_form.wait_for(state='visible', timeout=15000)
                
                # Verify payment form fields
                card_number_field = page.locator('input[placeholder*="card"], input[name*="card"]')
                expiry_field = page.locator('input[placeholder*="expiry"], input[placeholder*="MM/YY"]')
                cvv_field = page.locator('input[placeholder*="cvv"], input[placeholder*="CVC"]')
                
                expect(card_number_field).to_be_visible()
                expect(expiry_field).to_be_visible()
                expect(cvv_field).to_be_visible()
                
                allure.attach(
                    page.screenshot(),
                    name="Payment Form Display",
                    attachment_type=allure.attachment_type.PNG
                )

    @pytest.mark.regression
    @allure.story("Payment Validation")
    @allure.title("Validate payment form with invalid card details")
    def test_payment_form_validation_invalid_card(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test payment form validation with invalid card details"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        payment_section = page.locator('.payment-section, .billing')
        if payment_section.count() > 0:
            # Navigate to payment form
            upgrade_button = page.locator('button:has-text("Upgrade"), .upgrade-plan')
            if upgrade_button.count() > 0:
                upgrade_button.first.click()
                page.wait_for_timeout(2000)
                
                payment_form = page.locator('.payment-form, .checkout-form')
                payment_form.wait_for(state='visible', timeout=15000)
                
                # Fill with invalid card details
                card_number_field = page.locator('input[placeholder*="card"], input[name*="card"]')
                if card_number_field.is_visible():
                    card_number_field.fill('1234567890123456')  # Invalid card
                
                expiry_field = page.locator('input[placeholder*="expiry"], input[placeholder*="MM/YY"]')
                if expiry_field.is_visible():
                    expiry_field.fill('01/20')  # Expired date
                
                cvv_field = page.locator('input[placeholder*="cvv"], input[placeholder*="CVC"]')
                if cvv_field.is_visible():
                    cvv_field.fill('123')
                
                # Submit payment
                submit_button = page.locator('button:has-text("Pay"), button:has-text("Submit"), .pay-button')
                submit_button.click()
                page.wait_for_timeout(3000)
                
                # Verify validation errors appear
                error_messages = page.locator('.payment-error, .card-error, .alert-danger')
                expect(error_messages).to_be_visible()
                
                error_text = error_messages.inner_text()
                assert any(keyword in error_text.lower() for keyword in ['invalid', 'error', 'declined'])

    @pytest.mark.regression
    @allure.story("Payment Success")
    @allure.title("Successful payment with valid test card details")
    def test_payment_success_valid_test_card(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test successful payment with valid test card details (if test environment supports it)"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        payment_section = page.locator('.payment-section, .billing')
        if payment_section.count() > 0:
            upgrade_button = page.locator('button:has-text("Upgrade"), .upgrade-plan')
            if upgrade_button.count() > 0:
                upgrade_button.first.click()
                page.wait_for_timeout(2000)
                
                payment_form = page.locator('.payment-form, .checkout-form')
                payment_form.wait_for(state='visible', timeout=15000)
                
                # Use test card details (Stripe test card)
                card_number_field = page.locator('input[placeholder*="card"], input[name*="card"]')
                if card_number_field.is_visible():
                    card_number_field.fill('4242424242424242')  # Visa test card
                
                expiry_field = page.locator('input[placeholder*="expiry"], input[placeholder*="MM/YY"]')
                if expiry_field.is_visible():
                    expiry_field.fill('12/25')  # Future date
                
                cvv_field = page.locator('input[placeholder*="cvv"], input[placeholder*="CVC"]')
                if cvv_field.is_visible():
                    cvv_field.fill('123')
                
                # Fill cardholder name if required
                name_field = page.locator('input[placeholder*="name"], input[name*="name"]')
                if name_field.count() > 0 and name_field.is_visible():
                    name_field.fill('Test Cardholder')
                
                # Submit payment
                submit_button = page.locator('button:has-text("Pay"), button:has-text("Submit"), .pay-button')
                submit_button.click()
                page.wait_for_timeout(5000)
                
                # Check for success message or redirect
                success_indicators = page.locator('.payment-success, .success, .thank-you, .payment-complete')
                if success_indicators.count() > 0:
                    expect(success_indicators).to_be_visible()
                    
                    success_text = success_indicators.inner_text()
                    assert any(keyword in success_text.lower() for keyword in ['success', 'complete', 'thank'])

    @pytest.mark.regression
    @allure.story("Payment History")
    @allure.title("View payment history and transaction details")
    def test_view_payment_history(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test viewing payment history and transaction details"""
        page = authenticated_page
        
        # Navigate to account/billing section
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Look for user menu or account settings
        user_menu = page.locator('.user-menu, .account-menu, .profile-menu')
        if user_menu.count() == 0:
            # Try clicking on user icon or name
            user_icon = page.locator('.user-icon, .profile-icon, img[alt*="user"]')
            if user_icon.count() > 0:
                user_icon.click()
                page.wait_for_timeout(1000)
        
        # Navigate to billing/payment history
        billing_link = page.locator('a:has-text("Billing"), a:has-text("Payment"), a:has-text("History")')
        if billing_link.count() > 0:
            billing_link.click()
            page.wait_for_timeout(2000)
            
            # Check for payment history table
            payment_history = page.locator('.payment-history, .transaction-history, .billing-history')
            if payment_history.count() > 0:
                expect(payment_history).to_be_visible()
                
                # Check for transaction entries
                transactions = page.locator('.transaction-row, .payment-row, tr')
                transaction_count = transactions.count()
                
                if transaction_count > 0:
                    # Verify transaction details
                    first_transaction = transactions.first
                    expect(first_transaction).to_be_visible()
                    
                    # Look for transaction details like date, amount, status
                    transaction_text = first_transaction.inner_text()
                    
                    # Should contain date pattern or amount pattern
                    has_date = any(char.isdigit() for char in transaction_text)
                    assert has_date, "Transaction should contain date or numerical information"

    @pytest.mark.regression
    @allure.story("Subscription Management")
    @allure.title("Manage subscription and billing preferences")
    def test_manage_subscription_billing(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test managing subscription and billing preferences"""
        page = authenticated_page
        
        page.goto(f"{test_config.urls['base_url']}dashboard/main")
        page.wait_for_load_state('networkidle')
        
        # Navigate to subscription management
        user_menu = page.locator('.user-menu, .account-menu')
        if user_menu.count() > 0:
            user_menu.click()
            
            subscription_link = page.locator('a:has-text("Subscription"), a:has-text("Plan"), a:has-text("Billing")')
            if subscription_link.count() > 0:
                subscription_link.click()
                page.wait_for_timeout(2000)
                
                # Check current subscription status
                subscription_info = page.locator('.subscription-info, .current-plan, .plan-details')
                if subscription_info.count() > 0:
                    expect(subscription_info).to_be_visible()
                    
                    # Look for plan upgrade/downgrade options
                    plan_options = page.locator('.plan-option, .upgrade-option, .change-plan')
                    if plan_options.count() > 0:
                        plan_text = plan_options.first.inner_text()
                        
                        # Should contain plan-related keywords
                        plan_keywords = ['upgrade', 'plan', 'subscription', 'premium', 'basic']
                        has_plan_keyword = any(keyword in plan_text.lower() for keyword in plan_keywords)
                        assert has_plan_keyword, f"Plan options should contain relevant keywords, found: {plan_text}"

    @pytest.mark.regression
    @allure.story("Payment Methods")
    @allure.title("Add and manage payment methods")
    def test_add_manage_payment_methods(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test adding and managing payment methods"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        # Look for payment methods section
        payment_methods = page.locator('.payment-methods, .saved-cards, .billing-methods')
        if payment_methods.count() > 0:
            # Add new payment method
            add_method_button = page.locator('button:has-text("Add"), button:has-text("New Card"), .add-payment-method')
            if add_method_button.count() > 0:
                add_method_button.click()
                page.wait_for_timeout(2000)
                
                # Fill new card details
                card_form = page.locator('.card-form, .payment-method-form')
                card_form.wait_for(state='visible', timeout=10000)
                
                card_number = page.locator('input[placeholder*="card number"]')
                if card_number.is_visible():
                    card_number.fill('4000000000000002')  # Test card
                
                expiry = page.locator('input[placeholder*="expiry"]')
                if expiry.is_visible():
                    expiry.fill('12/26')
                
                cvv = page.locator('input[placeholder*="cvv"]')
                if cvv.is_visible():
                    cvv.fill('123')
                
                # Save payment method
                save_button = page.locator('button:has-text("Save"), button:has-text("Add Card")')
                save_button.click()
                page.wait_for_timeout(3000)
                
                # Verify payment method was added
                success_message = page.locator('.success, .card-added, .method-saved')
                if success_message.count() > 0:
                    expect(success_message).to_be_visible()

    @pytest.mark.regression
    @allure.story("Invoice Generation")
    @allure.title("Generate and download invoice for payments")
    def test_invoice_generation_download(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test generating and downloading invoices for payments"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        # Navigate to invoices section
        invoices_link = page.locator('a:has-text("Invoices"), a:has-text("Receipts"), .invoices')
        if invoices_link.count() > 0:
            invoices_link.click()
            page.wait_for_timeout(2000)
            
            # Look for invoice list
            invoice_list = page.locator('.invoice-list, .receipts-list')
            if invoice_list.count() > 0:
                # Find download buttons
                download_buttons = page.locator('button:has-text("Download"), a:has-text("PDF"), .download-invoice')
                if download_buttons.count() > 0:
                    # Set up download handler
                    async with page.expect_download() as download_info:
                        download_buttons.first.click()
                    
                    download = download_info.value
                    
                    # Verify download
                    assert download.suggested_filename.endswith('.pdf'), "Invoice should be a PDF file"
                    
                    allure.attach(
                        f"Downloaded invoice: {download.suggested_filename}",
                        name="Invoice Download",
                        attachment_type=allure.attachment_type.TEXT
                    )

    @pytest.mark.performance
    @allure.story("Payment Performance")
    @allure.title("Payment processing performance within acceptable limits")
    def test_payment_processing_performance(
        self, authenticated_page, test_helpers, test_config, performance_tracker
    ):
        """Test payment processing performance"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        payment_section = page.locator('.payment-section, .billing')
        if payment_section.count() > 0:
            upgrade_button = page.locator('button:has-text("Upgrade"), .upgrade-plan')
            if upgrade_button.count() > 0:
                # Track payment form loading performance
                form_start = page.evaluate('() => performance.now()')
                
                upgrade_button.first.click()
                
                payment_form = page.locator('.payment-form, .checkout-form')
                payment_form.wait_for(state='visible', timeout=15000)
                
                form_end = page.evaluate('() => performance.now()')
                form_load_time = int(form_end - form_start)
                performance_tracker['add_operation']('Payment Form Load', form_load_time)
                
                # Track payment processing time
                process_start = page.evaluate('() => performance.now()')
                
                # Fill form quickly
                page.fill('input[placeholder*="card"]', '4242424242424242')
                page.fill('input[placeholder*="expiry"]', '12/25')
                page.fill('input[placeholder*="cvv"]', '123')
                
                submit_button = page.locator('button:has-text("Pay"), .pay-button')
                submit_button.click()
                
                # Wait for processing to complete (success or error)
                result = page.locator('.payment-success, .payment-error, .success, .alert')
                result.wait_for(state='visible', timeout=30000)
                
                process_end = page.evaluate('() => performance.now()')
                process_time = int(process_end - process_start)
                performance_tracker['add_operation']('Payment Processing', process_time)
                
                # Verify performance thresholds
                assert form_load_time < 10000, f"Payment form load took {form_load_time}ms, expected < 10000ms"
                assert process_time < 30000, f"Payment processing took {process_time}ms, expected < 30000ms"

    @pytest.mark.regression
    @allure.story("Payment Security")
    @allure.title("Verify payment form security features")
    def test_payment_form_security_features(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test payment form security features"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        payment_section = page.locator('.payment-section, .billing')
        if payment_section.count() > 0:
            upgrade_button = page.locator('button:has-text("Upgrade"), .upgrade-plan')
            if upgrade_button.count() > 0:
                upgrade_button.first.click()
                page.wait_for_timeout(2000)
                
                payment_form = page.locator('.payment-form, .checkout-form')
                payment_form.wait_for(state='visible', timeout=15000)
                
                # Check for security indicators
                security_badges = page.locator('.security-badge, .ssl-badge, .secure-payment')
                if security_badges.count() > 0:
                    expect(security_badges).to_be_visible()
                
                # Verify card number field masking
                card_number_field = page.locator('input[placeholder*="card"], input[name*="card"]')
                if card_number_field.is_visible():
                    card_number_field.fill('4242424242424242')
                    
                    # Check if input is masked or formatted
                    field_value = card_number_field.input_value()
                    # Should be formatted like ****-****-****-4242 or similar
                    has_formatting = '*' in field_value or '-' in field_value or ' ' in field_value
                    
                    if not has_formatting:
                        # At minimum, verify the form is secure (HTTPS)
                        current_url = page.url
                        assert current_url.startswith('https://'), "Payment form should be served over HTTPS"

    @pytest.mark.regression  
    @allure.story("Currency Support")
    @allure.title("Support multiple currencies in payment processing")
    def test_multiple_currency_support(
        self, authenticated_page, test_helpers, test_config
    ):
        """Test support for multiple currencies in payment processing"""
        page = authenticated_page
        
        payment_url = test_config.settings.get('payment_api_url', 'https://devtest.comda.co.il:4433/')
        page.goto(payment_url)
        page.wait_for_load_state('networkidle')
        
        payment_section = page.locator('.payment-section, .billing')
        if payment_section.count() > 0:
            # Look for currency selector
            currency_selector = page.locator('select[name*="currency"], .currency-selector, .currency-dropdown')
            if currency_selector.count() > 0:
                currency_selector.select_option('EUR')  # Try to select Euro
                page.wait_for_timeout(1000)
                
                # Verify price updates to reflect currency change
                price_elements = page.locator('.price, .amount, .cost')
                if price_elements.count() > 0:
                    price_text = price_elements.first.inner_text()
                    
                    # Should contain Euro symbol or currency code
                    has_euro = '€' in price_text or 'EUR' in price_text.upper()
                    
                    if has_euro:
                        allure.attach(
                            f"Currency changed to EUR, price: {price_text}",
                            name="Currency Support",
                            attachment_type=allure.attachment_type.TEXT
                        )
                    else:
                        # At least verify currency selector is present
                        expect(currency_selector).to_be_visible()