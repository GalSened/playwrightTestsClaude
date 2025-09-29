"""
WeSign Real Interface Selectors

This module contains the actual selectors discovered during comprehensive WeSign system exploration.
These selectors are extracted from live system navigation and provide accurate element targeting.

Author: WeSign QA Automation Team
Created: 2025-09-28
Version: 1.0.0

Selector Categories:
- Navigation selectors (Hebrew interface)
- Document management selectors
- Template management selectors
- Contact management selectors
- Dashboard selectors
- Search and filtering selectors
"""

# Main navigation selectors (Hebrew interface)
NAVIGATION_SELECTORS = {
    "dashboard": 'button:has-text("ראשי")',
    "contacts": 'button:has-text("אנשי קשר")',
    "templates": 'button:has-text("תבניות")',
    "documents": 'button:has-text("מסמכים")',
    "language_selector": 'combobox',
    "logout": 'text:has-text("התנתק")',
    "back_button": 'button:has-text("חזור")'
}

# Dashboard selectors
DASHBOARD_SELECTORS = {
    "upload_file": 'button:has-text("העלאת קובץ")',
    "server_signature": 'button:has-text("חתימת שרת Signer 1")',
    "merge_files": 'button:has-text("איחוד קבצים")',
    "assign_send": 'button:has-text("שיוך ושליחה")',
    "version_info": 'text:has-text("גרסה:")',
    "footer_links": {
        "terms": 'link:has-text("תנאי השימוש")',
        "privacy": 'link:has-text("מדיניות הפרטיות")',
        "comsigntrust": 'link:has-text("ComsignTrust.com")',
        "contact": 'link:has-text("צור קשר")',
        "guides": 'link:has-text("מדריכים")'
    }
}

# Document management selectors
DOCUMENT_SELECTORS = {
    "page_title": 'heading:has-text("המסמכים שלי")',
    "search_box": 'searchbox[placeholder="חיפוש מסמכים"]',
    "search_criteria": {
        "dropdown": 'combobox >> option:has-text("שם מסמך")',
        "signer_details": 'option:has-text("פרטי חותם")',
        "sender_details": 'option:has-text("פרטי שולח")'
    },
    "date_filters": {
        "from_date": 'text:has-text("מתאריך")',
        "to_date": 'text:has-text("עד לתאריך")'
    },
    "pagination": {
        "rows_per_page": 'combobox >> option:has-text("10")',
        "page_navigation": 'spinbutton',
        "next_page": 'button:has([src*="next"])',
        "prev_page": 'button:has([src*="prev"])'
    },
    "document_list": {
        "table": 'table',
        "checkboxes": 'checkbox',
        "document_names": 'cell:nth-child(3)',
        "sender_names": 'cell:nth-child(4)',
        "dates": 'cell:nth-child(5)',
        "status": 'cell:nth-child(6)',
        "action_buttons": 'cell:last-child button'
    },
    "status_filters": {
        "all_documents": 'text:has-text("כל המסמכים")',
        "pending": 'text:has-text("בהמתנה")',
        "signed": 'text:has-text("נחתם")',
        "rejected": 'text:has-text("נדחה")',
        "cancelled": 'text:has-text("בוטל")',
        "distributed": 'text:has-text("מסמכים בהפצה")',
        "waiting_for_signature": 'text:has-text("ממתינים לחתימה שלי")',
        "excel_export": 'text:has-text("ייצוא מסמכים לקובץ אקסל")'
    },
    "document_count": 'heading:has-text("סך המסמכים:")'
}

# Template management selectors
TEMPLATE_SELECTORS = {
    "page_title": 'heading:has-text("תבניות")',
    "search_box": 'searchbox[placeholder="חיפוש תבניות"]',
    "add_template": 'text:has-text("הוסף תבנית חדשה")',
    "sign_button": 'button:has-text("חתום")',
    "pagination": {
        "rows_per_page": 'combobox >> option:has-text("10")',
        "page_navigation": 'spinbutton',
        "total_count": 'text:has-text("22")',
        "next_page": 'button:has([src*="next"])',
        "prev_page": 'button:has([src*="prev"])'
    },
    "template_list": {
        "table": 'table',
        "checkboxes": 'checkbox',
        "template_names": 'cell:nth-child(2)',
        "creators": 'cell:nth-child(3)',
        "creation_dates": 'cell:nth-child(4)',
        "action_buttons": 'cell:last-child button'
    },
    "template_headers": {
        "title": 'text:has-text("כותרת")',
        "created_by": 'text:has-text("נוצר על ידי")',
        "creation_date": 'text:has-text("תאריך יצירה")'
    }
}

# Contact management selectors (to be discovered)
CONTACT_SELECTORS = {
    # Will be populated when we navigate to contacts
    "page_title": 'heading:has-text("אנשי קשר")',
    "search_box": 'searchbox',
    "add_contact": 'button:has-text("הוסף איש קשר")',
    "contact_list": 'table',
    "pagination": 'spinbutton'
}

# Search and filtering selectors
SEARCH_SELECTORS = {
    "global_search": 'input[type="search"]',
    "search_box": 'searchbox',
    "search_criteria": 'combobox',
    "filter_options": 'option',
    "advanced_search": 'button:has-text("חיפוש מתקדם")',
    "clear_filters": 'button:has-text("נקה מסננים")'
}

# File merging selectors
MERGE_SELECTORS = {
    "merge_files_button": 'button:has-text("איחוד קבצים")',
    "file_selection": 'checkbox',
    "merge_order": 'draggable',
    "merge_execute": 'button:has-text("בצע איחוד")',
    "merge_progress": '.progress',
    "download_result": 'button:has-text("הורד תוצאה")'
}

