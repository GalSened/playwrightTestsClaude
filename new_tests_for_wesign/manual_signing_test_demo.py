"""
Manual Signing Workflow Test Demo
This script demonstrates step-by-step signing workflow testing for manual validation
"""

import asyncio
from playwright.async_api import async_playwright
import time


class ManualSigningTestDemo:
    def __init__(self):
        self.base_url = "https://devtest.comda.co.il"
        self.credentials = {
            "email": "gals@comda.co.il",
            "password": "Comda159!"
        }

    async def step_1_authentication(self, page):
        """Step 1: Test Authentication"""
        print("🔐 STEP 1: Testing Authentication...")

        try:
            # Navigate to login
            print("   → Navigating to login page...")
            await page.goto(f"{self.base_url}/auth/login")
            await page.wait_for_load_state('networkidle', timeout=10000)

            # Fill credentials
            print("   → Filling login credentials...")
            await page.fill('input[type="email"]', self.credentials["email"])
            await page.fill('input[type="password"]', self.credentials["password"])

            # Submit login
            print("   → Submitting login form...")
            login_button = page.locator('button[type="submit"]').first
            await login_button.click()

            # Wait for redirect
            print("   → Waiting for dashboard redirect...")
            await page.wait_for_url("**/dashboard**", timeout=15000)

            current_url = page.url
            if "/dashboard" in current_url:
                print("   ✅ Authentication successful!")
                print(f"   📍 Current URL: {current_url}")
                return True
            else:
                print("   ❌ Authentication failed - not redirected to dashboard")
                return False

        except Exception as e:
            print(f"   ❌ Authentication error: {e}")
            return False

    async def step_2_navigate_to_signing(self, page):
        """Step 2: Navigate to Signing Workflow"""
        print("\n🧭 STEP 2: Navigating to Signing Workflow...")

        try:
            # Try direct navigation to signing workflow
            print("   → Attempting direct navigation to signing workflow...")
            await page.goto(f"{self.base_url}/dashboard/selectsigners")
            await page.wait_for_load_state('networkidle', timeout=10000)

            if "/selectsigners" in page.url:
                print("   ✅ Direct navigation successful!")
                return True
            else:
                # Try through dashboard UI
                print("   → Direct navigation failed, trying through dashboard...")
                await page.goto(f"{self.base_url}/dashboard")
                await page.wait_for_load_state('networkidle')

                # Look for signing options
                server_sign_button = page.locator('button:has-text("Server sign"), a:has-text("Server sign")').first
                if await server_sign_button.is_visible():
                    print("   → Found 'Server sign' button, clicking...")
                    await server_sign_button.click()
                    await asyncio.sleep(3)
                    print(f"   📍 After clicking: {page.url}")
                    return True
                else:
                    print("   ⚠️  Server sign button not found, looking for alternatives...")
                    # List available options
                    buttons = page.locator('button')
                    button_count = await buttons.count()
                    print(f"   📋 Found {button_count} buttons on dashboard")

                    # Try to find any signing-related buttons
                    signing_buttons = page.locator('button:has-text("sign"), a:has-text("sign")')
                    signing_count = await signing_buttons.count()
                    if signing_count > 0:
                        print(f"   📋 Found {signing_count} signing-related buttons")
                        first_signing = signing_buttons.first
                        button_text = await first_signing.text_content()
                        print(f"   → Clicking first signing button: '{button_text}'")
                        await first_signing.click()
                        await asyncio.sleep(3)
                        return True

                    return False

        except Exception as e:
            print(f"   ❌ Navigation error: {e}")
            return False

    async def step_3_test_signing_tabs(self, page):
        """Step 3: Test Signing Workflow Tabs"""
        print("\n📑 STEP 3: Testing Signing Workflow Tabs...")

        try:
            current_url = page.url
            print(f"   📍 Current URL: {current_url}")

            # Look for signing tabs
            signing_tabs = ["Myself", "Others", "Live"]
            found_tabs = []

            for tab_name in signing_tabs:
                print(f"   → Looking for '{tab_name}' tab...")
                tab_button = page.locator(f'button:has-text("{tab_name}")').first

                if await tab_button.is_visible():
                    print(f"   ✅ Found '{tab_name}' tab")
                    found_tabs.append(tab_name)

                    # Test clicking the tab
                    await tab_button.click()
                    await asyncio.sleep(1)
                    print(f"   → Clicked '{tab_name}' tab successfully")
                else:
                    print(f"   ❌ '{tab_name}' tab not found")

            if len(found_tabs) > 0:
                print(f"   ✅ Found {len(found_tabs)}/3 signing tabs: {found_tabs}")
                return True
            else:
                print("   ❌ No signing tabs found")
                return False

        except Exception as e:
            print(f"   ❌ Tab testing error: {e}")
            return False

    async def step_4_test_others_workflow(self, page):
        """Step 4: Test Others Signing Workflow Forms"""
        print("\n👥 STEP 4: Testing Others Signing Workflow...")

        try:
            # Click Others tab
            print("   → Clicking 'Others' tab...")
            others_button = page.locator('button:has-text("Others")').first
            if await others_button.is_visible():
                await others_button.click()
                await asyncio.sleep(2)
                print("   ✅ Others tab clicked successfully")
            else:
                print("   ❌ Others tab not found")
                return False

            # Test form fields
            print("   → Testing form field interactions...")

            # Test name field
            name_field = page.locator('input[placeholder*="Full name"], textbox[aria-label*="Full name"]').first
            if await name_field.is_visible():
                print("   → Testing name field...")
                await name_field.fill("Test Recipient E2E")
                current_value = await name_field.input_value()
                if "Test Recipient E2E" in current_value:
                    print("   ✅ Name field working correctly")
                else:
                    print("   ❌ Name field not working")

            # Test email field
            email_field = page.locator('input[placeholder*="Email"], textbox[aria-label*="Email"]').first
            if await email_field.is_visible():
                print("   → Testing email field...")
                await email_field.fill("test.e2e@example.com")
                current_value = await email_field.input_value()
                if "test.e2e@example.com" in current_value:
                    print("   ✅ Email field working correctly")
                else:
                    print("   ❌ Email field not working")

            # Test communication method dropdown
            comm_select = page.locator('select').first
            if await comm_select.is_visible():
                print("   → Testing communication method dropdown...")
                await comm_select.select_option("Send document by SMS")
                await asyncio.sleep(1)

                # Check if phone field appeared
                phone_field = page.locator('input[placeholder*="050"]').first
                if await phone_field.is_visible():
                    print("   ✅ SMS mode switch successful - phone field appeared")
                    await phone_field.fill("050-123-4567")
                    print("   ✅ Phone field interaction successful")
                else:
                    print("   ⚠️  Phone field not visible after SMS selection")

            print("   ✅ Others workflow form testing completed")
            return True

        except Exception as e:
            print(f"   ❌ Others workflow testing error: {e}")
            return False

    async def step_5_test_javascript_errors(self, page):
        """Step 5: Monitor for JavaScript Errors"""
        print("\n🐛 STEP 5: Monitoring JavaScript Errors...")

        console_errors = []

        def handle_console_message(msg):
            if msg.type == "error":
                console_errors.append({
                    "text": msg.text,
                    "timestamp": time.time()
                })

        page.on("console", handle_console_message)

        try:
            # Trigger the known JavaScript error (SMS switching)
            print("   → Attempting to reproduce SMS switching JavaScript error...")

            # Fill name field
            name_field = page.locator('input[placeholder*="Full name"]').first
            if await name_field.is_visible():
                await name_field.fill("JS Error Test")

            # Switch to SMS (this should trigger the error)
            comm_select = page.locator('select').first
            if await comm_select.is_visible():
                await comm_select.select_option("Send document by SMS")
                await asyncio.sleep(2)  # Wait for error to occur

            # Check for errors
            phone_errors = [error for error in console_errors if "phone" in error["text"].lower()]

            if phone_errors:
                print("   🐛 JavaScript error reproduced:")
                for error in phone_errors:
                    print(f"      Error: {error['text']}")
                print("   📋 This confirms the bug exists and our test can detect it")
            else:
                print("   ✅ No JavaScript errors detected")
                print("   📋 Either the bug was fixed or didn't trigger in this session")

            print(f"   📊 Total console errors captured: {len(console_errors)}")

            # Clean up
            page.remove_listener("console", handle_console_message)
            return True

        except Exception as e:
            print(f"   ❌ JavaScript error monitoring failed: {e}")
            page.remove_listener("console", handle_console_message)
            return False

    async def run_complete_demo(self):
        """Run complete signing workflow test demo"""
        print("🚀 WeSign Signing Workflow E2E Test Demo")
        print("=" * 60)

        async with async_playwright() as p:
            # Launch browser with visible UI for demo
            browser = await p.chromium.launch(headless=False, slow_mo=1000)
            page = await browser.new_page()

            try:
                results = {}

                # Step 1: Authentication
                results['auth'] = await self.step_1_authentication(page)

                if results['auth']:
                    # Step 2: Navigation
                    results['navigation'] = await self.step_2_navigate_to_signing(page)

                    if results['navigation']:
                        # Step 3: Tab testing
                        results['tabs'] = await self.step_3_test_signing_tabs(page)

                        # Step 4: Others workflow
                        results['others_workflow'] = await self.step_4_test_others_workflow(page)

                        # Step 5: JavaScript error monitoring
                        results['js_errors'] = await self.step_5_test_javascript_errors(page)

                # Print final results
                print("\n" + "=" * 60)
                print("🎯 FINAL TEST RESULTS:")
                print("=" * 60)

                for test_name, result in results.items():
                    status = "✅ PASS" if result else "❌ FAIL"
                    print(f"{test_name.upper()}: {status}")

                total_tests = len(results)
                passed_tests = sum(results.values())
                print(f"\nOVERALL: {passed_tests}/{total_tests} tests passed")

                if passed_tests == total_tests:
                    print("🎉 ALL TESTS PASSED - Signing workflow automation is working!")
                else:
                    print("⚠️  Some tests failed - manual investigation needed")

                # Keep browser open for manual inspection
                print("\n📋 Browser will remain open for manual inspection...")
                print("Press Enter to close...")
                input()

            finally:
                await browser.close()


async def main():
    demo = ManualSigningTestDemo()
    await demo.run_complete_demo()


if __name__ == "__main__":
    asyncio.run(main())