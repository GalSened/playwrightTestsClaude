# QA Intelligence System Tests

This directory contains all tests for the QA Intelligence system, organized by functionality.

## Directory Structure

### 📊 **dashboard/**
Dashboard-related tests (UI, functionality, real-time features)
- `test_dashboard_validation.py` - Main dashboard validation
- `simple_dashboard_check.py` - Quick dashboard health check
- `dashboard_epu_test.py` - End-to-end dashboard testing

### 🔐 **auth/**
Authentication and authorization tests
- Login/logout functionality
- User registration
- Session management
- Security validation

### ⏰ **scheduler/**
Test scheduler functionality
- Scheduler UI tests
- API endpoint tests
- Workflow validation
- E2E scheduler testing

### 🎨 **frontend/**
Frontend UI component tests
- React component testing
- User interface validation
- Cross-browser compatibility
- EPU (End-to-end Performance User) tests

### 🔧 **backend/**
Backend API and service tests
- REST API testing
- Database operations
- Service integration
- Performance testing

### 🤖 **ai-system/**
AI and machine learning system tests
- Intelligent test failure analysis
- Coverage analysis
- Self-healing validation
- AI recommendations testing

### 🔗 **integration/**
Integration and end-to-end tests
- Multi-component workflows
- System integration tests
- Cross-service communication
- Full user journeys

### ✅ **validation/**
General validation and verification tests
- System health checks
- Configuration validation
- Smoke tests
- Regression validation

## Usage Guidelines

### For New Tests
```bash
# Place new tests in appropriate category
qa-intelligence-tests/
├── dashboard/     # <- Dashboard tests go here
├── auth/         # <- Authentication tests go here
└── scheduler/    # <- Scheduler tests go here
```

### Running Tests
```bash
# Run specific category tests
python qa-intelligence-tests/dashboard/test_dashboard_validation.py

# Run all tests in a category
python -m pytest qa-intelligence-tests/auth/

# Quick system validation
python qa-intelligence-tests/validation/simple_validation.py
```

## Important Notes

⚠️ **These tests are for the QA Intelligence system itself**
- Not for testing WeSign application
- WeSign tests belong in `/tests` directory
- Keep system tests separate from application tests

✅ **Best Practices**
- Use descriptive test names
- Add docstrings explaining test purpose
- Include expected vs actual results
- Clean up test data after runs

🔄 **Regular Maintenance**
- Archive obsolete tests
- Update tests when features change
- Keep this README current
- Review test coverage regularly

---
*Last updated: December 2024*
*Total test files organized: 50+*