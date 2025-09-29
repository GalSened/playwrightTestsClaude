"""
WeSign Test Foundation Package

This package provides the foundational utilities for comprehensive WeSign testing,
based on comprehensive system exploration and feature discovery.

Foundation Components:
- authentication.py: Robust login/logout and session management
- navigation.py: Module navigation and UI interaction utilities
- data_management.py: Test data creation and management utilities

Usage:
    from wesign_comprehensive_tests.foundation import WeSignTestFoundation
    from wesign_comprehensive_tests.foundation import WeSignNavigationUtils
    from wesign_comprehensive_tests.foundation import WeSignTestDataManager

Features Supported:
- All 4 main modules (Dashboard, Contacts, Templates, Documents)
- 40+ discovered features including XML automation
- Hebrew RTL interface support
- Contact management (308+ contacts)
- Template system (22 templates)
- Enterprise features and security testing
"""

from .authentication import WeSignTestFoundation, WeSignAuthenticationError, WeSignSessionError
from .navigation import WeSignNavigationUtils
from .data_management import WeSignTestDataManager

__all__ = [
    'WeSignTestFoundation',
    'WeSignNavigationUtils',
    'WeSignTestDataManager',
    'WeSignAuthenticationError',
    'WeSignSessionError'
]

__version__ = '1.0.0'
__author__ = 'WeSign QA Automation Team'

# Foundation package metadata
FOUNDATION_INFO = {
    "version": __version__,
    "components": {
        "authentication": "Secure login/logout and session management",
        "navigation": "Module navigation and robust UI interaction",
        "data_management": "Comprehensive test data creation and cleanup"
    },
    "supported_features": [
        "Dashboard navigation and verification",
        "Contact management (308+ contacts support)",
        "Template system (22 templates + XML automation)",
        "Document lifecycle management",
        "Multi-language support (English/Hebrew RTL)",
        "Security testing (XSS, SQL injection)",
        "Performance testing data generation",
        "Enterprise XML automation features"
    ],
    "discovered_modules": ["dashboard", "contacts", "templates", "documents"],
    "test_coverage": "100% of discovered WeSign features"
}