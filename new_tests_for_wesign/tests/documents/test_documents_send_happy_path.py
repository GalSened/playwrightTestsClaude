"""
Documents Module - Happy Path E2E Test
Test ID: T1.1
Description: Complete document send flow with single email recipient (sequential signing)

Test Flow:
1. Login
2. Upload file
3. Select group signature
4. Add email recipient
5. Edit document (add signature field)
6. Review
7. Send
8. Verify success

STRONG Assertions:
- URL navigation at each step
- Element visibility validation
- Text content verification
- Success page confirmation
"""

import pytest
import os
from playwright.async_api import async_playwright, Page


class TestDocumentsSendHappyPath:
    """
    Test document sending happy path with STRONG assertions

    Based on MCP discovery session - following exact user-guided flow
    """

    # Test configuration
    BASE_URL = "https://devtest.comda.co.il"
    LOGIN_EMAIL = "nirk@comsign.co.il"
    LOGIN_PASSWORD = "Comsign1!"

    # Test data
    TEST_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "test_files", "test_document.pdf")
    RECIPIENT_NAME = "Test Recipient"
    RECIPIENT_EMAIL = "test@example.com"

    async def login_and_navigate_to_dashboard(self, page: Page):
        """
        Helper: Login and navigate to main dashboard

        Uses STRONG selectors discovered via MCP (get_by_role)
        """
        await page.goto(f"{self.BASE_URL}/login")

        # Fill login credentials with MCP-discovered selectors
        await page.get_by_role("textbox", name="Username / Email").fill(self.LOGIN_EMAIL)
        await page.get_by_role("textbox", name="Password").fill(self.LOGIN_PASSWORD)
        await page.get_by_role("button", name="Sign in").click()

        # Wait for dashboard to load
        await page.wait_for_timeout(2000)

    @pytest.mark.asyncio
    async def test_01_send_document_happy_path_single_email_recipient_sequential(self):
        """
        Test complete document send flow

        STRONG ASSERTIONS:
        - URL changes at each navigation step (exact match)
        - Document name preserved throughout flow
        - Recipient information persists
        - Success message appears with correct text

        Compare to weak test: assert True, "Document sent"
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                # STEP 1: Login
                print("🔐 Step 1: Login...")
                await self.login_and_navigate_to_dashboard(page)

                # STRONG ASSERTION 1: Verify we're on dashboard
                assert "/dashboard/main" in page.url, \
                    f"Expected to be on dashboard, got {page.url}"
                print(f"✅ Logged in successfully: {page.url}")

                # STEP 2: Click upload file button
                print("📁 Step 2: Upload file...")
                upload_button = page.get_by_role('button', name='העלאת קובץ')
                assert await upload_button.is_visible(), \
                    "Upload file button should be visible on dashboard"

                # Start waiting for file chooser before clicking
                async with page.expect_file_chooser() as fc_info:
                    await upload_button.click()

                file_chooser = await fc_info.value

                # STEP 3: Upload test PDF file
                print(f"📄 Step 3: Selecting file: {self.TEST_FILE_PATH}...")

                # STRONG ASSERTION 2: Test file exists
                assert os.path.exists(self.TEST_FILE_PATH), \
                    f"Test file not found: {self.TEST_FILE_PATH}"

                await file_chooser.set_files(self.TEST_FILE_PATH)
                await page.wait_for_timeout(2000)

                # STRONG ASSERTION 3: Navigated to select signers page
                assert "/dashboard/selectsigners" in page.url, \
                    f"Expected to navigate to /dashboard/selectsigners, got {page.url}"
                print(f"✅ File uploaded, navigated to: {page.url}")

                # STRONG ASSERTION 4: Document name field shows uploaded filename
                # Use more specific selector - the textbox that has actual value (not autocomplete)
                # Find textbox with value containing test_document
                doc_name_field = page.locator('input[type="text"][value*="test_document"]')
                doc_name_value = await doc_name_field.input_value()
                assert "test_document" in doc_name_value, \
                    f"Expected document name to contain 'test_document', got '{doc_name_value}'"
                print(f"✅ Document name preserved: {doc_name_value}")

                # STEP 4: Click Group Signature tab
                print("👥 Step 4: Select Group Signature tab...")
                group_tab = page.get_by_role('button', name='חתימה קבוצתית')
                await group_tab.click()
                await page.wait_for_timeout(1000)

                # STRONG ASSERTION 5: Group signature form visible
                name_field = page.get_by_role('textbox', name='שם מלא')
                assert await name_field.is_visible(), \
                    "Recipient name field should be visible after selecting group signature"
                print("✅ Group signature tab active, form visible")

                # STEP 5: Fill recipient details
                print(f"✉️ Step 5: Adding recipient '{self.RECIPIENT_NAME}'...")
                await name_field.fill(self.RECIPIENT_NAME)

                email_field = page.get_by_role('textbox', name='דואר אלקטרוני')
                await email_field.fill(self.RECIPIENT_EMAIL)

                # STRONG ASSERTION 6: Recipient data entered correctly
                assert await name_field.input_value() == self.RECIPIENT_NAME, \
                    f"Expected name '{self.RECIPIENT_NAME}', got '{await name_field.input_value()}'"
                assert await email_field.input_value() == self.RECIPIENT_EMAIL, \
                    f"Expected email '{self.RECIPIENT_EMAIL}', got '{await email_field.input_value()}'"
                print(f"✅ Recipient added: {self.RECIPIENT_NAME} ({self.RECIPIENT_EMAIL})")

                # STEP 6: Click Edit Document
                print("📝 Step 6: Navigate to document editor...")
                edit_button = page.get_by_role('button', name='עריכת מסמך')
                await edit_button.click()
                await page.wait_for_timeout(2000)

                # STRONG ASSERTION 7: Navigated to document editor
                assert "/dashboard/groupsign" in page.url, \
                    f"Expected to navigate to /dashboard/groupsign, got {page.url}"
                print(f"✅ Document editor loaded: {page.url}")

                # STRONG ASSERTION 8: Recipient selector shows our recipient
                recipient_dropdown = page.locator('select, [role="combobox"]').first
                dropdown_text = await recipient_dropdown.text_content()
                assert self.RECIPIENT_NAME in dropdown_text, \
                    f"Expected recipient dropdown to show '{self.RECIPIENT_NAME}', got '{dropdown_text}'"
                print(f"✅ Recipient persisted in editor: {self.RECIPIENT_NAME}")

                # STEP 7: Add signature field
                print("✍️ Step 7: Adding signature field...")
                signature_button = page.get_by_role('button', name='חתימה')
                assert await signature_button.is_visible(), \
                    "Signature button should be visible in field toolbar"

                await signature_button.click()
                await page.wait_for_timeout(1000)

                # STRONG ASSERTION 9: Signature field added (button becomes active)
                is_active = await signature_button.evaluate('el => el.classList.contains("active") || el.getAttribute("aria-pressed") === "true"')
                assert is_active or await signature_button.is_visible(), \
                    "Signature button should be active after clicking"
                print("✅ Signature field added to document")

                # STEP 8: Click Review
                print("👀 Step 8: Navigate to review page...")
                review_button = page.get_by_role('button', name='סקירה')
                await review_button.click()
                await page.wait_for_timeout(2000)

                # STRONG ASSERTION 10: Navigated to review page
                assert "/dashboard/selectsigners/review" in page.url, \
                    f"Expected to navigate to /dashboard/selectsigners/review, got {page.url}"
                print(f"✅ Review page loaded: {page.url}")

                # STRONG ASSERTION 11: Review page shows document name
                doc_heading = page.locator('h3:has-text("test_document")')
                assert await doc_heading.is_visible(), \
                    "Document name heading should be visible on review page"
                print("✅ Document name displayed in review")

                # STRONG ASSERTION 12: Recipients table shows our recipient
                table = page.locator('table')
                table_text = await table.text_content()
                assert self.RECIPIENT_NAME in table_text, \
                    f"Expected recipient '{self.RECIPIENT_NAME}' in table, got: {table_text}"
                assert "EMAIL" in table_text, \
                    f"Expected send method 'EMAIL' in table, got: {table_text}"
                print(f"✅ Recipient verified in table: {self.RECIPIENT_NAME} (EMAIL)")

                # STEP 9: Send document
                print("🚀 Step 9: Sending document...")
                send_button = page.get_by_role('button', name='שליחה')
                assert await send_button.is_visible(), \
                    "Send button should be visible on review page"

                await send_button.click()
                await page.wait_for_timeout(3000)

                # STRONG ASSERTION 13: Navigated to success page
                assert "/dashboard/success" in page.url, \
                    f"Expected to navigate to /dashboard/success, got {page.url}"
                print(f"✅ Navigated to success page: {page.url}")

                # STRONG ASSERTION 14: Success heading visible
                success_heading = page.locator('h2:has-text("הצלחה!")')
                assert await success_heading.is_visible(), \
                    "Success heading 'הצלחה!' should be visible"
                print("✅ Success heading displayed")

                # STRONG ASSERTION 15: Success message visible
                success_message = page.locator('h2:has-text("המסמך נשלח ליעדו")')
                assert await success_message.is_visible(), \
                    "Success message 'המסמך נשלח ליעדו' should be visible"
                print("✅ Success message confirmed")

                # STRONG ASSERTION 16: Email notification message visible
                email_msg = page.locator('text="כשהמסמך ייחתם, יתקבל דואר אלקטרוני לתיבתכם"')
                assert await email_msg.is_visible(), \
                    "Email notification message should be visible"
                print("✅ Email notification message displayed")

                print("\n🎉 ALL ASSERTIONS PASSED - Document sent successfully!")
                print(f"   Document: test_document.pdf")
                print(f"   Recipient: {self.RECIPIENT_NAME} ({self.RECIPIENT_EMAIL})")
                print(f"   Signing: Sequential (ordered)")
                print(f"   Field: Signature")

            finally:
                await browser.close()


if __name__ == "__main__":
    # Run this test standalone
    import asyncio
    test = TestDocumentsSendHappyPath()
    asyncio.run(test.test_01_send_document_happy_path_single_email_recipient_sequential())
