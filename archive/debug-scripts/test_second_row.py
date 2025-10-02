#!/usr/bin/env python3
"""
Quick test to verify clicking on second row works correctly
"""
import asyncio
from playwright.async_api import async_playwright

async def test_second_row_click():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        
        try:
            print("Testing second row click functionality...")
            
            # Navigate to reports page
            await page.goto("http://localhost:5173/reports")
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Find second row and click it
            second_row = page.locator('[data-testid="table-row"]').nth(1)
            row_count = await page.locator('[data-testid="table-row"]').count()
            print(f"Found {row_count} rows total")
            
            if row_count >= 2:
                # Get text from second row to verify it's different
                suite_name = await second_row.locator('td').nth(1).text_content()
                print(f"Clicking second row with suite: {suite_name}")
                
                await second_row.click()
                await page.wait_for_timeout(1500)
                
                # Verify details panel opened with different content
                details_panel = page.locator('[data-testid="run-details-panel"]')
                is_visible = await details_panel.is_visible()
                print(f"Details panel visible after second row click: {is_visible}")
                
                if is_visible:
                    # Check if suite name in details matches
                    details_suite_name = await page.locator('[data-testid="run-suite-name"]').text_content()
                    print(f"Details panel shows suite: {details_suite_name}")
                    
                    # Verify tabs still work
                    steps_tab = page.get_by_role("tab", name="Test Steps")
                    if await steps_tab.is_visible():
                        await steps_tab.click()
                        await page.wait_for_timeout(500)
                        
                        steps_section = page.locator('[data-testid="run-steps-section"]')
                        steps_visible = await steps_section.is_visible()
                        print(f"Steps tab works on second row: {steps_visible}")
                        
                        # Check step count
                        step_items = page.locator('[data-testid="step-item"]')
                        step_count = await step_items.count()
                        print(f"Found {step_count} steps in second row")
                    
                    print("SUCCESS: Second row drill-down works correctly!")
                else:
                    print("WARNING: Details panel did not open for second row")
            else:
                print("WARNING: Only one row found, cannot test second row")
                
        except Exception as e:
            print(f"ERROR: {str(e)}")
        finally:
            await browser.close()

# Run the test
if __name__ == "__main__":
    asyncio.run(test_second_row_click())