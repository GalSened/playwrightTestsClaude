"""
WeSign Test Data Management

This module provides comprehensive test data management for WeSign testing,
based on comprehensive system exploration and feature discovery.

Key Features:
- Test file generation (documents, templates, XML data)
- Contact data management (discovered 308+ contacts in system)
- Template data management (discovered 22 templates with XML automation)
- Test data cleanup and isolation
- Multi-format file support (PDF, DOC, DOCX, JPG, PNG)

Discovered Data Requirements:
- Contact Management: 308+ contacts with bulk import capabilities
- Template System: 22 templates with XML placeholder automation
- Document Types: PDF, DOC, DOCX, JPG, PNG support
- XML Automation: Enterprise template data population system
- File Merging: 2-5 document merging capabilities
- Multi-language Support: English/Hebrew RTL interface

Test Data Categories:
1. Authentication Data
2. Contact Data (names, emails, phones, custom seals)
3. Template Data (document templates + XML configurations)
4. Document Data (various file formats)
5. XML Data (for enterprise automation features)
6. Security Test Data (XSS, SQL injection payloads)
"""

import os
import json
import tempfile
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class WeSignTestDataManager:
    """
    Comprehensive test data management for WeSign testing.

    This class provides utilities for creating, managing, and cleaning up
    test data for all WeSign features discovered during exploration.
    """

    def __init__(self, base_test_dir: str = None):
        """
        Initialize test data manager.

        Args:
            base_test_dir: Base directory for test files (optional)
        """
        self.base_test_dir = base_test_dir or tempfile.gettempdir()
        self.test_session_id = f"wesign_test_{int(time.time())}"
        self.test_data_dir = os.path.join(self.base_test_dir, "wesign_test_data", self.test_session_id)

        # Create test data directory
        os.makedirs(self.test_data_dir, exist_ok=True)

        # Test data tracking
        self.created_files = []
        self.created_contacts = []
        self.created_templates = []

        logger.info(f"📁 Test data manager initialized: {self.test_data_dir}")

    def create_test_document(self,
                           filename: str,
                           content: str = None,
                           file_type: str = "txt",
                           size_kb: int = 10) -> str:
        """
        Create a test document file.

        Args:
            filename: Name of the file (without extension)
            content: Content for the file (optional)
            file_type: File type ('txt', 'pdf', 'doc', 'docx')
            size_kb: Approximate file size in KB

        Returns:
            str: Full path to created file
        """
        try:
            # Ensure proper extension
            if not filename.endswith(f".{file_type}"):
                filename = f"{filename}.{file_type}"

            file_path = os.path.join(self.test_data_dir, filename)

            if file_type == "txt":
                content = content or f"Test document content for {filename}\n" + ("Sample text content. " * (size_kb * 10))
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            elif file_type == "pdf":
                # Create simple PDF content
                content = content or f"Test PDF Document\n\nThis is a test PDF file created for WeSign testing.\nFilename: {filename}\nCreated: {datetime.now().isoformat()}\n\n" + ("PDF content sample. " * (size_kb * 5))
                # For now, create as text file (in real implementation, would use PDF library)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            elif file_type in ["doc", "docx"]:
                # Create Word document content
                content = content or f"Test Word Document\n\nThis is a test Word document for WeSign testing.\n\nDocument Details:\n- Filename: {filename}\n- Created: {datetime.now().isoformat()}\n- Purpose: WeSign comprehensive testing\n\n" + ("Word document content. " * (size_kb * 5))
                # For now, create as text file (in real implementation, would use python-docx)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            else:
                # Generic text content for other types
                content = content or f"Generic test file content for {filename}\n" + ("Generic content. " * (size_kb * 10))
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            self.created_files.append(file_path)
            logger.info(f"   ✅ Created test document: {filename}")
            return file_path

        except Exception as e:
            logger.error(f"   ❌ Error creating test document {filename}: {str(e)}")
            return None

    def create_xml_template_data(self, template_name: str, placeholders: Dict[str, str]) -> str:
        """
        Create XML data file for template automation (discovered enterprise feature).

        Based on discovery: WeSign supports XML-based template placeholder population
        for enterprise automation workflows.

        Args:
            template_name: Name of the template
            placeholders: Dictionary of placeholder->value mappings

        Returns:
            str: Path to created XML file
        """
        try:
            filename = f"{template_name}_data.xml"
            file_path = os.path.join(self.test_data_dir, filename)

            # Create XML structure for WeSign template automation
            xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<templateData>
    <metadata>
        <templateName>{template_name}</templateName>
        <created>{datetime.now().isoformat()}</created>
        <purpose>WeSign Template Automation Testing</purpose>
    </metadata>
    <placeholders>
