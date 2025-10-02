"""
Centralized Locator Management System
Provides fallback selectors for all UI elements across WeSign application
"""

from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class LocatorSet:
    """Container for multiple selector fallbacks"""
    primary: str
    fallbacks: List[str]
    description: str
    
    def all_selectors(self) -> List[str]:
        """Get all selectors in priority order"""
        return [self.primary] + self.fallbacks


class WeSignLocators:
    """Centralized locator repository for WeSign application"""
    
    # Authentication & Login
    LOGIN = {
        'username_input': LocatorSet(
            primary='input[name="email"]',
            fallbacks=[
                'input[placeholder*="Username"]',
                'input[placeholder*="Email"]',
                'input[type="email"]',
                'input[name="username"]',
                'input[id="username"]',
                'input[placeholder*="username"]',
                'input[placeholder*="שם משתמש"]',  # Hebrew
                '.login-form input[type="text"]',
                '[data-testid="username"]'
            ],
            description='Username input field'
        ),
        'password_input': LocatorSet(
            primary='input[name="password"]',
            fallbacks=[
                'input[type="password"]',
                'input[placeholder*="Password"]',
                'input[id="password"]',
                'input[placeholder*="password"]',
                'input[placeholder*="סיסמה"]',  # Hebrew
                '[data-testid="password"]'
            ],
            description='Password input field'
        ),
        'login_button': LocatorSet(
            primary='button:has-text("Submit")',
            fallbacks=[
                'input[type="submit"]',
                'input[id="loginInput"]',
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("התחבר")',  # Hebrew
                'button:has-text("Sign In")',
                '.login-button',
                '[data-testid="login-btn"]'
            ],
            description='Login submit button'
        ),
        'logout_button': LocatorSet(
            primary='button:has-text("Logout")',
            fallbacks=[
                'button:has-text("התנתק")',  # Hebrew
                'button:has-text("Sign Out")',
                '.logout-btn',
                '[data-testid="logout"]',
                'a[href*="logout"]'
            ],
            description='Logout button'
        )
    }
    
    # Navigation & Menu
    NAVIGATION = {
        'contacts_nav': LocatorSet(
            primary='button.button--contacts-ent:has-text("Contacts")',
            fallbacks=[
                'button:has-text("Contacts")',
                'button:has-text("אנשי קשר")',  # Hebrew
                'a[href*="contacts"]',
                '.nav-link:has-text("Contacts")',
                '[data-page="contacts"]',
                '.menu-item:has-text("Contacts")',
                '.sidebar-menu a:has-text("Contacts")'
            ],
            description='Contacts navigation link'
        ),
        'dashboard_nav': LocatorSet(
            primary='a[href*="dashboard"]',
            fallbacks=[
                'button:has-text("Dashboard")',
                'button:has-text("לוח בקרה")',  # Hebrew
                '.nav-link:has-text("Dashboard")',
                '[data-page="dashboard"]',
                '.menu-item:has-text("Dashboard")'
            ],
            description='Dashboard navigation link'
        ),
        'templates_nav': LocatorSet(
            primary='a[href*="templates"]',
            fallbacks=[
                'button:has-text("Templates")',
                'button:has-text("תבניות")',  # Hebrew
                '.nav-link:has-text("Templates")',
                '[data-page="templates"]',
                '.menu-item:has-text("Templates")'
            ],
            description='Templates navigation link'
        ),
        'menu_toggle': LocatorSet(
            primary='.hamburger-menu',
            fallbacks=[
                '.menu-toggle',
                'button[aria-label="Toggle menu"]',
                '.navbar-toggler',
                '[data-testid="menu-toggle"]'
            ],
            description='Mobile menu toggle button'
        )
    }
    
    # Contacts Page
    CONTACTS = {
        'add_contact_button': LocatorSet(
            primary='button:has-text("Add Contact")',
            fallbacks=[
                'button:has-text("הוסף איש קשר")',  # Hebrew
                '.add-contact-btn',
                '[data-testid="add-contact"]',
                'button[aria-label*="Add"]',
                '.btn-primary:has-text("Add")',
                'button:has-text("+")'
            ],
            description='Add new contact button'
        ),
        'import_excel_button': LocatorSet(
            primary='li:has-text("Import Excel")',
            fallbacks=[
                'a:has-text("Import Excel")',
                'button:has-text("Import Excel")',
                'li.ws_button--table-info:has-text("import excel")',
                'button:has-text("יבא אקסל")',  # Hebrew
                '.import-excel-btn',
                '[data-testid="import-excel"]',
                'button:has-text("Import")',
                '.import-button',
                'button[aria-label*="Import"]'
            ],
            description='Import Excel contacts button'
        ),
        'search_input': LocatorSet(
            primary='input[placeholder*="Search"]',
            fallbacks=[
                'input[placeholder*="חפש"]',  # Hebrew
                '.search-input',
                'input[name="search"]',
                '[data-testid="search"]',
                '.form-control[type="text"]'
            ],
            description='Contact search input field'
        ),
        'contact_list': LocatorSet(
            primary='.contacts-list',
            fallbacks=[
                '.contact-items',
                '.list-group',
                '[data-testid="contacts-list"]',
                '.contacts-container .list-item'
            ],
            description='Contact list container'
        ),
        'contact_item': LocatorSet(
            primary='.contact-item',
            fallbacks=[
                '.contact-row',
                '.list-group-item',
                '[data-testid="contact-item"]',
                '.contact-entry'
            ],
            description='Individual contact list item'
        )
    }
    
    # File Upload
    UPLOAD = {
        'file_input': LocatorSet(
            primary='input[type="file"]',
            fallbacks=[
                '.file-input',
                '[data-testid="file-upload"]',
                'input[accept*=".pdf"]',
                '.upload-input'
            ],
            description='File input element'
        ),
        'upload_button': LocatorSet(
            primary='button:has-text("Upload")',
            fallbacks=[
                'button:has-text("העלה")',  # Hebrew
                '.upload-btn',
                '[data-testid="upload"]',
                'button[aria-label*="Upload"]',
                '.btn-upload'
            ],
            description='Upload file button'
        ),
        'drag_drop_area': LocatorSet(
            primary='.drag-drop-area',
            fallbacks=[
                '.dropzone',
                '.upload-zone',
                '[data-testid="dropzone"]',
                '.file-drop-area'
            ],
            description='Drag and drop upload area'
        )
    }
    
    # Document Actions  
    DOCUMENT = {
        'pdf_button': LocatorSet(
            primary='button:has-text("PDF")',
            fallbacks=[
                'button:has-text("PDF"):not([disabled])',
                '.pdf-btn',
                '[data-testid="pdf-button"]',
                'button[aria-label*="PDF"]',
                '.document-actions button:has-text("PDF")'
            ],
            description='PDF action button'
        ),
        'merge_button': LocatorSet(
            primary='button:has-text("Merge")',
            fallbacks=[
                'button:has-text("מזג")',  # Hebrew
                '.merge-btn',
                '[data-testid="merge"]',
                'button[aria-label*="Merge"]'
            ],
            description='Merge documents button'
        ),
        'send_button': LocatorSet(
            primary='button:has-text("Send")',
            fallbacks=[
                'button:has-text("שלח")',  # Hebrew
                '.send-btn',
                '[data-testid="send"]',
                'button[aria-label*="Send"]',
                '.btn-primary:has-text("Send")'
            ],
            description='Send document button'
        )
    }
    
    # Forms & Modals
    FORMS = {
        'modal_container': LocatorSet(
            primary='.modal',
            fallbacks=[
                '.dialog',
                '.popup',
                '[role="dialog"]',
                '.modal-dialog',
                '.overlay'
            ],
            description='Modal dialog container'
        ),
        'modal_close': LocatorSet(
            primary='.modal .close',
            fallbacks=[
                'button[aria-label="Close"]',
                '.modal-header .btn-close',
                '.close-button',
                '[data-dismiss="modal"]'
            ],
            description='Modal close button'
        ),
        'submit_button': LocatorSet(
            primary='button[type="submit"]',
            fallbacks=[
                'button:has-text("Submit")',
                'button:has-text("שלח")',  # Hebrew
                '.submit-btn',
                '.btn-primary:has-text("Save")',
                '[data-testid="submit"]'
            ],
            description='Form submit button'
        ),
        'cancel_button': LocatorSet(
            primary='button:has-text("Cancel")',
            fallbacks=[
                'button:has-text("בטל")',  # Hebrew
                '.cancel-btn',
                '.btn-secondary',
                '[data-testid="cancel"]'
            ],
            description='Cancel action button'
        )
    }
    
    # Language Support
    LANGUAGE = {
        'language_toggle': LocatorSet(
            primary='.language-toggle',
            fallbacks=[
                '.lang-switch',
                'button[aria-label*="Language"]',
                '[data-testid="language"]',
                '.language-selector'
            ],
            description='Language toggle button'
        ),
        'english_option': LocatorSet(
            primary='button:has-text("English")',
            fallbacks=[
                'option[value="en"]',
                '.lang-en',
                '[data-lang="english"]'
            ],
            description='English language option'
        ),
        'hebrew_option': LocatorSet(
            primary='button:has-text("עברית")',
            fallbacks=[
                'option[value="he"]',
                '.lang-he',
                '[data-lang="hebrew"]'
            ],
            description='Hebrew language option'
        )
    }
    
    # Status & Feedback
    STATUS = {
        'success_message': LocatorSet(
            primary='.alert.alert-success',
            fallbacks=[
                '.success-message',
                '.alert-success',
                '.toast-success',
                '.notification.success',
                '[data-testid="success-msg"]',
                '.alert:has-text("success")',
                '.alert:has-text("uploaded")',
                '.alert:has-text("imported")',
                '[role="alert"]:has-text("success")',
                '.message-success'
            ],
            description='Success notification message'
        ),
        'error_message': LocatorSet(
            primary='.error-message',
            fallbacks=[
                '.alert-danger',
                '.toast-error',
                '.notification.error',
                '[data-testid="error-msg"]'
            ],
            description='Error notification message'
        ),
        'loading_spinner': LocatorSet(
            primary='.loading-spinner',
            fallbacks=[
                '.spinner',
                '.loader',
                '[data-testid="loading"]',
                '.fa-spin'
            ],
            description='Loading indicator'
        )
    }

    @staticmethod
    def get_selectors(category: str, element: str) -> List[str]:
        """Get all selectors for a specific element"""
        category_dict = getattr(WeSignLocators, category.upper(), {})
        locator_set = category_dict.get(element)
        if locator_set:
            return locator_set.all_selectors()
        return []
    
    @staticmethod
    def get_primary_selector(category: str, element: str) -> Optional[str]:
        """Get primary selector for a specific element"""
        category_dict = getattr(WeSignLocators, category.upper(), {})
        locator_set = category_dict.get(element)
        if locator_set:
            return locator_set.primary
        return None
    
    @staticmethod
    def get_description(category: str, element: str) -> Optional[str]:
        """Get description for a specific element"""
        category_dict = getattr(WeSignLocators, category.upper(), {})
        locator_set = category_dict.get(element)
        if locator_set:
            return locator_set.description
        return None


