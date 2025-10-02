import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional


class WeSignTestConfig:
    """Configuration class for WeSign test suite"""
    
    def __init__(self, settings_file_path: str = None):
        """
        Initialize test configuration
        
        Args:
            settings_file_path: Path to settings.json file
        """
        # Default paths - go up to project root (two levels up from src/config)
        self.base_dir = Path(__file__).parent.parent.parent
        self.settings_file = settings_file_path or self.base_dir / "settings.json"
        
        # Load settings
        self.settings = self._load_settings()
        
        # Test configuration
        self.test_timeouts = {
            'default': 30000,
            'upload': 120000,
            'merge': 60000,
            'send': 90000,
            'login': 15000
        }
        
        # Browser configuration
        self.browser_config = {
            'headless': True,  # Run headless to avoid hanging
            'viewport': {'width': 1920, 'height': 1080},
            'slow_mo': 0,  # Disable slow motion for faster execution
            'trace': False,  # Disable tracing initially
            'screenshot_on_failure': True,
            'video': False  # Disable video recording initially
        }
        
        # Test data paths
        self.test_files = self._get_test_files()
        
        # User credentials
        self.test_users = self._get_test_users()
        
        # URL configurations
        self.urls = self._get_urls()
        
        # Language configurations
        self.languages = ['english', 'hebrew']
        
        # Supported file types for testing
        self.supported_file_types = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.bmp', '.gif']
        self.unsupported_file_types = ['.html', '.txt', '.exe', '.zip']
        
        # Test data for recipients
        self.test_recipients = self._get_test_recipients()
        
    def _load_settings(self) -> Dict[str, Any]:
        """Load settings from JSON file"""
        try:
            with open(self.settings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Settings file not found: {self.settings_file}")
            return {}
        except json.JSONDecodeError as e:
            print(f"Error parsing settings file: {e}")
            return {}
            
    def _get_test_files(self) -> Dict[str, str]:
        """Get test file paths from settings"""
        return {
            'pdf_3_pages': self.settings.get('pdf_file', ''),
            'pdf_2_pages': self.settings.get('pdf_file2', ''),
            'pdf_6_pages': self.settings.get('pdf_6pages', ''),
            'pdf_11_pages': self.settings.get('pdf_11Pages', ''),
            'pdf_60_pages': self.settings.get('pdf_60Pages', ''),
            'pdf_102_pages': self.settings.get('102_pdf_file', ''),
            'pdf_10mb': self.settings.get('10_mega-pdf_file', ''),
            'word_document': self.settings.get('word_file', ''),
            'word_with_xml': self.settings.get('word_with_xml', ''),
            'word_with_fields': self.settings.get('word_with_fields', ''),
            'excel_file': self.settings.get('xlsx_file', ''),
            'png_image': self.settings.get('png_image', ''),
            'jpg_image': self.settings.get('jpg_image', ''),
            'bmp_image': self.settings.get('bmp_image', ''),
            'gif_image': self.settings.get('gif_image', ''),
            'xml_file': self.settings.get('xml_file', ''),
            'csv_file': self.settings.get('csv_file', ''),
            'unsupported_html': self.settings.get('unsupported_file', ''),
            'msg_file': self.settings.get('msg_outlook_file', ''),
            'signed_pdf': self.settings.get('signed_pdf_with_values', ''),
            'multi_signature_pdf': self.settings.get('signed_pdf_with_multi_signatures', ''),
            'pdf_with_fields': self.settings.get('pdf_with_fields', ''),
            'contact_seal': self.settings.get('contact_seal', ''),
            'signer_image': self.settings.get('signer1_img', '')
        }
        
    def _get_test_users(self) -> Dict[str, Dict[str, str]]:
        """Get test user credentials from settings"""
        return {
            'company_user': {
                'username': self.settings.get('company_username', ''),
                'email': self.settings.get('company_user', ''),
                'password': self.settings.get('company_user_password', ''),
                'server_cert_id': self.settings.get('server_cert_id', ''),
                'server_password': self.settings.get('server_password', '')
            },
            'basic_user': {
                'email': self.settings.get('basic_user', ''),
                'password': self.settings.get('basic_user_password', '')
            },
            'editor_user': {
                'email': self.settings.get('editor_user', ''),
                'password': self.settings.get('editor_user_password', '')
            },
            'management_user': {
                'email': self.settings.get('management_user_email', ''),
                'password': self.settings.get('management_user_password', '')
            },
            'expired_account': {
                'email': self.settings.get('expired_account', ''),
                'password': self.settings.get('basic_user_password', '')
            }
        }
        
    def _get_urls(self) -> Dict[str, str]:
        """Get URL configurations from settings"""
        return {
            'base_url': self.settings.get('base_url', 'https://devtest.comda.co.il/'),
            'wse_url': self.settings.get('wse_url', ''),
            'wesign_dev_url': self.settings.get('wesign_dev_url', ''),
            'lite_base_url': self.settings.get('lite_base_url', ''),
            'management_url': self.settings.get('management_url', ''),
            'register_page': self.settings.get('register_page', ''),
            'payment_api_url': self.settings.get('payment_api_url', ''),
            'dashboard': self.settings.get('base_url', '') + 'dashboard/main',
            'documents': self.settings.get('base_url', '') + 'documents',
            'templates': self.settings.get('base_url', '') + 'templates'
        }
        
    def _get_test_recipients(self) -> List[Dict[str, str]]:
        """Get test recipient data from settings"""
        return [
            {
                'name': self.settings.get('first_recipient_name', 'Test User 1'),
                'email': self.settings.get('first_recipient_email', 'test1@example.com'),
                'phone': self.settings.get('Israeli_number', '0552603210')
            },
            {
                'name': self.settings.get('second_recipient_name', 'Test User 2'), 
                'email': self.settings.get('second_recipient_mail', 'test2@example.com'),
                'phone': self.settings.get('phone_number', '0504821887')
            },
            {
                'name': self.settings.get('third_recipient_name', 'Test User 3'),
                'email': self.settings.get('third_recipient_email', 'test3@example.com'),
                'phone': self.settings.get('united_state_sms_number', '9783475606')
            },
            {
                'name': self.settings.get('four_recipient_name', 'Test User 4'),
                'email': self.settings.get('four_recipient_email', 'test4@example.com'),
                'phone': self.settings.get('united_state_sms_second_number', '8044064234')
            },
            {
                'name': self.settings.get('fifth_recipient_name', 'Test User 5'),
                'email': self.settings.get('fifth_recipient_email', 'test5@example.com')
            }
        ]
        
    def get_file_path(self, file_key: str) -> Optional[str]:
        """
        Get file path by key
        
        Args:
            file_key: Key for the test file
            
        Returns:
            str: File path or None if not found
        """
        return self.test_files.get(file_key)
        
    def get_valid_test_files(self) -> List[str]:
        """Get list of valid test files that exist on disk"""
        valid_files = []
        for file_path in self.test_files.values():
            if file_path and os.path.exists(file_path):
                valid_files.append(file_path)
        return valid_files
        
    def get_files_by_type(self, file_extension: str) -> List[str]:
        """
        Get files by extension
        
        Args:
            file_extension: File extension (e.g., '.pdf', '.docx')
            
        Returns:
            List of file paths with matching extension
        """
        matching_files = []
        for file_path in self.test_files.values():
            if file_path and file_path.lower().endswith(file_extension.lower()):
                if os.path.exists(file_path):
                    matching_files.append(file_path)
        return matching_files
        
    def get_files_for_merge_testing(self) -> List[str]:
        """Get suitable files for merge testing (PDF files of different sizes)"""
        merge_files = [
            self.get_file_path('pdf_3_pages'),
            self.get_file_path('pdf_2_pages'), 
            self.get_file_path('pdf_6_pages')
        ]
        return [f for f in merge_files if f and os.path.exists(f)]
        
    def get_large_files(self) -> List[str]:
        """Get large files for performance testing"""
        large_files = [
            self.get_file_path('pdf_60_pages'),
            self.get_file_path('pdf_102_pages'),
            self.get_file_path('pdf_10mb')
        ]
        return [f for f in large_files if f and os.path.exists(f)]
        
    def get_user_credentials(self, user_type: str) -> Optional[Dict[str, str]]:
        """
        Get user credentials by type
        
        Args:
            user_type: Type of user ('company_user', 'basic_user', etc.)
            
        Returns:
            Dict with user credentials or None
        """
        return self.test_users.get(user_type)
        
    def get_timeout(self, operation: str) -> int:
        """
        Get timeout for specific operation
        
        Args:
            operation: Operation name ('upload', 'merge', 'send', etc.)
            
        Returns:
            Timeout in milliseconds
        """
        return self.test_timeouts.get(operation, self.test_timeouts['default'])
        
    def get_browser_config(self) -> Dict[str, Any]:
        """Get browser configuration"""
        return self.browser_config.copy()
        
    def get_test_recipients_for_language(self, language: str) -> List[Dict[str, str]]:
        """
        Get test recipients with appropriate names for language
        
        Args:
            language: Language ('hebrew' or 'english')
            
        Returns:
            List of recipient dictionaries
        """
        recipients = self.test_recipients.copy()
        
        if language == 'hebrew':
            # Add Hebrew names for testing
            hebrew_names = [
                'יוסי כהן',
                'מירי לוי', 
                'דני אברהם',
                'שרה יעקב',
                'אבי דוד'
            ]
            for i, recipient in enumerate(recipients):
                if i < len(hebrew_names):
                    recipient['name_hebrew'] = hebrew_names[i]
                    
        return recipients
        
    def get_invalid_test_data(self) -> Dict[str, Any]:
        """Get invalid test data for negative testing"""
        return {
            'invalid_emails': [
                'invalid-email',
                'test@',
                '@domain.com',
                'test..test@domain.com',
                'test@domain',
                'test@.com',
                ''
            ],
            'invalid_names': [
                '',
                'a' * 300,  # Too long
                '123!@#',    # Special characters only
                '<script>alert("test")</script>',  # XSS attempt
                'Test123!@'
            ],
            'invalid_phones': [
                '123',       # Too short
                'abcd1234',  # Contains letters
                '0521!00000', # Special characters
                '',          # Empty
                '1' * 20     # Too long
            ],
            'invalid_file_paths': [
                'non_existent_file.pdf',
                '',
                None
            ],
            'oversized_files': [],  # Files over size limit
            'unsupported_files': [
                self.get_file_path('unsupported_html')
            ]
        }
        
    def get_performance_thresholds(self) -> Dict[str, int]:
        """Get performance testing thresholds in milliseconds"""
        return {
            'page_load_max': 10000,      # 10 seconds
            'file_upload_max': 120000,   # 2 minutes for large files
            'file_merge_max': 60000,     # 1 minute
            'document_send_max': 90000,  # 1.5 minutes
            'ui_response_max': 3000      # 3 seconds for UI interactions
        }
        
    def get_accessibility_config(self) -> Dict[str, Any]:
        """Get accessibility testing configuration"""
        return {
            'standards': ['WCAG2A', 'WCAG2AA'],
            'include_notices': False,
            'include_warnings': True,
            'browser_context': self.get_browser_config()
        }
        
    def create_test_artifacts_dir(self) -> str:
        """Create and return path to test artifacts directory"""
        artifacts_dir = self.base_dir / "artifacts"
        artifacts_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        for subdir in ['screenshots', 'videos', 'traces', 'reports', 'logs']:
            (artifacts_dir / subdir).mkdir(exist_ok=True)
            
        return str(artifacts_dir)
        
    def get_test_environment(self) -> str:
        """Get current test environment"""
        return os.getenv('TEST_ENV', 'development')
        
    def is_ci_environment(self) -> bool:
        """Check if running in CI environment"""
        return os.getenv('CI', '').lower() in ['true', '1', 'yes']
        
    def get_parallel_workers(self) -> int:
        """Get number of parallel workers for test execution"""
        if self.is_ci_environment():
            return 4
        return 2
        
    def should_record_video(self) -> bool:
        """Determine if video recording should be enabled"""
        return not self.is_ci_environment() or os.getenv('RECORD_VIDEO', 'false').lower() == 'true'
        
    def get_retry_config(self) -> Dict[str, int]:
        """Get retry configuration for flaky tests"""
        return {
            'max_retries': 3 if self.is_ci_environment() else 1,
            'retry_delay': 2000  # 2 seconds between retries
        }