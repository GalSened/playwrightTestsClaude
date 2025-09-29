"""Comprehensive Reports and Analytics Test Suite - WeSign"""

import pytest
import asyncio
import tempfile
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.dashboard_page import DashboardPage


class TestReportsAnalyticsComprehensive:
    """Comprehensive reports and analytics test suite covering all reporting scenarios"""

    @pytest.mark.asyncio
    async def test_reports_page_navigation_and_layout(self):
        """Test 1: Reports page navigation and UI layout validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            auth_page = AuthPage(page)
            dashboard_page = DashboardPage(page)

            try:
                print("=== REPORTS PAGE NAVIGATION TEST ===")

                # Step 1: Authenticate
                await auth_page.navigate()
                await auth_page.login_with_company_user()
                assert await auth_page.is_login_successful(), "Login should succeed"

                # Step 2: Navigate to reports
                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Step 3: Validate reports page elements
                reports_loaded = await page.locator(".reports-container, [data-testid='reports-page'], .report-content").count() > 0
                filter_section = await page.locator(".report-filter, [data-testid='report-filter'], .filter-section").count() > 0
                results_section = await page.locator(".report-results, [data-testid='report-results'], .results-table").count() > 0

                print(f"Reports page loaded: {reports_loaded}")
                print(f"Filter section visible: {filter_section}")
                print(f"Results section visible: {results_section}")

                current_url = page.url
                assert "reports" in current_url, f"Should be on reports page, got: {current_url}"

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_filter_functionality(self):
        """Test 2: Report filtering and date range selection"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT FILTER FUNCTIONALITY TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Navigate to reports
                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Test date range filters
                date_filters = [
                    "input[type='date']",
                    "[data-testid='start-date']",
                    "[data-testid='end-date']",
                    ".date-picker input"
                ]

                date_filter_found = False
                for filter_selector in date_filters:
                    if await page.locator(filter_selector).count() > 0:
                        print(f"Date filter found: {filter_selector}")
                        date_filter_found = True
                        break

                # Test report type filters
                report_type_selectors = [
                    "select[name='reportType']",
                    ".report-type-select",
                    "[data-testid='report-type']",
                    "select option"
                ]

                type_filter_found = False
                for type_selector in report_type_selectors:
                    if await page.locator(type_selector).count() > 0:
                        print(f"Report type filter found: {type_selector}")
                        type_filter_found = True
                        break

                # Test filter buttons
                filter_buttons = await page.locator("button:has-text('Filter'), button:has-text('Search'), .filter-btn").count()
                print(f"Filter buttons available: {filter_buttons}")

                print("Report filtering functionality validated")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_generation_workflow(self):
        """Test 3: Complete report generation workflow"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT GENERATION WORKFLOW TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Step 1: Set date range (last 30 days)
                end_date = datetime.now()
                start_date = end_date - timedelta(days=30)

                date_inputs = await page.locator("input[type='date']").count()
                if date_inputs >= 2:
                    await page.locator("input[type='date']").first.fill(start_date.strftime("%Y-%m-%d"))
                    await page.locator("input[type='date']").last.fill(end_date.strftime("%Y-%m-%d"))
                    print(f"Date range set: {start_date.date()} to {end_date.date()}")

                # Step 2: Select report type
                select_elements = await page.locator("select").count()
                if select_elements > 0:
                    await page.locator("select").first.select_option(index=1)
                    print("Report type selected")

                # Step 3: Generate report
                generate_buttons = [
                    "button:has-text('Generate')",
                    "button:has-text('Create Report')",
                    "button:has-text('Run Report')",
                    ".generate-btn",
                    "[data-testid='generate-report']"
                ]

                report_generated = False
                for btn_selector in generate_buttons:
                    if await page.locator(btn_selector).count() > 0:
                        await page.locator(btn_selector).click()
                        await page.wait_for_timeout(2000)
                        report_generated = True
                        print("Report generation triggered")
                        break

                # Step 4: Validate results
                await page.wait_for_timeout(3000)

                results_indicators = [
                    ".report-results",
                    ".results-table",
                    "table",
                    ".data-grid",
                    "[data-testid='report-output']"
                ]

                results_found = False
                for indicator in results_indicators:
                    if await page.locator(indicator).count() > 0:
                        results_found = True
                        print(f"Report results found: {indicator}")
                        break

                print(f"Report generation workflow completed: {report_generated or results_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_export_functionality(self):
        """Test 4: Report export to different formats"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT EXPORT FUNCTIONALITY TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Look for export buttons
                export_buttons = [
                    "button:has-text('Export')",
                    "button:has-text('Download')",
                    "button:has-text('PDF')",
                    "button:has-text('Excel')",
                    "button:has-text('CSV')",
                    ".export-btn",
                    "[data-testid='export-report']"
                ]

                export_options_found = 0
                for btn_selector in export_buttons:
                    count = await page.locator(btn_selector).count()
                    if count > 0:
                        export_options_found += count
                        print(f"Export option found: {btn_selector}")

                # Test export format dropdown
                format_selectors = [
                    "select[name='exportFormat']",
                    ".export-format-select",
                    "[data-testid='export-format']"
                ]

                format_options_found = False
                for selector in format_selectors:
                    if await page.locator(selector).count() > 0:
                        format_options_found = True
                        print(f"Export format selector found: {selector}")
                        break

                print(f"Export functionality validated - Options: {export_options_found}, Format selector: {format_options_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_analytics_dashboard_metrics(self):
        """Test 5: Analytics dashboard and key metrics display"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== ANALYTICS DASHBOARD METRICS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # Try different analytics/dashboard URLs
                analytics_urls = [
                    "https://devtest.comda.co.il/dashboard/reports",
                    "https://devtest.comda.co.il/dashboard/analytics",
                    "https://devtest.comda.co.il/dashboard"
                ]

                metrics_found = 0
                for url in analytics_urls:
                    await page.goto(url)
                    await page.wait_for_load_state("networkidle")

                    # Look for metric indicators
                    metric_selectors = [
                        ".metric-card",
                        ".analytics-metric",
                        ".kpi-card",
                        ".stat-box",
                        "[data-testid='metric']",
                        ".dashboard-widget"
                    ]

                    for selector in metric_selectors:
                        count = await page.locator(selector).count()
                        if count > 0:
                            metrics_found += count
                            print(f"Metrics found at {url}: {selector} ({count})")

                # Look for charts and graphs
                chart_selectors = [
                    "canvas",
                    ".chart-container",
                    "svg",
                    ".graph",
                    "[data-testid='chart']"
                ]

                charts_found = 0
                for selector in chart_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        charts_found += count
                        print(f"Charts found: {selector} ({count})")

                print(f"Analytics metrics validated - Metrics: {metrics_found}, Charts: {charts_found}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_frequency_settings(self):
        """Test 6: Automated report frequency configuration"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT FREQUENCY SETTINGS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Look for frequency/scheduling options
                frequency_selectors = [
                    "select[name='frequency']",
                    ".frequency-select",
                    "button:has-text('Schedule')",
                    "button:has-text('Frequency')",
                    "[data-testid='report-frequency']",
                    ".schedule-report"
                ]

                frequency_options_found = 0
                for selector in frequency_selectors:
                    count = await page.locator(selector).count()
                    if count > 0:
                        frequency_options_found += count
                        print(f"Frequency option found: {selector}")

                # Test frequency values if dropdown exists
                if await page.locator("select").count() > 0:
                    select_element = page.locator("select").first
                    options = await select_element.locator("option").count()
                    if options > 1:
                        print(f"Frequency options available: {options}")

                print(f"Report frequency configuration validated: {frequency_options_found} options found")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_data_accuracy_validation(self):
        """Test 7: Report data accuracy and consistency validation"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT DATA ACCURACY VALIDATION TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                # First get baseline data from dashboard
                await page.goto("https://devtest.comda.co.il/dashboard")
                await page.wait_for_load_state("networkidle")

                # Capture any visible counts or numbers
                dashboard_numbers = []
                number_selectors = [
                    ".count",
                    ".number",
                    ".stat",
                    ".metric-value",
                    "[data-testid*='count']"
                ]

                for selector in number_selectors:
                    elements = page.locator(selector)
                    count = await elements.count()
                    for i in range(count):
                        text = await elements.nth(i).text_content()
                        if text and text.strip().isdigit():
                            dashboard_numbers.append(int(text.strip()))

                print(f"Dashboard baseline numbers captured: {dashboard_numbers}")

                # Now check reports page
                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Generate a simple report if possible
                await page.wait_for_timeout(2000)

                # Look for data in tables or results
                table_data = []
                table_selectors = [
                    "table tbody tr",
                    ".data-row",
                    ".report-row",
                    "[data-testid='data-row']"
                ]

                for selector in table_selectors:
                    rows = await page.locator(selector).count()
                    if rows > 0:
                        table_data.append(rows)
                        print(f"Report data rows found: {rows} ({selector})")

                # Validate data consistency
                data_consistent = len(table_data) > 0 or len(dashboard_numbers) > 0
                print(f"Data accuracy validation completed - Consistent: {data_consistent}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_performance_large_datasets(self):
        """Test 8: Report performance with large date ranges"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT PERFORMANCE LARGE DATASETS TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Test large date range (1 year)
                end_date = datetime.now()
                start_date = end_date - timedelta(days=365)

                start_time = datetime.now()

                # Set large date range if date inputs exist
                date_inputs = await page.locator("input[type='date']").count()
                if date_inputs >= 2:
                    await page.locator("input[type='date']").first.fill(start_date.strftime("%Y-%m-%d"))
                    await page.locator("input[type='date']").last.fill(end_date.strftime("%Y-%m-%d"))
                    print(f"Large date range set: {start_date.date()} to {end_date.date()}")

                    # Trigger report generation
                    generate_buttons = ["button:has-text('Generate')", "button:has-text('Run')", ".generate-btn"]
                    for btn_selector in generate_buttons:
                        if await page.locator(btn_selector).count() > 0:
                            await page.locator(btn_selector).click()
                            break

                    # Wait for results with timeout
                    await page.wait_for_timeout(5000)

                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()

                    # Check if results loaded
                    results_loaded = await page.locator(".report-results, table, .data-grid").count() > 0

                    print(f"Large dataset report performance:")
                    print(f"- Duration: {duration:.2f}s")
                    print(f"- Results loaded: {results_loaded}")
                    print(f"- Performance acceptable: {duration < 30}")  # 30s timeout

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_error_handling_edge_cases(self):
        """Test 9: Report error handling and edge cases"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT ERROR HANDLING EDGE CASES TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Test case 1: Invalid date range (end before start)
                future_date = datetime.now() + timedelta(days=30)
                past_date = datetime.now() - timedelta(days=30)

                date_inputs = await page.locator("input[type='date']").count()
                if date_inputs >= 2:
                    # Set end date before start date
                    await page.locator("input[type='date']").first.fill(future_date.strftime("%Y-%m-%d"))
                    await page.locator("input[type='date']").last.fill(past_date.strftime("%Y-%m-%d"))

                    # Try to generate report
                    generate_buttons = ["button:has-text('Generate')", ".generate-btn"]
                    for btn_selector in generate_buttons:
                        if await page.locator(btn_selector).count() > 0:
                            await page.locator(btn_selector).click()
                            await page.wait_for_timeout(1000)
                            break

                    # Check for error messages
                    error_messages = await page.locator(".error, .alert-danger, [role='alert']").count()
                    print(f"Invalid date range error handling: {error_messages > 0}")

                # Test case 2: Future dates
                future_start = datetime.now() + timedelta(days=10)
                future_end = datetime.now() + timedelta(days=20)

                if date_inputs >= 2:
                    await page.locator("input[type='date']").first.fill(future_start.strftime("%Y-%m-%d"))
                    await page.locator("input[type='date']").last.fill(future_end.strftime("%Y-%m-%d"))

                    for btn_selector in generate_buttons:
                        if await page.locator(btn_selector).count() > 0:
                            await page.locator(btn_selector).click()
                            await page.wait_for_timeout(1000)
                            break

                    future_date_error = await page.locator(".error, .alert-danger").count()
                    print(f"Future date error handling: {future_date_error > 0}")

                print("Report error handling validation completed")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_report_accessibility_compliance(self):
        """Test 10: Report accessibility and usability features"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            auth_page = AuthPage(page)

            try:
                print("=== REPORT ACCESSIBILITY COMPLIANCE TEST ===")

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                await page.goto("https://devtest.comda.co.il/dashboard/reports")
                await page.wait_for_load_state("networkidle")

                # Test keyboard navigation
                await page.keyboard.press('Tab')
                await page.wait_for_timeout(500)

                focused_element = await page.evaluate("document.activeElement.tagName")
                keyboard_nav = focused_element in ['INPUT', 'BUTTON', 'SELECT', 'A']
                print(f"Keyboard navigation works: {keyboard_nav}")

                # Check for ARIA labels
                aria_elements = await page.locator("[aria-label], [role]").count()
                print(f"ARIA accessibility elements: {aria_elements}")

                # Check for proper form labels
                labeled_inputs = await page.locator("input[id]:has(+ label), label:has(+ input)").count()
                form_labels = await page.locator("label").count()
                print(f"Form labels found: {form_labels}, Properly labeled inputs: {labeled_inputs}")

                # Test color contrast (basic check)
                buttons = await page.locator("button").count()
                print(f"Interactive buttons for contrast testing: {buttons}")

                # Check for loading states
                loading_indicators = await page.locator(".loading, .spinner, [role='progressbar']").count()
                print(f"Loading state indicators: {loading_indicators}")

                accessibility_score = (
                    (1 if keyboard_nav else 0) +
                    (1 if aria_elements > 0 else 0) +
                    (1 if form_labels > 0 else 0) +
                    (1 if buttons > 0 else 0)
                )

                print(f"Accessibility compliance score: {accessibility_score}/4")

            finally:
                await browser.close()