class LocatorHelper:
    """Helper class for working with locators in tests"""
    
    def __init__(self, page):
        self.page = page
    
    def find_element_with_fallbacks(self, category: str, element: str, timeout: int = 10000):
        """
        Try to find an element using fallback selectors
        Returns the first matching element or None if not found
        """
        selectors = WeSignLocators.get_selectors(category, element)
        
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                if locator.count() > 0:
                    return locator.first
            except Exception:
                continue
        
        return None
    
    def wait_for_element_with_fallbacks(self, category: str, element: str, timeout: int = 10000):
        """
        Wait for an element to appear using fallback selectors
        Returns the first matching element or raises timeout error
        """
        selectors = WeSignLocators.get_selectors(category, element)
        
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                locator.wait_for(timeout=timeout // len(selectors))
                if locator.count() > 0:
                    return locator.first
            except Exception:
                continue
        
        # If no selector worked, raise error with all attempted selectors
        description = WeSignLocators.get_description(category, element)
        raise TimeoutError(f"Element '{description}' not found with any of these selectors: {selectors}")
    
    def click_with_fallbacks(self, category: str, element: str, timeout: int = 10000) -> bool:
        """
        Click an element using fallback selectors
        Returns True if successful, False otherwise
        """
        try:
            element_locator = self.wait_for_element_with_fallbacks(category, element, timeout)
            element_locator.click()
            return True
        except Exception as e:
            print(f"Failed to click element: {e}")
            return False
    
    def fill_with_fallbacks(self, category: str, element: str, text: str, timeout: int = 10000) -> bool:
        """
        Fill an input element using fallback selectors
        Returns True if successful, False otherwise
        """
        try:
            element_locator = self.wait_for_element_with_fallbacks(category, element, timeout)
            element_locator.fill(text)
            return True
        except Exception as e:
            print(f"Failed to fill element: {e}")
            return False