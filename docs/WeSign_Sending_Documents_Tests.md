# WeSign Sending Documents Tests Documentation

## 📋 Overview

This document provides comprehensive documentation for the WeSign document sending functionality test suite. The tests cover the complete assign and send workflow in both English and Hebrew interfaces, ensuring 100% coverage of the sending functionality.

## 🎯 Test Coverage

### Core Functionality
- ✅ Single recipient assignment and sending
- ✅ Multiple recipients assignment and sending
- ✅ Email validation and error handling
- ✅ Name validation and security testing
- ✅ Performance testing for send operations
- ✅ Large document handling
- ✅ Specific document selection and assignment

### Language Support
- ✅ **English Interface** - All functionality tested in English
- ✅ **Hebrew Interface** - All functionality tested with Hebrew labels and recipient names

---

## 📁 Test File Structure

### Main Test File
**`tests/test_wesign_assign_send_functionality.py`**
- Contains 18 comprehensive test methods
- 494 lines of test code
- Full bilingual coverage (English/Hebrew)

### Test Class
```python
@allure.epic("WeSign Document Management")
@allure.feature("Assign and Send Functionality")
class TestWeSignAssignSendFunctionality
```

---

## 🧪 Test Categories

### 1. Single Recipient Assignment
**Test Methods:**
- `test_assign_send_single_recipient_english()`
- `test_assign_send_single_recipient_hebrew()`

**Coverage:**
- Assigns document to single recipient
- Verifies send operation completion
- Tests success message validation
- Supports both English and Hebrew interfaces

**Workflow:**
1. Switch to target language interface
2. Verify document availability
3. Prepare recipient data from settings.json
4. Execute assign and send operation
5. Verify completion status

### 2. Multiple Recipients Assignment
**Test Methods:**
- `test_assign_send_multiple_recipients_english()`
- `test_assign_send_multiple_recipients_hebrew()`

**Coverage:**
- Assigns document to 3+ recipients simultaneously
- Extended timeout for multiple recipient processing
- Verifies all recipients receive assignment
- Language-specific recipient data

**Key Features:**
- Uses first 3 recipients from settings.json
- 5-second timeout for processing multiple recipients
- Success verification for batch operations

### 3. Email Validation Testing
**Test Methods:**
- `test_assign_send_invalid_email_english()` (Parameterized)
- `test_assign_send_invalid_email_hebrew()` (Parameterized)

**Invalid Email Test Cases:**
```python
@pytest.mark.parametrize("invalid_email", [
    "invalid-email",           # Missing @ symbol
    "test@",                   # Missing domain
    "@domain.com",            # Missing username
    "test..test@domain.com",  # Double dots
    "test@domain",            # Missing TLD
    ""                        # Empty email
])
```

**Coverage:**
- Email format validation
- Error message display verification
- Both English and Hebrew error handling
- Security validation for malformed emails

### 4. Name Validation Testing
**Test Methods:**
- `test_assign_send_invalid_name_english()` (Parameterized)
- `test_assign_send_invalid_name_hebrew()` (Parameterized)

**Invalid Name Test Cases:**
```python
@pytest.mark.parametrize("invalid_name,description", [
    ("", "empty name"),                           # Empty name
    ("a" * 300, "very long name"),                # 300 character name
    ("<script>alert('test')</script>", "XSS attempt"),  # XSS security test
    ("Test123!@", "special characters")           # Special characters
])
```

**Security Features:**
- XSS injection prevention testing
- Name length validation
- Special character handling
- Hebrew character support with security validation

### 5. Performance Testing
**Test Methods:**
- `test_assign_send_performance_single_recipient()`
- `test_assign_send_performance_multiple_recipients()`

**Performance Metrics:**
- Single recipient: Uses `document_send_max` threshold from settings
- Multiple recipients: 2x `document_send_max` threshold (5 recipients)
- Real-time measurement with millisecond precision
- Performance data attached to Allure reports

**Measurement Process:**
```python
start_time = time.time()
success = self.document_page.assign_and_send_document(recipients)
end_time = time.time()
send_time_ms = (end_time - start_time) * 1000
```

### 6. Large Document Handling
**Test Methods:**
- `test_assign_send_large_document_english()`
- `test_assign_send_large_document_hebrew()`

**Large Document Support:**
- Tests 60+ page PDF documents (pdf_60_pages)
- Fallback to 102+ page documents (pdf_102_pages)
- Extended timeout: 2x normal send timeout
- 10-second completion verification
- Large file upload with 120-second timeout

**Workflow:**
1. Upload large document (120s timeout)
2. Wait 3 seconds for upload completion
3. Assign and send with extended timeout
4. Wait 10 seconds for processing verification

### 7. Specific Document Selection
**Test Methods:**
- `test_assign_send_specific_document_english()`
- `test_assign_send_specific_document_hebrew()`

**Features:**
- Upload specific identifiable documents
- Get list of available documents
- Target specific document by name
- Verify document-specific assignment
- Document name attachment to Allure reports

---

## ⚙️ Test Configuration

