"""
WeSign Core Business Workflows Testing Package

This package provides comprehensive testing for WeSign's core business workflows
discovered during comprehensive system exploration.

Core Workflows Covered:
1. XML Template Automation (Enterprise Feature)
2. Document Lifecycle Management
3. Signing Workflows (All 3 Types)

Modules:
- xml_automation.py: Enterprise XML template automation testing
- document_lifecycle.py: Document management and lifecycle testing
- signing_workflows.py: All 3 signing workflows testing

Usage:
    from wesign_comprehensive_tests.core_workflows import TestXMLTemplateAutomation
    from wesign_comprehensive_tests.core_workflows import TestDocumentLifecycle
    from wesign_comprehensive_tests.core_workflows import TestSigningWorkflows

Features Tested:
- XML template placeholder system with automated data population
- Document status management (7 categories) and lifecycle transitions
- Document editor with 10 field types (Text, Signature, Email, etc.)
- File merging system (2-5 documents)
- All 3 signing workflows: Myself (self-signing), Others (multi-recipient), Live (co-browsing)
- Communication methods (Email/SMS) with known bug reproduction
- Contact integration and advanced workflow features
- Security testing for XML injection and malicious content
"""

from .xml_automation import TestXMLTemplateAutomation
from .document_lifecycle import TestDocumentLifecycle
from .signing_workflows import TestSigningWorkflows

__all__ = [
    'TestXMLTemplateAutomation',
    'TestDocumentLifecycle',
    'TestSigningWorkflows'
]

__version__ = '1.0.0'
__author__ = 'WeSign QA Automation Team'

# Core workflows package metadata
CORE_WORKFLOWS_INFO = {
    "version": __version__,
    "components": {
        "xml_automation": "Enterprise XML template automation testing",
        "document_lifecycle": "Document management and lifecycle testing",
        "signing_workflows": "Comprehensive signing workflow testing"
    },
    "discovered_features": {
        "xml_automation": [
            "Template placeholder system",
            "XML data population",
            "Automated document generation",
            "Security validation for XML injection"
        ],
        "document_lifecycle": [
            "7 document status categories",
            "10 document editor field types",
            "File merging system (2-5 documents)",
            "Multi-format support (PDF, DOC, DOCX, JPG, PNG)"
        ],
        "signing_workflows": [
            "Myself workflow (self-signing with certificate auth)",
            "Others workflow (multi-recipient with Email/SMS)",
            "Live workflow (co-browsing collaboration)",
            "JavaScript error reproduction and testing"
        ]
    },
    "critical_discoveries": [
        "Enterprise XML automation system for template placeholders",
        "JavaScript error in Others workflow SMS switching",
        "Co-browsing technology for real-time collaboration",
        "10 comprehensive document editor field types",
        "File merging capability for 2-5 documents"
    ],
    "test_coverage": "100% of discovered core business workflows"
}