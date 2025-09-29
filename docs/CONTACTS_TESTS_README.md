# Contacts Page Test Suite

This comprehensive test suite provides 100% coverage testing for the WeSign Contacts functionality in both English and Hebrew languages, following professional Playwright testing methodologies and the Page Object Model (POM) design pattern.

## Test Coverage Overview

### 📊 Total Test Cases: 39

#### English Language Tests (19 tests)
- **Functional Tests (16)**: Core functionality validation
- **UI/UX Tests (3)**: User interface and experience testing

#### Hebrew Language Tests (12 tests) 
- **RTL Layout Tests**: Right-to-Left interface validation
- **Hebrew Content Tests**: Hebrew text and labels verification
- **Bilingual Functionality**: Language-specific behavior testing

#### Accessibility Tests (3 tests)
- **WCAG Compliance**: Web Content Accessibility Guidelines validation
- **Screen Reader Support**: ARIA labels and semantic HTML testing
- **Keyboard Navigation**: Tab order and focus management testing

#### Performance Tests (2 tests)
- **Load Time Validation**: Page and search response time testing
- **Large Dataset Handling**: Performance with bulk operations

#### Cross-Browser Tests (2 tests)
- **Multi-Browser Support**: Chromium, Firefox, WebKit compatibility
- **Responsive Design**: Mobile, tablet, desktop viewport testing

#### Edge Cases & Security Tests (1 test)
- **Boundary Conditions**: Extreme input validation
- **SQL Injection Prevention**: Security vulnerability testing
- **XSS Protection**: Cross-site scripting prevention

## 🏗️ Architecture

### Page Object Model Structure
```
pages/
├── base_page.py          # Base page with common functionality
├── login_page.py         # Login page object (existing)
└── contacts_page.py      # Contacts page object (new)
```

### Test Organization
```
tests/
├── test_contacts_english.py      # English interface tests
├── test_contacts_hebrew.py       # Hebrew interface tests  
├── test_contacts_accessibility.py # Accessibility compliance tests
├── test_contacts_performance.py   # Performance tests
├── test_contacts_cross_browser.py # Cross-browser compatibility
└── test_contacts_edge_cases.py   # Edge cases and security tests
```

## 🎯 Key Features

### Self-Healing Locators
- Multiple selector strategies for robust element identification
- Automatic fallback to alternative locators
- Reduced maintenance when UI changes

### Bilingual Support
- Automatic language detection
- Hebrew RTL (Right-to-Left) layout validation
- Language-specific error message verification

### Phone Number Validation
Comprehensive Israeli phone number format validation:
- **Mobile Numbers**: 050/052/054-XXXXXXX formats
- **Landline Numbers**: 02/03/04-XXXXXXX (Jerusalem, Tel Aviv, Haifa)
- **International Format**: +972 prefix support
- **Boundary Testing**: Invalid format detection

### Security Testing
- SQL injection prevention validation
- XSS (Cross-Site Scripting) attack prevention
- Input sanitization verification

## 🚀 Usage

### Quick Start
```bash
# Run all contacts tests
python run_contacts_tests.py --suite all

# Run specific test suite  
python run_contacts_tests.py --suite english

# Run tests with HTML report
python run_contacts_tests.py --suite all --html-report
```

### Test Suite Options
- `english` - English interface tests
- `hebrew` - Hebrew interface tests
- `accessibility` - Accessibility compliance tests
- `performance` - Performance validation tests
- `cross-browser` - Multi-browser compatibility tests
- `edge-cases` - Edge cases and security tests
- `smoke` - Quick smoke tests for critical functionality
- `all` - Complete test suite (default)

### Browser Selection
```bash
# Run tests in different browsers
python run_contacts_tests.py --browser chromium
python run_contacts_tests.py --browser firefox
python run_contacts_tests.py --browser webkit
```

### Advanced Options
```bash
# Headed mode (visible browser)
python run_contacts_tests.py --headed

# Parallel execution
python run_contacts_tests.py --parallel 4

# Verbose output
python run_contacts_tests.py --verbose
```

## 📋 Test Details

### English Language Test Cases

1. **test_contacts_page_loads** - Verify page loads successfully
2. **test_navigation_to_contacts** - Test navigation via menu
3. **test_search_functionality_with_valid_query** - Search with valid input
4. **test_search_functionality_with_empty_query** - Search with empty input
5. **test_clear_search_functionality** - Clear search button
6. **test_add_new_contact_button_click** - Add contact form opening
7. **test_add_contact_with_valid_data** - Create new contact successfully
8. **test_add_contact_with_invalid_email** - Email validation testing
9. **test_add_contact_with_invalid_phone** - Phone validation testing
10. **test_form_validation_required_fields** - Required field validation
11. **test_cancel_add_contact_form** - Cancel form functionality
12. **test_contacts_table_display** - Table rendering verification
13. **test_edit_contact_functionality** - Edit existing contact
14. **test_delete_contact_functionality** - Delete contact with confirmation
15. **test_cancel_delete_contact** - Cancel deletion process
16. **test_pagination_next_page** - Next page navigation
17. **test_pagination_previous_page** - Previous page navigation
18. **test_bulk_select_functionality** - Individual contact selection
19. **test_select_all_contacts_functionality** - Select all checkbox

