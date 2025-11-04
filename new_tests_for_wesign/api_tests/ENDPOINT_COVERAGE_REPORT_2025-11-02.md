# WeSign API - Endpoint Coverage Report

**Generated:** 2025-11-02
**Purpose:** Detailed mapping of all API endpoints and their test coverage status
**Total Controllers:** 12
**Total Endpoints:** ~117
**Total Tests:** 170

---

## 📊 Coverage Summary

| Controller                              | Endpoints     | Tested       | Untested     | Coverage      |
| --------------------------------------- | ------------- | ------------ | ------------ | ------------- |
| **UsersController**               | 21            | 20           | 1            | 95% ✅        |
| **TemplatesController**           | 11            | 11           | 0            | 100% ✅       |
| **ContactsController**            | 14            | 14           | 0            | 100% ✅       |
| **SelfSignController**            | 8             | 8            | 0            | 100% ✅       |
| **AdminsController**              | 9             | 9            | 0            | 100% ✅       |
| **DistributionController**        | 12            | 11           | 1            | 92% ✅        |
| **LinksController**               | 4             | 4            | 0            | 100% ✅       |
| **ConfigurationController**       | 2             | 2            | 0            | 100% ✅       |
| **DashboardController**           | 1             | 1            | 0            | 100% ✅       |
| **DocumentCollectionsController** | 28            | 14           | 14           | 50% ⚠️      |
| **ReportsController**             | 5             | 4            | 1            | 80% ✅        |
| **SignersController**             | 1             | 1            | 0            | 100% ✅       |
| **TOTAL**                         | **116** | **99** | **17** | **85%** |

---

## 1️⃣ UsersController - 21 Endpoints (95% Coverage)

**File:** `WeSign\Areas\Api\Controllers\UsersController.cs`

### ✅ TESTED (20 endpoints)

| Method | Endpoint                         | Test Collection | Test Name               |
| ------ | -------------------------------- | --------------- | ----------------------- |
| POST   | `/v3/users/login`              | Main Suite      | User Login - Happy Path |
| POST   | `/v3/users/register`           | Main Suite      | User Registration       |
| POST   | `/v3/users/refresh`            | Main Suite      | Refresh Token           |
| GET    | `/v3/users/me`                 | Main Suite      | Get User Profile        |
| PUT    | `/v3/users/me`                 | Main Suite      | Update User Profile     |
| PUT    | `/v3/users/phone`              | Main Suite      | Update Phone Number     |
| POST   | `/v3/users/password/reset`     | Main Suite      | Password Reset Request  |
| PUT    | `/v3/users/password`           | Main Suite      | Change Password         |
| POST   | `/v3/users/otp/request`        | Main Suite      | Request OTP             |
| POST   | `/v3/users/otp/validate`       | Main Suite      | Validate OTP            |
| POST   | `/v3/users/logout`             | Main Suite      | User Logout             |
| GET    | `/v3/users/groups`             | Main Suite      | Get User Groups         |
| PUT    | `/v3/users/group`              | Main Suite      | Switch Group            |
| GET    | `/v3/users/settings`           | Main Suite      | Get Settings            |
| PUT    | `/v3/users/settings`           | Main Suite      | Update Settings         |
| POST   | `/v3/users/avatar`             | Main Suite      | Upload Avatar           |
| DELETE | `/v3/users/avatar`             | Main Suite      | Delete Avatar           |
| GET    | `/v3/users/notifications`      | Main Suite      | Get Notifications       |
| PUT    | `/v3/users/notifications/{id}` | Main Suite      | Mark Notification Read  |
| POST   | `/v3/users/devices`            | Main Suite      | Register Device         |

### ❌ UNTESTED (1 endpoint)

| Method | Endpoint                     | Purpose                           |
| ------ | ---------------------------- | --------------------------------- |
| POST   | `/v3/users/external/login` | External authentication (AD/SAML) |

---

## 2️⃣ TemplatesController - 11 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\TemplatesController.cs`
**Test Collection:** `Templates_Module_Tests.postman_collection.json` (17 tests)

### ✅ ALL TESTED (11 endpoints)

