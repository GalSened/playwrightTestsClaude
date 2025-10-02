"""
New conftest using pytest-playwright built-in fixtures
"""
import pytest
from pathlib import Path
import datetime
import os
from src.config.wesign_test_config import WeSignTestConfig
from src.utils.test_helpers import TestHelpers
import allure

# Test configuration
test_configuration = WeSignTestConfig()

def pytest_configure(config):
    """Configure pytest settings"""
    # Import the test config to avoid name collision
    from src.config.wesign_test_config import WeSignTestConfig
    test_config = WeSignTestConfig()
    
    # Create artifacts directory
    artifacts_dir = test_config.create_test_artifacts_dir()
    
    # Add custom markers
    config.addinivalue_line("markers", "smoke: mark test as smoke test")
    config.addinivalue_line("markers", "regression: mark test as regression test")
    config.addinivalue_line("markers", "performance: mark test as performance test")
    config.addinivalue_line("markers", "bilingual: mark test as bilingual test")
    config.addinivalue_line("markers", "upload: mark test as upload functionality test")
    config.addinivalue_line("markers", "merge: mark test as merge functionality test")
    config.addinivalue_line("markers", "send: mark test as send functionality test")

@pytest.fixture(scope="session")
def test_config():
    """Provide test configuration"""
    return test_configuration

@pytest.fixture(scope="function")
def test_helpers(page, test_config):
    """Provide test helpers instance"""
    return TestHelpers(page, test_config)

@pytest.fixture(scope="function")
def authenticated_page(page, test_helpers):
    """Provide authenticated page with logged in user"""
    try:
        # Navigate to base URL
        base_url = test_helpers.config.urls['base_url']
        page.goto(base_url)
        
        # Login with default user
        login_success = test_helpers.login_with_default_user()
        
        if not login_success:
            pytest.fail("Failed to authenticate user")
        
        # Navigate to dashboard
        dashboard_url = test_helpers.config.urls['dashboard']
        page.goto(dashboard_url)
        
        return page
    except Exception as e:
        pytest.fail(f"Failed to create authenticated page: {str(e)}")

@pytest.fixture(scope="function", params=['english', 'hebrew'])
def bilingual_authenticated_page(page, test_helpers, request):
    """Provide authenticated page with language switching"""
    language = request.param
    
    # Navigate to base URL
    base_url = test_helpers.config.urls['base_url']
    page.goto(base_url)
    
    # Login with default user
    login_success = test_helpers.login_with_default_user()
    
    if not login_success:
        pytest.fail("Failed to authenticate user")
    
    # Navigate to dashboard
    dashboard_url = test_helpers.config.urls['dashboard']
    page.goto(dashboard_url)
    
    # Switch to requested language
    from src.pages.wesign_document_page import WeSignDocumentPage
    document_page = WeSignDocumentPage(page, test_helpers.config)
    
    if language == 'hebrew':
        language_switched = document_page.switch_language('hebrew')
        if not language_switched:
            pytest.fail(f"Failed to switch to {language} interface")
    
    # Add language info to allure report
    allure.dynamic.parameter("language", language)
    
    return page, language

@pytest.fixture(scope="function")
def test_files(test_config):
    """Provide test files for upload testing"""
    return {
        'valid_files': test_config.get_valid_test_files(),
        'pdf_files': test_config.get_files_by_type('.pdf'),
        'merge_files': test_config.get_files_for_merge_testing(),
        'large_files': test_config.get_large_files(),
        'invalid_files': test_config.get_invalid_test_data()['unsupported_files']
    }

@pytest.fixture(scope="function")
def test_recipients(test_config, request):
    """Provide test recipients based on language"""
    # Default to English if no language specified
    language = getattr(request, 'param', 'english')
    return test_config.get_test_recipients_for_language(language)

@pytest.fixture(autouse=True)
def screenshot_on_failure(request, page):
    """Automatically take screenshot on test failure"""
    yield
    
    if hasattr(request.node, 'rep_call') and request.node.rep_call.failed:
        # Take screenshot
        screenshot_dir = Path(test_configuration.create_test_artifacts_dir()) / "screenshots"
        timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        screenshot_path = screenshot_dir / f"failure-{request.node.name}-{timestamp}.png"
        
        try:
            page.screenshot(path=str(screenshot_path), full_page=True)
            
            # Attach to Allure report
            allure.attach.file(
                str(screenshot_path),
                name="Screenshot on Failure",
                attachment_type=allure.attachment_type.PNG
            )
        except Exception as e:
            print(f"Failed to take screenshot: {e}")

