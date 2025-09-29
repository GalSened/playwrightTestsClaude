/**
 * WeSign K6 Load Test - Complete User Journey
 *
 * Purpose: Simulate realistic user workflows under normal load
 * Load: 20-50 VUs with gradual ramp-up
 * Duration: 15 minutes with stages
 * Coverage: Full user journey from login to document signing
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import {
    validateJSONResponse,
    validateCRUDResponse,
    validateAuthResponse
} from '../../utils/common-checks.js';
import {
    generateCredentials,
    generateContact,
    generateDocument,
    generateTemplate,
    generateUserJourneyData
} from '../../utils/data-generator.js';

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 10 },  // Warm up to 10 users
        { duration: '3m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 50 },  // Peak load at 50 users
        { duration: '3m', target: 20 },  // Scale down to 20 users
        { duration: '2m', target: 0 }    // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'],      // 95% under 3s
        http_req_failed: ['rate<0.05'],         // Error rate under 5%
        'http_req_duration{endpoint:/users/login}': ['p(99)<1500'], // Login under 1.5s
        'http_req_duration{operation:document_upload}': ['p(95)<10000'], // Upload under 10s
        auth_success_rate: ['rate>0.95'],       // 95% auth success
        checks: ['rate>0.90']                   // 90% checks pass
    },
    tags: {
        test_type: 'load',
        test_name: 'user_journey'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const journeyData = generateUserJourneyData();

    console.log(`🚀 VU${vuId} Iteration${iterationId}: Starting user journey`);

    // Initialize session
    const authSession = new AuthSession(baseUrl, credentials);

    // PHASE 1: Authentication & Profile Setup
    console.log(`🔐 VU${vuId}: Phase 1 - Authentication`);

    const authResult = authSession.authenticate();
    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Authentication failed, aborting journey`);
        return;
    }

    validateAuthResponse(authResult.response, 'User journey authentication');
    const apiClient = authSession.getAPIClient();

    // Get user profile
    const profileResponse = apiClient.users.getProfile();
    validateJSONResponse(profileResponse, 200, 'Profile retrieval');

    sleep(1); // Think time after login

    // PHASE 2: Contact Management
    console.log(`📞 VU${vuId}: Phase 2 - Contact Management`);

    // List existing contacts
    const contactsListResponse = apiClient.contacts.list();
    validateJSONResponse(contactsListResponse, 200, 'Contacts list');

    // Create new contacts
    const createdContacts = [];
    for (let i = 0; i < 2; i++) {
        const contactData = generateContact({ batchId: journeyData.sessionId, index: i });
        const createContactResponse = apiClient.contacts.create(contactData);

        if (validateCRUDResponse(createContactResponse, 'create', 'Contact creation')) {
            const responseData = createContactResponse.json();
            const contactId = responseData.id || responseData.contactId;
            if (contactId) {
                createdContacts.push(contactId);
                console.log(`✅ VU${vuId}: Created contact ${contactId}`);
            }
        }

        sleep(0.5); // Brief pause between creations
    }

    sleep(1); // Think time after contact management

    // PHASE 3: Template Operations
    console.log(`📋 VU${vuId}: Phase 3 - Template Operations`);

    // List templates
    const templatesListResponse = apiClient.templates.list();
    validateJSONResponse(templatesListResponse, 200, 'Templates list');

    // Create a template
    const templateData = generateTemplate({ sessionId: journeyData.sessionId });
    const createTemplateResponse = apiClient.templates.create(templateData);

    let createdTemplateId = null;
    if (validateCRUDResponse(createTemplateResponse, 'create', 'Template creation')) {
        const responseData = createTemplateResponse.json();
        createdTemplateId = responseData.id || responseData.templateId;
        console.log(`✅ VU${vuId}: Created template ${createdTemplateId}`);
    }

    sleep(1); // Think time after template creation

    // PHASE 4: Document Operations
    console.log(`📄 VU${vuId}: Phase 4 - Document Operations`);

    // List existing documents
    const documentsListResponse = apiClient.documents.list();
    validateJSONResponse(documentsListResponse, 200, 'Documents list');

    // Document upload simulation
    const documentData = generateDocument({ sessionId: journeyData.sessionId });
    const uploadResponse = apiClient.documents.upload(
        'base64encodedfiledata',
        documentData.name
    );

    let createdDocumentId = null;
    if (check(uploadResponse, {
        'Document upload successful': (r) => r.status === 200 || r.status === 201
    })) {
        try {
            const responseData = uploadResponse.json();
            createdDocumentId = responseData.id || responseData.documentId;
            console.log(`✅ VU${vuId}: Uploaded document ${createdDocumentId}`);
        } catch (e) {
            console.log(`⚠️ VU${vuId}: Document upload response parsing failed`);
        }
    }

    sleep(2); // Think time after document upload

    // PHASE 5: Distribution & Sharing
    console.log(`📤 VU${vuId}: Phase 5 - Distribution & Sharing`);

    // Get distribution options
    const distributionListResponse = apiClient.distribution.list();
    validateJSONResponse(distributionListResponse, 200, 'Distribution list');

    // Create distribution if we have a document and contacts
    if (createdDocumentId && createdContacts.length > 0) {
        const distributionData = {
            documentId: createdDocumentId,
            recipients: createdContacts.map(contactId => ({
                contactId: contactId,
                role: 'signer'
            })),
            message: `Load testing distribution from VU${vuId}`,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const createDistributionResponse = apiClient.distribution.create(distributionData);
        validateCRUDResponse(createDistributionResponse, 'create', 'Distribution creation');
    }

    sleep(1); // Think time after distribution

    // PHASE 6: Statistics & Reporting
    console.log(`📊 VU${vuId}: Phase 6 - Statistics & Reporting`);

    // Get dashboard statistics
    const dashboardResponse = apiClient.statistics.getDashboard();
    validateJSONResponse(dashboardResponse, 200, 'Statistics dashboard');

    // Get reports
    const reportsResponse = apiClient.statistics.getReports({
        dateRange: '30days',
        includeCharts: 'false'
    });
    validateJSONResponse(reportsResponse, 200, 'Statistics reports');

    sleep(1); // Think time after statistics

    // PHASE 7: Configuration Check
    console.log(`⚙️ VU${vuId}: Phase 7 - Configuration`);

    // Check configuration
    const configResponse = apiClient.configuration.get();
    validateJSONResponse(configResponse, 200, 'Configuration check');

    sleep(1); // Think time after configuration

    // PHASE 8: Cleanup & Logout
    console.log(`🧹 VU${vuId}: Phase 8 - Cleanup & Logout`);

    // Optional: Clean up created resources (contacts, templates)
    // In a real scenario, you might want to leave some data for persistence testing

    // Logout
    const logoutResult = authSession.logout();
    if (logoutResult.success) {
        console.log(`✅ VU${vuId}: User journey completed successfully`);
    } else {
        console.log(`⚠️ VU${vuId}: Logout failed but journey completed`);
    }

    // Final think time
    sleep(2 + Math.random() * 3); // 2-5 seconds random think time
}

export function setup() {
    console.log('🚀 Starting WeSign Load Test - User Journey');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`👥 Peak VUs: 50`);
    console.log(`⏱️ Total Duration: 15 minutes`);
    console.log(`🎯 Testing complete user workflows`);

    return {
        startTime: Date.now(),
        testConfig: {
            baseUrl,
            peakUsers: 50,
            duration: '15m'
        }
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 User Journey Load Test Completed');
    console.log(`⏱️ Total test duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Check the reports for detailed performance metrics`);
}