| Method | Endpoint                            | Test Name                         |
| ------ | ----------------------------------- | --------------------------------- |
| POST   | `/v3/templates`                   | Create Template - PDF Upload      |
| GET    | `/v3/templates`                   | Get All Templates with Pagination |
| GET    | `/v3/templates/{id}`              | Get Template by ID                |
| PUT    | `/v3/templates/{id}`              | Update Template                   |
| DELETE | `/v3/templates/{id}`              | Delete Template                   |
| POST   | `/v3/templates/{id}`              | Duplicate Template                |
| GET    | `/v3/templates/{id}/pages`        | Get Template Pages Count          |
| GET    | `/v3/templates/{id}/pages/{page}` | Get Specific Page                 |
| GET    | `/v3/templates/{id}/pages/range`  | Get Page Range                    |
| GET    | `/v3/templates/{id}/download`     | Download Template PDF             |
| POST   | `/v3/templates/merge`             | Merge Templates                   |
| PUT    | `/v3/templates/deletebatch`       | Batch Delete Templates            |

---

## 3️⃣ ContactsController - 14 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\ContactsController.cs`
**Test Collection:** `Contacts_Module_Tests.postman_collection.json` (19 tests)

### ✅ ALL TESTED (14 endpoints)

| Method | Endpoint                                      | Test Name                    |
| ------ | --------------------------------------------- | ---------------------------- |
| POST   | `/v3/contacts`                              | Create Contact - Happy Path  |
| POST   | `/v3/contacts/bulk`                         | Bulk Create Contacts         |
| GET    | `/v3/contacts`                              | Get All Contacts with Search |
| GET    | `/v3/contacts/{id}`                         | Get Contact by ID            |
| PUT    | `/v3/contacts/{id}`                         | Update Contact               |
| DELETE | `/v3/contacts/{id}`                         | Delete Contact               |
| PUT    | `/v3/contacts/deletebatch`                  | Batch Delete Contacts        |
| GET    | `/v3/contacts/Groups`                       | Get All Contact Groups       |
| POST   | `/v3/contacts/Group`                        | Create Contact Group         |
| GET    | `/v3/contacts/Group/{id}`                   | Get Contact Group by ID      |
| PUT    | `/v3/contacts/Group/{id}`                   | Update Contact Group         |
| DELETE | `/v3/contacts/Group/{id}`                   | Delete Contact Group         |
| GET    | `/v3/contacts/signatures/{docCollectionId}` | Get Signature Images         |
| PUT    | `/v3/contacts/signatures`                   | Update Signature Images      |

---

## 4️⃣ SelfSignController - 8 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\SelfSignController.cs`
**Test Collection:** `SelfSign_Module_Tests.postman_collection.json` (19 tests)

### ✅ ALL TESTED (8 endpoints)

| Method | Endpoint                                    | Test Name                       |
| ------ | ------------------------------------------- | ------------------------------- |
| POST   | `/v3/selfsign`                            | Create SelfSign Document        |
| PUT    | `/v3/selfsign`                            | Update SelfSign Document - Save |
| DELETE | `/v3/selfsign/{id}`                       | Delete SelfSign Document        |
| GET    | `/v3/selfsign/download/smartcard`         | Download SmartCard Client       |
| POST   | `/v3/selfsign/sign`                       | Sign Using Signer1              |
| POST   | `/v3/selfsign/CreateSmartCardSigningFlow` | Create SmartCard Flow           |
| POST   | `/v3/selfsign/sign/verify`                | Verify Signer1 Credential       |
| POST   | `/v3/selfsign/CheckidentityFlowEIDASSign` | Check Identity Flow eIDAS       |

---

## 5️⃣ AdminsController - 9 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\AdminsController.cs`
**Test Collection:** `Admins_Module_Tests.postman_collection.json` (18 tests)

### ✅ ALL TESTED (9 endpoints)

| Method | Endpoint                    | Test Name                   |
| ------ | --------------------------- | --------------------------- |
| POST   | `/v3/admins/groups`       | Create Admin Group          |
| GET    | `/v3/admins/groups`       | Get All Admin Groups        |
| PUT    | `/v3/admins/groups/{id}`  | Update Admin Group          |
| DELETE | `/v3/admins/groups/{id}`  | Delete Admin Group          |
| POST   | `/v3/admins/users`        | Create User (Admin)         |
| GET    | `/v3/admins/users`        | Get All Users with Search   |
| PUT    | `/v3/admins/users/{id}`   | Update User (Admin)         |
| DELETE | `/v3/admins/users/{id}`   | Delete User (Admin)         |
| PUT    | `/v3/admins/dev/password` | Update Password (Dev Admin) |

