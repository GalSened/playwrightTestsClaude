# WeSign API - Complete Endpoint Mapping

**Date:** 2025-10-31
**Source:** C:\Users\gals\source\repos\user-backend\WeSign\Areas\Api\Controllers
**Base URL:** https://devtest.comda.co.il/userapi/

---

## Overview

This document maps all REST API endpoints in the WeSign backend system. The API is organized into 12 controller modules, each handling different aspects of the electronic signature workflow.

**Total Controllers:** 12
**Estimated Total Endpoints:** ~100+
**API Version:** v3
**Authentication:** Bearer Token (JWT)

---

## Controllers Summary

| Controller | Base Route | Purpose | Endpoints Est. |
|------------|-----------|---------|----------------|
| **UsersController** | `/v3/users` | User authentication, profile, token management | ~18 |
| **DocumentCollectionsController** | `/v3/documentcollections` | Document management, upload, distribution | ~25+ |
| **TemplatesController** | `/v3/templates` | Template CRUD, management | ~10 |
| **ContactsController** | `/v3/contacts` | Contact management | ~8 |
| **DistributionController** | `/v3/distribution` | Document distribution workflows | ~12 |
| **SignersController** | `/v3/signers` | Signer management | ~5 |
| **LinksController** | `/v3/links` | Signing link management | ~3 |
| **ConfigurationController** | `/v3/configuration` | System configuration | ~2 |
| **DashboardController** | `/v3/dashboard` | Dashboard data | ~1 |
| **ReportsController** | `/v3/reports` | Reporting endpoints | ~5 |
| **SelfSignController** | `/v3/selfsign` | Self-signing workflows | ~8 |
| **AdminsController** | `/v3/admins` | Admin operations | ~5 |

---

## Detailed Endpoint Mapping

### 1. UsersController (`/v3/users`)

**Purpose:** User authentication, profile management, password operations, token management

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/users` | 🔓 | User sign up |
| PUT | `/v3/users` | 🔒 | Update user profile |
| GET | `/v3/users` | 🔒 | Get own user details |
| GET | `/v3/users/groups` | 🔒 | Get user groups |
| POST | `/v3/users/SwitchGroup/{groupId}` | 🔒 | Switch active user group |
| POST | `/v3/users/resendOtp` | 🔓 | Resend OTP code |
| POST | `/v3/users/validateOtpflow` | 🔓 | Validate OTP login |
| POST | `/v3/users/validateExpiredPasswordFlow` | 🔓 | Validate expired password renewal |
| POST | `/v3/users/login` | 🔓 | User login (returns JWT tokens) |
| GET | `/v3/users/Logout` | 🔒 | User logout |
| PUT | `/v3/users/activation` | 🔓 | Activate user account |
| POST | `/v3/users/activation` | 🔓 | Resend activation link |
| POST | `/v3/users/externalLogin` | 🔓 | External login (AD/SAML) |
| POST | `/v3/users/password` | 🔓 | Reset password (send email) |
| PUT | `/v3/users/password` | 🔓 | Update password with reset token |
| POST | `/v3/users/refresh` | 🔓 | Refresh JWT token |
| POST | `/v3/users/change` | 🔒 | Change password (authenticated) |
| POST | `/v3/users/unsubscribeuser` | 🔒 | Unsubscribe user |
| POST | `/v3/users/changepaymentrule` | 🔒 | Change payment rule |
| POST | `/v3/users/UpdatePhone` | 🔒 | Start phone number update process |
| POST | `/v3/users/UpdatePhoneValidateOtp` | 🔒 | Validate OTP for phone update |

---

### 2. DocumentCollectionsController (`/v3/documentcollections`)

**Purpose:** Document upload, management, distribution, signing workflows

**Main Document Operations:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/documentcollections` | 🔒 | Create new document collection |
| GET | `/v3/documentcollections` | 🔒 | Get all document collections (with filters) |
| GET | `/v3/documentcollections/{id}` | 🔒 | Get specific document collection |
| PUT | `/v3/documentcollections/{id}` | 🔒 | Update document collection |
| DELETE | `/v3/documentcollections/{id}` | 🔒 | Delete document collection |
| PUT | `/v3/documentcollections/deletebatch` | 🔒 | Delete multiple documents |

