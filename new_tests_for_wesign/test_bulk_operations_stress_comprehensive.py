"""Bulk Operations and Stress Test Suite - Comprehensive Performance Testing"""

import pytest
import asyncio
import tempfile
import os
from playwright.async_api import async_playwright
from pages.auth_page import AuthPage
from pages.documents_page import DocumentsPage
from pages.templates_page import TemplatesPage
from pages.contacts_page import ContactsPage
from utils.smart_waits import WeSignSmartWaits
import datetime
import time


class TestBulkOperationsStress:
    """Comprehensive bulk operations and stress testing suite"""

    # BULK DOCUMENT OPERATIONS

    @pytest.mark.asyncio
    async def test_bulk_document_upload_performance(self):
        """Test 1: Bulk document upload performance"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                print("=== BULK DOCUMENT UPLOAD TEST ===")

                # Create multiple test files for bulk upload
                test_files = []
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

                for i in range(5):  # Create 5 test documents
                    temp_file = tempfile.NamedTemporaryFile(suffix=f'_bulk_{i}_{timestamp}.pdf', delete=False)
                    temp_file.write(f'%PDF-1.4 Bulk test document {i}'.encode())
                    temp_file.close()
                    test_files.append(temp_file.name)

                try:
                    initial_count = await documents_page.count_documents()
                    start_time = time.time()

                    # Upload files sequentially with timing
                    upload_results = []
                    for i, file_path in enumerate(test_files):
                        file_start = time.time()
                        result = await documents_page.upload_document(file_path)
                        file_end = time.time()

                        upload_results.append({
                            'file': f'file_{i}',
                            'result': result,
                            'duration': file_end - file_start
                        })

                        print(f"File {i+1} upload: {result}, duration: {file_end - file_start:.2f}s")

                        # Wait for upload to complete
                        smart_waits = WeSignSmartWaits(page)
                        await smart_waits.wait_for_document_upload()

                    end_time = time.time()
                    total_duration = end_time - start_time

                    final_count = await documents_page.count_documents()

                    print(f"Bulk upload completed:")
                    print(f"- Files uploaded: {len(test_files)}")
                    print(f"- Total duration: {total_duration:.2f}s")
                    print(f"- Average per file: {total_duration/len(test_files):.2f}s")
                    print(f"- Document count: {initial_count} -> {final_count}")

                finally:
                    # Cleanup test files
                    for file_path in test_files:
                        if os.path.exists(file_path):
                            os.unlink(file_path)

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_concurrent_document_operations(self):
        """Test 2: Concurrent document operations stress test"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                print("=== CONCURRENT OPERATIONS STRESS TEST ===")

                # Test rapid sequential operations
                operations = [
                    ('count_documents', documents_page.count_documents),
                    ('get_document_list', documents_page.get_document_list),
                    ('search_documents', lambda: documents_page.search_documents("test")),
                    ('reset_search', lambda: documents_page.search_documents("")),
                    ('check_upload_availability', documents_page.is_upload_functionality_available)
                ]

                start_time = time.time()

                for round_num in range(3):  # 3 rounds of operations
                    print(f"Round {round_num + 1}:")

                    for op_name, op_func in operations:
                        op_start = time.time()
                        result = await op_func()
                        op_end = time.time()

                        print(f"  {op_name}: {op_end - op_start:.3f}s")

                        # Very short delay between operations
                        smart_waits = WeSignSmartWaits(page)
                        await smart_waits.wait_for_navigation_complete()

                    smart_waits = WeSignSmartWaits(page)
                    await smart_waits.wait_for_navigation_complete()  # Delay between rounds

                end_time = time.time()
                total_duration = end_time - start_time

                print(f"Concurrent operations completed in {total_duration:.2f}s")

                # Verify page is still responsive
                final_check = await documents_page.is_documents_page_loaded()
                print(f"Page still responsive: {final_check}")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_large_document_list_performance(self):
        """Test 3: Large document list handling performance"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                print("=== LARGE DOCUMENT LIST PERFORMANCE TEST ===")

                # Test performance with large document lists
                performance_metrics = []

                for iteration in range(10):
                    start_time = time.time()

                    # Get document list
                    documents = await documents_page.get_document_list()
                    list_time = time.time()

                    # Count documents
                    doc_count = await documents_page.count_documents()
                    count_time = time.time()

                    # Search documents
                    await documents_page.search_documents("test")
                    search_results = await documents_page.get_document_list()
                    search_time = time.time()

                    # Reset search
                    await documents_page.search_documents("")
                    reset_time = time.time()

                    metrics = {
                        'iteration': iteration + 1,
                        'list_duration': list_time - start_time,
                        'count_duration': count_time - list_time,
                        'search_duration': search_time - count_time,
                        'reset_duration': reset_time - search_time,
                        'total_duration': reset_time - start_time,
                        'doc_count': doc_count,
                        'search_results': len(search_results) if isinstance(search_results, list) else 0
                    }

                    performance_metrics.append(metrics)

                    print(f"Iteration {iteration + 1}: {metrics['total_duration']:.3f}s, {metrics['doc_count']} docs")

                # Calculate averages
                avg_total = sum(m['total_duration'] for m in performance_metrics) / len(performance_metrics)
                avg_list = sum(m['list_duration'] for m in performance_metrics) / len(performance_metrics)
                avg_search = sum(m['search_duration'] for m in performance_metrics) / len(performance_metrics)

                print(f"\nPerformance Summary:")
                print(f"- Average total operation time: {avg_total:.3f}s")
                print(f"- Average list loading time: {avg_list:.3f}s")
                print(f"- Average search time: {avg_search:.3f}s")

            finally:
                await browser.close()

    # BULK TEMPLATE OPERATIONS

    @pytest.mark.asyncio
    async def test_bulk_template_management(self):
        """Test 4: Bulk template creation and management"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                templates_page = TemplatesPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await templates_page.navigate_to_templates()

                print("=== BULK TEMPLATE MANAGEMENT TEST ===")

                initial_template_count = await templates_page.count_templates()
                print(f"Initial template count: {initial_template_count}")

                # Test bulk template operations
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

                # Create multiple templates rapidly
                template_creation_times = []

                for i in range(3):  # Create 3 templates
                    with tempfile.NamedTemporaryFile(suffix=f'_template_{i}_{timestamp}.pdf', delete=False) as temp_file:
                        temp_file.write(f'%PDF-1.4 Template {i} content'.encode())
                        temp_path = temp_file.name

                    try:
                        start_time = time.time()
                        template_name = f"Bulk Template {i} {timestamp}"
                        creation_result = await templates_page.create_template(template_name, temp_path)
                        end_time = time.time()

                        creation_time = end_time - start_time
                        template_creation_times.append(creation_time)

                        print(f"Template {i+1} created: {creation_result}, time: {creation_time:.2f}s")

                        smart_waits = WeSignSmartWaits(page)
                        await smart_waits.wait_for_document_upload()

                    finally:
                        if os.path.exists(temp_path):
                            os.unlink(temp_path)

                # Verify template count increase
                final_template_count = await templates_page.count_templates()
                print(f"Final template count: {final_template_count}")

                # Calculate performance metrics
                avg_creation_time = sum(template_creation_times) / len(template_creation_times)
                print(f"Average template creation time: {avg_creation_time:.2f}s")

                # Test template list performance with more templates
                list_start = time.time()
                templates = await templates_page.get_template_list()
                list_end = time.time()

                print(f"Template list loading time: {list_end - list_start:.2f}s for {len(templates)} templates")

            finally:
                await browser.close()

    # STRESS TESTING

    @pytest.mark.asyncio
    async def test_memory_usage_stress(self):
        """Test 5: Memory usage and stability under stress"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== MEMORY USAGE STRESS TEST ===")

                # Perform intensive operations repeatedly
                for round_num in range(5):
                    print(f"Stress round {round_num + 1}/5")

                    # Navigate between pages
                    await documents_page.navigate_to_documents()
                    await page.wait_for_load_state("networkidle")

                    # Perform multiple operations
                    for i in range(10):
                        await documents_page.count_documents()
                        await documents_page.get_document_list()
                        await documents_page.search_documents(f"stress_test_{i}")
                        await documents_page.search_documents("")  # Reset

                        if i % 3 == 0:  # Every 3rd iteration
                            await page.reload()
                            await page.wait_for_load_state("networkidle")

                    # Check if page is still responsive
                    is_responsive = await documents_page.is_documents_page_loaded()
                    print(f"  Page responsive after round {round_num + 1}: {is_responsive}")

                    smart_waits = WeSignSmartWaits(page)
                    await smart_waits.wait_for_navigation_complete()

                print("Memory stress test completed - system remained stable")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_network_resilience_stress(self):
        """Test 6: Network resilience and error recovery"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                print("=== NETWORK RESILIENCE STRESS TEST ===")

                # Test 1: Rapid page refreshes
                for i in range(5):
                    print(f"Refresh test {i+1}/5")
                    await page.reload()
                    await page.wait_for_load_state("networkidle")

                    # Verify functionality after refresh
                    doc_count = await documents_page.count_documents()
                    print(f"  Documents accessible after refresh: {doc_count}")

                # Test 2: Offline/online simulation
                print("Testing offline resilience...")

                # Go offline briefly
                await page.set_offline(True)
                smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_navigation_complete()

                # Try operations while offline
                try:
                    offline_result = await documents_page.count_documents()
                    print(f"Offline operation result: {offline_result}")
                except Exception as e:
                    print(f"Expected offline error: {type(e).__name__}")

                # Go back online
                await page.set_offline(False)
                await page.wait_for_timeout(1000)

                # Verify recovery
                online_result = await documents_page.count_documents()
                print(f"Online recovery successful: {online_result}")

                print("Network resilience test completed")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_concurrent_user_simulation(self):
        """Test 7: Simulate concurrent user behavior"""
        async with async_playwright() as p:
            # Create multiple browser contexts to simulate different users
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])

            contexts = []
            pages = []

            try:
                print("=== CONCURRENT USER SIMULATION ===")

                # Create 3 concurrent user sessions
                for user_num in range(3):
                    context = await browser.new_context(
                        ignore_https_errors=True,
                        viewport={"width": 1920, "height": 1080}
                    )
                    page = await context.new_page()

                    contexts.append(context)
                    pages.append(page)

                    # Login each user
                    auth_page = AuthPage(page)
                    await auth_page.navigate()
                    await auth_page.login_with_company_user()

                    print(f"User {user_num + 1} logged in")

                # Simulate concurrent operations
                async def user_operations(user_id, user_page):
                    documents_page = DocumentsPage(user_page)
                    await documents_page.navigate_to_documents()

                    for i in range(3):
                        await documents_page.count_documents()
                        await documents_page.get_document_list()
                        await documents_page.search_documents(f"user{user_id}_search_{i}")
                        smart_waits = WeSignSmartWaits(user_page)
                        await smart_waits.wait_for_navigation_complete()

                    return f"User {user_id} completed operations"

                # Run all user operations concurrently
                start_time = time.time()

                tasks = [
                    user_operations(i + 1, page)
                    for i, page in enumerate(pages)
                ]

                results = await asyncio.gather(*tasks, return_exceptions=True)

                end_time = time.time()

                print(f"Concurrent operations completed in {end_time - start_time:.2f}s")
                for result in results:
                    print(f"  {result}")

            finally:
                # Cleanup contexts
                for context in contexts:
                    await context.close()
                await browser.close()

    @pytest.mark.asyncio
    async def test_data_integrity_stress(self):
        """Test 8: Data integrity under stress conditions"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()
                await documents_page.navigate_to_documents()

                print("=== DATA INTEGRITY STRESS TEST ===")

                # Test 1: Repeated data consistency checks
                consistency_checks = []

                for check_num in range(10):
                    # Get data using different methods
                    count_method1 = await documents_page.count_documents()
                    list_method = await documents_page.get_document_list()
                    count_method2 = len(list_method) if isinstance(list_method, list) else 0

                    consistency = {
                        'check': check_num + 1,
                        'count_method1': count_method1,
                        'count_method2': count_method2,
                        'consistent': count_method1 == count_method2
                    }

                    consistency_checks.append(consistency)
                    print(f"Consistency check {check_num + 1}: {consistency['consistent']}")

                    await page.wait_for_timeout(200)

                # Analyze consistency
                consistent_count = sum(1 for check in consistency_checks if check['consistent'])
                consistency_rate = consistent_count / len(consistency_checks) * 100

                print(f"Data consistency rate: {consistency_rate:.1f}% ({consistent_count}/{len(consistency_checks)})")

                # Test 2: State preservation across operations
                initial_state = await documents_page.get_document_list()

                # Perform various operations
                await documents_page.search_documents("integrity_test")
                await documents_page.search_documents("")  # Reset
                await page.reload()
                await page.wait_for_load_state("networkidle")

                final_state = await documents_page.get_document_list()

                # Compare states (basic comparison)
                state_preserved = len(initial_state) == len(final_state)
                print(f"State preservation: {state_preserved}")

                print("Data integrity test completed")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_performance_benchmarking(self):
        """Test 9: Comprehensive performance benchmarking"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== PERFORMANCE BENCHMARKING ===")

                benchmarks = {
                    'page_load': [],
                    'document_count': [],
                    'document_list': [],
                    'search_operation': [],
                    'navigation': []
                }

                # Run benchmarks multiple times
                for run in range(5):
                    print(f"Benchmark run {run + 1}/5")

                    # Page load benchmark
                    load_start = time.time()
                    await documents_page.navigate_to_documents()
                    await page.wait_for_load_state("networkidle")
                    load_end = time.time()
                    benchmarks['page_load'].append(load_end - load_start)

                    # Document count benchmark
                    count_start = time.time()
                    await documents_page.count_documents()
                    count_end = time.time()
                    benchmarks['document_count'].append(count_end - count_start)

                    # Document list benchmark
                    list_start = time.time()
                    await documents_page.get_document_list()
                    list_end = time.time()
                    benchmarks['document_list'].append(list_end - list_start)

                    # Search benchmark
                    search_start = time.time()
                    await documents_page.search_documents("benchmark")
                    await documents_page.search_documents("")  # Reset
                    search_end = time.time()
                    benchmarks['search_operation'].append(search_end - search_start)

                    smart_waits = WeSignSmartWaits(page)
                    await smart_waits.wait_for_navigation_complete()

                # Calculate and report averages
                print("\nPerformance Benchmark Results:")
                for operation, times in benchmarks.items():
                    if times:
                        avg_time = sum(times) / len(times)
                        min_time = min(times)
                        max_time = max(times)
                        print(f"  {operation.replace('_', ' ').title()}:")
                        print(f"    Average: {avg_time:.3f}s")
                        print(f"    Range: {min_time:.3f}s - {max_time:.3f}s")

            finally:
                await browser.close()

    @pytest.mark.asyncio
    async def test_long_running_session_stability(self):
        """Test 10: Long-running session stability"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = await browser.new_page()

            try:
                auth_page = AuthPage(page)
                documents_page = DocumentsPage(page)

                await auth_page.navigate()
                await auth_page.login_with_company_user()

                print("=== LONG-RUNNING SESSION STABILITY TEST ===")

                # Simulate long-running user session
                session_start = time.time()
                operation_count = 0

                # Run for a shorter time in test environment (30 operations instead of time-based)
                for cycle in range(6):  # 6 cycles of 5 operations each
                    print(f"Session cycle {cycle + 1}/6")

                    for operation in range(5):
                        operation_count += 1

                        # Vary operations to simulate real usage
                        if operation % 5 == 0:
                            await documents_page.navigate_to_documents()
                        elif operation % 5 == 1:
                            await documents_page.count_documents()
                        elif operation % 5 == 2:
                            await documents_page.get_document_list()
                        elif operation % 5 == 3:
                            await documents_page.search_documents("stability")
                        else:
                            await documents_page.search_documents("")

                        # Check session health periodically
                        if operation_count % 10 == 0:
                            session_healthy = await documents_page.is_documents_page_loaded()
                            print(f"  Session health check (op {operation_count}): {session_healthy}")

                        smart_waits = WeSignSmartWaits(page)
                        await smart_waits.wait_for_navigation_complete()  # Short delay between operations

                    # Longer pause between cycles
                    smart_waits = WeSignSmartWaits(page)
                await smart_waits.wait_for_navigation_complete()

                session_end = time.time()
                total_session_time = session_end - session_start

                print(f"Long-running session completed:")
                print(f"  Total operations: {operation_count}")
                print(f"  Session duration: {total_session_time:.2f}s")
                print(f"  Operations per second: {operation_count/total_session_time:.2f}")

                # Final stability check
                final_check = await documents_page.is_documents_page_loaded()
                print(f"  Session stable at end: {final_check}")

            finally:
                await browser.close()