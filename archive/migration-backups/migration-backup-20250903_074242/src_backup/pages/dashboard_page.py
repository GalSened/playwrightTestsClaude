from playwright.sync_api import Page, Locator
from .base_page import BasePage
from typing import Dict, Optional, List
import os
import re


class DashboardPage(BasePage):
    """Page Object Model for Dashboard Main Page"""
    
    def __init__(self, page: Page, base_url: str = None):
        super().__init__(page)
        self.base_url = base_url or os.getenv("BASE_URL", "https://devtest.comda.co.il/")
        self.dashboard_url = f"{self.base_url.rstrip('/')}/dashboard/main" if not self.base_url.endswith('/dashboard/main') else self.base_url
        self._init_locators()
        
    def _init_locators(self) -> None:
        """Initialize all locators for the dashboard page with self-healing capabilities"""
        
        # Navigation elements
        self.dashboard_nav_button = self.page.locator('''
            button:has-text("Dashboard"), 
            button:has-text("לוח בקרה"),
            a:has-text("Dashboard"),
            a:has-text("לוח בקרה"),
            [data-testid="dashboard-nav"],
            .nav-dashboard,
            #dashboard-nav
        ''')
        
        # Page title and header
        self.page_title = self.page.locator('''
            h1:has-text("Dashboard"),
            h1:has-text("לוח בקרה"),
            .page-title,
            [data-testid="page-title"],
            .dashboard-title,
            .main-title
        ''')
        
        # Main dashboard sections
        self.main_content = self.page.locator('''
            .main-content,
            .dashboard-content,
            [data-testid="main-content"],
            .content-wrapper,
            #main-content
        ''')
        
        # Statistics/Summary cards
        self.stats_cards = self.page.locator('''
            .stats-card,
            .summary-card,
            .dashboard-card,
            .metric-card,
            [data-testid="stats-card"],
            .card
        ''')
        
        self.total_documents_card = self.page.locator('''
            .card:has-text("Documents"),
            .card:has-text("מסמכים"),
            .stats-card:has-text("Documents"),
            .stats-card:has-text("מסמכים"),
            [data-testid="total-documents"]
        ''')
        
        self.pending_signatures_card = self.page.locator('''
            .card:has-text("Pending"),
            .card:has-text("ממתינים"),
            .stats-card:has-text("Pending"),
            .stats-card:has-text("ממתינים"),
            [data-testid="pending-signatures"]
        ''')
        
        self.completed_signatures_card = self.page.locator('''
            .card:has-text("Completed"),
            .card:has-text("הושלמו"),
            .stats-card:has-text("Completed"),
            .stats-card:has-text("הושלמו"),
            [data-testid="completed-signatures"]
        ''')
        
        self.users_card = self.page.locator('''
            .card:has-text("Users"),
            .card:has-text("משתמשים"),
            .stats-card:has-text("Users"),
            .stats-card:has-text("משתמשים"),
            [data-testid="users-count"]
        ''')
        
        # Recent activity section
        self.recent_activity_section = self.page.locator('''
            .recent-activity,
            .activity-section,
            [data-testid="recent-activity"],
            .dashboard-activity,
            section:has-text("Recent Activity"),
            section:has-text("פעילות אחרונה")
        ''')
        
        self.activity_items = self.page.locator('''
            .activity-item,
            .activity-row,
            [data-testid="activity-item"],
            .recent-activity-item
        ''')
        
        # Quick actions section
        self.quick_actions_section = self.page.locator('''
            .quick-actions,
            .actions-section,
            [data-testid="quick-actions"],
            .dashboard-actions,
            section:has-text("Quick Actions"),
            section:has-text("פעולות מהירות")
        ''')
        
        self.new_document_button = self.page.locator('''
            button:has-text("New Document"),
            button:has-text("מסמך חדש"),
            a:has-text("New Document"),
            a:has-text("מסמך חדש"),
            [data-testid="new-document"],
            .new-document-btn
        ''')
        
        self.upload_document_button = self.page.locator('''
            button:has-text("Upload"),
            button:has-text("העלה"),
            a:has-text("Upload Document"),
            a:has-text("העלה מסמך"),
            [data-testid="upload-document"],
            .upload-btn
        ''')
        
        self.invite_users_button = self.page.locator('''
            button:has-text("Invite Users"),
            button:has-text("הזמן משתמשים"),
            a:has-text("Invite Users"),
            a:has-text("הזמן משתמשים"),
            [data-testid="invite-users"],
            .invite-users-btn
        ''')
        
        # Charts and analytics
        self.charts_section = self.page.locator('''
            .charts-section,
            .analytics-section,
            [data-testid="charts"],
            .dashboard-charts
        ''')
        
        self.signature_trend_chart = self.page.locator('''
            .chart,
            .trend-chart,
            [data-testid="signature-trend"],
            .analytics-chart,
            canvas
        ''')
        
        # Sidebar/Navigation menu
        self.sidebar = self.page.locator('''
            .sidebar,
            .navigation-menu,
            [data-testid="sidebar"],
            .main-nav,
            .side-nav
        ''')
        
        self.sidebar_toggle = self.page.locator('''
            .sidebar-toggle,
            .menu-toggle,
            [data-testid="sidebar-toggle"],
            .hamburger-menu,
            button.navbar-toggler
        ''')
        
        # Navigation menu items
        self.nav_documents = self.page.locator('''
            a:has-text("Documents"),
            a:has-text("מסמכים"),
            [data-testid="nav-documents"],
            .nav-item:has-text("Documents"),
            .nav-item:has-text("מסמכים")
        ''')
        
        self.nav_signatures = self.page.locator('''
            a:has-text("Signatures"),
            a:has-text("חתימות"),
            [data-testid="nav-signatures"],
            .nav-item:has-text("Signatures"),
            .nav-item:has-text("חתימות")
        ''')
        
        self.nav_contacts = self.page.locator('''
            a:has-text("Contacts"),
            a:has-text("אנשי קשר"),
            [data-testid="nav-contacts"],
            .nav-item:has-text("Contacts"),
            .nav-item:has-text("אנשי קשר")
        ''')
        
        self.nav_settings = self.page.locator('''
            a:has-text("Settings"),
            a:has-text("הגדרות"),
            [data-testid="nav-settings"],
            .nav-item:has-text("Settings"),
            .nav-item:has-text("הגדרות")
        ''')
        
        # User profile section
        self.user_profile_section = self.page.locator('''
            .user-profile,
            .profile-section,
            [data-testid="user-profile"],
            .user-info,
            .profile-menu
        ''')
        
        self.user_name = self.page.locator('''
            .user-name,
            .username,
            [data-testid="user-name"],
            .profile-name
        ''')
        
        self.user_email = self.page.locator('''
            .user-email,
            [data-testid="user-email"],
            .profile-email
        ''')
        
        self.logout_button = self.page.locator('''
            button:has-text("Logout"),
            button:has-text("התנתק"),
            a:has-text("Logout"),
            a:has-text("התנתק"),
            [data-testid="logout"],
            .logout-btn
        ''')
        
        # Notifications
        self.notifications_bell = self.page.locator('''
            .notifications-bell,
            .notification-icon,
            [data-testid="notifications"],
            .bell-icon,
            .fa-bell
        ''')
        
        self.notifications_dropdown = self.page.locator('''
            .notifications-dropdown,
            .notification-menu,
            [data-testid="notifications-dropdown"],
            .notifications-list
        ''')
        
        self.notification_items = self.page.locator('''
            .notification-item,
            [data-testid="notification-item"],
            .notification
        ''')
        
        # Search functionality
        self.search_input = self.page.locator('''
            input[placeholder*="Search"],
            input[placeholder*="חיפוש"],
            input[name="search"],
            input[type="search"],
            [data-testid="search-input"],
            .search-input
        ''')
        
        self.search_button = self.page.locator('''
            button:has-text("Search"),
            button:has-text("חיפוש"),
            [data-testid="search-button"],
            .search-btn,
            .fa-search
        ''')
        
        # Tables/Lists
        self.recent_documents_table = self.page.locator('''
            .recent-documents,
            .documents-table,
            [data-testid="recent-documents"],
            table
        ''')
        
        self.table_headers = self.page.locator('thead th, .table-header, [data-testid="table-header"]')
        self.table_rows = self.page.locator('tbody tr, .table-row, [data-testid="table-row"]')
        
        # Pagination
        self.pagination_container = self.page.locator('.pagination, [data-testid="pagination"]')
        self.prev_page_button = self.page.locator('''
            button:has-text("Previous"),
            button:has-text("קודם"),
            .page-prev,
            [data-testid="prev-page"]
        ''')
        self.next_page_button = self.page.locator('''
            button:has-text("Next"),
            button:has-text("הבא"),
            .page-next,
            [data-testid="next-page"]
        ''')
        
        # Breadcrumbs
        self.breadcrumbs = self.page.locator('''
            .breadcrumb,
            .breadcrumbs,
            [data-testid="breadcrumbs"],
            .nav-breadcrumb
        ''')
        
        # Loading indicators
        self.loading_spinner = self.page.locator('.loading, .spinner, [data-testid="loading"]')
        
        # Error/Success messages
        self.success_message = self.page.locator('''
            .alert-success,
            .success-message,
            .toast-success,
            [data-testid="success-message"]
        ''')
        
        self.error_message = self.page.locator('''
            .alert-error,
            .error-message,
            .toast-error,
            [data-testid="error-message"]
        ''')
        
        # Language selector
        self.language_selector = self.page.locator('''
            select[name="language"],
            .language-selector,
            [data-testid="language"],
            .lang-switcher
        ''')
        
        # Theme toggle
        self.theme_toggle = self.page.locator('''
            .theme-toggle,
            .dark-mode-toggle,
            [data-testid="theme-toggle"],
            button[aria-label*="theme"]
        ''')
        
        # Modal dialogs
        self.modal_dialog = self.page.locator('.modal, .dialog, [role="dialog"]')
        self.modal_close_button = self.page.locator('''
            .modal-close,
            .close,
            button[aria-label="Close"],
            [data-testid="modal-close"]
        ''')
        
    def navigate_to_dashboard(self) -> None:
        """Navigate to dashboard page"""
        self.navigate_to(self.dashboard_url)
        self.wait_for_page_load()
        
    def click_dashboard_nav(self) -> None:
        """Click dashboard navigation button"""
        self.click_element(self.dashboard_nav_button)
        
    def get_stats_card_value(self, card_type: str) -> str:
        """Get value from statistics card"""
        card_locators = {
            'documents': self.total_documents_card,
            'pending': self.pending_signatures_card,
            'completed': self.completed_signatures_card,
            'users': self.users_card
        }
        
        if card_type in card_locators:
            card = card_locators[card_type]
            if self.is_visible(card):
                return self.get_text(card)
        return ""
        
    def get_stats_cards_count(self) -> int:
        """Get total number of statistics cards"""
        return self.stats_cards.count()
        
    def click_quick_action(self, action: str) -> None:
        """Click quick action button"""
        action_buttons = {
            'new_document': self.new_document_button,
            'upload_document': self.upload_document_button,
            'invite_users': self.invite_users_button
        }
        
        if action in action_buttons:
            self.click_element(action_buttons[action])
            
    def get_recent_activity_count(self) -> int:
        """Get number of recent activity items"""
        if self.is_visible(self.recent_activity_section):
            return self.activity_items.count()
        return 0
        
    def navigate_to_section(self, section: str) -> None:
        """Navigate to specific section via sidebar"""
        nav_items = {
            'documents': self.nav_documents,
            'signatures': self.nav_signatures,
            'contacts': self.nav_contacts,
            'settings': self.nav_settings
        }
        
        if section in nav_items:
            self.click_element(nav_items[section])
            
    def toggle_sidebar(self) -> None:
        """Toggle sidebar visibility"""
        if self.is_visible(self.sidebar_toggle):
            self.click_element(self.sidebar_toggle)
            
    def search_dashboard(self, query: str) -> None:
        """Search in dashboard"""
        if self.is_visible(self.search_input):
            self.fill_input(self.search_input, query)
            if self.is_visible(self.search_button):
                self.click_element(self.search_button)
                
    def get_user_info(self) -> Dict[str, str]:
        """Get user profile information"""
        user_info = {}
        
        if self.is_visible(self.user_name):
            user_info['name'] = self.get_text(self.user_name)
            
        if self.is_visible(self.user_email):
            user_info['email'] = self.get_text(self.user_email)
            
        return user_info
        
    def click_notifications(self) -> None:
        """Click notifications bell"""
        if self.is_visible(self.notifications_bell):
            self.click_element(self.notifications_bell)
            
    def get_notifications_count(self) -> int:
        """Get number of notifications"""
        self.click_notifications()
        if self.is_visible(self.notifications_dropdown):
            return self.notification_items.count()
        return 0
        
    def logout(self) -> None:
        """Perform logout"""
        if self.is_visible(self.logout_button):
            self.click_element(self.logout_button)
            self.wait_for_page_load()
            
    def switch_language(self, language: str) -> None:
        """Switch dashboard language"""
        if self.is_visible(self.language_selector):
            self.language_selector.select_option(language)
            self.wait_for_page_load()
            
    def get_page_language(self) -> str:
        """Detect current page language"""
        page_content = self.page.content()
        hebrew_indicators = ["לוח בקרה", "מסמכים", "חתימות", "הגדרות", "פעילות אחרונה", "פעולות מהירות"]
        
        if any(hebrew_text in page_content for hebrew_text in hebrew_indicators):
            return "hebrew"
        return "english"
        
    def toggle_theme(self) -> None:
        """Toggle dark/light theme"""
        if self.is_visible(self.theme_toggle):
            self.click_element(self.theme_toggle)
            
    def wait_for_dashboard_load(self) -> None:
        """Wait for dashboard to fully load"""
        # Wait for main content and key elements
        if self.is_visible(self.main_content, timeout=10000):
            self.wait_for_loading_complete()
            
    def wait_for_loading_complete(self) -> None:
        """Wait for loading spinner to disappear"""
        if self.is_visible(self.loading_spinner, timeout=2000):
            self.loading_spinner.wait_for(state="hidden", timeout=self.timeout)
            
    def get_success_message(self) -> str:
        """Get success message text"""
        if self.is_visible(self.success_message, timeout=2000):
            return self.get_text(self.success_message)
        return ""
        
    def get_error_message(self) -> str:
        """Get error message text"""
        if self.is_visible(self.error_message, timeout=2000):
            return self.get_text(self.error_message)
        return ""
        
    def has_success_message(self) -> bool:
        """Check if success message is displayed"""
        return bool(self.get_success_message())
        
    def has_error_message(self) -> bool:
        """Check if error message is displayed"""
        return bool(self.get_error_message())
        
    def is_dashboard_loaded(self) -> bool:
        """Check if dashboard page has loaded successfully"""
        indicators = [
            lambda: self.is_visible(self.main_content, timeout=3000),
            lambda: self.is_visible(self.page_title, timeout=3000),
            lambda: "/dashboard" in self.get_current_url()
        ]
        
        return any(indicator() for indicator in indicators)
        
    def get_recent_documents_count(self) -> int:
        """Get number of recent documents displayed"""
        if self.is_visible(self.recent_documents_table):
            return self.table_rows.count()
        return 0
        
    def get_breadcrumb_text(self) -> str:
        """Get breadcrumb navigation text"""
        if self.is_visible(self.breadcrumbs):
            return self.get_text(self.breadcrumbs)
        return ""
        
    def close_modal(self) -> None:
        """Close any open modal dialog"""
        if self.is_visible(self.modal_dialog):
            if self.is_visible(self.modal_close_button):
                self.click_element(self.modal_close_button)
            else:
                # Try pressing Escape key
                self.page.keyboard.press("Escape")
                
    def validate_dashboard_elements_present(self) -> Dict[str, bool]:
        """Validate that key dashboard elements are present"""
        return {
            "main_content": self.is_visible(self.main_content, timeout=2000),
            "stats_cards": self.get_stats_cards_count() > 0,
            "quick_actions": self.is_visible(self.quick_actions_section, timeout=2000),
            "navigation_menu": self.is_visible(self.sidebar, timeout=2000),
            "user_profile": self.is_visible(self.user_profile_section, timeout=2000)
        }