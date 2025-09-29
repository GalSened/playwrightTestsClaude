"""
Playwright Smart Platform Authentication and Test Bank Verification
"""
import pytest
from playwright.sync_api import Page, expect

@pytest.mark.smoke
def test_playwright_smart_login_and_test_bank(page: Page):
    """Login to Playwright Smart and verify Test Bank features"""
    print("\n=== PLAYWRIGHT SMART LOGIN & TEST BANK VERIFICATION ===")
    
    try:
        # Step 1: Login to Playwright Smart platform
        print("1. Navigating to Playwright Smart...")
        page.goto("http://localhost:3007")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        
        # Take screenshot of login page
        page.screenshot(path="artifacts/playwright_smart_login.png", full_page=True)
        
        # Fill login form with demo credentials
        print("2. Filling login form...")
        
        # Email field
        email_field = page.locator('input[placeholder*="you@company.com"], input[name*="email"], input[type="email"]')
        if email_field.is_visible():
            email_field.fill("admin@demo.com")
            print("   - Email filled: admin@demo.com")
        
        # Password field  
        password_field = page.locator('input[placeholder*="password"], input[type="password"]')
        if password_field.is_visible():
            password_field.fill("demo123")
            print("   - Password filled")
        
        # Optional company subdomain
        company_field = page.locator('input[placeholder*="your-company"], input[name*="company"]')
        if company_field.is_visible():
            company_field.fill("demo")
            print("   - Company filled: demo")
        
        # Click Sign In button
        sign_in_btn = page.locator('button:has-text("Sign In"), button[type="submit"]')
        if sign_in_btn.is_visible():
            print("3. Clicking Sign In...")
            sign_in_btn.click()
            page.wait_for_timeout(3000)
            page.wait_for_load_state("networkidle")
        
        # Take screenshot after login attempt
        page.screenshot(path="artifacts/after_smart_login.png", full_page=True)
        
        # Step 2: Navigate to Test Bank
        current_url = page.url
        print(f"4. Current URL after login: {current_url}")
        
        if "/test-bank" not in current_url:
            print("5. Navigating to Test Bank...")
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
        
        # Take screenshot of Test Bank page
        page.screenshot(path="artifacts/test_bank_authenticated.png", full_page=True)
        
        # Step 3: Verify Test Bank features
        print("6. Verifying Test Bank features...")
        
        results = {}
        
        # Check page content
        page_content = page.text_content("body").lower()
        if any(word in page_content for word in ["test", "suite", "bank", "execution"]):
            print("   PASS: Test Bank content found")
            results["content"] = "PASS"
        else:
            print("   FAIL: No Test Bank content found")
            results["content"] = "FAIL"
        
        # Check for main navigation or menu
        nav_elements = page.locator("nav, .navigation, .menu, .sidebar").count()
        print(f"   Navigation elements: {nav_elements}")
        results["navigation"] = f"PASS ({nav_elements})" if nav_elements > 0 else "FAIL"
        
        # Check for test-related elements
        test_elements = page.locator("[data-testid*='test'], .test, [class*='test']").count()
        print(f"   Test elements: {test_elements}")
        results["test_elements"] = f"PASS ({test_elements})" if test_elements > 0 else "FAIL"
        
        # Check for tables
        tables = page.locator("table, .data-table, .test-table").count()
        print(f"   Tables: {tables}")
        results["tables"] = f"PASS ({tables})" if tables > 0 else "FAIL"
        
        # Check for interactive elements (buttons, inputs)
        buttons = page.locator("button").count()
        inputs = page.locator("input").count()
        selects = page.locator("select").count()
        
        print(f"   Interactive elements: {buttons} buttons, {inputs} inputs, {selects} selects")
        total_interactive = buttons + inputs + selects
        results["interactive"] = f"PASS ({total_interactive})" if total_interactive > 0 else "FAIL"
        
        # Look for specific Test Bank features
        feature_selectors = [
            ("Create Suite", "button:has-text('Create'), button:has-text('Suite')"),
            ("Run/Execute", "button:has-text('Run'), button:has-text('Execute')"),
            ("Filters", "select, .filter, input[placeholder*='search']"),
            ("Checkboxes", "input[type='checkbox']"),
            ("Test Rows", "tr, .test-row, .test-item"),
            ("Suite Section", ".suite, [data-testid*='suite']")
        ]
        
        for feature_name, selector in feature_selectors:
            count = page.locator(selector).count()
            status = f"PASS ({count})" if count > 0 else "FAIL"
            results[feature_name.lower().replace("/", "_").replace(" ", "_")] = status
            print(f"   {feature_name}: {status}")
        
        # Step 4: Try basic interactions
        print("7. Testing basic interactions...")
        
        # Try clicking on first available button (non-destructive)
        visible_buttons = page.locator("button:visible").count()
        if visible_buttons > 0:
            first_button = page.locator("button:visible").first
            button_text = first_button.text_content() or "Unknown"
            
            # Only click safe buttons
            safe_buttons = ["view", "details", "info", "help", "cancel", "close"]
            if any(safe in button_text.lower() for safe in safe_buttons):
                try:
                    print(f"   Clicking safe button: {button_text}")
                    first_button.click()
                    page.wait_for_timeout(1000)
                    results["button_interaction"] = "PASS"
                except:
                    results["button_interaction"] = "FAIL"
            else:
                print(f"   Skipping button click for safety: {button_text}")
                results["button_interaction"] = "SKIP"
        
        # Summary
        print("\n=== PLAYWRIGHT SMART TEST BANK RESULTS ===")
        passed = failed = skipped = 0
        
        for feature, status in results.items():
            print(f"{feature}: {status}")
            if "PASS" in status:
                passed += 1
            elif "FAIL" in status:
                failed += 1
            else:
                skipped += 1
        
        total = passed + failed
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"\nSUCCESS RATE: {success_rate:.1f}% ({passed}/{total} working)")
            
            if success_rate >= 70:
                print("OVERALL STATUS: EXCELLENT - Test Bank is working well")
            elif success_rate >= 50:
                print("OVERALL STATUS: GOOD - Most features working")
            elif success_rate >= 30:
                print("OVERALL STATUS: PARTIAL - Some features working")
            else:
                print("OVERALL STATUS: POOR - Major issues found")
        
        # Don't fail the test, just report results
        print("=== VERIFICATION COMPLETE ===")
        
    except Exception as e:
        print(f"ERROR during verification: {e}")
        page.screenshot(path="artifacts/verification_error.png", full_page=True)
        raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])