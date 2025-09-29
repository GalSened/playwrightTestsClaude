"""Direct authentication test without complex fixtures"""

import pytest
from playwright.async_api import async_playwright


@pytest.mark.asyncio
async def test_direct_authentication():
    """Test direct authentication to WeSign"""
    async with async_playwright() as p:
        try:
            print("Launching browser...")
            browser = await p.chromium.launch(
                headless=True,
                timeout=15000,
                args=['--no-sandbox', '--disable-dev-shm-usage']
            )

            print("Creating page...")
            context = await browser.new_context()
            page = await context.new_page()

            print("Navigating to WeSign...")
            await page.goto("https://devtest.comda.co.il/", timeout=15000)

            print("Getting page title...")
            title = await page.title()
            print(f"Page title: {title}")

            # Look for login form elements
            print("Looking for login elements...")
            email_field = page.locator('input[type="email"], input[name="email"]').first
            password_field = page.locator('input[type="password"], input[name="password"]').first

            email_count = await email_field.count()
            password_count = await password_field.count()

            print(f"Email fields found: {email_count}")
            print(f"Password fields found: {password_count}")

            if email_count > 0 and password_count > 0:
                print("Login form detected - attempting login...")

                await email_field.fill("nirk@comsign.co.il")
                await password_field.fill("Comsign1!")

                # Find and click login button
                login_button = page.locator('input[type="submit"], button[type="submit"]').first
                if await login_button.count() > 0:
                    await login_button.click()

                    # Wait for navigation
                    await page.wait_for_timeout(3000)

                    final_url = page.url
                    print(f"Final URL: {final_url}")

                    if "dashboard" in final_url.lower():
                        print("SUCCESS: LOGIN SUCCESSFUL! Reached dashboard")
                    else:
                        print(f"Login completed, current page: {final_url}")
                else:
                    print("ERROR: No login button found")
            else:
                print("ERROR: Login form not found")

            await browser.close()
            print("Test completed successfully")

        except Exception as e:
            print(f"Test failed: {e}")
            raise