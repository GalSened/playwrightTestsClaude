# Product Requirements Document (PRD) - WeSign

## 1. Introduction

This document provides a detailed overview of the WeSign system, a web-based platform for digital signatures and document management. The purpose of this PRD is to outline the system's features, functionalities, and requirements to guide the development and testing process. The information contained herein is based on a comprehensive analysis of the live system at wse.comsigntrust.com.

### 1.1. Scope

This PRD covers the core functionalities of the WeSign platform, including user authentication, document management, contact management, template creation, and the complete digital signature workflow. It details the requirements for each module and provides a foundation for future enhancements.

### 1.2. Target Audience

This document is intended for a diverse audience, including:

*   **Product Managers**: To understand the system's capabilities and plan future development.
*   **Developers**: To guide the implementation of new features and bug fixes.
*   **QA Engineers**: To create comprehensive test plans and ensure the system meets quality standards.
*   **Stakeholders**: To provide a clear understanding of the system's functionality and value proposition.

## 2. System Modules and Requirements

### 2.1. Hamburger Menu

The Hamburger Menu, located in the top-left corner of the dashboard, provides access to additional navigation options and system settings. It is a key component for overall system navigation and user experience.

#### 2.1.1. Functional Requirements

- **FR1.1: User Information Display**: The menu displays the logged-in user's name and email address.
- **FR1.2: Group Switching**: A 


button to switch between user groups.
- **FR1.3: Status Indicator**: Displays the user's current status (e.g., "פעיל" - Active).
- **FR1.4: Navigation Icons**: The menu includes three icons at the bottom:
    - **Logout Icon**: A right arrow icon that logs the user out of the system.
    - **My Profile Icon**: A document icon that likely navigates to the user's profile page.
    - **Settings Icon**: A gear icon that likely navigates to the account or system settings page.

#### 2.1.2. Non-Functional Requirements

- **NFR1.1: Responsiveness**: The menu should be responsive and display correctly on all devices.
- **NFR1.2: Accessibility**: The menu should be accessible to users with disabilities.

### 2.2. ראשי (Home) Module

The Home module is the central hub of the WeSign platform, providing users with immediate access to the most critical functionalities.

#### 2.2.1. Functional Requirements

- **FR2.1: File Upload**: The system must provide a clear and intuitive interface for users to upload files.
- **FR2.2: Merge Files**: The system must allow users to select and combine multiple files into a single document.
- **FR2.3: Associate and Send**: The system must provide a streamlined process for associating uploaded files with specific workflows.

#### 2.2.2. Non-Functional Requirements

- **NFR2.1: Performance**: The Home module should load quickly, with all elements rendering promptly.
- **NFR2.2: Usability**: The layout of the Home module should be clean and uncluttered.

### 2.3. אנשי קשר (Contacts) Module

The Contacts module is a critical component of the WeSign platform, enabling users to manage their contact information efficiently.

#### 2.3.1. Functional Requirements

- **FR3.1: Add New Contact**: The system must provide a form for users to manually add new contacts.
- **FR3.2: Import from Excel**: The system must allow users to import contacts from an Excel file.
- **FR3.3: Search and Filter**: The system must provide a robust search functionality.
- **FR3.4: Contact List Display**: The system must display the list of contacts in a clear and organized table.
- **FR3.5: Edit and Delete**: Users must be able to edit and delete contacts.

#### 2.3.2. Non-Functional Requirements

- **NFR3.1: Scalability**: The Contacts module should be able to handle a large number of contacts without performance degradation.
- **NFR3.2: Data Integrity**: The system must ensure the integrity of the contact data.

### 2.4. תבניות (Templates) Module

The Templates module allows users to create, manage, and reuse document templates.

#### 2.4.1. Functional Requirements

- **FR4.1: Create New Template**: The system must provide a user-friendly interface for creating new templates.
- **FR4.2: Search and Filter**: Users must be able to search for templates by title or other metadata.
- **FR4.3: Template List Display**: The system must display the list of templates in a clear and organized table.
- **FR4.4: Template Actions**: The system must provide a set of actions for each template, including Edit, Duplicate, URL, Download, and Delete.
- **FR4.5: Pagination**: The system must include pagination controls to manage large lists of templates.

#### 2.4.2. Non-Functional Requirements

- **NFR4.1: Reusability**: Templates should be easily reusable.
- **NFR4.2: Consistency**: The use of templates should ensure consistency in document formatting.

### 2.5. מסמכים (Documents) Module

