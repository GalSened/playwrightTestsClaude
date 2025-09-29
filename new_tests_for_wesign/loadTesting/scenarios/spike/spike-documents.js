/**
 * WeSign K6 Spike Test - Document Operations Sudden Load
 *
 * Purpose: Test document handling under sudden traffic spikes
 * Load: 5 VUs → 150 VUs in 1 minute → back to 5 VUs
 * Duration: 8 minutes total
 * Coverage: Document upload, download, processing under spike conditions
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import {
    validateJSONResponse,
    validateFileUploadResponse,
    checkForErrors
} from '../../utils/common-checks.js';
import {
    generateCredentials,
    generateDocument,
    generateFileData
} from '../../utils/data-generator.js';

// Test configuration - Document spike pattern
export const options = {
    stages: [
        { duration: '1m', target: 5 },    // Baseline with few users
        { duration: '1m', target: 150 },  // SPIKE! Document operations surge
        { duration: '4m', target: 150 },  // Sustain document spike
        { duration: '1m', target: 5 },    // Rapid drop
        { duration: '1m', target: 5 }     // Recovery baseline
    ],
    thresholds: {
        http_req_duration: ['p(95)<15000'],          // 95% under 15s (document tolerance)
        'http_req_duration{operation:document_upload}': ['p(95)<30000'], // Upload under 30s during spike
        'http_req_duration{operation:document_list}': ['p(95)<8000'], // List under 8s during spike
        http_req_failed: ['rate<0.20'],              // Error rate under 20% (spike tolerance)
        auth_success_rate: ['rate>0.80'],            // 80% auth success
        checks: ['rate>0.70']                        // 70% checks pass (spike tolerance)
    },
    tags: {
        test_type: 'spike',
        test_name: 'document_spike'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const currentPhase = getDocumentSpikePhase();

    console.log(`📄⚡ VU${vuId} Iteration${iterationId}: Document spike test (Phase: ${currentPhase})`);

    // Initialize session
    const authSession = new AuthSession(baseUrl, credentials);
    const authResult = authSession.authenticate();

    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Authentication failed during document spike`);
        return;
    }

    const apiClient = authSession.getAPIClient();
    const testConfig = getDocumentTestConfigForPhase(currentPhase);

    // SCENARIO 1: Document Upload Spike (40% of traffic)
    if (Math.random() < 0.4) {
        console.log(`📤 VU${vuId}: Document upload spike testing`);

        for (let upload = 0; upload < testConfig.uploadCount; upload++) {
            // Generate file data based on spike phase
            const fileSize = currentPhase === 'spike' || currentPhase === 'sustain' ? 'small' : 'medium';
            const fileData = generateFileData(fileSize);
            const documentMeta = generateDocument({ vuId, upload, phase: currentPhase });

            console.log(`📎 VU${vuId}: Spike upload ${upload + 1}/${testConfig.uploadCount} (${fileSize})`);

            const uploadStart = Date.now();
            const uploadResponse = apiClient.documents.upload(fileData.data, fileData.fileName);
            const uploadDuration = Date.now() - uploadStart;

            const uploadChecks = check(uploadResponse, {
                [`Spike upload ${upload + 1} completed`]: (r) => r.status < 500,
                [`Spike upload ${upload + 1} time`]: () => uploadDuration < 45000,
                [`Spike upload ${upload + 1} not timeout`]: (r) => r.status !== 0
            });

            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                console.log(`✅ VU${vuId}: Spike upload ${upload + 1} successful (${uploadDuration}ms)`);

                // Quick verification if upload succeeded
                try {
                    const responseData = uploadResponse.json();
                    const documentId = responseData.id || responseData.documentId;

                    if (documentId) {
                        // Verify upload with quick read
                        sleep(0.5); // Brief wait for processing
                        const verifyResponse = apiClient.documents.get(documentId);

                        check(verifyResponse, {
                            [`Spike upload ${upload + 1} verification`]: (r) => r.status === 200
                        });
                    }
                } catch (e) {
                    console.log(`⚠️ VU${vuId}: Upload ${upload + 1} verification failed`);
                }
            } else {
                console.error(`❌ VU${vuId}: Spike upload ${upload + 1} failed (${uploadResponse.status})`);
            }

            sleep(testConfig.uploadDelay);
        }
    }

    // SCENARIO 2: Document Browsing Spike (35% of traffic)
    else if (Math.random() < 0.75) {
        console.log(`📋 VU${vuId}: Document browsing spike testing`);

        // Rapid document list requests
        for (let browse = 0; browse < testConfig.browseRequests; browse++) {
            const listParams = {
                limit: testConfig.listLimit,
                page: Math.floor(Math.random() * 5) + 1
            };

            const listStart = Date.now();
            const listResponse = apiClient.documents.list(listParams);
            const listDuration = Date.now() - listStart;

            const browseChecks = check(listResponse, {
                [`Spike browse ${browse + 1} success`]: (r) => r.status === 200,
                [`Spike browse ${browse + 1} time`]: () => listDuration < 10000,
                [`Spike browse ${browse + 1} data`]: (r) => r.body && r.body.length > 0
            });

            if (listResponse.status === 200) {
                console.log(`📄 VU${vuId}: Spike browse ${browse + 1} successful (${listDuration}ms)`);

                // Process document list if available
                try {
                    const documents = listResponse.json();
                    const docArray = Array.isArray(documents) ? documents : (documents.items || documents.data || []);

                    // Quick access to random documents
                    if (docArray.length > 0 && browse < 3) {
                        const randomDoc = docArray[Math.floor(Math.random() * Math.min(docArray.length, 3))];
                        const docId = randomDoc.id || randomDoc.documentId;

                        if (docId) {
                            const detailResponse = apiClient.documents.get(docId);
                            check(detailResponse, {
                                [`Spike detail ${browse + 1} access`]: (r) => r.status === 200
                            });
                        }
                    }
                } catch (e) {
                    // Continue even if parsing fails
                }
            } else {
                console.error(`❌ VU${vuId}: Spike browse ${browse + 1} failed (${listResponse.status})`);
            }

            sleep(testConfig.browseDelay);
        }
    }

    // SCENARIO 3: Mixed Document Operations (25% of traffic)
    else {
        console.log(`🔄 VU${vuId}: Mixed document operations spike`);

        // Mix of different document operations
        const operations = [
            () => {
                // Quick list
                return apiClient.documents.list({ limit: 5 });
            },
            () => {
                // Templates list (related to documents)
                return apiClient.templates.list();
            },
            () => {
                // Statistics call
                return apiClient.statistics.getDashboard();
            }
        ];

        for (let op = 0; op < testConfig.mixedOperations; op++) {
            const operation = operations[op % operations.length];
            const opName = ['documents list', 'templates list', 'statistics'][op % operations.length];

            const opStart = Date.now();
            const opResponse = operation();
            const opDuration = Date.now() - opStart;

            check(opResponse, {
                [`Spike mixed ${op + 1} (${opName}) success`]: (r) => r.status === 200,
                [`Spike mixed ${op + 1} time`]: () => opDuration < 8000
            });

            console.log(`🔀 VU${vuId}: Mixed operation ${op + 1} (${opName}): ${opResponse.status} in ${opDuration}ms`);

            sleep(testConfig.mixedDelay);
        }
    }

    // Test system recovery capabilities
    if (currentPhase === 'drop' || currentPhase === 'recovery') {
        console.log(`🔧 VU${vuId}: Testing document system recovery`);

        // Single comprehensive test after spike
        const recoveryResponse = apiClient.documents.list({ limit: 10 });

        check(recoveryResponse, {
            'Document system recovery': (r) => r.status === 200,
            'Recovery response time': (r) => r.timings.duration < 5000
        });

        if (recoveryResponse.status === 200) {
            console.log(`✅ VU${vuId}: Document system recovery confirmed`);
        }
    }

    // Logout
    authSession.logout();

    // Phase-appropriate think time
    sleep(testConfig.thinkTime);
}

function getDocumentSpikePhase() {
    const elapsed = (__ENV.K6_CURRENT_STAGE_ELAPSED || 0) / 1000;

    if (elapsed < 60) return 'baseline';
    if (elapsed < 120) return 'spike';
    if (elapsed < 360) return 'sustain';
    if (elapsed < 420) return 'drop';
    return 'recovery';
}

function getDocumentTestConfigForPhase(phase) {
    const configs = {
        'baseline': {
            uploadCount: 1,
            browseRequests: 2,
            mixedOperations: 2,
            listLimit: 10,
            uploadDelay: 1,
            browseDelay: 0.5,
            mixedDelay: 0.5,
            thinkTime: 2
        },
        'spike': {
            uploadCount: 2,
            browseRequests: 5,
            mixedOperations: 4,
            listLimit: 5,
            uploadDelay: 0.2,
            browseDelay: 0.1,
            mixedDelay: 0.1,
            thinkTime: 0.3
        },
        'sustain': {
            uploadCount: 1,
            browseRequests: 4,
            mixedOperations: 3,
            listLimit: 8,
            uploadDelay: 0.3,
            browseDelay: 0.2,
            mixedDelay: 0.2,
            thinkTime: 0.5
        },
        'drop': {
            uploadCount: 1,
            browseRequests: 2,
            mixedOperations: 2,
            listLimit: 10,
            uploadDelay: 0.5,
            browseDelay: 0.3,
            mixedDelay: 0.3,
            thinkTime: 1
        },
        'recovery': {
            uploadCount: 1,
            browseRequests: 2,
            mixedOperations: 1,
            listLimit: 10,
            uploadDelay: 1,
            browseDelay: 0.5,
            mixedDelay: 0.5,
            thinkTime: 2
        }
    };

    return configs[phase] || configs['baseline'];
}

export function setup() {
    console.log('📄⚡ Starting WeSign Spike Test - Document Operations');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`📈 Spike Pattern: 5 → 150 → 5 VUs`);
    console.log(`⏱️ Duration: 8 minutes`);
    console.log(`🎯 Testing document operations under sudden load`);
    console.log(`📤 Focus: Upload, browse, and processing spikes`);

    return {
        startTime: Date.now(),
        testType: 'document_spike'
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Document Spike Test Completed');
    console.log(`⏱️ Total duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Review document operation performance during spike`);
    console.log(`📈 Check upload/download success rates and processing times`);
}