# Form and input selectors
FORM_SELECTORS = {
    "text_input": 'input[type="text"]',
    "email_input": 'input[type="email"]',
    "password_input": 'input[type="password"]',
    "checkbox": 'input[type="checkbox"]',
    "radio": 'input[type="radio"]',
    "select": 'select',
    "textarea": 'textarea',
    "file_input": 'input[type="file"]',
    "submit_button": 'button[type="submit"]',
    "cancel_button": 'button:has-text("ביטול")',
    "save_button": 'button:has-text("שמור")'
}

# Accessibility selectors
ACCESSIBILITY_SELECTORS = {
    "accessibility_button": 'button:has-text("Accessibility")',
    "screen_reader": 'button:has-text("Press enter for Accessibility for blind people")',
    "keyboard_navigation": 'button:has-text("Press enter for Keyboard Navigation")',
    "accessibility_menu": 'button:has-text("Press enter for Accessibility menu")'
}

# Status and feedback selectors
STATUS_SELECTORS = {
    "success_message": '.success',
    "error_message": '.error',
    "warning_message": '.warning',
    "loading_indicator": '.loading',
    "progress_bar": '.progress',
    "confirmation_dialog": '.confirmation',
    "alert_dialog": 'alert'
}

# Document editor selectors (field types)
EDITOR_SELECTORS = {
    "editor_container": '.editor',
    "toolbar": '.toolbar',
    "field_types": {
        "text": 'button:has-text("טקסט")',
        "signature": 'button:has-text("חתימה")',
        "initials": 'button:has-text("ראשי תיבות")',
        "email": 'button:has-text("אימייל")',
        "phone": 'button:has-text("טלפון")',
        "date": 'button:has-text("תאריך")',
        "number": 'button:has-text("מספר")',
        "list": 'button:has-text("רשימה")',
        "checkbox": 'button:has-text("תיבת סימון")',
        "radio": 'button:has-text("בחירה יחידה")'
    },
    "field_properties": '.properties',
    "save_document": 'button:has-text("שמור מסמך")',
    "preview_document": 'button:has-text("תצוגה מקדימה")'
}

# Authentication selectors
AUTH_SELECTORS = {
    "login_form": 'form',
    "email_field": 'input[type="email"]',
    "password_field": 'input[type="password"]',
    "login_button": 'button[type="submit"]',
    "forgot_password": 'link:has-text("שכחת סיסמה")',
    "register_link": 'link:has-text("הרשמה")',
    "remember_me": 'checkbox:has-text("זכור אותי")'
}

# Language and localization selectors
LANGUAGE_SELECTORS = {
    "hebrew_text": 'text:has-text("עברית")',
    "english_text": 'text:has-text("English")',
    "language_dropdown": 'combobox',
    "rtl_container": '[dir="rtl"]',
    "ltr_container": '[dir="ltr"]'
}


def get_selector(category: str, selector_name: str, sub_selector: str = None) -> str:
    """
    Get a specific selector from the selector mapping.

    Args:
        category: Selector category (e.g., 'NAVIGATION', 'DOCUMENT')
        selector_name: Specific selector name
        sub_selector: Optional sub-selector for nested selectors

    Returns:
        CSS selector string
    """
    selector_map = {
        'NAVIGATION': NAVIGATION_SELECTORS,
        'DASHBOARD': DASHBOARD_SELECTORS,
        'DOCUMENT': DOCUMENT_SELECTORS,
        'TEMPLATE': TEMPLATE_SELECTORS,
        'CONTACT': CONTACT_SELECTORS,
        'SEARCH': SEARCH_SELECTORS,
        'MERGE': MERGE_SELECTORS,
        'FORM': FORM_SELECTORS,
        'ACCESSIBILITY': ACCESSIBILITY_SELECTORS,
        'STATUS': STATUS_SELECTORS,
        'EDITOR': EDITOR_SELECTORS,
        'AUTH': AUTH_SELECTORS,
        'LANGUAGE': LANGUAGE_SELECTORS
    }

    category_selectors = selector_map.get(category, {})

    if sub_selector:
        selector_group = category_selectors.get(selector_name, {})
        return selector_group.get(sub_selector, f"[data-selector='{sub_selector}']")
    else:
        return category_selectors.get(selector_name, f"[data-selector='{selector_name}']")


def get_hebrew_text_selector(text: str) -> str:
    """Get selector for Hebrew text content."""
    return f'text:has-text("{text}")'


def get_button_with_text(text: str) -> str:
    """Get button selector with specific text."""
    return f'button:has-text("{text}")'


def get_input_by_placeholder(placeholder: str) -> str:
    """Get input selector by placeholder text."""
    return f'input[placeholder="{placeholder}"]'


def get_table_cell_by_position(row: int, col: int) -> str:
    """Get table cell selector by position."""
    return f'table tr:nth-child({row}) td:nth-child({col})'


def get_link_by_href(href: str) -> str:
    """Get link selector by href attribute."""
    return f'link[href="{href}"]'


# WeSign-specific helper selectors
WESIGN_HELPERS = {
    "any_document_row": 'table tr:has(td)',
    "any_template_row": 'table tr:has(td)',
    "any_action_button": 'cell:last-child button',
    "any_checkbox": 'input[type="checkbox"]',
    "any_pagination": 'spinbutton',
    "any_search_box": 'searchbox',
    "any_dropdown": 'combobox',
    "hebrew_interface": '[dir="rtl"]',
    "main_content": 'main',
    "navigation_bar": 'navigation',
    "footer_content": 'contentinfo'
}