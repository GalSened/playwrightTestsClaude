"""
Test Bank Feature Check
"""
import pytest
from playwright.sync_api import Page, expect

@pytest.mark.smoke
def test_test_bank_features(page: Page):
    """Check Test Bank features"""
    print("\n=== CHECKING TEST BANK FEATURES ===")
    
    results = {}
    
    try:
        # Navigate to Test Bank
        print("1. Navigating to Test Bank...")
        page.goto("http://localhost:3007/test-bank")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        
        # Take screenshot
        page.screenshot(path="artifacts/test_bank_check.png", full_page=True)
        
        # Check if page loads
        page_content = page.text_content("body")
        if "test" in page_content.lower() or "suite" in page_content.lower():
            print("PASS: Test Bank page loads with relevant content")
            results["page_load"] = "PASS"
        else:
            print("FAIL: Test Bank page doesn't contain test-related content")
            results["page_load"] = "FAIL"
        
        # Check for test table/grid
        tables = page.locator("table, .test-grid, .data-table").count()
        print(f"2. Test tables found: {tables}")
        results["test_table"] = f"PASS ({tables} tables)" if tables > 0 else "FAIL"
        
        # Check for test rows
        rows = page.locator("tbody tr, .test-row, .test-item").count()
        print(f"3. Test rows found: {rows}")
        results["test_rows"] = f"PASS ({rows} tests)" if rows > 0 else "FAIL"
        
        # Check for filters
        filters = page.locator("select, .filter, input[placeholder*='search']").count()
        print(f"4. Filter elements found: {filters}")
        results["filters"] = f"PASS ({filters} filters)" if filters > 0 else "FAIL"
        
        # Check for checkboxes
        checkboxes = page.locator("input[type='checkbox']").count()
        print(f"5. Checkboxes found: {checkboxes}")
        results["checkboxes"] = f"PASS ({checkboxes} checkboxes)" if checkboxes > 0 else "FAIL"
        
        # Check for buttons
        buttons = page.locator("button").count()
        print(f"6. Buttons found: {buttons}")
        results["buttons"] = f"PASS ({buttons} buttons)" if buttons > 0 else "FAIL"
        
        # Check for run buttons specifically
        run_buttons = page.locator("button:has-text('Run')").count()
        print(f"7. Run buttons found: {run_buttons}")
        results["run_buttons"] = f"PASS ({run_buttons} buttons)" if run_buttons > 0 else "FAIL"
        
        # Check for suite buttons
        suite_buttons = page.locator("button:has-text('Suite'), button:has-text('Create')").count()
        print(f"8. Suite buttons found: {suite_buttons}")
        results["suite_buttons"] = f"PASS ({suite_buttons} buttons)" if suite_buttons > 0 else "FAIL"
        
        # Try checkbox interaction if available
        first_checkbox = page.locator("input[type='checkbox']").first
        if first_checkbox.count() > 0 and first_checkbox.is_visible():
            print("9. Testing checkbox interaction...")
            first_checkbox.click()
            page.wait_for_timeout(500)
            
            if first_checkbox.is_checked():
                print("PASS: Checkbox interaction works")
                results["checkbox_interaction"] = "PASS"
                first_checkbox.uncheck()
            else:
                print("FAIL: Checkbox didn't get checked")
                results["checkbox_interaction"] = "FAIL"
        else:
            print("9. No visible checkboxes to test")
            results["checkbox_interaction"] = "SKIP"
        
        # Try search if available
        search_input = page.locator("input[placeholder*='search'], input[type='search']").first
        if search_input.count() > 0 and search_input.is_visible():
            print("10. Testing search functionality...")
            initial_rows = page.locator("tbody tr, .test-row").count()
            
            search_input.fill("test")
            page.wait_for_timeout(1000)
            
            search_rows = page.locator("tbody tr, .test-row").count()
            
            if search_rows != initial_rows:
                print(f"PASS: Search changed results ({initial_rows} -> {search_rows})")
                results["search_function"] = "PASS"
            else:
                print("INFO: Search didn't change results")
                results["search_function"] = "INFO"
                
            search_input.clear()
        else:
            print("10. No search input found")
            results["search_function"] = "SKIP"
        
        print("\n=== TEST BANK RESULTS ===")
        passed = 0
        failed = 0
        
        for feature, status in results.items():
            print(f"{feature}: {status}")
            if "PASS" in status:
                passed += 1
            elif "FAIL" in status:
                failed += 1
        
        total = passed + failed
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"\nSUCCESS RATE: {success_rate:.1f}% ({passed}/{total} working)")
            
            # Assert based on success rate
            assert success_rate >= 50, f"Test Bank success rate too low: {success_rate:.1f}%"
        
        print("=== TEST BANK CHECK COMPLETE ===")
            
    except Exception as e:
        print(f"ERROR: {e}")
        page.screenshot(path="artifacts/test_bank_error.png", full_page=True)
        raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])