@pytest.fixture(scope="function")
def performance_tracker():
    """Track performance metrics during tests"""
    metrics = {
        'start_time': datetime.datetime.now(),
        'operations': []
    }
    
    def add_operation(operation_name: str, duration_ms: int):
        metrics['operations'].append({
            'name': operation_name,
            'duration_ms': duration_ms,
            'timestamp': datetime.datetime.now()
        })
    
    metrics['add_operation'] = add_operation
    
    yield metrics
    
    # Log performance metrics
    end_time = datetime.datetime.now()
    total_duration = (end_time - metrics['start_time']).total_seconds() * 1000
    
    # Attach performance report to Allure
    performance_report = f"Total Test Duration: {total_duration:.2f}ms\n"
    performance_report += "Operations:\n"
    
    for op in metrics['operations']:
        performance_report += f"  - {op['name']}: {op['duration_ms']}ms\n"
    
    allure.attach(
        performance_report,
        name="Performance Metrics",
        attachment_type=allure.attachment_type.TEXT
    )

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to capture test results for screenshot fixture"""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)

@pytest.fixture(scope="function")
def cleanup_test_data():
    """Clean up test data after each test"""
    created_documents = []
    uploaded_files = []
    
    def register_document(document_id: str):
        created_documents.append(document_id)
    
    def register_upload(file_path: str):
        uploaded_files.append(file_path)
    
    yield {
        'register_document': register_document,
        'register_upload': register_upload,
        'documents': created_documents,
        'uploads': uploaded_files
    }
    
    # Cleanup logic would go here
    # For now, just log what would be cleaned up
    if created_documents:
        print(f"Would cleanup documents: {created_documents}")
    if uploaded_files:
        print(f"Would cleanup uploaded files: {uploaded_files}")

# Custom pytest options
def pytest_addoption(parser):
    """Add custom command line options"""
    parser.addoption(
        "--language",
        action="store",
        default="both",
        help="Run tests in specific language: english, hebrew, or both"
    )
    parser.addoption(
        "--browser-type",
        action="store", 
        default="chromium",
        help="Browser type: chromium, firefox, or webkit"
    )
    parser.addoption(
        "--headless",
        action="store_true",
        help="Run tests in headless mode"
    )
    parser.addoption(
        "--slow-mo",
        action="store",
        type=int,
        default=500,
        help="Slow down operations by specified milliseconds"
    )

def pytest_collection_modifyitems(config, items):
    """Modify test collection based on command line options"""
    language_option = config.getoption("--language")
    
    if language_option != "both":
        # Filter tests based on language selection
        selected_items = []
        
        for item in items:
            # Check if test is bilingual
            if "bilingual" in [marker.name for marker in item.iter_markers()]:
                # Keep bilingual tests but parameterize for specific language
                if hasattr(item, 'callspec') and hasattr(item.callspec, 'params'):
                    if 'language' in item.callspec.params:
                        if item.callspec.params['language'] == language_option:
                            selected_items.append(item)
                else:
                    selected_items.append(item)
            else:
                # Keep non-bilingual tests
                selected_items.append(item)
        
        items[:] = selected_items

# Allure reporting configuration
@pytest.fixture(scope="session", autouse=True)
def configure_allure():
    """Configure Allure reporting"""
    # Set Allure environment properties
    allure_env = {
        'Environment': test_configuration.get_test_environment(),
        'Browser': 'Chromium',
        'Base URL': test_configuration.urls['base_url'],
        'Test Suite': 'WeSign Comprehensive Test Suite',
        'Language Support': 'English, Hebrew'
    }
    
    # Create environment.properties file for Allure
    artifacts_dir = Path(test_configuration.create_test_artifacts_dir())
    env_file = artifacts_dir / 'environment.properties'
    
    with open(env_file, 'w', encoding='utf-8') as f:
        for key, value in allure_env.items():
            f.write(f'{key}={value}\n')
    
    yield allure_env