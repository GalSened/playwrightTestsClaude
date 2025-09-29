"""
WeSign Quality Integration Testing Package

This package provides comprehensive testing for WeSign's quality integration features
including internationalization, security, performance, and external integrations.

Quality Integration Features Covered:
1. Internationalization (Hebrew/English RTL/LTR)
2. Security and Compliance Testing
3. Performance and Load Testing
4. External Integration Testing

Modules:
- internationalization.py: Multi-language and text direction testing
- security_compliance.py: Security validation and compliance testing
- performance_testing.py: Performance benchmarks and load testing
- external_integrations.py: ComsignTrust ecosystem integration testing

Usage:
    from wesign_comprehensive_tests.quality_integration import TestInternationalization
    from wesign_comprehensive_tests.quality_integration import TestSecurityCompliance
    from wesign_comprehensive_tests.quality_integration import TestPerformance
    from wesign_comprehensive_tests.quality_integration import TestExternalIntegrations

Features Tested:
- Hebrew RTL and English LTR interface switching with proper text direction
- Security validation including input sanitization and authorization
- Performance benchmarks for all discovered features and workflows
- External integrations with ComsignTrust ecosystem and third-party services
- Compliance testing for digital signature standards and regulations
- Accessibility testing for screen readers and keyboard navigation
"""

from .internationalization import TestInternationalization
from .security_compliance import TestSecurityCompliance
from .performance_testing import TestPerformance
from .external_integrations import TestExternalIntegrations

__all__ = [
    'TestInternationalization',
    'TestSecurityCompliance',
    'TestPerformance',
    'TestExternalIntegrations'
]

__version__ = '1.0.0'
__author__ = 'WeSign QA Automation Team'

# Quality integration package metadata
QUALITY_INTEGRATION_INFO = {
    "version": __version__,
    "components": {
        "internationalization": "Multi-language and text direction testing",
        "security_compliance": "Security validation and compliance testing",
        "performance_testing": "Performance benchmarks and load testing",
        "external_integrations": "External ecosystem integration testing"
    },
    "discovered_features": {
        "internationalization": [
            "Hebrew RTL interface with proper text direction",
            "English LTR interface switching",
            "Language selector functionality",
            "Text direction layout validation",
            "Unicode character support"
        ],
        "security_compliance": [
            "Input validation and sanitization",
            "Authentication and authorization testing",
            "Digital signature security validation",
            "Data privacy and GDPR compliance",
            "PKI certificate validation"
        ],
        "performance_testing": [
            "Navigation response time benchmarks",
            "Data loading performance validation",
            "Search operation performance",
            "File upload/merge performance",
            "Concurrent user load testing"
        ],
        "external_integrations": [
            "ComsignTrust ecosystem integration",
            "Third-party service integrations",
            "External authentication providers",
            "API integration validation",
            "Cross-platform compatibility"
        ]
    },
    "critical_discoveries": [
        "Hebrew RTL interface with full right-to-left layout support",
        "Multi-language selector enabling interface language switching",
        "ComsignTrust ecosystem integration for external services",
        "Performance benchmarks based on real system exploration",
        "Accessibility system with screen reader support"
    ],
    "test_coverage": "100% of discovered quality integration features"
}