---

## 6️⃣ DistributionController - 12 Endpoints (92% Coverage)

**File:** `WeSign\Areas\Api\Controllers\DistributionController.cs`
**Test Collection:** Main Suite (15 tests)

### ✅ TESTED (11 endpoints)

| Method | Endpoint                                     | Test Collection | Test Name                     |
| ------ | -------------------------------------------- | --------------- | ----------------------------- |
| POST   | `/v3/distribution`                         | Main Suite      | Create Distribution - Simple  |
| POST   | `/v3/distribution/complex`                 | Main Suite      | Create Distribution - Complex |
| GET    | `/v3/distribution/{id}`                    | Main Suite      | Get Distribution Details      |
| PUT    | `/v3/distribution/{id}`                    | Main Suite      | Update Distribution           |
| DELETE | `/v3/distribution/{id}`                    | Main Suite      | Delete Distribution           |
| POST   | `/v3/distribution/{id}/send`               | Main Suite      | Send Distribution             |
| POST   | `/v3/distribution/{id}/signers`            | Main Suite      | Add Signers to Distribution   |
| PUT    | `/v3/distribution/{id}/signers/{signerId}` | Main Suite      | Update Signer                 |
| DELETE | `/v3/distribution/{id}/signers/{signerId}` | Main Suite      | Remove Signer                 |
| GET    | `/v3/distribution/{id}/status`             | Main Suite      | Get Distribution Status       |
| POST   | `/v3/distribution/{id}/resend`             | Main Suite      | Resend to Signer              |

### ❌ UNTESTED (1 endpoint)

| Method | Endpoint                         | Purpose                           |
| ------ | -------------------------------- | --------------------------------- |
| PUT    | `/v3/distribution/{id}/fields` | Update signature fields placement |

---

## 7️⃣ LinksController - 4 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\LinksController.cs`
**Test Collection:** Main Suite (15 tests)

### ✅ ALL TESTED (4 endpoints)

| Method | Endpoint           | Test Name            |
| ------ | ------------------ | -------------------- |
| POST   | `/v3/links`      | Create Signing Link  |
| GET    | `/v3/links/{id}` | Get Link Details     |
| PUT    | `/v3/links/{id}` | Update Link Settings |
| DELETE | `/v3/links/{id}` | Delete Link          |

---

## 8️⃣ ConfigurationController - 2 Endpoints (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\ConfigurationController.cs`
**Test Collection:** Main Suite (14 tests)

### ✅ ALL TESTED (2 endpoints)

| Method | Endpoint              | Test Name                 |
| ------ | --------------------- | ------------------------- |
| GET    | `/v3/configuration` | Get User Configuration    |
| PUT    | `/v3/configuration` | Update User Configuration |

---

## 9️⃣ DashboardController - 1 Endpoint (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\DashboardController.cs`
**Test Collection:** Main Suite (1 test)

### ✅ ALL TESTED (1 endpoint)

| Method | Endpoint                | Test Name                |
| ------ | ----------------------- | ------------------------ |
| GET    | `/v3/dashboard/stats` | Get Dashboard Statistics |

---

## 🔟 DocumentCollectionsController - 28 Endpoints (50% Coverage) ⚠️

**File:** `WeSign\Areas\Api\Controllers\DocumentCollectionsController.cs` (1,218 lines - largest controller)
**Test Collection:** Main Suite Files Module (14 tests)

### ✅ TESTED (14 endpoints)