**Document File Operations:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/documentcollections/{id}/file` | 🔒 | Download document file |
| POST | `/v3/documentcollections/{id}/merge` | 🔒 | Merge documents |
| POST | `/v3/documentcollections/{id}/upload` | 🔒 | Upload additional files |

**Signer Management:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/documentcollections/{id}/signers` | 🔒 | Add signers to document |
| PUT | `/v3/documentcollections/{id}/signer/{signerId}` | 🔒 | Update signer details |
| DELETE | `/v3/documentcollections/{id}/signer/{signerId}` | 🔒 | Remove signer |
| POST | `/v3/documentcollections/{id}/signer/{signerId}/replace` | 🔒 | Replace signer |
| POST | `/v3/documentcollections/{id}/signer/{signerId}/resend` | 🔒 | Resend to signer |

**Distribution & Workflow:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/documentcollections/{id}/distribute` | 🔒 | Distribute document for signing |
| POST | `/v3/documentcollections/{id}/cancel` | 🔒 | Cancel document distribution |
| POST | `/v3/documentcollections/{id}/reactivate` | 🔒 | Reactivate cancelled document |
| GET | `/v3/documentcollections/{id}/status` | 🔒 | Get document status |
| POST | `/v3/documentcollections/{id}/share` | 🔒 | Share document with others |

**Fields & Metadata:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/documentcollections/{id}/fields` | 🔒 | Add/update form fields |
| GET | `/v3/documentcollections/{id}/fields` | 🔒 | Get document fields |
| PUT | `/v3/documentcollections/{id}/metadata` | 🔒 | Update document metadata |

**Additional Operations:**

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/documentcollections/{id}/audit` | 🔒 | Get audit trail |
| GET | `/v3/documentcollections/{id}/certificate` | 🔒 | Get completion certificate |
| POST | `/v3/documentcollections/{id}/remind` | 🔒 | Send reminder to signers |

---

### 3. TemplatesController (`/v3/templates`)

**Purpose:** Document template creation and management

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/templates` | 🔒 | Create new template |
| GET | `/v3/templates` | 🔒 | Get all templates (with search) |
| GET | `/v3/templates/{id}` | 🔒 | Get specific template |
| PUT | `/v3/templates/{id}` | 🔒 | Update template |
| DELETE | `/v3/templates/{id}` | 🔒 | Delete template |
| PUT | `/v3/templates/deletebatch` | 🔒 | Delete multiple templates |
| POST | `/v3/templates/{id}/use` | 🔒 | Create document from template |
| GET | `/v3/templates/{id}/download` | 🔒 | Download template file |
| PUT | `/v3/templates/{id}/fields` | 🔒 | Update template fields |
| GET | `/v3/templates/{id}/preview` | 🔒 | Preview template |

---

### 4. ContactsController (`/v3/contacts`)

