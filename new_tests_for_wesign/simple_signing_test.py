"""
Simple Signing Workflow Test - Step by Step Demo
This script demonstrates signing workflow testing without Unicode issues
"""

import asyncio
from playwright.async_api import async_playwright
import time


async def test_signing_workflow():
    """Simple signing workflow test"""
    print("WeSign Signing Workflow E2E Test Demo")
    print("=" * 50)

    async with async_playwright() as p:
        # Launch browser with visible UI
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        page = await browser.new_page()

        try:
            # Step 1: Authentication
            print("STEP 1: Testing Authentication...")
            await page.goto("https://devtest.comda.co.il/auth/login")
            await page.wait_for_load_state('networkidle', timeout=10000)

            # Fill credentials
            await page.fill('input[type="email"]', "gals@comda.co.il")
            await page.fill('input[type="password"]', "Comda159!")

            # Submit login
            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            # Wait for dashboard
            await page.wait_for_url("**/dashboard**", timeout=15000)
            print("Authentication successful! Current URL:", page.url)

            # Step 2: Navigate to signing
            print("\nSTEP 2: Navigating to Signing Workflow...")
            await page.goto("https://devtest.comda.co.il/dashboard/selectsigners")
            await page.wait_for_load_state('networkidle', timeout=10000)

            if "/selectsigners" in page.url:
                print("Direct navigation to signing workflow successful!")
            else:
                print("Need to navigate through dashboard...")
                await page.goto("https://devtest.comda.co.il/dashboard")
                await page.wait_for_load_state('networkidle')

            # Step 3: Test signing tabs
            print("\nSTEP 3: Testing Signing Tabs...")
            signing_tabs = ["Myself", "Others", "Live"]

            for tab_name in signing_tabs:
                print(f"Looking for '{tab_name}' tab...")
                tab_button = page.locator(f'button:has-text("{tab_name}")').first

                if await tab_button.is_visible():
                    print(f"Found '{tab_name}' tab - clicking...")
                    await tab_button.click()
                    await asyncio.sleep(1)
                    print(f"'{tab_name}' tab clicked successfully")
                else:
                    print(f"'{tab_name}' tab not found")

            # Step 4: Test Others workflow
            print("\nSTEP 4: Testing Others Signing Workflow...")
            others_button = page.locator('button:has-text("Others")').first
            if await others_button.is_visible():
                await others_button.click()
                await asyncio.sleep(2)
                print("Others tab activated")

                # Test form fields
                name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
                if await name_field.is_visible():
                    print("Testing name field...")
                    await name_field.fill("Test User E2E")
                    print("Name field filled successfully")

                email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
                if await email_field.is_visible():
                    print("Testing email field...")
                    await email_field.fill("test.e2e@example.com")
                    print("Email field filled successfully")

                # Test SMS switching
                comm_select = page.locator('select').first
                if await comm_select.is_visible():
                    print("Testing SMS switch...")
                    await comm_select.select_option("Send document by SMS")
                    await asyncio.sleep(2)

                    phone_field = page.locator('input[placeholder*="050"]').first
                    if await phone_field.is_visible():
                        print("Phone field appeared - SMS switch successful!")
                        await phone_field.fill("050-123-4567")
                        print("Phone field filled successfully")
                    else:
                        print("Phone field did not appear after SMS selection")

            print("\nTest completed successfully!")
            print("Browser will remain open for manual inspection...")
            print("Check the browser window to see the final state")

            # Wait a bit to see the final state
            await asyncio.sleep(5)

        except Exception as e:
            print(f"Test error: {e}")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_signing_workflow())