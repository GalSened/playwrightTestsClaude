#!/usr/bin/env python3
"""
Debug Test Bank EPU Tests - Simple version to identify issues
"""

import asyncio
import traceback
from playwright.async_api import async_playwright, Page, expect

async def debug_test(page: Page):
    try:
        await page.goto("http://localhost:5173/test-bank")
        await page.wait_for_load_state('networkidle', timeout=10000)
        
        print("SUCCESS: Page loaded successfully")
        
        # Test basic elements
        try:
            clear_filters = page.locator('[data-testid="clear-filters"]')
            is_visible = await clear_filters.is_visible()
            print(f"SUCCESS: clear_filters visible: {is_visible}")
        except Exception as e:
            print(f"ERROR: clear_filters error: {e}")
        
        # Test count operations
        try:
            test_checkboxes = page.locator('[data-testid="test-checkbox"]')
            checkbox_count = await test_checkboxes.count()
            print(f"SUCCESS: checkbox count: {checkbox_count}")
        except Exception as e:
            print(f"ERROR: checkbox count error: {e}")
            
        # Test text content
        try:
            selected_count = page.locator('[data-testid="selected-tests-count"]')
            count_text = await selected_count.text_content()
            print(f"SUCCESS: selected count text: {count_text}")
        except Exception as e:
            print(f"ERROR: selected count text error: {e}")
            
    except Exception as e:
        print(f"ERROR: Main error: {e}")
        traceback.print_exc()

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            await debug_test(page)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())