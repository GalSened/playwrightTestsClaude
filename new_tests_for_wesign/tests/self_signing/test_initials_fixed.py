"""
Initials Field Test - FIXED
Pattern: Add field -> Feather -> Type button -> Finish
"""
import pytest
from pathlib import Path
from playwright.async_api import async_playwright
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from pages.auth_page import AuthPage

test_pdf = Path(__file__).parent.parent.parent / "test_files" / "sample.pdf"

class TestInitialsFixed:
    @pytest.mark.asyncio
    async def test_initials_success(self):
        p = await async_playwright().__aenter__()
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--start-maximized'])
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()
        
        try:
            # Login
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            
            # Upload
            upload_button = page.locator('button:has-text("העלאת קובץ")').first
            async with page.expect_file_chooser() as fc_info:
                await upload_button.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(str(test_pdf.absolute()))
            await page.wait_for_timeout(2000)
            
            # Self-sign
            await page.locator('button:has-text("חתימה אישית")').first.click()
            await page.wait_for_timeout(2000)
            await page.locator('button:has-text("עריכת מסמך")').first.click()
            await page.wait_for_timeout(3000)
            assert "selfsignfields" in page.url
            
            # Add initials
            await page.locator('button:has-text("ראשי תיבות")').first.click()
            await page.wait_for_timeout(2000)
            
            # Open modal
            await page.locator('.ct-button--icon.button--field').first.click()
            await page.wait_for_timeout(2000)
            
            # Try to find saved initials first (like signature field pattern)
            # If no saved initials, create new ones by clicking Type button
            
            # Check if there are saved initials (canvas/img in modal)
            saved_initials = page.locator('sgn-sign-pad button canvas, sgn-sign-pad button img')
            count = await saved_initials.count()
            
            if count > 0:
                # Click first saved initial
                await saved_initials.first.click()
            else:
                # No saved initials - click Type button to create new
                # Type button is within the modal toolbar area, not visible text
                # Try clicking the second button in the modal's button group
                modal_buttons = page.locator('sgn-sign-pad > div > div > button')
                button_count = await modal_buttons.count()
                
                if button_count >= 2:
                    # Click second button (Type)
                    await modal_buttons.nth(1).click(force=True)
                else:
                    # Fallback: try any clickable button in modal
                    await page.locator('sgn-sign-pad button').first.click(force=True)
            
            await page.wait_for_timeout(2000)
            
            # Finish
            await page.locator('button:has-text("סיים")').first.click()
            await page.wait_for_timeout(3000)
            
            # Verify
            assert "success/selfsign" in page.url
            
        finally:
            await context.close()
            await browser.close()

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
