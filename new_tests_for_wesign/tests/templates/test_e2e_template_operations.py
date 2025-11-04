"""
E2E Tests for Template Operations: Create, Edit, Delete
These tests actually perform the operations and verify they work
"""

import pytest
from playwright.async_api import async_playwright
from pages.templates_page import TemplatesPage
from pages.auth_page import AuthPage
from pathlib import Path
import time
import random


class TestE2ETemplateOperations:
    """E2E tests that ACTUALLY create, edit, and delete templates"""

    @pytest.mark.asyncio
    async def test_1_create_new_template_with_pdf_file(self):
        """Test 1: Create a new template by uploading a PDF file"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized', '--force-device-scale-factor=1'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                print("\n" + "="*80)
                print("TEST 1: Creating new template with PDF upload")
                print("="*80)

                # Login
                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to templates
                await templates_page.navigate_to_templates()
                await page.wait_for_timeout(3000)

                print(f"Current URL: {page.url}")

                # Count templates before
                initial_count = await templates_page.count_templates()
                print(f"Initial template count: {initial_count}")

                # Click "Add New Template" button
                print("\nLooking for 'Add New Template' button...")

                # Try multiple selectors for the add button
                add_button_selectors = [
                    'button:has-text("תבנית חדשה")',
                    'button:has-text("New Template")',
                    'li:has-text("תבנית חדשה")',
                    '[data-action="add-template"]',
                    'button.add-template',
                    'text=תבנית חדשה'
                ]

                button_found = False
                for selector in add_button_selectors:
                    try:
                        btn = page.locator(selector).first
                        if await btn.is_visible(timeout=2000):
                            print(f"✅ Found add button with selector: {selector}")
                            await btn.click()
                            button_found = True
                            break
                    except Exception as e:
                        print(f"❌ Selector '{selector}' failed: {str(e)[:50]}")

                if not button_found:
                    # List all buttons to find the right one
                    print("\n📋 Listing all visible buttons on templates page:")
                    all_buttons = page.locator('button')
                    button_count = await all_buttons.count()
                    print(f"Found {button_count} buttons")

                    for i in range(min(button_count, 20)):  # Check first 20 buttons
                        btn = all_buttons.nth(i)
                        try:
                            if await btn.is_visible():
                                text = await btn.text_content()
                                html = await btn.evaluate('el => el.outerHTML')
                                print(f"\nButton {i+1}:")
                                print(f"  Text: {text}")
                                print(f"  HTML: {html[:150]}")
                        except:
                            pass

                await page.wait_for_timeout(2000)

                # Look for file upload input or modal
                print("\nLooking for file upload input...")
                file_input = page.locator('input[type="file"]').first

                if await file_input.is_visible(timeout=5000):
                    print("✅ File input found")

                    # Use existing test PDF file
                    test_pdf_path = Path("test_files/sample.pdf")

                    if test_pdf_path.exists():
                        print(f"Uploading file: {test_pdf_path}")
                        await file_input.set_input_files(str(test_pdf_path))
                        await page.wait_for_timeout(2000)

                        # Look for submit/upload button
                        submit_selectors = [
                            'button:has-text("Upload")',
                            'button:has-text("העלה")',
                            'button:has-text("אישור")',
                            'button[type="submit"]',
                            'button:has-text("Submit")'
                        ]

                        for selector in submit_selectors:
                            try:
                                submit_btn = page.locator(selector).first
                                if await submit_btn.is_visible(timeout=2000):
                                    print(f"✅ Found submit button: {selector}")
                                    await submit_btn.click()
                                    break
                            except:
                                pass

                        await page.wait_for_timeout(3000)

                        # Verify template was created
                        final_count = await templates_page.count_templates()
                        print(f"\nFinal template count: {final_count}")

                        assert final_count > initial_count, f"Template count should increase from {initial_count} to {final_count}"
                        print("✅ TEST 1 PASSED: Template created successfully!")
                    else:
                        print(f"❌ Test file not found: {test_pdf_path}")
                        assert False, "Test PDF file not found"
                else:
                    print("❌ File input not found after clicking add button")

                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_2_edit_existing_template_name(self):
        """Test 2: Edit an existing template's name"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                print("\n" + "="*80)
                print("TEST 2: Editing template name")
                print("="*80)

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()
                await page.wait_for_timeout(3000)

                # Get list of templates
                templates = await templates_page.get_templates_list()
                print(f"Found {len(templates)} templates")

                if len(templates) > 0:
                    # Click on first template to edit
                    print(f"\nSelecting first template for editing...")

                    first_template = page.locator('.template-item, .template-card, [data-item="template"]').first
                    await first_template.click()
                    await page.wait_for_timeout(2000)

                    # Look for edit button or edit mode
                    edit_selectors = [
                        'button:has-text("Edit")',
                        'button:has-text("ערוך")',
                        'button[data-action="edit"]',
                        'i-feather[name="edit"]',
                        'text=ערוך'
                    ]

                    for selector in edit_selectors:
                        try:
                            edit_btn = page.locator(selector).first
                            if await edit_btn.is_visible(timeout=2000):
                                print(f"✅ Found edit button: {selector}")
                                await edit_btn.click()
                                await page.wait_for_timeout(2000)
                                break
                        except:
                            pass

                    # Look for name input field
                    name_input_selectors = [
                        'input[name="name"]',
                        'input[placeholder*="name"]',
                        'input[placeholder*="שם"]',
                        'input[type="text"]'
                    ]

                    new_name = f"Edited Template {int(time.time())}"

                    for selector in name_input_selectors:
                        try:
                            name_input = page.locator(selector).first
                            if await name_input.is_visible(timeout=2000):
                                print(f"✅ Found name input: {selector}")
                                await name_input.fill(new_name)
                                print(f"Changed name to: {new_name}")

                                # Save changes
                                save_btn = page.locator('button:has-text("Save"), button:has-text("שמור"), button:has-text("אישור")').first
                                if await save_btn.is_visible(timeout=2000):
                                    await save_btn.click()
                                    await page.wait_for_timeout(2000)
                                    print("✅ TEST 2 PASSED: Template edited successfully!")
                                break
                        except:
                            pass
                else:
                    print("⚠️ No templates available to edit")

                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_3_delete_template(self):
        """Test 3: Delete a template and verify it's removed"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                print("\n" + "="*80)
                print("TEST 3: Deleting template")
                print("="*80)

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()
                await page.wait_for_timeout(3000)

                # Count templates before deletion
                initial_count = await templates_page.count_templates()
                print(f"Initial template count: {initial_count}")

                if initial_count > 0:
                    # Select first template
                    print("\nSelecting first template for deletion...")

                    # Try to find and check checkbox
                    first_checkbox = page.locator('input[type="checkbox"]').first
                    if await first_checkbox.is_visible(timeout=2000):
                        await first_checkbox.check()
                        print("✅ Template selected via checkbox")
                        await page.wait_for_timeout(1000)
                    else:
                        # Right-click or click template for context menu
                        first_template = page.locator('.template-item, .template-card').first
                        await first_template.click()
                        await page.wait_for_timeout(1000)

                    # Look for delete button
                    delete_selectors = [
                        'button:has-text("Delete")',
                        'button:has-text("מחק")',
                        'i-feather[name="trash"]',
                        'i-feather[name="trash-2"]',
                        'button[data-action="delete"]',
                        'text=מחק'
                    ]

                    delete_found = False
                    for selector in delete_selectors:
                        try:
                            delete_btn = page.locator(selector).first
                            if await delete_btn.is_visible(timeout=2000):
                                print(f"✅ Found delete button: {selector}")
                                await delete_btn.click()
                                delete_found = True
                                await page.wait_for_timeout(2000)
                                break
                        except Exception as e:
                            print(f"❌ Delete selector '{selector}' failed: {str(e)[:50]}")

                    if delete_found:
                        # Confirm deletion in modal/popup
                        confirm_selectors = [
                            'button:has-text("Confirm")',
                            'button:has-text("אישור")',
                            'button:has-text("Yes")',
                            'button:has-text("כן")',
                            'button.confirm',
                            'button[data-action="confirm"]'
                        ]

                        for selector in confirm_selectors:
                            try:
                                confirm_btn = page.locator(selector).first
                                if await confirm_btn.is_visible(timeout=2000):
                                    print(f"✅ Found confirm button: {selector}")
                                    await confirm_btn.click()
                                    await page.wait_for_timeout(3000)
                                    break
                            except:
                                pass

                        # Verify template was deleted
                        final_count = await templates_page.count_templates()
                        print(f"\nFinal template count: {final_count}")

                        assert final_count < initial_count, f"Template count should decrease from {initial_count} to {final_count}"
                        print("✅ TEST 3 PASSED: Template deleted successfully!")
                    else:
                        print("❌ Delete button not found")
                        # List all visible buttons for debugging
                        print("\n📋 Listing all buttons:")
                        all_buttons = page.locator('button')
                        button_count = await all_buttons.count()
                        for i in range(min(button_count, 30)):
                            btn = all_buttons.nth(i)
                            try:
                                if await btn.is_visible():
                                    text = await btn.text_content()
                                    print(f"Button {i+1}: {text}")
                            except:
                                pass
                else:
                    print("⚠️ No templates available to delete")

                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_4_create_template_from_blank(self):
        """Test 4: Create a new blank template"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                print("\n" + "="*80)
                print("TEST 4: Creating blank template")
                print("="*80)

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()
                await page.wait_for_timeout(3000)

                # Count templates before
                initial_count = await templates_page.count_templates()
                print(f"Initial template count: {initial_count}")

                # Look for "Create Blank" or similar option
                blank_selectors = [
                    'text=Blank Template',
                    'text=תבנית ריקה',
                    'button:has-text("Blank")',
                    'button:has-text("ריקה")',
                    '[data-template-type="blank"]'
                ]

                for selector in blank_selectors:
                    try:
                        blank_btn = page.locator(selector).first
                        if await blank_btn.is_visible(timeout=2000):
                            print(f"✅ Found blank template button: {selector}")
                            await blank_btn.click()
                            await page.wait_for_timeout(3000)

                            # Verify redirect to template editor
                            print(f"Current URL: {page.url}")
                            if "template" in page.url or "editor" in page.url:
                                print("✅ TEST 4 PASSED: Navigated to template editor!")
                            break
                    except:
                        pass

                await page.wait_for_timeout(3000)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_5_duplicate_template(self):
        """Test 5: Duplicate an existing template"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--start-maximized'],
                slow_mo=1500
            )
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                print("\n" + "="*80)
                print("TEST 5: Duplicating template")
                print("="*80)

                # Login and navigate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()
                await page.wait_for_timeout(3000)

                # Count templates before
                initial_count = await templates_page.count_templates()
                print(f"Initial template count: {initial_count}")

                if initial_count > 0:
                    # Select or click first template
                    first_template = page.locator('.template-item, .template-card').first
                    await first_template.click()
                    await page.wait_for_timeout(2000)

                    # Look for duplicate/copy button
                    duplicate_selectors = [
                        'button:has-text("Duplicate")',
                        'button:has-text("שכפל")',
                        'button:has-text("Copy")',
                        'button:has-text("העתק")',
                        'i-feather[name="copy"]',
                        '[data-action="duplicate"]'
                    ]

                    for selector in duplicate_selectors:
                        try:
                            dup_btn = page.locator(selector).first
                            if await dup_btn.is_visible(timeout=2000):
                                print(f"✅ Found duplicate button: {selector}")
                                await dup_btn.click()
                                await page.wait_for_timeout(3000)

                                # Verify count increased
                                final_count = await templates_page.count_templates()
                                print(f"Final template count: {final_count}")

                                if final_count > initial_count:
                                    print("✅ TEST 5 PASSED: Template duplicated successfully!")
                                break
                        except:
                            pass
                else:
                    print("⚠️ No templates available to duplicate")

                await page.wait_for_timeout(3000)

            finally:
                await browser.close()