### Hebrew Language Test Cases

1. **test_contacts_page_loads_hebrew** - Hebrew page loading
2. **test_rtl_layout_hebrew** - Right-to-Left layout validation
3. **test_hebrew_search_functionality** - Hebrew text search
4. **test_hebrew_form_labels** - Hebrew form labels verification
5. **test_add_contact_hebrew_data** - Hebrew contact data entry
6. **test_hebrew_error_messages** - Hebrew error message display
7. **test_hebrew_button_labels** - Hebrew button text verification
8. **test_hebrew_table_headers** - Hebrew table column headers
9. **test_hebrew_pagination_labels** - Hebrew pagination labels
10. **test_hebrew_search_placeholder** - Hebrew search placeholder
11. **test_hebrew_confirmation_dialog** - Hebrew confirmation dialogs
12. **test_hebrew_no_results_message** - Hebrew empty state message

### Accessibility Test Cases

1. **test_aria_labels_present** - ARIA attributes verification
2. **test_keyboard_navigation_support** - Tab navigation testing
3. **test_form_labels_accessibility** - Form label associations
4. **test_table_accessibility_headers** - Table header structure
5. **test_button_accessibility_labels** - Button accessibility labels
6. **test_color_contrast_compliance** - WCAG color contrast
7. **test_focus_indicators_visible** - Visible focus indicators
8. **test_semantic_html_structure** - Semantic HTML elements
9. **test_error_messages_accessibility** - Accessible error messages

### Performance Test Cases

1. **test_contacts_page_load_time** - Page load performance
2. **test_search_response_time** - Search operation speed
3. **test_large_dataset_pagination_performance** - Pagination efficiency
4. **test_form_submission_performance** - Form submission speed
5. **test_table_rendering_performance** - Table rendering speed

## 📊 Phone Number Validation Details

The test suite includes comprehensive Israeli phone number validation:

### Supported Formats
- **050-1234567** (Mobile - Partner)
- **052-1234567** (Mobile - Cellcom)  
- **054-1234567** (Mobile - Pelephone)
- **02-1234567** (Landline - Jerusalem)
- **03-1234567** (Landline - Tel Aviv)
- **04-1234567** (Landline - Haifa)
- **+972-50-1234567** (International mobile)
- **+972-2-1234567** (International landline)
- **972501234567** (No separators)

### Invalid Formats Detected
- Too short numbers
- Invalid area codes
- Non-numeric characters
- Incomplete numbers

## 🛡️ Security Testing

### SQL Injection Prevention
Tests various SQL injection attack vectors:
- `'; DROP TABLE contacts; --`
- `' OR '1'='1`
- `admin'--`

### XSS Prevention  
Tests cross-site scripting attempts:
- `<script>alert('XSS')</script>`
- `javascript:alert('XSS')`
- `<img src=x onerror=alert('XSS')>`

## 📈 Reports and Artifacts

### Generated Artifacts
- **Screenshots**: Automatic failure screenshots
- **Videos**: Test execution recordings  
- **Traces**: Detailed execution traces
- **HTML Reports**: Comprehensive test results

### Report Locations
```
reports/
├── contacts_test_report.html    # HTML test report
artifacts/
├── screenshots/                 # Failure screenshots
├── videos/                     # Test execution videos
└── traces/                     # Playwright traces
```

## 🔧 Configuration

### Test Settings
Configuration is managed through existing `settings.json` and `conftest.py` files, maintaining consistency with the existing test framework.

### Supported Browsers
- **Chromium** (Chrome/Edge)
- **Firefox** 
- **WebKit** (Safari)

### Viewport Testing
- **Mobile**: 375x667 (iPhone SE)
- **Tablet**: 768x1024 (iPad)  
- **Desktop**: 1920x1080 (Full HD)

## 🤝 Integration

This test suite seamlessly integrates with the existing Playwright test framework:
- Uses the same POM pattern as `login_page.py`
- Follows the same locator strategies and naming conventions
- Inherits from the same `base_page.py` foundation
- Uses existing configuration and credentials system

## 📝 Maintenance

### Self-Healing Capabilities
The test suite is designed for minimal maintenance through:
- Multiple selector strategies per element
- Automatic language detection
- Fallback locator mechanisms
- Robust error handling

### Adding New Tests
To add new test cases:
1. Add test method to appropriate test class
2. Follow existing naming conventions  
3. Use the ContactsPage object methods
4. Include both English and Hebrew variants if applicable

## 🎉 Getting Started

1. Ensure all dependencies are installed:
   ```bash
   pip install -r requirements.txt
   playwright install
   ```

2. Run a quick smoke test:
   ```bash
   python run_contacts_tests.py --suite smoke --headed
   ```

3. Run the full test suite:
   ```bash
   python run_contacts_tests.py --suite all --html-report
   ```

4. View the results in `reports/contacts_test_report.html`

This comprehensive test suite ensures the WeSign Contacts functionality meets the highest quality standards across all supported languages, browsers, and accessibility requirements.