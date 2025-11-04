"""
Debug pagination step by step
Let's explore the page structure manually
"""
import asyncio
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--start-maximized'],
            slow_mo=1000
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            print("\n=== STEP 1: Login ===")
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await page.wait_for_timeout(3000)
            print("✅ Logged in")

            print("\n=== STEP 2: Navigate to Documents ===")
            documents_page = DocumentsPage(page)
            await documents_page.navigate_to_documents()
            await page.wait_for_timeout(2000)
            print(f"✅ On page: {page.url}")

            print("\n=== STEP 3: Count current documents in table ===")
            rows = page.locator('table tbody tr')
            initial_count = await rows.count()
            print(f"Current document rows: {initial_count}")

            print("\n=== STEP 4: Find all comboboxes on page ===")
            comboboxes = page.get_by_role('combobox')
            combo_count = await comboboxes.count()
            print(f"Total comboboxes found: {combo_count}")

            for i in range(combo_count):
                combo = comboboxes.nth(i)
                is_visible = await combo.is_visible()
                print(f"  Combobox {i}: visible={is_visible}")
                if is_visible:
                    # Try to get current value
                    try:
                        value = await combo.input_value()
                        print(f"    Current value: {value}")
                    except:
                        print(f"    (Could not get value)")

            print("\n=== STEP 5: Try to interact with combobox.nth(2) ===")
            page_size_combo = page.get_by_role('combobox').nth(2)
            is_visible = await page_size_combo.is_visible()
            print(f"Combobox.nth(2) visible: {is_visible}")

            if is_visible:
                print("Trying to select option '25'...")
                await page_size_combo.select_option("25")
                await page.wait_for_timeout(2000)

                print("\n=== STEP 6: Check if page updated ===")
                new_count = await rows.count()
                print(f"Document rows after change: {new_count}")
                print(f"Expected: <= 25, Got: {new_count}")

            print("\n=== Pausing - Check the browser ===")
            input("Press Enter to close browser...")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