The Documents module is the core of the WeSign platform, providing a comprehensive set of tools for managing the entire lifecycle of a document.

#### 2.5.1. Functional Requirements

- **FR5.1: Document Status Filters**: The system must provide a comprehensive set of filters to allow users to view documents based on their status.
- **FR5.2: Search and Filter**: The system must provide a powerful search functionality.
- **FR5.3: Document List Display**: The system must display the list of documents in a clear and organized table.
- **FR5.4: Document Actions**: The system must provide a set of actions for each document, which may vary depending on the document's status.
- **FR5.5: Pagination**: The system must include pagination controls to manage large lists of documents.

#### 2.5.2. Non-Functional Requirements

- **NFR5.1: Security**: The system must ensure the security and integrity of all documents.
- **NFR5.2: Audit Trail**: The system must maintain a detailed audit trail for each document.

### 2.6. העלאת קובץ (Upload File) Module

The File Upload module is the entry point for getting documents into the WeSign system.

#### 2.6.1. Functional Requirements

- **FR6.1: Drag and Drop**: The system must provide a drag-and-drop area for file uploads.
- **FR6.2: File Browser**: The system must provide a button that opens the native file browser.
- **FR6.3: Supported File Types**: The system must support the upload of common document formats.
- **FR6.4: Upload Workflow**: Upon successful upload, the system must seamlessly transition the user to the next step in the workflow.

#### 2.6.2. Non-Functional Requirements

- **NFR6.1: Performance**: The file upload process should be fast and reliable.
- **NFR6.2: Error Handling**: The system must provide clear and concise error messages if an upload fails.

### 2.7. איחוד קבצים (Merge Files) Module

The Merge Files module provides a convenient way for users to combine multiple files into a single document.

#### 2.7.1. Functional Requirements

- **FR7.1: File Selection**: The system must allow users to select multiple files to be merged.
- **FR7.2: File Reordering**: Users must be able to reorder the selected files before the merge operation.
- **FR7.3: Merge Options**: The system should provide options for how the files are merged.
- **FR7.4: Output Format**: The system should allow the user to select the output format for the merged document.

#### 2.7.2. Non-Functional Requirements

- **NFR7.1: Performance**: The merge operation should be performed efficiently.
- **NFR7.2: Data Integrity**: The system must ensure that the content of the original files is preserved in the merged document.

### 2.8. שיוך ושליחה (Associate and Send) Module

The Associate and Send module is a key part of the WeSign workflow, allowing users to associate files with templates and send them for signature.

#### 2.8.1. Functional Requirements

- **FR8.1: Template File Upload**: The system must provide an option for users to upload a template file.
- **FR8.2: XML File Upload**: The system must provide an option for users to upload an XML file.
- **FR8.3: File Association**: The system must associate the uploaded template file with the uploaded XML file.
- **FR8.4: Send for Signature**: Once the document is generated, the system must allow the user to send it for signature.

#### 2.8.2. Non-Functional Requirements

- **NFR8.1: Data Mapping**: The system must accurately map the data from the XML file to the template file.
- **NFR8.2: Error Handling**: The system must provide clear error messages if there are any issues during document generation.

## 3. Signature Workflow

The signature workflow is the core process of the WeSign platform.

### 3.1. Add Signers

After a document is uploaded, the user is taken to the "Add Signers" page.

#### 3.1.1. Functional Requirements

- **FR9.1: Select Signature Type**: The system must allow the user to choose the type of signature required.
- **FR9.2: Add Personal Signer**: For a personal signature, the system should allow the user to select a single recipient.
- **FR9.3: Add Group Signers**: For a group signature, the system must allow the user to select a predefined group of contacts.
- **FR9.4: Online Signature**: For an online signature, the system should provide a way for the user to sign the document directly in the browser.
- **FR9.5: Document Editing**: The system must provide an option to edit the document before sending it for signature.

### 3.2. Signature Process

Once the signers have been added, the document is sent for signature.

#### 3.2.1. Functional Requirements

- **FR10.1: Email/SMS Notifications**: The system must send notifications to recipients.
- **FR10.2: Secure Document Access**: The system must provide a secure way for recipients to access the document.
- **FR10.3: Signature Interface**: The system must provide a user-friendly interface for signing.
- **FR10.4: Signature Placement**: The system should allow the sender to specify where the signature should be placed.
- **FR10.5: Audit Trail**: The system must maintain a detailed audit trail of the signature process.


