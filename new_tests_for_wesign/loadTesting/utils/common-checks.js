/**
 * Common validation functions for K6 WeSign load tests
 *
 * Provides reusable check functions for API response validation,
 * performance monitoring, and error detection.
 */

import { check } from 'k6';

/**
 * Validate basic HTTP response
 */
export function validateResponse(response, expectedStatus = 200, testName = 'API request') {
    return check(response, {
        [`${testName}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
        [`${testName}: response time < 5s`]: (r) => r.timings.duration < 5000,
        [`${testName}: response has body`]: (r) => r.body && r.body.length > 0
    });
}

/**
 * Validate JSON API response
 */
export function validateJSONResponse(response, expectedStatus = 200, testName = 'JSON API request') {
    const basicChecks = validateResponse(response, expectedStatus, testName);

    const jsonChecks = check(response, {
        [`${testName}: response is valid JSON`]: (r) => {
            try {
                r.json();
                return true;
            } catch (e) {
                return false;
            }
        },
        [`${testName}: response has correct content-type`]: (r) =>
            r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json')
    });

    return basicChecks && jsonChecks;
}

/**
 * Validate authentication response
 */
export function validateAuthResponse(response, testName = 'Authentication') {
    const basicValidation = validateJSONResponse(response, 200, testName);

    if (response.status === 200) {
        const authChecks = check(response, {
            [`${testName}: has JWT token`]: (r) => r.json('token') !== undefined && r.json('token') !== '',
            [`${testName}: has refresh token`]: (r) => r.json('refreshToken') !== undefined && r.json('refreshToken') !== '',
            [`${testName}: token is string`]: (r) => typeof r.json('token') === 'string',
            [`${testName}: refresh token is string`]: (r) => typeof r.json('refreshToken') === 'string'
        });

        return basicValidation && authChecks;
    }

    return basicValidation;
}

/**
 * Validate error response
 */
export function validateErrorResponse(response, expectedStatus = 400, testName = 'Error response') {
    return check(response, {
        [`${testName}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
        [`${testName}: response time < 3s`]: (r) => r.timings.duration < 3000,
        [`${testName}: has error message`]: (r) => {
            try {
                const json = r.json();
                return json.error || json.message || json.errorMessage;
            } catch (e) {
                return r.body && r.body.length > 0;
            }
        }
    });
}

/**
 * Validate list/collection response
 */
export function validateListResponse(response, testName = 'List request', minItems = 0) {
    const basicValidation = validateJSONResponse(response, 200, testName);

    if (response.status === 200) {
        const listChecks = check(response, {
            [`${testName}: response is array or has items`]: (r) => {
                try {
                    const json = r.json();
                    return Array.isArray(json) || (json.items && Array.isArray(json.items)) || (json.data && Array.isArray(json.data));
                } catch (e) {
                    return false;
                }
            },
            [`${testName}: has at least ${minItems} items`]: (r) => {
                try {
                    const json = r.json();
                    const items = Array.isArray(json) ? json : (json.items || json.data || []);
                    return items.length >= minItems;
                } catch (e) {
                    return false;
                }
            }
        });

        return basicValidation && listChecks;
    }

    return basicValidation;
}

/**
 * Validate CRUD operation response
 */
export function validateCRUDResponse(response, operation = 'create', testName = null) {
    const operationName = testName || `${operation.toUpperCase()} operation`;

    const expectedStatuses = {
        'create': 201,
        'read': 200,
        'update': 200,
        'delete': 200
    };

    const expectedStatus = expectedStatuses[operation] || 200;

    const basicValidation = validateJSONResponse(response, expectedStatus, operationName);

    if (response.status === expectedStatus) {
        const crudChecks = check(response, {
            [`${operationName}: response time < 3s`]: (r) => r.timings.duration < 3000
        });

        // Additional checks for create operations
        if (operation === 'create' && response.status === 201) {
            const createChecks = check(response, {
                [`${operationName}: has ID in response`]: (r) => {
                    try {
                        const json = r.json();
                        return json.id || json._id || json.uuid || json.contactId || json.templateId || json.documentId;
                    } catch (e) {
                        return false;
                    }
                }
            });

            return basicValidation && crudChecks && createChecks;
        }

        return basicValidation && crudChecks;
    }

    return basicValidation;
}

/**
 * Validate file upload response
 */
export function validateFileUploadResponse(response, testName = 'File upload') {
    const basicValidation = validateJSONResponse(response, 200, testName);

    if (response.status === 200) {
        const uploadChecks = check(response, {
            [`${testName}: upload time < 30s`]: (r) => r.timings.duration < 30000,
            [`${testName}: has file ID or URL`]: (r) => {
                try {
                    const json = r.json();
                    return json.fileId || json.url || json.downloadUrl || json.documentId;
                } catch (e) {
                    return false;
                }
            }
        });

        return basicValidation && uploadChecks;
    }

    return basicValidation;
}

/**
 * Validate performance benchmarks
 */
export function validatePerformance(response, testName = 'Performance check', maxDuration = 2000) {
    return check(response, {
        [`${testName}: response time < ${maxDuration}ms`]: (r) => r.timings.duration < maxDuration,
        [`${testName}: DNS lookup < 100ms`]: (r) => r.timings.looking_up < 100,
        [`${testName}: TCP connection < 100ms`]: (r) => r.timings.connecting < 100,
        [`${testName}: TLS handshake < 200ms`]: (r) => r.timings.tls_handshaking < 200,
        [`${testName}: server processing < ${maxDuration - 500}ms`]: (r) => r.timings.waiting < (maxDuration - 500)
    });
}

/**
 * Validate security headers
 */
export function validateSecurityHeaders(response, testName = 'Security headers') {
    return check(response, {
        [`${testName}: has security headers`]: (r) => {
            const headers = r.headers;
            const hasCSP = headers['Content-Security-Policy'] !== undefined;
            const hasXFrame = headers['X-Frame-Options'] !== undefined;
            const hasXContentType = headers['X-Content-Type-Options'] !== undefined;

            return hasCSP || hasXFrame || hasXContentType; // At least one security header
        },
        [`${testName}: no sensitive info in headers`]: (r) => {
            const headers = JSON.stringify(r.headers).toLowerCase();
            return !headers.includes('password') && !headers.includes('secret') && !headers.includes('key');
        }
    });
}

/**
 * Validate pagination response
 */
export function validatePaginationResponse(response, testName = 'Pagination') {
    const basicValidation = validateJSONResponse(response, 200, testName);

    if (response.status === 200) {
        const paginationChecks = check(response, {
            [`${testName}: has pagination info`]: (r) => {
                try {
                    const json = r.json();
                    return json.page !== undefined || json.totalPages !== undefined ||
                           json.limit !== undefined || json.totalItems !== undefined ||
                           json.hasNext !== undefined || json.hasPrevious !== undefined;
                } catch (e) {
                    return false;
                }
            }
        });

        return basicValidation && paginationChecks;
    }

    return basicValidation;
}

/**
 * Check for common error patterns
 */
export function checkForErrors(response, testName = 'Error detection') {
    return check(response, {
        [`${testName}: no server errors (5xx)`]: (r) => r.status < 500,
        [`${testName}: no timeout errors`]: (r) => !r.error_code || r.error_code !== 1050,
        [`${testName}: no connection errors`]: (r) => !r.error || !r.error.includes('connection'),
        [`${testName}: response received`]: (r) => r.status !== 0
    });
}

/**
 * Custom assertion helper
 */
export function customCheck(response, condition, message) {
    return check(response, {
        [message]: condition
    });
}

export default {
    validateResponse,
    validateJSONResponse,
    validateAuthResponse,
    validateErrorResponse,
    validateListResponse,
    validateCRUDResponse,
    validateFileUploadResponse,
    validatePerformance,
    validateSecurityHeaders,
    validatePaginationResponse,
    checkForErrors,
    customCheck
};