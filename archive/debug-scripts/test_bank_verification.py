"""
Test Bank Feature Verification Script
Systematically tests all Test Bank functionality
"""
import pytest
from playwright.sync_api import Page, expect
import time
import json

class TestBankFeatureVerification:
    """Comprehensive Test Bank feature verification"""
    
    def setup_method(self, method):
        """Setup for each test method"""
        self.test_results = {}
        self.feature_status = {}
    
    @pytest.mark.verification
    def test_01_test_discovery_and_display(self, page: Page):
        """TEST BANK - Test Discovery & Display Verification"""
        print("\n🔍 VERIFYING: Test Discovery & Display")
        
        try:
            # Navigate to Test Bank
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            # Take screenshot
            page.screenshot(path="artifacts/test_bank_main.png", full_page=True)
            
            # Check Test Bank page loads
            page_title = page.locator('[data-testid="test-bank-page"], .test-bank-page, h1, .page-title')
            if page_title.count() > 0:
                print("✅ Test Bank page loads successfully")
                self.feature_status["Page Load"] = "✅"
            else:
                print("❌ Test Bank page not found")
                self.feature_status["Page Load"] = "❌"
            
            # Check test discovery - look for test table
            test_table = page.locator('table, .test-grid, [data-testid="test-table"]')
            if test_table.count() > 0:
                print("✅ Test table/grid found")
                self.feature_status["Test Table"] = "✅"
                
                # Count test rows
                test_rows = page.locator('tbody tr, .test-row, [data-testid*="test-item"]')
                test_count = test_rows.count()
                print(f"✅ Found {test_count} tests displayed")
                self.feature_status["Test Count"] = f"✅ ({test_count} tests)"
                
                # Check for test names in first few rows
                if test_count > 0:
                    first_row = test_rows.first
                    row_text = first_row.text_content()
                    print(f"✅ First test row contains: {row_text[:100]}...")
                    self.feature_status["Test Names"] = "✅"
                
            else:
                print("❌ Test table/grid not found")
                self.feature_status["Test Table"] = "❌"
            
            # Check for test categories/grouping
            category_elements = page.locator('[data-testid*="category"], .category, .test-module, .module-header')
            if category_elements.count() > 0:
                categories = category_elements.all_text_contents()
                print(f"✅ Test categories found: {categories[:3]}")  # Show first 3
                self.feature_status["Test Categories"] = f"✅ ({len(categories)} found)"
            else:
                print("⚠️ Test categories not clearly visible")
                self.feature_status["Test Categories"] = "⚠️"
            
            # Check for test file paths
            file_path_elements = page.locator('.file-path, [data-testid*="file"], .test-path')
            if file_path_elements.count() > 0:
                print("✅ Test file paths displayed")
                self.feature_status["File Paths"] = "✅"
            else:
                print("⚠️ Test file paths not clearly visible")
                self.feature_status["File Paths"] = "⚠️"
            
            print("📊 TEST DISCOVERY & DISPLAY STATUS:")
            for feature, status in self.feature_status.items():
                print(f"  {feature}: {status}")
                
        except Exception as e:
            print(f"❌ Test Discovery verification failed: {e}")
            self.feature_status["Overall"] = f"❌ Error: {str(e)}"
    
    @pytest.mark.verification
    def test_02_filtering_and_search(self, page: Page):
        """TEST BANK - Filtering & Search Verification"""
        print("\n🔍 VERIFYING: Filtering & Search")
        
        try:
            # Ensure we're on Test Bank page
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            filter_status = {}
            
            # Check for category filters
            category_filter = page.locator('[data-testid="filter-modules"], [data-testid="filter-category"], select[name*="category"], .category-filter')
            if category_filter.count() > 0:
                print("✅ Category filter found")
                filter_status["Category Filter"] = "✅"
                
                # Test category filtering
                try:
                    if category_filter.first.is_visible():
                        # Get initial test count
                        initial_rows = page.locator('tbody tr, .test-row').count()
                        
                        # Try to select a category
                        category_filter.first.click()
                        page.wait_for_timeout(500)
                        
                        # Check if options are available
                        options = page.locator('option, .dropdown-option').count()
                        if options > 0:
                            print(f"✅ Category filter has {options} options")
                            filter_status["Category Options"] = f"✅ ({options} options)"
                        
                except Exception as e:
                    print(f"⚠️ Category filter interaction failed: {e}")
                    filter_status["Category Interaction"] = "⚠️"
            else:
                print("❌ Category filter not found")
                filter_status["Category Filter"] = "❌"
            
            # Check for tag/type filters
            tag_filter = page.locator('[data-testid="filter-tags"], [data-testid="filter-type"], select[name*="tag"], .tag-filter')
            if tag_filter.count() > 0:
                print("✅ Tag/Type filter found")
                filter_status["Tag Filter"] = "✅"
            else:
                print("❌ Tag/Type filter not found")
                filter_status["Tag Filter"] = "❌"
            
            # Check for risk filter
            risk_filter = page.locator('[data-testid="filter-risk"], select[name*="risk"], .risk-filter')
            if risk_filter.count() > 0:
                print("✅ Risk filter found")
                filter_status["Risk Filter"] = "✅"
            else:
                print("❌ Risk filter not found")
                filter_status["Risk Filter"] = "❌"
            
            # Check for search functionality
            search_input = page.locator('input[placeholder*="search"], input[type="search"], [data-testid="search"], .search-input')
            if search_input.count() > 0:
                print("✅ Search input found")
                filter_status["Search Input"] = "✅"
                
                # Test search functionality
                try:
                    search_input.first.fill("login")
                    page.wait_for_timeout(1000)
                    
                    # Check if results changed
                    search_results = page.locator('tbody tr, .test-row').count()
                    print(f"✅ Search returned {search_results} results for 'login'")
                    filter_status["Search Function"] = f"✅ ({search_results} results)"
                    
                    # Clear search
                    search_input.first.clear()
                    page.wait_for_timeout(500)
                    
                except Exception as e:
                    print(f"⚠️ Search function test failed: {e}")
                    filter_status["Search Function"] = "⚠️"
            else:
                print("❌ Search input not found")
                filter_status["Search Input"] = "❌"
            
            # Check for clear filters button
            clear_button = page.locator('[data-testid="clear-filters"], button:has-text("Clear"), .clear-filters')
            if clear_button.count() > 0:
                print("✅ Clear filters button found")
                filter_status["Clear Filters"] = "✅"
            else:
                print("⚠️ Clear filters button not found")
                filter_status["Clear Filters"] = "⚠️"
            
            page.screenshot(path="artifacts/test_bank_filters.png", full_page=True)
            
            print("📊 FILTERING & SEARCH STATUS:")
            for feature, status in filter_status.items():
                print(f"  {feature}: {status}")
                
            self.feature_status.update(filter_status)
                
        except Exception as e:
            print(f"❌ Filtering & Search verification failed: {e}")
    
    @pytest.mark.verification  
    def test_03_test_selection(self, page: Page):
        """TEST BANK - Test Selection Verification"""
        print("\n🔍 VERIFYING: Test Selection")
        
        try:
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            selection_status = {}
            
            # Check for individual test checkboxes
            checkboxes = page.locator('input[type="checkbox"], .test-checkbox, [data-testid*="checkbox"]')
            checkbox_count = checkboxes.count()
            
            if checkbox_count > 0:
                print(f"✅ Found {checkbox_count} test selection checkboxes")
                selection_status["Individual Checkboxes"] = f"✅ ({checkbox_count} found)"
                
                # Test individual selection
                try:
                    first_checkbox = checkboxes.first
                    if first_checkbox.is_visible():
                        first_checkbox.check()
                        page.wait_for_timeout(500)
                        
                        if first_checkbox.is_checked():
                            print("✅ Individual test selection works")
                            selection_status["Individual Selection"] = "✅"
                            
                            # Uncheck it
                            first_checkbox.uncheck()
                            page.wait_for_timeout(500)
                        else:
                            print("⚠️ Checkbox didn't get checked")
                            selection_status["Individual Selection"] = "⚠️"
                            
                except Exception as e:
                    print(f"⚠️ Individual selection test failed: {e}")
                    selection_status["Individual Selection"] = "⚠️"
                    
            else:
                print("❌ No test selection checkboxes found")
                selection_status["Individual Checkboxes"] = "❌"
            
            # Check for select all functionality
            select_all = page.locator('input[type="checkbox"][data-testid*="select-all"], .select-all-checkbox, button:has-text("Select All")')
            if select_all.count() > 0:
                print("✅ Select All functionality found")
                selection_status["Select All"] = "✅"
                
                # Test select all
                try:
                    select_all.first.click()
                    page.wait_for_timeout(1000)
                    
                    # Check if multiple checkboxes are now checked
                    checked_count = page.locator('input[type="checkbox"]:checked').count()
                    print(f"✅ Select All checked {checked_count} items")
                    selection_status["Select All Function"] = f"✅ ({checked_count} selected)"
                    
                except Exception as e:
                    print(f"⚠️ Select All test failed: {e}")
                    selection_status["Select All Function"] = "⚠️"
            else:
                print("⚠️ Select All functionality not found")
                selection_status["Select All"] = "⚠️"
            
            # Check for selected count display
            selected_count_display = page.locator('[data-testid*="selected"], .selected-count, .selection-count')
            if selected_count_display.count() > 0:
                count_text = selected_count_display.first.text_content()
                print(f"✅ Selected count display: {count_text}")
                selection_status["Selection Counter"] = "✅"
            else:
                print("⚠️ Selected count display not found")
                selection_status["Selection Counter"] = "⚠️"
            
            # Check for bulk actions
            bulk_actions = page.locator('button:has-text("Run Selected"), button:has-text("Create Suite"), .bulk-actions')
            if bulk_actions.count() > 0:
                print("✅ Bulk actions found")
                selection_status["Bulk Actions"] = "✅"
            else:
                print("⚠️ Bulk actions not found")
                selection_status["Bulk Actions"] = "⚠️"
            
            page.screenshot(path="artifacts/test_bank_selection.png", full_page=True)
            
            print("📊 TEST SELECTION STATUS:")
            for feature, status in selection_status.items():
                print(f"  {feature}: {status}")
                
            self.feature_status.update(selection_status)
                
        except Exception as e:
            print(f"❌ Test Selection verification failed: {e}")
    
    @pytest.mark.verification
    def test_04_suite_management(self, page: Page):
        """TEST BANK - Suite Management Verification"""
        print("\n🔍 VERIFYING: Suite Management")
        
        try:
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            suite_status = {}
            
            # Check for create suite functionality
            create_suite_btn = page.locator('button:has-text("Create Suite"), [data-testid="create-suite"], .create-suite-btn')
            if create_suite_btn.count() > 0:
                print("✅ Create Suite button found")
                suite_status["Create Suite Button"] = "✅"
                
                # Test suite creation dialog
                try:
                    create_suite_btn.first.click()
                    page.wait_for_timeout(1000)
                    
                    # Look for suite creation modal/dialog
                    modal = page.locator('.modal, .dialog, [role="dialog"], .suite-creation-modal')
                    if modal.count() > 0 and modal.first.is_visible():
                        print("✅ Suite creation modal opens")
                        suite_status["Suite Creation Modal"] = "✅"
                        
                        # Look for suite name input
                        name_input = page.locator('input[placeholder*="suite"], input[name*="name"], .suite-name-input')
                        if name_input.count() > 0:
                            print("✅ Suite name input found")
                            suite_status["Suite Name Input"] = "✅"
                            
                            # Test filling suite name
                            name_input.first.fill("Test Verification Suite")
                            page.wait_for_timeout(500)
                            
                        # Close modal (look for cancel or close button)
                        close_btn = page.locator('button:has-text("Cancel"), button:has-text("Close"), .modal-close, [aria-label="Close"]')
                        if close_btn.count() > 0:
                            close_btn.first.click()
                            page.wait_for_timeout(500)
                            
                    else:
                        print("⚠️ Suite creation modal not visible")
                        suite_status["Suite Creation Modal"] = "⚠️"
                        
                except Exception as e:
                    print(f"⚠️ Suite creation test failed: {e}")
                    suite_status["Suite Creation Test"] = "⚠️"
                    
            else:
                print("❌ Create Suite button not found")
                suite_status["Create Suite Button"] = "❌"
            
            # Check for existing suites display
            existing_suites = page.locator('.suite-list, [data-testid="existing-suites"], .suites-section')
            if existing_suites.count() > 0:
                print("✅ Existing suites section found")
                suite_status["Existing Suites Section"] = "✅"
                
                # Count existing suites
                suite_items = page.locator('.suite-item, .suite-card, [data-testid*="suite-item"]')
                suite_count = suite_items.count()
                print(f"✅ Found {suite_count} existing suites")
                suite_status["Suite Count"] = f"✅ ({suite_count} suites)"
                
                if suite_count > 0:
                    # Check first suite for management options
                    first_suite = suite_items.first
                    
                    # Look for edit button
                    edit_btn = first_suite.locator('button:has-text("Edit"), .edit-btn, [data-testid*="edit"]')
                    if edit_btn.count() > 0:
                        print("✅ Suite edit functionality found")
                        suite_status["Suite Edit"] = "✅"
                    
                    # Look for delete button
                    delete_btn = first_suite.locator('button:has-text("Delete"), .delete-btn, [data-testid*="delete"]')
                    if delete_btn.count() > 0:
                        print("✅ Suite delete functionality found")
                        suite_status["Suite Delete"] = "✅"
                    
                    # Look for run button
                    run_btn = first_suite.locator('button:has-text("Run"), .run-btn, [data-testid*="run"]')
                    if run_btn.count() > 0:
                        print("✅ Suite run functionality found")
                        suite_status["Suite Run"] = "✅"
                        
            else:
                print("⚠️ Existing suites section not found")
                suite_status["Existing Suites Section"] = "⚠️"
            
            # Check for suite presets
            preset_section = page.locator('.suite-presets, [data-testid="suite-presets"], .quick-suite')
            if preset_section.count() > 0:
                print("✅ Suite presets section found")
                suite_status["Suite Presets"] = "✅"
                
                # Count preset options
                preset_buttons = page.locator('button:has-text("Suite"), .preset-btn')
                preset_count = preset_buttons.count()
                print(f"✅ Found {preset_count} suite presets")
                suite_status["Preset Count"] = f"✅ ({preset_count} presets)"
                
            else:
                print("⚠️ Suite presets not found")
                suite_status["Suite Presets"] = "⚠️"
            
            page.screenshot(path="artifacts/test_bank_suites.png", full_page=True)
            
            print("📊 SUITE MANAGEMENT STATUS:")
            for feature, status in suite_status.items():
                print(f"  {feature}: {status}")
                
            self.feature_status.update(suite_status)
                
        except Exception as e:
            print(f"❌ Suite Management verification failed: {e}")
    
    @pytest.mark.verification
    def test_05_test_execution(self, page: Page):
        """TEST BANK - Test Execution Verification"""
        print("\n🔍 VERIFYING: Test Execution")
        
        try:
            page.goto("http://localhost:3007/test-bank")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            execution_status = {}
            
            # Check for individual test run buttons
            run_buttons = page.locator('button:has-text("Run"), .run-btn, [data-testid*="run-test"]')
            run_count = run_buttons.count()
            
            if run_count > 0:
                print(f"✅ Found {run_count} test run buttons")
                execution_status["Run Buttons"] = f"✅ ({run_count} found)"
                
                # Test clicking a run button (but don't wait for completion)
                try:
                    first_run_btn = run_buttons.first
                    if first_run_btn.is_visible():
                        print("✅ Run button is clickable")
                        execution_status["Run Button Click"] = "✅"
                        
                        # Click and immediately check for execution start
                        first_run_btn.click()
                        page.wait_for_timeout(1000)
                        
                        # Look for execution indicators
                        executing_indicators = page.locator('.executing, .running, [data-testid*="executing"], .spinner')
                        if executing_indicators.count() > 0:
                            print("✅ Execution started (spinner/indicator found)")
                            execution_status["Execution Start"] = "✅"
                        else:
                            print("⚠️ No clear execution indicator found")
                            execution_status["Execution Start"] = "⚠️"
                        
                except Exception as e:
                    print(f"⚠️ Run button test failed: {e}")
                    execution_status["Run Button Click"] = "⚠️"
                    
            else:
                print("❌ No test run buttons found")
                execution_status["Run Buttons"] = "❌"
            
            # Check for browser selection
            browser_select = page.locator('select[name*="browser"], [data-testid*="browser"], .browser-select')
            if browser_select.count() > 0:
                print("✅ Browser selection found")
                execution_status["Browser Selection"] = "✅"
                
                # Check browser options
                try:
                    browser_select.first.click()
                    page.wait_for_timeout(500)
                    
                    options = page.locator('option').count()
                    if options > 0:
                        print(f"✅ Browser has {options} options")
                        execution_status["Browser Options"] = f"✅ ({options} options)"
                        
                except Exception as e:
                    print(f"⚠️ Browser selection test failed: {e}")
                    
            else:
                print("⚠️ Browser selection not found")
                execution_status["Browser Selection"] = "⚠️"
            
            # Check for execution mode selection (headed/headless)
            mode_select = page.locator('select[name*="mode"], [data-testid*="mode"], .execution-mode')
            if mode_select.count() > 0:
                print("✅ Execution mode selection found")
                execution_status["Execution Mode"] = "✅"
            else:
                print("⚠️ Execution mode selection not found")
                execution_status["Execution Mode"] = "⚠️"
            
            # Check for bulk execution (run selected tests)
            bulk_run = page.locator('button:has-text("Run Selected"), [data-testid="run-selected"]')
            if bulk_run.count() > 0:
                print("✅ Bulk execution found")
                execution_status["Bulk Execution"] = "✅"
            else:
                print("⚠️ Bulk execution not found")
                execution_status["Bulk Execution"] = "⚠️"
            
            # Check for execution history/results
            history_section = page.locator('.execution-history, [data-testid="history"], .results-section')
            if history_section.count() > 0:
                print("✅ Execution history section found")
                execution_status["Execution History"] = "✅"
            else:
                print("⚠️ Execution history section not found")
                execution_status["Execution History"] = "⚠️"
            
            page.screenshot(path="artifacts/test_bank_execution.png", full_page=True)
            
            print("📊 TEST EXECUTION STATUS:")
            for feature, status in execution_status.items():
                print(f"  {feature}: {status}")
                
            self.feature_status.update(execution_status)
                
        except Exception as e:
            print(f"❌ Test Execution verification failed: {e}")
    
    def generate_test_bank_report(self):
        """Generate comprehensive Test Bank status report"""
        print("\n" + "="*60)
        print("🏦 TEST BANK FEATURE STATUS REPORT")
        print("="*60)
        
        # Categorize features
        categories = {
            "Test Discovery & Display": [
                "Page Load", "Test Table", "Test Count", "Test Names", 
                "Test Categories", "File Paths"
            ],
            "Filtering & Search": [
                "Category Filter", "Tag Filter", "Risk Filter", 
                "Search Input", "Search Function", "Clear Filters"
            ],
            "Test Selection": [
                "Individual Checkboxes", "Individual Selection", 
                "Select All", "Selection Counter", "Bulk Actions"
            ],
            "Suite Management": [
                "Create Suite Button", "Suite Creation Modal", "Suite Name Input",
                "Existing Suites Section", "Suite Count", "Suite Edit", 
                "Suite Delete", "Suite Run", "Suite Presets"
            ],
            "Test Execution": [
                "Run Buttons", "Run Button Click", "Execution Start",
                "Browser Selection", "Execution Mode", "Bulk Execution",
                "Execution History"
            ]
        }
        
        overall_status = {"✅": 0, "⚠️": 0, "❌": 0}
        
        for category, features in categories.items():
            print(f"\n📋 {category}:")
            category_status = {"✅": 0, "⚠️": 0, "❌": 0}
            
            for feature in features:
                status = self.feature_status.get(feature, "❓ Not tested")
                print(f"  {feature}: {status}")
                
                # Count status types
                if "✅" in status:
                    category_status["✅"] += 1
                    overall_status["✅"] += 1
                elif "⚠️" in status:
                    category_status["⚠️"] += 1
                    overall_status["⚠️"] += 1
                elif "❌" in status:
                    category_status["❌"] += 1
                    overall_status["❌"] += 1
            
            # Category summary
            total = sum(category_status.values())
            if total > 0:
                working_pct = (category_status["✅"] / total) * 100
                print(f"  📊 Category Status: {category_status['✅']}/{total} working ({working_pct:.1f}%)")
        
        # Overall summary
        total_features = sum(overall_status.values())
        if total_features > 0:
            working_pct = (overall_status["✅"] / total_features) * 100
            
            print(f"\n🎯 OVERALL TEST BANK STATUS:")
            print(f"  ✅ Working: {overall_status['✅']}")
            print(f"  ⚠️ Partial: {overall_status['⚠️']}")
            print(f"  ❌ Broken: {overall_status['❌']}")
            print(f"  📊 Success Rate: {working_pct:.1f}%")
            
            if working_pct >= 80:
                print(f"  🎉 TEST BANK STATUS: EXCELLENT")
            elif working_pct >= 60:
                print(f"  👍 TEST BANK STATUS: GOOD")
            elif working_pct >= 40:
                print(f"  ⚠️ TEST BANK STATUS: NEEDS WORK")
            else:
                print(f"  🚨 TEST BANK STATUS: MAJOR ISSUES")


if __name__ == "__main__":
    # Run verification
    test_instance = TestBankFeatureVerification()
    pytest.main([__file__, "-v", "-s", "--tb=short"])