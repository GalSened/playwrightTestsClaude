/**
 * WeSign API Client for K6 Load Testing
 *
 * Provides a comprehensive interface for WeSign API interactions
 * with authentication management, error handling, and performance tracking.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics for tracking performance
export const apiResponseTime = new Trend('api_response_time');
export const apiErrorRate = new Rate('api_error_rate');
export const apiRequestCount = new Counter('api_request_count');

export class WeSignAPIClient {
    constructor(baseUrl, credentials = {}) {
        this.baseUrl = baseUrl;
        this.credentials = credentials;
        this.authToken = null;
        this.refreshToken = null;
        this.jwtToken = null;
        this.userId = null;

        // Default headers
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Generic HTTP request method with error handling and metrics
     */
    request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.defaultHeaders, ...options.headers };

        // Add authentication header if available
        if (this.jwtToken) {
            headers['Authorization'] = `Bearer ${this.jwtToken}`;
        }

        const requestConfig = {
            headers,
            tags: { endpoint: endpoint, method: method }
        };

        if (data) {
            requestConfig.body = typeof data === 'string' ? data : JSON.stringify(data);
        }

        // Make the request
        const response = http.request(method, url, requestConfig.body, requestConfig);

        // Track metrics
        apiResponseTime.add(response.timings.duration);
        apiRequestCount.add(1);
        apiErrorRate.add(response.status >= 400);

        return response;
    }

    /**
     * Authentication Methods
     */
    authenticate(email = null, password = null) {
        const loginData = {
            email: email || this.credentials.email || 'nirk@comsign.co.il',
            password: password || this.credentials.password || 'Comsign1!'
        };

        const response = this.request('POST', '/users/login', loginData);

        const loginSuccess = check(response, {
            'login successful': (r) => r.status === 200,
            'login response has token': (r) => r.status === 200 && r.json('token') !== undefined
        });

        if (loginSuccess && response.status === 200) {
            const responseData = response.json();
            this.jwtToken = responseData.token;
            this.refreshToken = responseData.refreshToken;
            this.authToken = responseData.authToken;
            this.userId = responseData.userId;

            console.log('Authentication successful - tokens stored');
        }

        return { response, success: loginSuccess };
    }

    refreshAuthentication() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = this.request('POST', '/users/refresh', {
            refreshToken: this.refreshToken
        });

        if (response.status === 200) {
            const responseData = response.json();
            this.jwtToken = responseData.token;
            this.refreshToken = responseData.refreshToken;
        }

        return response;
    }

    logout() {
        const response = this.request('POST', '/users/logout');

        if (response.status === 200) {
            this.jwtToken = null;
            this.refreshToken = null;
            this.authToken = null;
            this.userId = null;
        }

        return response;
    }

    /**
     * User Management Methods
     */
    users = {
        getProfile: () => {
            return this.request('GET', '/users/profile');
        },

        getGroups: () => {
            return this.request('GET', '/users/groups');
        },

        updateProfile: (profileData) => {
            return this.request('PUT', '/users/profile', profileData);
        }
    };

    /**
     * Document Management Methods
     */
    documents = {
        list: (params = {}) => {
            const queryString = Object.keys(params).length > 0
                ? '?' + new URLSearchParams(params).toString()
                : '';
            return this.request('GET', `/documents${queryString}`);
        },

        upload: (fileData, fileName = 'test-document.pdf') => {
            // Simulate file upload with base64 data or form data
            const uploadData = {
                file: fileData,
                fileName: fileName,
                documentType: 'pdf'
            };
            return this.request('POST', '/documents/upload', uploadData);
        },

        get: (documentId) => {
            return this.request('GET', `/documents/${documentId}`);
        },

        delete: (documentId) => {
            return this.request('DELETE', `/documents/${documentId}`);
        },

        sign: (documentId, signatureData) => {
            return this.request('POST', `/documents/${documentId}/sign`, signatureData);
        }
    };

    /**
     * Template Management Methods
     */
    templates = {
        list: () => {
            return this.request('GET', '/templates');
        },

        create: (templateData) => {
            return this.request('POST', '/templates', templateData);
        },

        get: (templateId) => {
            return this.request('GET', `/templates/${templateId}`);
        },

        update: (templateId, templateData) => {
            return this.request('PUT', `/templates/${templateId}`, templateData);
        },

        delete: (templateId) => {
            return this.request('DELETE', `/templates/${templateId}`);
        }
    };

    /**
     * Contact Management Methods
     */
    contacts = {
        list: () => {
            return this.request('GET', '/contacts');
        },

        create: (contactData) => {
            return this.request('POST', '/contacts', contactData);
        },

        get: (contactId) => {
            return this.request('GET', `/contacts/${contactId}`);
        },

        update: (contactId, contactData) => {
            return this.request('PUT', `/contacts/${contactId}`, contactData);
        },

        delete: (contactId) => {
            return this.request('DELETE', `/contacts/${contactId}`);
        }
    };

    /**
     * Distribution Methods
     */
    distribution = {
        list: () => {
            return this.request('GET', '/distribution');
        },

        create: (distributionData) => {
            return this.request('POST', '/distribution', distributionData);
        },

        get: (distributionId) => {
            return this.request('GET', `/distribution/${distributionId}`);
        }
    };

    /**
     * Statistics Methods
     */
    statistics = {
        getDashboard: () => {
            return this.request('GET', '/statistics/dashboard');
        },

        getReports: (params = {}) => {
            const queryString = Object.keys(params).length > 0
                ? '?' + new URLSearchParams(params).toString()
                : '';
            return this.request('GET', `/statistics/reports${queryString}`);
        }
    };

    /**
     * Configuration Methods
     */
    configuration = {
        get: () => {
            return this.request('GET', '/configuration');
        },

        update: (configData) => {
            return this.request('PUT', '/configuration', configData);
        }
    };

    /**
     * Links Management Methods
     */
    links = {
        list: () => {
            return this.request('GET', '/links');
        },

        create: (linkData) => {
            return this.request('POST', '/links', linkData);
        },

        get: (linkId) => {
            return this.request('GET', `/links/${linkId}`);
        }
    };

    /**
     * Tablets Management Methods
     */
    tablets = {
        list: () => {
            return this.request('GET', '/tablets');
        },

        register: (tabletData) => {
            return this.request('POST', '/tablets/register', tabletData);
        },

        get: (tabletId) => {
            return this.request('GET', `/tablets/${tabletId}`);
        }
    };

    /**
     * Health check method
     */
    healthCheck() {
        return this.request('GET', '/health');
    }

    /**
     * Get current authentication status
     */
    isAuthenticated() {
        return this.jwtToken !== null;
    }

    /**
     * Get current user ID
     */
    getUserId() {
        return this.userId;
    }
}

export default WeSignAPIClient;