| Method | Endpoint                                                                   | Test Collection | Test Name                      |
| ------ | -------------------------------------------------------------------------- | --------------- | ------------------------------ |
| GET    | `/v3/documentcollections`                                                | Main Suite      | Get All Documents with Filters |
| GET    | `/v3/documentcollections/{id}`                                           | Main Suite      | Download Document (PDF/ZIP)    |
| POST   | `/v3/documentcollections`                                                | Main Suite      | Create Document Collection     |
| DELETE | `/v3/documentcollections/{id}`                                           | Main Suite      | Delete Document Collection     |
| PUT    | `/v3/documentcollections/deletebatch`                                    | Main Suite      | Batch Delete Documents         |
| PUT    | `/v3/documentcollections/{id}/cancel`                                    | Main Suite      | Cancel Document Collection     |
| GET    | `/v3/documentcollections/{id}/signers/{signerId}/method/{sendingMethod}` | Main Suite      | Resend to Signer               |
| GET    | `/v3/documentcollections/{collectionId}/reactivate`                      | Main Suite      | Reactivate Document            |
| GET    | `/v3/documentcollections/{id}/DocumentCollectionLinks`                   | Main Suite      | Get Signing Links              |
| POST   | `/v3/documentcollections/share`                                          | Main Suite      | Share Document                 |
| GET    | `/v3/documentcollections/export`                                         | Main Suite      | Export Documents List          |
| GET    | `/v3/documentcollections/{id}/audit/{offset}`                            | Main Suite      | Get Audit Trail                |
| GET    | `/v3/documentcollections/{id}/documents/{documentId}/pages/{page}`       | Main Suite      | Get Document Page              |
| PUT    | `/v3/documentcollections/{id}/signer/{signerId}/replace`                 | Main Suite      | Replace Signer                 |

### ❌ UNTESTED (14 endpoints) - PRIORITY EXPANSION

| Method | Endpoint                                                          | Purpose                           | Priority |
| ------ | ----------------------------------------------------------------- | --------------------------------- | -------- |
| POST   | `/v3/documentcollections/downloadbatch`                         | Batch download multiple documents | HIGH     |
| GET    | `/v3/documentcollections/{id}/ExtraInfo/json`                   | Get document extra info as JSON   | MEDIUM   |
| GET    | `/v3/documentcollections/{id}/json`                             | Get document as JSON              | MEDIUM   |
| GET    | `/v3/documentcollections/{id}/signer/{signerId}`                | Download signer attachment        | HIGH     |
| POST   | `/v3/documentcollections` (CreateSimpleDocument)                | Create simple document workflow   | HIGH     |
| GET    | `/v3/documentcollections` (GetPagesCountByDocumentId)           | Get pages count for document      | MEDIUM   |
| GET    | `/v3/documentcollections/{id}/documents/{documentId}`           | Get all document pages info       | MEDIUM   |
| GET    | `/v3/documentcollections/exportDistribution`                    | Export distribution data          | MEDIUM   |
| GET    | `/v3/documentcollections/{id}/fields`                           | Export PDF fields                 | HIGH     |
| GET    | `/v3/documentcollections/{id}/fields/json`                      | Export PDF fields as JSON         | MEDIUM   |
| GET    | `/v3/documentcollections/{id}/fields/CsvXml`                    | Export PDF fields as CSV/XML      | LOW      |
| PUT    | `/v3/documentcollections/{id}/serversign`                       | Server-side signing (extra flow)  | HIGH     |
| GET    | `/v3/documentcollections` (GetDocumentCollectionData)           | Get specific document data        | MEDIUM   |
| GET    | `/v3/documentcollections` (GetDocumentCollectionLiveSenderLink) | Get live sender link              | MEDIUM   |

---

## 1️⃣1️⃣ ReportsController - 5 Endpoints (80% Coverage)

**File:** `WeSign\Areas\Api\Controllers\ReportsController.cs`
**Test Collection:** Main Suite Statistics Module (14 tests)

### ✅ TESTED (4 endpoints)

| Method | Endpoint                         | Test Collection | Test Name                  |
| ------ | -------------------------------- | --------------- | -------------------------- |
| GET    | `/v3/reports/UsageData`        | Main Suite      | Get Usage Data Report      |
| POST   | `/v3/reports/FrequencyReports` | Main Suite      | Create Frequency Report    |
| GET    | `/v3/reports/FrequencyReports` | Main Suite      | Get Frequency Reports List |
| DELETE | `/v3/reports/FrequencyReports` | Main Suite      | Delete Frequency Report    |

### ❌ UNTESTED (1 endpoint)

| Method | Endpoint        | Purpose                        | Priority |
| ------ | --------------- | ------------------------------ | -------- |
| GET    | `/v3/reports` | Download frequency report file | MEDIUM   |

---

## 1️⃣2️⃣ SignersController - 1 Endpoint (100% Coverage) ✅

**File:** `WeSign\Areas\Api\Controllers\SignersController.cs`
**Test Collection:** Main Suite (covered in Distribution tests)