**Purpose:** Contact (signer) management

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/contacts` | 🔒 | Create new contact |
| GET | `/v3/contacts` | 🔒 | Get all contacts (with search) |
| GET | `/v3/contacts/{id}` | 🔒 | Get specific contact |
| PUT | `/v3/contacts/{id}` | 🔒 | Update contact |
| DELETE | `/v3/contacts/{id}` | 🔒 | Delete contact |
| POST | `/v3/contacts/bulk` | 🔒 | Create contacts from Excel file |
| PUT | `/v3/contacts/deletebatch` | 🔒 | Delete multiple contacts |
| GET | `/v3/contacts/export` | 🔒 | Export contacts to Excel |

---

### 5. DistributionController (`/v3/distribution`)

**Purpose:** Document distribution management and tracking

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/distribution` | 🔒 | Get distribution items |
| GET | `/v3/distribution/{id}` | 🔒 | Get distribution details |
| PUT | `/v3/distribution/{id}` | 🔒 | Update distribution |
| DELETE | `/v3/distribution/{id}` | 🔒 | Delete distribution |
| GET | `/v3/distribution/search` | 🔒 | Search distributions |
| GET | `/v3/distribution/statistics` | 🔒 | Get distribution statistics |
| POST | `/v3/distribution/{id}/export` | 🔒 | Export distribution data |
| GET | `/v3/distribution/{id}/signers` | 🔒 | Get distribution signers |
| PUT | `/v3/distribution/{id}/settings` | 🔒 | Update distribution settings |
| POST | `/v3/distribution/{id}/resend` | 🔒 | Resend distribution |
| POST | `/v3/distribution/{id}/cancel` | 🔒 | Cancel distribution |

---

### 6. SignersController (`/v3/signers`)

**Purpose:** Signer-specific operations (public endpoints for signing)

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/signers/{token}` | 🔓 | Get signer details by token |
| POST | `/v3/signers/{token}/sign` | 🔓 | Sign document |
| POST | `/v3/signers/{token}/decline` | 🔓 | Decline to sign |
| GET | `/v3/signers/{token}/document` | 🔓 | View document |
| POST | `/v3/signers/{token}/download` | 🔓 | Download signed document |

---

### 7. LinksController (`/v3/links`)

**Purpose:** Signing link management

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/links` | 🔒 | Create signing link |
| GET | `/v3/links` | 🔒 | Get all links |
| DELETE | `/v3/links/{id}` | 🔒 | Delete link |
| GET | `/v3/links/{id}/videoConference` | 🔒 | Get video conference link |

---

### 8. ConfigurationController (`/v3/configuration`)

**Purpose:** System and user configuration

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/configuration` | 🔒 | Get user configuration |
| GET | `/v3/configuration/tablets` | 🔒 | Get tablet configuration |

---

### 9. DashboardController (`/v3/dashboard`)

**Purpose:** Dashboard statistics and views

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/dashboard/view` | 🔓 | Get dashboard view data |

---

### 10. ReportsController (`/v3/reports`)