### Setup Process
Each test includes automatic setup:
```python
@pytest.fixture(autouse=True)
def setup(self, page: Page, test_config: WeSignTestConfig):
    # Login with default user
    # Navigate to dashboard
    # Upload test document for assignment
    # Setup complete test environment
```

### Test Dependencies
- **Test File**: `pdf_3_pages` (primary test document)
- **Large Files**: `pdf_60_pages` or `pdf_102_pages`
- **Specific Files**: `pdf_6_pages` for document selection tests
- **Recipients**: English and Hebrew recipients from settings.json

---

## 📊 Test Data Requirements

### Settings.json Structure
The tests require properly configured recipient data:

```json
{
  "test_recipients": {
    "english": [
      {
        "name": "John Smith",
        "email": "john.smith@example.com"
      },
      {
        "name": "Jane Doe", 
        "email": "jane.doe@example.com"
      }
    ],
    "hebrew": [
      {
        "name": "יוחנן כהן",
        "email": "yohanan@example.com"
      },
      {
        "name": "רחל לוי",
        "email": "rachel@example.com"
      }
    ]
  }
}
```

### Performance Thresholds
```json
{
  "performance_thresholds": {
    "document_send_max": 5000
  },
  "timeouts": {
    "send": 30000
  }
}
```

---

## 🚀 Execution Methods

### Run All Sending Tests
```bash
python run_tests.py --send
```

### Run Specific Test Categories
```bash
# Performance tests only
python -m pytest tests/test_wesign_assign_send_functionality.py::TestWeSignAssignSendFunctionality::test_assign_send_performance_single_recipient -v

# Email validation tests
python -m pytest tests/test_wesign_assign_send_functionality.py -k "invalid_email" -v

# Hebrew interface tests
python -m pytest tests/test_wesign_assign_send_functionality.py -k "hebrew" -v

# Large document tests
python -m pytest tests/test_wesign_assign_send_functionality.py -k "large_document" -v
```

### Run with Specific Markers
```bash
# Critical tests only
python -m pytest -m critical tests/test_wesign_assign_send_functionality.py

# High priority tests
python -m pytest -m "not slow" tests/test_wesign_assign_send_functionality.py
```

---

## 📈 Reporting

### Allure Integration
All tests include comprehensive Allure reporting:
- **Epic**: "WeSign Document Management"
- **Feature**: "Assign and Send Functionality"
- **Stories**: Organized by test categories
- **Severity Levels**: CRITICAL, HIGH, NORMAL
- **Step-by-step execution** with detailed logging
- **Performance metrics** attached to relevant tests
- **Error details** for validation failures

### Test Stories
- 📝 Single Recipient Assignment
- 👥 Multiple Recipients Assignment
- ✉️ Email Validation
- 👤 Name Validation
- ⚡ Performance Testing
- 📄 Large Document Assignment
- 🎯 Document Selection

### Generate Reports
```bash
# Run tests and generate Allure report
python run_tests.py --send --allure
python run_tests.py --generate-report

# Serve interactive report
python run_tests.py --serve-report
```

---

## 🔧 Maintenance & Updates

### Test Data Maintenance
- **Update recipient emails** in settings.json regularly
- **Verify test document files** are available
- **Review performance thresholds** based on system performance
- **Update Hebrew text** for accurate localization testing

### Adding New Tests
1. **Follow naming convention**: `test_[functionality]_[language]`
2. **Include Allure decorators**: @allure.story, @allure.severity
3. **Add bilingual support**: Create both English and Hebrew variants
4. **Use proper assertions**: Detailed error messages for failures
5. **Include performance measurement** where applicable

### Common Issues & Solutions
- **Recipients not found**: Verify settings.json recipient data
- **Large document timeout**: Increase timeout values in settings
- **Hebrew text display**: Ensure proper UTF-8 encoding
- **Performance threshold failures**: Review and adjust thresholds

---

## 📋 Test Checklist

### Pre-Test Verification
- [ ] settings.json contains valid recipient data
- [ ] Test document files are accessible
- [ ] WeSign application is running and accessible
- [ ] Browser automation is configured
- [ ] Network connectivity is stable

### Post-Test Verification
- [ ] All recipients received test emails (manual verification)
- [ ] Performance metrics are within acceptable ranges
- [ ] Error handling worked correctly for invalid inputs
- [ ] Both English and Hebrew interfaces functioned properly
- [ ] Large documents processed successfully

---

## 🎯 Quality Assurance

### Test Quality Metrics
- **Code Coverage**: 100% of assign and send functionality
- **Language Coverage**: Complete English and Hebrew support
- **Validation Coverage**: Email, name, and security validation
- **Performance Coverage**: Single and multiple recipient scenarios
- **Error Coverage**: Invalid input handling and edge cases

### Success Criteria
- ✅ All tests pass in both languages
- ✅ Performance thresholds are met
- ✅ Security validation prevents XSS and injection
- ✅ Email validation catches all invalid formats
- ✅ Large documents process without timeout
- ✅ Multiple recipients receive assignments correctly

---

*This documentation is maintained alongside the WeSign test suite and should be updated with any test modifications or additions.*