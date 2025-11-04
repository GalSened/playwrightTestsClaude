"""
Debug pagination - Check what the extra row is
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
            slow_mo=500
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        try:
            # Login and navigate
            auth_page = AuthPage(page)
            await auth_page.navigate()
            await auth_page.login_with_company_user()
            await page.wait_for_timeout(3000)

            documents_page = DocumentsPage(page)
            await documents_page.navigate_to_documents()
            await page.wait_for_timeout(2000)

            # Set page size to 25
            page_size_combo = page.get_by_role('combobox').nth(2)
            await page_size_combo.select_option("25")
            await page.wait_for_timeout(2000)

            # Count and examine rows
            rows = page.locator('table tbody tr')
            count = await rows.count()
            print(f"\n=== Total rows in tbody: {count} ===\n")

            # Check first few rows
            for i in range(min(3, count)):
                row = rows.nth(i)
                cells = row.locator('td')
                cell_count = await cells.count()

                print(f"Row {i}:")
                print(f"  Cell count: {cell_count}")

                # Try to get text from first few cells
                for j in range(min(3, cell_count)):
                    cell_text = await cells.nth(j).inner_text()
                    print(f"  Cell {j}: '{cell_text[:50]}'")
                print()

            # Check last row
            print(f"\nLast row (index {count-1}):")
            last_row = rows.nth(count - 1)
            last_cells = last_row.locator('td')
            last_cell_count = await last_cells.count()
            print(f"  Cell count: {last_cell_count}")

            for j in range(min(3, last_cell_count)):
                cell_text = await last_cells.nth(j).inner_text()
                print(f"  Cell {j}: '{cell_text[:50]}'")

            await page.wait_for_timeout(5000)

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
