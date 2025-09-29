/**
 * WeSign K6 Load Test - Document Operations Focus
 *
 * Purpose: Test document-heavy operations under normal load
 * Load: 30-80 VUs with focus on document operations
 * Duration: 12 minutes
 * Coverage: Document upload, retrieval, processing, signing workflows
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import {
    validateJSONResponse,
    validateCRUDResponse,
    validateFileUploadResponse,
    validatePerformance
} from '../../utils/common-checks.js';
import {
    generateCredentials,
    generateDocument,
    generateFileData,
    generateSignatureData
} from '../../utils/data-generator.js';

// Test configuration
export const options = {
    stages: [
        { duration: '1m', target: 10 },  // Warm up
        { duration: '2m', target: 30 },  // Ramp to moderate load
        { duration: '6m', target: 80 },  // Peak document operations
        { duration: '2m', target: 30 },  // Scale down
        { duration: '1m', target: 0 }    // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'],      // 95% under 5s
        'http_req_duration{operation:document_upload}': ['p(95)<15000'], // Upload under 15s
        'http_req_duration{operation:document_download}': ['p(95)<3000'], // Download under 3s
        'http_req_duration{operation:document_sign}': ['p(95)<5000'], // Signing under 5s
        http_req_failed: ['rate<0.05'],         // Error rate under 5%
        auth_success_rate: ['rate>0.95'],       // 95% auth success
        checks: ['rate>0.90']                   // 90% checks pass
    },
    tags: {
        test_type: 'load',
        test_name: 'document_operations'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;

    console.log(`📄 VU${vuId} Iteration${iterationId}: Starting document operations test`);

    // Initialize session
    const authSession = new AuthSession(baseUrl, credentials);

    // Authentication
    console.log(`🔐 VU${vuId}: Authenticating...`);
    const authResult = authSession.authenticate();
    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Authentication failed`);
        return;
    }

    const apiClient = authSession.getAPIClient();

    // SCENARIO 1: Document Listing & Browsing (40% of time)
    if (Math.random() < 0.4) {
        console.log(`📋 VU${vuId}: Scenario 1 - Document Browsing`);

        // List all documents
        const allDocsResponse = apiClient.documents.list();
        validateJSONResponse(allDocsResponse, 200, 'Documents list');
        validatePerformance(allDocsResponse, 'Documents list performance', 2000);

        // List with filters
        const filteredDocsResponse = apiClient.documents.list({
            type: 'pdf',
            status: 'active',
            limit: 20
        });
        validateJSONResponse(filteredDocsResponse, 200, 'Filtered documents list');

        // Browse through documents (simulate pagination)
        for (let page = 1; page <= 3; page++) {
            const pageResponse = apiClient.documents.list({
                page: page,
                limit: 10
            });
            validateJSONResponse(pageResponse, 200, `Documents page ${page}`);
            sleep(0.5); // Think time between pages
        }

        sleep(1); // Think time after browsing
    }

    // SCENARIO 2: Document Upload Operations (25% of time)
    else if (Math.random() < 0.65) { // 25% of remaining 60%
        console.log(`📤 VU${vuId}: Scenario 2 - Document Upload`);

        // Generate document data
        const documentMetadata = generateDocument({ vuId, iterationId });

        // Test different file sizes
        const fileSizes = ['small', 'medium', 'large'];
        const selectedSize = fileSizes[Math.floor(Math.random() * fileSizes.length)];
        const fileData = generateFileData(selectedSize);

        console.log(`📎 VU${vuId}: Uploading ${selectedSize} file (${fileData.size} bytes)`);

        // Upload document
        const uploadStartTime = Date.now();
        const uploadResponse = apiClient.documents.upload(fileData.data, fileData.fileName);
        const uploadDuration = Date.now() - uploadStartTime;

        const uploadSuccess = check(uploadResponse, {
            'Upload successful': (r) => r.status === 200 || r.status === 201,
            'Upload time acceptable': (r) => uploadDuration < 30000,
            'Upload has response body': (r) => r.body && r.body.length > 0
        });

        let uploadedDocumentId = null;
        if (uploadSuccess && uploadResponse.status < 300) {
            try {
                const responseData = uploadResponse.json();
                uploadedDocumentId = responseData.id || responseData.documentId;
                console.log(`✅ VU${vuId}: Upload successful, ID: ${uploadedDocumentId}`);
            } catch (e) {
                console.log(`⚠️ VU${vuId}: Upload response parsing failed`);
            }
        }

        // Verify upload by retrieving document details
        if (uploadedDocumentId) {
            sleep(1); // Wait for processing
            const verifyResponse = apiClient.documents.get(uploadedDocumentId);
            validateJSONResponse(verifyResponse, 200, 'Upload verification');
        }

        sleep(2); // Think time after upload
    }

    // SCENARIO 3: Document Processing & Signing (20% of time)
    else if (Math.random() < 0.8) { // 20% of remaining 35%
        console.log(`✍️ VU${vuId}: Scenario 3 - Document Signing`);

        // Get list of documents
        const docsResponse = apiClient.documents.list({ limit: 10 });

        if (docsResponse.status === 200) {
            try {
                const documents = docsResponse.json();
                const docArray = Array.isArray(documents) ? documents : (documents.items || documents.data || []);

                if (docArray.length > 0) {
                    // Select a random document
                    const selectedDoc = docArray[Math.floor(Math.random() * docArray.length)];
                    const documentId = selectedDoc.id || selectedDoc.documentId;

                    if (documentId) {
                        console.log(`📄 VU${vuId}: Processing document ${documentId}`);

                        // Get document details
                        const docDetailsResponse = apiClient.documents.get(documentId);
                        validateJSONResponse(docDetailsResponse, 200, 'Document details');

                        // Simulate signing process
                        const signatureData = generateSignatureData({
                            documentId: documentId,
                            vuId: vuId
                        });

                        const signResponse = apiClient.documents.sign(documentId, signatureData);

                        check(signResponse, {
                            'Signing request processed': (r) => r.status >= 200 && r.status < 500,
                            'Signing response time acceptable': (r) => r.timings.duration < 10000
                        });

                        if (signResponse.status === 200) {
                            console.log(`✅ VU${vuId}: Document signed successfully`);
                        } else {
                            console.log(`⚠️ VU${vuId}: Signing returned status ${signResponse.status}`);
                        }
                    }
                }
            } catch (e) {
                console.log(`⚠️ VU${vuId}: Error processing documents for signing: ${e}`);
            }
        }

        sleep(2); // Think time after signing
    }

    // SCENARIO 4: Document Management Operations (15% of time)
    else {
        console.log(`🛠️ VU${vuId}: Scenario 4 - Document Management`);

        // Get documents list
        const docsResponse = apiClient.documents.list({ limit: 5 });

        if (docsResponse.status === 200) {
            try {
                const documents = docsResponse.json();
                const docArray = Array.isArray(documents) ? documents : (documents.items || documents.data || []);

                for (const doc of docArray.slice(0, 3)) { // Process up to 3 documents
                    const documentId = doc.id || doc.documentId;

                    if (documentId) {
                        // Get detailed document info
                        const detailResponse = apiClient.documents.get(documentId);
                        validateJSONResponse(detailResponse, 200, 'Document detail fetch');

                        // Simulate document metadata operations
                        sleep(0.3);

                        // Check document status/history (if available)
                        // Note: This endpoint might not exist, so we'll handle gracefully
                        try {
                            const historyResponse = apiClient.request('GET', `/documents/${documentId}/history`);
                            if (historyResponse.status === 200) {
                                console.log(`📜 VU${vuId}: Retrieved history for document ${documentId}`);
                            }
                        } catch (e) {
                            // History endpoint might not be available
                        }

                        sleep(0.2);
                    }
                }
            } catch (e) {
                console.log(`⚠️ VU${vuId}: Error in document management: ${e}`);
            }
        }

        sleep(1); // Think time after management operations
    }

    // Logout
    const logoutResult = authSession.logout();
    if (logoutResult.success) {
        console.log(`✅ VU${vuId}: Document operations test completed`);
    }

    // Random think time between iterations
    sleep(1 + Math.random() * 2);
}

export function setup() {
    console.log('📄 Starting WeSign Load Test - Document Operations');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`👥 Peak VUs: 80`);
    console.log(`⏱️ Duration: 12 minutes`);
    console.log(`🎯 Focus: Document upload, processing, and signing workflows`);

    return {
        startTime: Date.now(),
        testType: 'document_operations'
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Document Operations Load Test Completed');
    console.log(`⏱️ Total duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Review upload, processing, and signing performance metrics`);
}