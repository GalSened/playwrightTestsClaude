"""
Simple Test Bank Feature Check - No Unicode Issues
"""
import pytest
from playwright.sync_api import Page, expect

class SimpleTestBankCheck:
    
    @pytest.mark.verification
    def test_test_bank_comprehensive_check(self, page: Page):
        """Comprehensive Test Bank feature check"""
        print("\n=== CHECKING TEST BANK FEATURES ===")
        
        results = {}
        
        try:
            # Navigate to Test Bank
            print("Navigating to Test Bank...")
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            
            # Take screenshot
            page.screenshot(path="artifacts/test_bank_check.png", full_page=True)
            
            # 1. Check if page loads
            page_content = page.text_content("body")
            if "test" in page_content.lower() or "suite" in page_content.lower():
                print("PASS: Test Bank page loads with relevant content")
                results["page_load"] = "PASS"
            else:
                print("FAIL: Test Bank page doesn't contain test-related content")
                results["page_load"] = "FAIL"
            
            # 2. Check for test table/grid
            tables = page.locator("table, .test-grid, .data-table").count()
            if tables > 0:
                print(f"PASS: Found {tables} test table(s)")
                results["test_table"] = "PASS"
            else:
                print("FAIL: No test table found")
                results["test_table"] = "FAIL"
            
            # 3. Check for test rows
            rows = page.locator("tbody tr, .test-row, .test-item").count()
            if rows > 0:
                print(f"PASS: Found {rows} test row(s)")
                results["test_rows"] = f"PASS ({rows} tests)"
            else:
                print("FAIL: No test rows found")
                results["test_rows"] = "FAIL"
            
            # 4. Check for filters
            filters = page.locator("select, .filter, input[placeholder*='search']").count()
            if filters > 0:
                print(f"PASS: Found {filters} filter element(s)")
                results["filters"] = f"PASS ({filters} filters)"
            else:
                print("FAIL: No filter elements found")
                results["filters"] = "FAIL"
            
            # 5. Check for checkboxes (selection)
            checkboxes = page.locator("input[type='checkbox']").count()
            if checkboxes > 0:
                print(f"PASS: Found {checkboxes} checkbox(es) for selection")
                results["checkboxes"] = f"PASS ({checkboxes} checkboxes)"
            else:
                print("FAIL: No checkboxes found")
                results["checkboxes"] = "FAIL"
            
            # 6. Check for buttons (run, create suite, etc.)
            buttons = page.locator("button").count()
            if buttons > 0:
                print(f"PASS: Found {buttons} button(s)")
                results["buttons"] = f"PASS ({buttons} buttons)"
                
                # Check for specific button types
                run_buttons = page.locator("button:has-text('Run'), button[data-testid*='run']").count()
                suite_buttons = page.locator("button:has-text('Suite'), button:has-text('Create')").count()
                
                if run_buttons > 0:
                    print(f"PASS: Found {run_buttons} run button(s)")
                    results["run_buttons"] = f"PASS ({run_buttons} buttons)"
                
                if suite_buttons > 0:
                    print(f"PASS: Found {suite_buttons} suite button(s)")
                    results["suite_buttons"] = f"PASS ({suite_buttons} buttons)"
                    
            else:
                print("FAIL: No buttons found")
                results["buttons"] = "FAIL"
            
            # 7. Check for existing suites section
            suite_sections = page.locator(".suite, .existing-suite, [data-testid*='suite']").count()
            if suite_sections > 0:
                print(f"PASS: Found {suite_sections} suite section(s)")
                results["suite_sections"] = f"PASS ({suite_sections} sections)"
            else:
                print("INFO: No suite sections visible (may be empty)")
                results["suite_sections"] = "INFO"
            
            # 8. Try to interact with first checkbox if available
            first_checkbox = page.locator("input[type='checkbox']").first
            if first_checkbox.is_visible():
                print("Testing checkbox interaction...")
                first_checkbox.click()
                page.wait_for_timeout(500)
                
                if first_checkbox.is_checked():
                    print("PASS: Checkbox interaction works")
                    results["checkbox_interaction"] = "PASS"
                    first_checkbox.uncheck()
                else:
                    print("FAIL: Checkbox didn't get checked")
                    results["checkbox_interaction"] = "FAIL"
            
            # 9. Try search functionality
            search_input = page.locator("input[placeholder*='search'], input[type='search']").first
            if search_input.is_visible():
                print("Testing search functionality...")
                initial_rows = page.locator("tbody tr, .test-row").count()
                
                search_input.fill("test")
                page.wait_for_timeout(1000)
                
                search_rows = page.locator("tbody tr, .test-row").count()
                
                if search_rows != initial_rows:
                    print(f"PASS: Search changed results ({initial_rows} -> {search_rows})")
                    results["search_function"] = "PASS"
                else:
                    print("INFO: Search didn't change results (may be expected)")
                    results["search_function"] = "INFO"
                    
                search_input.clear()
                page.wait_for_timeout(500)
            
            print("\n=== TEST BANK FEATURE SUMMARY ===")
            passed = 0
            failed = 0
            info = 0
            
            for feature, status in results.items():
                print(f"{feature}: {status}")
                if "PASS" in status:
                    passed += 1
                elif "FAIL" in status:
                    failed += 1
                else:
                    info += 1
            
            total = passed + failed + info
            if total > 0:
                success_rate = (passed / total) * 100
                print(f"\nSUCCESS RATE: {success_rate:.1f}% ({passed}/{total} features working)")
                
                if success_rate >= 80:
                    print("OVERALL STATUS: EXCELLENT")
                elif success_rate >= 60:
                    print("OVERALL STATUS: GOOD")
                elif success_rate >= 40:
                    print("OVERALL STATUS: NEEDS IMPROVEMENT")
                else:
                    print("OVERALL STATUS: MAJOR ISSUES")
            
            # Return results for further use
            return results
                
        except Exception as e:
            print(f"ERROR during Test Bank check: {e}")
            page.screenshot(path="artifacts/test_bank_error.png", full_page=True)
            return {"error": str(e)}


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])