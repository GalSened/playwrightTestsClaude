# QA Intelligence Test Guidelines

## 🎯 Purpose
This document ensures all QA Intelligence system tests remain organized and maintainable.

## 📁 Where to Put New Tests

### Dashboard Tests → `dashboard/`
```python
# File: qa-intelligence-tests/dashboard/test_new_dashboard_feature.py
def test_dashboard_responsive_design():
    """Test dashboard works on mobile devices"""
    pass

def test_dashboard_real_time_updates():
    """Test dashboard updates automatically"""
    pass
```

### Authentication Tests → `auth/`
```python
# File: qa-intelligence-tests/auth/test_sso_integration.py
def test_single_sign_on():
    """Test SSO login functionality"""
    pass
```

### API Tests → `backend/`
```python
# File: qa-intelligence-tests/backend/test_new_api_endpoint.py
def test_analytics_api():
    """Test analytics API endpoints"""
    pass
```

### UI Tests → `frontend/`
```python
# File: qa-intelligence-tests/frontend/test_component_render.py
def test_test_bank_component():
    """Test TestBank component renders correctly"""
    pass
```

## 🚫 What NOT to Put Here

❌ **WeSign Application Tests**
```python
# WRONG - This belongs in /tests directory
def test_wesign_document_signing():
    """This is for WeSign app, not QA Intelligence system"""
    pass
```

❌ **WeSign UI Tests**
```python
# WRONG - WeSign tests go in /tests
def test_wesign_login_page():
    """WeSign login tests belong elsewhere"""
    pass
```

## ✅ What DOES Belong Here

✅ **QA Intelligence System Features**
```python
# CORRECT - Testing QA Intelligence dashboard
def test_qa_dashboard_loads():
    """Test QA Intelligence dashboard loads correctly"""
    pass

# CORRECT - Testing QA Intelligence scheduler
def test_test_scheduler_ui():
    """Test QA Intelligence scheduler interface"""
    pass
```

## 📝 Naming Conventions

### File Names
- Use descriptive names: `test_dashboard_responsive.py`
- Include feature being tested: `test_scheduler_api_endpoints.py`
- Prefix with `test_` for pytest discovery

### Test Functions
- Start with `test_`: `def test_feature_works():`
- Be specific: `test_dashboard_displays_real_data()`
- Use underscores: `test_auth_login_validation()`

## 🔄 Before Adding New Tests

1. **Check existing tests** - avoid duplicates
2. **Choose correct category** - dashboard/auth/scheduler/etc
3. **Add descriptive docstring** - explain what it tests
4. **Use real data** - no mock data unless necessary
5. **Clean up after test** - don't leave test artifacts

## Example New Test File

```python
# File: qa-intelligence-tests/scheduler/test_advanced_scheduling.py
"""
Advanced Scheduler Testing
Tests for complex scheduling scenarios in QA Intelligence
"""

import asyncio
from playwright.async_api import async_playwright

def test_schedule_multiple_test_suites():
    """
    Test scheduling multiple test suites simultaneously
    
    Validates:
    - UI allows multiple selections
    - Backend processes multiple schedules
    - No conflicts between schedules
    """
    # Test implementation here
    pass

def test_schedule_recurring_tests():
    """
    Test recurring test schedule functionality
    
    Validates:
    - Cron expression parsing
    - Schedule persistence
    - Automatic execution
    """
    # Test implementation here
    pass
```

## 🆘 When in Doubt

If you're unsure where a test belongs:
1. Ask: "Am I testing QA Intelligence system or WeSign app?"
2. QA Intelligence → Use `qa-intelligence-tests/`
3. WeSign app → Use `/tests/` directory
4. Still unsure → Put in `qa-intelligence-tests/validation/` temporarily

---
*Keep tests organized, keep codebase clean! 🧹*