**Purpose:** Reporting and analytics

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/reports/usage` | 🔒 | Get usage report |
| GET | `/v3/reports/UsageData` | 🔒 | Get detailed usage data |
| GET | `/v3/reports/documents` | 🔒 | Get documents report |
| GET | `/v3/reports/signers` | 🔒 | Get signers report |
| POST | `/v3/reports/export` | 🔒 | Export report data |

---

### 11. SelfSignController (`/v3/selfsign`)

**Purpose:** Self-signing workflows

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| POST | `/v3/selfsign` | 🔒 | Create self-sign document |
| GET | `/v3/selfsign/{id}` | 🔒 | Get self-sign document |
| POST | `/v3/selfsign/{id}/sign` | 🔒 | Sign own document |
| POST | `/v3/selfsign/{id}/fields` | 🔒 | Add signature fields |
| GET | `/v3/selfsign/{id}/download` | 🔒 | Download signed document |
| DELETE | `/v3/selfsign/{id}` | 🔒 | Delete self-sign document |
| POST | `/v3/selfsign/gov` | 🔒 | Government signing workflow |
| PUT | `/v3/selfsign/{id}` | 🔒 | Update self-sign document |

---

### 12. AdminsController (`/v3/admins`)

**Purpose:** Administrative operations and user management

| Method | Endpoint | Auth | Summary |
|--------|----------|------|---------|
| GET | `/v3/admins/users` | 🔒 | Get all users (admin) |
| POST | `/v3/admins/users` | 🔒 | Create user (admin) |
| PUT | `/v3/admins/users/{id}` | 🔒 | Update user (admin) |
| DELETE | `/v3/admins/users/{id}` | 🔒 | Delete user (admin) |
| GET | `/v3/admins/groups` | 🔒 | Get all groups |

---

## API Patterns & Conventions

### Authentication

**Public Endpoints** (🔓):
- User registration/login
- Password reset
- Account activation
- Signer operations (token-based)
- Dashboard view

**Authenticated Endpoints** (🔒):
- All document operations
- Template management
- Contact management
- User profile updates
- Admin operations

**Token Types:**
- `jwtToken` - Main authentication token (short-lived)
- `refreshToken` - Token refresh (longer-lived)
- `authToken` - Additional auth context
- Signer tokens - Time-limited, single-use signing tokens

### Common Query Parameters

**Pagination:**
- `offset` - Starting record (default: 0)
- `limit` - Records per page (default: 20)

**Filtering:**
- `key` - Search keyword
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `popular` - Sort by popularity
- `recent` - Sort by recent activity

**Sorting:**
- Varies by endpoint, commonly includes creation date, name, status

### Response Patterns

**Success Responses:**
- `200 OK` - Successful request
- `201 Created` - Resource created
- `204 No Content` - Successful deletion

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Common Response Headers:**
- `x-total-count` - Total records (pagination)
- `Authorization` - Bearer token

### Data Types & Enums

**UserLanguage:**
- `1` = English
- `2` = Hebrew

**UserType:**
- `1` = Basic
- `2` = Editor
- `3` = CompanyAdmin

**SendingMethod:**
- `1` = SMS
- `2` = Email
- `3` = Tablet

**FieldType (Signature):**
- `1` = Graphic
- `2` = SmartCard
- `3` = Server

**FieldType (Text):**
- `1` = Text
- `2` = Date
- `3` = Number
- `4` = Phone
- `5` = Email
- `6` = Custom
- `7` = Time

**DocumentStatus:**
- `0` = Draft
- `1` = Pending
- `2` = Completed
- `3` = Cancelled

---

## Integration Notes

### Swagger Documentation

The API includes Swagger documentation accessible at:
- **Production:** https://wesign3.comda.co.il/userapi/swagger/index.html
- **Local:** https://localhost:44348/swagger/index.html

### Rate Limiting

No explicit rate limiting information found in controllers. Implement client-side throttling as needed.

### File Upload

- Base64 encoding for file content
- Supported formats: PDF, DOCX, XLSX, images
- Maximum file size limits not documented in controllers

### Error Handling

All endpoints return standardized error responses:
```json
{
  "error": {
    "code": "numeric_error_code",
    "message": "Error description"
  }
}
```

---

## Comparison with Postman Test Collection

**Test Collection Coverage:**
- Users Module: ✅ Well covered (authentication, profile, tokens)
- Distribution: ✅ Well covered
- Links: ✅ Covered
- Configuration: ✅ Covered
- Files: ⚠️ Not explicitly in controllers (may be part of DocumentCollections)
- Statistics: ⚠️ Partial (covered by Reports + Dashboard)
- Tablets: ✅ Covered (Configuration controller)
- Templates: ❌ Missing from test collection (needs to be added)
- Contacts: ❌ Missing from test collection (needs to be added)
- SelfSign: ❌ Missing from test collection (needs to be added)

**Recommendation:** Expand Postman collection to include Templates, Contacts, and SelfSign modules.

---

## Next Steps

1. ✅ **Complete:** API endpoint mapping
2. ⏭️ **TODO:** Extract request/response DTOs for each endpoint
3. ⏭️ **TODO:** Document error codes and their meanings
4. ⏭️ **TODO:** Create endpoint-to-test mapping matrix
5. ⏭️ **TODO:** Identify untested endpoints
6. ⏭️ **TODO:** Generate Postman collection for missing modules

---

**Document Status:** Initial Draft - Pending verification against actual controller implementations
**Last Updated:** 2025-10-31
**Maintainer:** QA Team