### ✅ ALL TESTED (1 endpoint)

| Method | Endpoint                                       | Test Name                                       |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| PUT    | `/v3/signers/{id}/signer/{signerId}/replace` | Replace Signer (covered in DocumentCollections) |

**Note:** This endpoint is actually a duplicate of DocumentCollectionsController's ReplaceSigner endpoint.

---

## 🎯 Priority Recommendations

### HIGH PRIORITY (15 endpoints - 13% gap)

Endpoints that are critical for complete workflow coverage:

1. **DocumentCollections - Batch Download** (POST `/documentcollections/downloadbatch`)
2. **DocumentCollections - Signer Attachments** (GET `/documentcollections/{id}/signer/{signerId}`)
3. **DocumentCollections - Simple Document Creation** (POST `/documentcollections` - CreateSimpleDocument variant)
4. **DocumentCollections - PDF Fields Export** (GET `/documentcollections/{id}/fields`)
5. **DocumentCollections - Server Sign** (PUT `/documentcollections/{id}/serversign`)
6. **Distribution - Fields Update** (PUT `/distribution/{id}/fields`)

### MEDIUM PRIORITY (9 endpoints - 8% gap)

Endpoints that enhance coverage but are less critical:

7. **DocumentCollections - Extra Info JSON** (GET `/documentcollections/{id}/ExtraInfo/json`)
8. **DocumentCollections - Document as JSON** (GET `/documentcollections/{id}/json`)
9. **DocumentCollections - Pages Count** (GET `/documentcollections` - GetPagesCountByDocumentId)
10. **DocumentCollections - All Pages Info** (GET `/documentcollections/{id}/documents/{documentId}`)
11. **DocumentCollections - Export Distribution** (GET `/documentcollections/exportDistribution`)
12. **DocumentCollections - Fields JSON** (GET `/documentcollections/{id}/fields/json`)
13. **DocumentCollections - Document Data** (GET `/documentcollections` - GetDocumentCollectionData)
14. **DocumentCollections - Live Sender Link** (GET `/documentcollections` - GetDocumentCollectionLiveSenderLink)
15. **Reports - Download Report** (GET `/reports`)

### LOW PRIORITY (2 endpoints - 2% gap)

16. **DocumentCollections - Fields CSV/XML** (GET `/documentcollections/{id}/fields/CsvXml`)
17. **Users - External Login** (POST `/users/external/login`)

---

## 📈 Coverage Improvement Plan

### Phase 1: DocumentCollections Expansion (+14 endpoints)

**Target:** 50% → 100% coverage
**Effort:** 12-15 new tests
**Impact:** Closes largest gap, brings overall coverage to ~97%

### Phase 2: Minor Gaps (+3 endpoints)

**Target:** Close remaining gaps
**Effort:** 3-5 new tests
**Impact:** Achieves 100% endpoint coverage

### Expected Final Coverage: **100% (116/116 endpoints)**

---

## 📝 Test Collection Files

| File Name                                           | Tests         | Endpoints Covered                |
| --------------------------------------------------- | ------------- | -------------------------------- |
| `WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json` | 97            | 60+ endpoints across 8 modules   |
| `Templates_Module_Tests.postman_collection.json`  | 17            | 11 endpoints (100%)              |
| `Contacts_Module_Tests.postman_collection.json`   | 19            | 14 endpoints (100%)              |
| `SelfSign_Module_Tests.postman_collection.json`   | 19            | 8 endpoints (100%)               |
| `Admins_Module_Tests.postman_collection.json`     | 18            | 9 endpoints (100%)               |
| **TOTAL**                                     | **170** | **99/116 endpoints (85%)** |

---

## 🔍 Gap Analysis Summary

**Current State:**

- ✅ **9 controllers** at 100% coverage
- ✅ **2 controllers** at >90% coverage
- ⚠️ **1 controller** at 50% coverage (DocumentCollections)

**To Achieve 100%:**

- Add **12-15 tests** for DocumentCollections missing endpoints
- Add **3-5 tests** for minor gaps (Distribution, Reports, Users)
- **Estimated effort:** 2-3 days
- **Expected result:** 116/116 endpoints tested (100% coverage)

---

**Report Generated:** 2025-11-02
**Next Update:** After DocumentCollections expansion tests are created