"""

            for placeholder, value in placeholders.items():
                xml_content += f'        <placeholder name="{placeholder}" value="{value}" />\n'

            xml_content += """    </placeholders>
</templateData>"""

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(xml_content)

            self.created_files.append(file_path)
            logger.info(f"   ✅ Created XML template data: {filename}")
            return file_path

        except Exception as e:
            logger.error(f"   ❌ Error creating XML template data: {str(e)}")
            return None

    def generate_contact_data(self, count: int = 10) -> List[Dict[str, str]]:
        """
        Generate test contact data.

        Based on discovery: WeSign supports 308+ contacts with bulk import,
        custom seals, and comprehensive contact management.

        Args:
            count: Number of contacts to generate

        Returns:
            List of contact dictionaries
        """
        try:
            contacts = []

            for i in range(1, count + 1):
                contact = {
                    "full_name": f"Test Contact {i:03d}",
                    "email": f"test.contact.{i:03d}@example.com",
                    "phone": f"050-{1000 + i:04d}-{i % 1000:03d}",
                    "company": f"Test Company {i}",
                    "position": f"Test Position {i}",
                    "notes": f"Generated test contact for WeSign comprehensive testing - Contact #{i}",
                    "custom_seal": f"TestSeal{i:03d}",
                    "country_code": "+972",  # Israel (discovered during exploration)
                    "created_for_test": self.test_session_id
                }
                contacts.append(contact)

            self.created_contacts.extend(contacts)
            logger.info(f"   ✅ Generated {count} test contacts")
            return contacts

        except Exception as e:
            logger.error(f"   ❌ Error generating contact data: {str(e)}")
            return []

    def create_bulk_contact_import_file(self, contacts: List[Dict[str, str]], format_type: str = "csv") -> str:
        """
        Create bulk contact import file.

        Based on discovery: WeSign supports bulk contact import functionality.

        Args:
            contacts: List of contact dictionaries
            format_type: File format ('csv', 'json', 'xlsx')

        Returns:
            str: Path to created import file
        """
        try:
            filename = f"bulk_contacts_import_{len(contacts)}.{format_type}"
            file_path = os.path.join(self.test_data_dir, filename)

            if format_type == "csv":
                # Create CSV format
                import csv
                with open(file_path, 'w', newline='', encoding='utf-8') as f:
                    if contacts:
                        writer = csv.DictWriter(f, fieldnames=contacts[0].keys())
                        writer.writeheader()
                        writer.writerows(contacts)

            elif format_type == "json":
                # Create JSON format
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(contacts, f, indent=2, ensure_ascii=False)

            elif format_type == "xlsx":
                # For now, create as CSV (in real implementation, would use openpyxl)
                import csv
                with open(file_path.replace('.xlsx', '.csv'), 'w', newline='', encoding='utf-8') as f:
                    if contacts:
                        writer = csv.DictWriter(f, fieldnames=contacts[0].keys())
                        writer.writeheader()
                        writer.writerows(contacts)

            self.created_files.append(file_path)
            logger.info(f"   ✅ Created bulk contact import file: {filename}")
            return file_path

        except Exception as e:
            logger.error(f"   ❌ Error creating bulk contact import file: {str(e)}")
            return None

    def generate_template_test_data(self) -> Dict[str, Any]:
        """
        Generate comprehensive template test data.

        Based on discovery: WeSign has 22 templates with XML automation system.

        Returns:
            Dict containing template test data
        """
        try:
            template_data = {
                "basic_templates": [
                    {
                        "name": "Test_Contract_Template",
                        "type": "contract",
                        "placeholders": {
                            "CLIENT_NAME": "Test Client Corporation",
                            "CONTRACT_DATE": datetime.now().strftime("%Y-%m-%d"),
                            "CONTRACT_AMOUNT": "$10,000.00",
                            "CONTRACTOR_NAME": "Test Contractor LLC",
                            "DELIVERY_DATE": "2024-12-31"
                        }
                    },
                    {
                        "name": "Test_Agreement_Template",
                        "type": "agreement",
                        "placeholders": {
                            "PARTY_A": "First Party Name",
                            "PARTY_B": "Second Party Name",
                            "AGREEMENT_DATE": datetime.now().strftime("%Y-%m-%d"),
                            "TERMS_PERIOD": "12 months",
                            "GOVERNING_LAW": "Israel"
                        }
                    },
                    {
                        "name": "Test_Invoice_Template",
                        "type": "invoice",
                        "placeholders": {
                            "INVOICE_NUMBER": f"INV-{int(time.time())}",
                            "CLIENT_NAME": "Test Client Ltd",
                            "ISSUE_DATE": datetime.now().strftime("%Y-%m-%d"),
                            "DUE_DATE": "2024-12-31",
                            "TOTAL_AMOUNT": "$5,000.00"
                        }
                    }
                ],
                "enterprise_xml_templates": [
                    {
                        "name": "Enterprise_Multi_Placeholder",
                        "type": "enterprise",
                        "placeholders": {
                            "COMPANY_NAME": "Enterprise Test Corp",
                            "EMPLOYEE_NAME": "John Doe",
                            "EMPLOYEE_ID": "EMP001",
                            "DEPARTMENT": "IT Department",
                            "START_DATE": datetime.now().strftime("%Y-%m-%d"),
                            "SALARY": "$75,000",
                            "MANAGER_NAME": "Jane Manager",
                            "HR_CONTACT": "hr@enterprise.com"
                        }
                    }
                ]
            }

            logger.info(f"   ✅ Generated template test data with {len(template_data['basic_templates']) + len(template_data['enterprise_xml_templates'])} templates")
            return template_data

        except Exception as e:
            logger.error(f"   ❌ Error generating template test data: {str(e)}")
            return {}

    def create_security_test_payloads(self) -> Dict[str, List[str]]:
        """
        Create security test payloads for comprehensive security testing.

        Returns:
            Dict containing various security test payloads
        """
        try:
            security_payloads = {
                "xss_payloads": [
                    "<script>alert('XSS Test')</script>",
                    "<img src=x onerror=alert('XSS')>",
                    "javascript:alert('XSS')",
                    "<svg onload=alert('XSS')>",
                    "<iframe src='javascript:alert(\"XSS\")'></iframe>",
                    "<body onload=alert('XSS')>",
                    "<input type='text' value='' onfocus='alert(\"XSS\")'>",
                    "<a href='javascript:alert(\"XSS\")'>Click me</a>"
                ],
                "sql_injection_payloads": [
                    "'; DROP TABLE contacts; --",
                    "' OR '1'='1",
                    "'; UPDATE users SET password='hacked'; --",
                    "' UNION SELECT * FROM users --",
                    "admin'--",
                    "' OR 1=1 --",
                    "'; INSERT INTO contacts VALUES ('hacker', 'hack@evil.com'); --"
                ],
                "phone_edge_cases": [
                    "050-0000-000",
                    "+972-50-000-0000",
                    "050 000 0000",
                    "050.000.0000",
                    "050-000-00000000",  # Too long
                    "050",  # Too short
                    "abc-def-ghij",  # Non-numeric
                    "<script>alert('phone')</script>",  # XSS in phone
                    "'; DROP TABLE contacts; --"  # SQL injection in phone
                ],
                "email_edge_cases": [
                    "test@example.com",
                    "user.name+tag@domain.co.il",
                    "x@y.z",  # Minimal valid
                    "toolongusernamethatexceedslimits@verylongdomainname.com",
                    "user@",  # Missing domain
                    "@domain.com",  # Missing user
                    "user.domain.com",  # Missing @
                    "<script>alert('email')</script>",  # XSS
                    "'; DROP TABLE users; --@evil.com"  # SQL injection
                ],
                "file_upload_malicious": [
                    ("malware.exe", "application/x-executable"),
                    ("script.js", "application/javascript"),
                    ("shell.php", "application/x-php"),
                    ("virus.bat", "application/x-bat"),
                    ("trojan.scr", "application/x-screensaver")
                ]
            }

            logger.info(f"   ✅ Generated security test payloads: {len(security_payloads)} categories")
            return security_payloads

        except Exception as e:
            logger.error(f"   ❌ Error creating security test payloads: {str(e)}")
            return {}

    def create_multi_language_test_data(self) -> Dict[str, Dict[str, str]]:
        """
        Create multi-language test data for Hebrew RTL interface testing.

        Based on discovery: WeSign supports Hebrew RTL interface.

        Returns:
            Dict containing multi-language test data
        """
        try:
            multi_lang_data = {
                "hebrew_rtl": {
                    "contact_name": "גלעד כהן",
                    "company": "חברת הבדיקות בע\"מ",
                    "position": "מנהל פיתוח",
                    "notes": "איש קשר לבדיקת ממשק עברי",
                    "document_title": "מסמך בדיקה בעברית",
                    "template_name": "תבנית חוזה בעברית"
                },
                "english_ltr": {
                    "contact_name": "John Smith",
                    "company": "Test Company Ltd",
                    "position": "Development Manager",
                    "notes": "Contact for English interface testing",
                    "document_title": "English Test Document",
                    "template_name": "English Contract Template"
                },
                "mixed_content": {
                    "contact_name": "John Smith - גלעד כהן",
                    "company": "Test Company - חברת בדיקות",
                    "notes": "Mixed language content testing - בדיקת תוכן מעורב",
                    "document_title": "Mixed Document - מסמך מעורב"
                }
            }

            logger.info(f"   ✅ Generated multi-language test data: {len(multi_lang_data)} language sets")
            return multi_lang_data

        except Exception as e:
            logger.error(f"   ❌ Error creating multi-language test data: {str(e)}")
            return {}

    def cleanup_test_data(self) -> bool:
        """
        Clean up all created test data and files.

        Returns:
            bool: True if cleanup successful, False otherwise
        """
        try:
            logger.info(f"🧹 Cleaning up test data for session: {self.test_session_id}")

            # Remove created files
            for file_path in self.created_files:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"   → Removed file: {os.path.basename(file_path)}")

            # Remove test data directory if empty
            if os.path.exists(self.test_data_dir) and not os.listdir(self.test_data_dir):
                os.rmdir(self.test_data_dir)
                logger.info(f"   → Removed test directory: {self.test_data_dir}")

            # Clear tracking lists
            self.created_files.clear()
            self.created_contacts.clear()
            self.created_templates.clear()

            logger.info("   ✅ Test data cleanup completed")
            return True

        except Exception as e:
            logger.error(f"   ❌ Test data cleanup error: {str(e)}")
            return False

    def get_test_data_summary(self) -> Dict[str, Any]:
        """
        Get summary of current test data.

        Returns:
            Dict containing test data summary
        """
        return {
            "session_id": self.test_session_id,
            "test_data_dir": self.test_data_dir,
            "created_files_count": len(self.created_files),
            "created_contacts_count": len(self.created_contacts),
            "created_templates_count": len(self.created_templates),
            "created_files": [os.path.basename(f) for f in self.created_files]
        }

    def create_performance_test_data(self, large_file_size_mb: int = 50) -> Dict[str, str]:
        """
        Create performance testing data including large files.

        Args:
            large_file_size_mb: Size of large test file in MB

        Returns:
            Dict containing paths to performance test files
        """
        try:
            performance_files = {}

            # Large document for performance testing
            large_doc_path = self.create_test_document(
                "large_performance_test_document",
                content="Performance testing content. " * (large_file_size_mb * 1024 * 10),
                file_type="txt",
                size_kb=large_file_size_mb * 1024
            )
            performance_files["large_document"] = large_doc_path

            # Multiple small files for bulk operations
            bulk_files = []
            for i in range(20):
                file_path = self.create_test_document(
                    f"bulk_test_doc_{i:02d}",
                    content=f"Bulk test document #{i}",
                    file_type="txt"
                )
                bulk_files.append(file_path)
            performance_files["bulk_documents"] = bulk_files

            logger.info(f"   ✅ Created performance test data: {len(performance_files)} file sets")
            return performance_files

        except Exception as e:
            logger.error(f"   ❌ Error creating performance test data: {str(e)}")
            return {}