# Feature: {PAGE_NAME} - {Brief Description}
# Page Key: {PAGE_KEY}
# Priority: {P0/P1/P2}
# Owner: {TEAM_NAME}
# Created: {DATE}

@{PAGE_KEY} @{priority-tag} @{category-tag}
Feature: {PAGE_NAME}
  As a {user_role}
  I want to {action}
  So that {business_value}

  Background:
    Given the application is running at "http://localhost:3001"
    And the backend API is running at "http://localhost:8082"
    And the user is authenticated with valid credentials

  # ========================================
  # HAPPY PATH SCENARIOS
  # ========================================

  @smoke @critical @happy-path
  Scenario: {Happy Path 1} - {Brief Description}
    Given {precondition 1}
    And {precondition 2}
    When {action 1}
    And {action 2}
    Then {expected outcome 1}
    And {expected outcome 2}
    And the system logs show "{log_message}" with correlation id
    And the database contains {expected_data}
    And the response time is less than {X} milliseconds

  @smoke @happy-path
  Scenario: {Happy Path 2} - {Brief Description}
    Given {precondition}
    When {action}
    Then {expected outcome}
    And {observable side effect}

  # ========================================
  # EDGE CASES
  # ========================================

  @edge-case @regression
  Scenario: {Edge Case 1} - {Brief Description}
    Given {edge_condition_1}
    And {edge_condition_2}
    When {action}
    Then {expected_behavior}
    And {system_handles_gracefully}

  @edge-case
  Scenario: {Edge Case 2} - Empty/Null/Boundary Values
    Given {boundary_condition}
    When {action}
    Then {expected_behavior}
    And no errors are thrown
    And appropriate user feedback is displayed

  # ========================================
  # ERROR HANDLING
  # ========================================

  @error-handling @regression
  Scenario: {Error 1} - {Brief Description}
    Given {precondition}
    When {action_that_causes_error}
    Then the user sees error message "{error_message}"
    And the error message is displayed in the UI
    And the system logs error code "{error_code}" with correlation id
    And the system state remains consistent
    And the user can recover from the error

  @error-handling
  Scenario: {Error 2} - Network/Timeout Errors
    Given the backend API is slow or unresponsive
    When {action}
    Then the user sees a timeout error message
    And a retry mechanism is available
    And the system gracefully degrades

  @error-handling
  Scenario: {Error 3} - Validation Errors
    Given {precondition}
    When the user enters invalid data "{invalid_data}"
    And submits the form
    Then validation error "{error_message}" is displayed
    And the invalid field is highlighted
    And the form is not submitted
    And the user can correct the error

  # ========================================
  # AUTHENTICATION & AUTHORIZATION
  # ========================================

  @security @authentication
  Scenario: Unauthenticated User Access
    Given the user is not authenticated
    When the user attempts to access "{PAGE_URL}"
    Then the user is redirected to the login page
    And the original URL is preserved for redirect after login
    And an appropriate message is displayed

  @security @authorization
  Scenario: Unauthorized User Access - Insufficient Permissions
    Given the user is authenticated with role "{role}"
    And the user does not have permission to access "{feature}"
    When the user attempts to access "{PAGE_URL}"
    Then the user sees a "403 Forbidden" error
    And an appropriate message is displayed
    And the system logs the unauthorized access attempt

  # ========================================
  # INTERNATIONALIZATION (i18n)
  # ========================================

  @i18n @hebrew
  Scenario: Page Display in Hebrew
    Given the user has selected Hebrew language
    When the user navigates to "{PAGE_URL}"
    Then all UI text is displayed in Hebrew
    And the layout is Right-to-Left (RTL)
    And dates are formatted according to Hebrew locale
    And numbers are formatted according to Hebrew locale

  @i18n @english
  Scenario: Page Display in English
    Given the user has selected English language
    When the user navigates to "{PAGE_URL}"
    Then all UI text is displayed in English
    And the layout is Left-to-Right (LTR)
    And dates are formatted according to English locale
    And numbers are formatted according to English locale

  @i18n
  Scenario: Language Switching
    Given the user is viewing the page in Hebrew
    When the user switches to English language
    Then the page content is immediately displayed in English
    And the layout changes to LTR
    And the user's preference is persisted
    And the page state is preserved (no data loss)

  # ========================================
  # ACCESSIBILITY (a11y)
  # ========================================

  @accessibility @keyboard
  Scenario: Keyboard Navigation
    Given the user is on the page
    When the user navigates using only the keyboard (Tab, Enter, Escape, Arrow keys)
    Then all interactive elements are reachable
    And focus indicators are visible
    And the tab order is logical
    And all actions can be completed without a mouse

  @accessibility @screen-reader
  Scenario: Screen Reader Compatibility
    Given a screen reader is active
    When the user navigates the page
    Then all content is announced correctly
    And all interactive elements have proper ARIA labels
    And all images have alt text
    And form fields have associated labels
    And error messages are announced

  @accessibility @wcag
  Scenario: WCAG 2.1 AA Compliance
    Given the page is loaded
    When an automated accessibility scan is performed
    Then there are zero critical accessibility issues
    And there are zero major accessibility issues
    And color contrast ratios meet WCAG 2.1 AA standards
    And all form inputs have labels
    And all buttons have accessible names

  # ========================================
  # PERFORMANCE
  # ========================================

  @performance @critical
  Scenario: Page Load Performance - Critical Path
    Given the user is authenticated
    When the user navigates to "{PAGE_URL}"
    Then the page loads in less than 2 seconds (p95)
    And Time to Interactive (TTI) is less than 3 seconds
    And there are no layout shifts (CLS < 0.1)
    And there are no blocking resources

  @performance
  Scenario: API Response Performance
    Given the user is on the page
    When the user performs "{action}"
    Then the API responds in less than 1 second (p95)
    And the UI provides immediate feedback (loading state)
    And the UI updates smoothly without jank

  @performance
  Scenario: Large Data Set Handling
    Given the page needs to display {X} records
    When the page loads
    Then pagination or virtual scrolling is implemented
    And only visible records are rendered
    And scrolling is smooth (60 fps)
    And memory usage is stable (no leaks)

  # ========================================
  # DATA INTEGRITY & STATE MANAGEMENT
  # ========================================

  @data-integrity
  Scenario: Data Consistency - CRUD Operations
    Given the user creates/updates data on the page
    When the data is submitted
    Then the data is correctly saved to the database
    And the UI reflects the updated data
    And the data is correctly retrieved on page reload
    And concurrent updates are handled correctly (optimistic locking)

  @state-management
  Scenario: State Persistence - Page Refresh
    Given the user has made changes on the page
    And the changes are not yet saved
    When the user refreshes the page
    Then the user is warned about unsaved changes
    And the user can choose to stay or leave
    And unsaved data is preserved (if applicable)

  @state-management
  Scenario: State Consistency - Navigation
    Given the user has interacted with the page
    When the user navigates to another page and back
    Then the page state is correctly restored
    And the scroll position is preserved (if applicable)
    And the form data is preserved (if applicable)

  # ========================================
  # INTEGRATION & API CONTRACTS
  # ========================================

  @integration @api
  Scenario: API Contract - Success Response
    Given the user performs "{action}"
    When the API is called
    Then the response status is 200
    And the response body matches the schema "{schema_name}"
    And all required fields are present
    And field types are correct
    And the UI correctly handles the response

  @integration @api
  Scenario: API Contract - Error Response
    Given the API returns an error
    When the user performs "{action}"
    Then the response status is {4xx/5xx}
    And the error response matches the schema "{error_schema_name}"
    And the error message is user-friendly
    And the UI correctly displays the error
    And the error is logged for debugging

  # ========================================
  # CROSS-BROWSER & CROSS-DEVICE
  # ========================================

  @cross-browser @chromium
  Scenario: Functionality in Chromium
    Given the user is using Chromium browser
    When the user performs all critical actions
    Then all functionality works as expected
    And the UI renders correctly
    And there are no console errors

  @cross-browser @firefox
  Scenario: Functionality in Firefox
    Given the user is using Firefox browser
    When the user performs all critical actions
    Then all functionality works as expected
    And the UI renders correctly
    And there are no console errors

  @cross-browser @webkit
  Scenario: Functionality in WebKit (Safari)
    Given the user is using WebKit browser
    When the user performs all critical actions
    Then all functionality works as expected
    And the UI renders correctly
    And there are no console errors

  # ========================================
  # MONITORING & OBSERVABILITY
  # ========================================

  @monitoring
  Scenario: Error Logging and Correlation
    Given the user encounters an error
    When the error occurs
    Then the error is logged to the backend
    And the log entry includes a correlation ID
    And the log entry includes user context (user ID, session ID)
    And the log entry includes stack trace
    And the correlation ID is displayed to the user (for support)

  @monitoring
  Scenario: Performance Metrics Collection
    Given the user interacts with the page
    When key actions are performed
    Then performance metrics are collected (timing, resources)
    And metrics are sent to the analytics backend
    And metrics include page load time, API response time, user actions

  # ========================================
  # ADDITIONAL SCENARIOS (CUSTOMIZE PER PAGE)
  # ========================================

  # Add page-specific scenarios here
  # Examples:
  # - Specific business logic validation
  # - Complex workflows
  # - Integration with external systems
  # - Real-time updates (WebSocket, polling)
  # - File uploads/downloads
  # - Drag-and-drop interactions
  # - Multi-step wizards
  # - Conditional logic based on user roles/permissions

---

# NOTES:
# - Replace all {placeholders} with actual values
# - Remove unused scenarios
# - Add page-specific scenarios
# - Ensure all scenarios are testable with clear expected outcomes
# - Link scenarios to test implementations
# - Keep scenarios focused and atomic (one behavior per scenario)
# - Use meaningful tags for filtering and reporting
