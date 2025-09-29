"""
WeSign Advanced Features Testing Package

This package provides comprehensive testing for WeSign's advanced features
discovered during comprehensive system exploration.

Advanced Features Covered:
1. File Merging System (2-5 documents)
2. Search and Filtering Capabilities
3. Dashboard Integration Workflows
4. Multi-format Processing

Modules:
- file_merging.py: Document merging system testing (2-5 documents)
- search_filtering.py: Advanced search and filtering capabilities
- dashboard_integration.py: Dashboard workflow integration testing

Usage:
    from wesign_comprehensive_tests.advanced_features import TestFileMerging
    from wesign_comprehensive_tests.advanced_features import TestSearchFiltering
    from wesign_comprehensive_tests.advanced_features import TestDashboardIntegration

Features Tested:
- Multi-document merging workflows (2-5 documents simultaneously)
- Advanced search across all modules (Documents, Templates, Contacts)
- Filtering capabilities with multiple criteria
- Dashboard integration with all discovered modules
- Cross-module workflow testing
- Performance testing for advanced operations
"""

from .file_merging import TestFileMerging
from .search_filtering import TestSearchFiltering
from .dashboard_integration import TestDashboardIntegration

__all__ = [
    'TestFileMerging',
    'TestSearchFiltering',
    'TestDashboardIntegration'
]

__version__ = '1.0.0'
__author__ = 'WeSign QA Automation Team'

# Advanced features package metadata
ADVANCED_FEATURES_INFO = {
    "version": __version__,
    "components": {
        "file_merging": "Multi-document merging system testing (2-5 documents)",
        "search_filtering": "Advanced search and filtering capabilities testing",
        "dashboard_integration": "Dashboard workflow integration testing"
    },
    "discovered_features": {
        "file_merging": [
            "Multi-document merging (2-5 documents)",
            "Cross-format merging support",
            "Merge order management",
            "Output format configuration"
        ],
        "search_filtering": [
            "Global search across all modules",
            "Advanced filtering with multiple criteria",
            "Search within documents/templates/contacts",
            "Filter by status, date, type, user"
        ],
        "dashboard_integration": [
            "Dashboard navigation workflows",
            "Module integration testing",
            "Cross-module data flow",
            "Dashboard analytics and reporting"
        ]
    },
    "critical_discoveries": [
        "File merging system supports 2-5 documents simultaneously",
        "Advanced search spans all WeSign modules",
        "Dashboard serves as central integration hub",
        "Cross-module workflows enable complex business processes"
    ],
    "test_coverage": "100% of discovered advanced features and integrations"
}