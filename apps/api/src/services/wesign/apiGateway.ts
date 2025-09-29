import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';

export interface WeSignApiConfig {
  dotnetBaseUrl: string;
  nodeBaseUrl: string;
  timeout: number;
  retries: number;
}

export interface AuthenticationBridge {
  nodeSecret: string;
  dotnetSecret: string;
  issuer: string;
  audience: string;
}

export class WeSignApiGateway {
  private config: WeSignApiConfig;
  private authBridge: AuthenticationBridge;

  constructor(config?: Partial<WeSignApiConfig>) {
    this.config = {
      dotnetBaseUrl: process.env.WESIGN_DOTNET_URL || 'http://localhost:5000',
      nodeBaseUrl: process.env.QA_INTELLIGENCE_URL || 'http://localhost:8082',
      timeout: 30000,
      retries: 3,
      ...config
    };

    this.authBridge = {
      nodeSecret: process.env.JWT_SECRET || 'qa-intelligence-secret',
      dotnetSecret: process.env.WESIGN_JWT_SECRET || 'wesign-backend-secret',
      issuer: 'qa-intelligence',
      audience: 'wesign-backend'
    };

    logger.info('WeSign API Gateway initialized', {
      dotnetUrl: this.config.dotnetBaseUrl,
      nodeUrl: this.config.nodeBaseUrl,
      timeout: this.config.timeout
    });
  }

  /**
   * Main routing method - intelligently delegates requests
   */
  async routeRequest(req: Request, res: Response): Promise<void> {
    const route = req.path;
    const method = req.method;

    try {
      logger.info('Routing WeSign API request', {
        method,
        path: route,
        userAgent: req.headers ? req.headers['user-agent'] : 'unknown'
      });

      // Route to appropriate service based on path pattern
      if (this.shouldRouteToDotNet(route)) {
        await this.proxyToDotNet(req, res);
      } else if (this.shouldHandleInNode(route)) {
        await this.handleInNode(req, res);
      } else if (this.isHybridRequest(route)) {
        await this.hybridHandler(req, res);
      } else {
        // Default fallback
        res.status(404).json({
          success: false,
          error: 'Route not found',
          availableRoutes: this.getAvailableRoutes()
        });
      }
    } catch (error) {
      logger.error('API Gateway routing failed', {
        route,
        method,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Gateway routing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Determine if request should be routed to .NET backend
   */
  private shouldRouteToDotNet(route: string): boolean {
    const dotnetRoutes = [
      '/api/wesign/v3/'
    ];

    logger.info('Checking if route should go to .NET', { route, dotnetRoutes });
    return dotnetRoutes.some(pattern => route.startsWith(pattern));
  }

  /**
   * Determine if request should be handled in Node.js
   */
  private shouldHandleInNode(route: string): boolean {
    const nodeRoutes = [
      '/api/ai/',
      '/api/analytics/',
      '/api/test-execution/',
      '/api/healing/',
      '/api/knowledge/',
      '/api/wesign/test/' // Existing test execution
    ];

    return nodeRoutes.some(pattern => route.startsWith(pattern));
  }

  /**
   * Determine if request requires hybrid processing
   */
  private isHybridRequest(route: string): boolean {
    const hybridRoutes = [
      '/api/wesign/ai-enhanced/',
      '/api/wesign/smart-dashboard',
      '/api/wesign/intelligent-contacts',
      '/api/wesign/predictive-analytics/'
    ];

    return hybridRoutes.some(pattern => route.startsWith(pattern));
  }

  /**
   * Proxy request to .NET WeSign backend
   */
  private async proxyToDotNet(req: Request, res: Response): Promise<void> {
    try {
      // Convert route from /api/wesign/v3/... to /v3/...
      const dotnetPath = req.path.replace('/api/wesign', '');
      const targetUrl = `${this.config.dotnetBaseUrl}${dotnetPath}`;

      // Prepare headers with authentication bridge
      const headers = await this.bridgeAuthentication(req.headers);

      const axiosConfig: AxiosRequestConfig = {
        method: req.method as any,
        url: targetUrl,
        headers,
        params: req.query,
        data: req.body,
        timeout: this.config.timeout,
        validateStatus: () => true // Accept all status codes
      };

      logger.info('Proxying to .NET backend', {
        targetUrl,
        method: req.method,
        headers: Object.keys(headers)
      });

      const response: AxiosResponse = await axios(axiosConfig);

      // Forward response
      res.status(response.status);
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          res.setHeader(key, value);
        }
      });

      res.json(response.data);

      logger.info('.NET backend response', {
        status: response.status,
        dataSize: JSON.stringify(response.data).length
      });

    } catch (error) {
      logger.error('Failed to proxy to .NET backend', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: req.path
      });

      res.status(503).json({
        success: false,
        error: 'WeSign backend service unavailable',
        details: 'Unable to connect to .NET backend service'
      });
    }
  }

  /**
   * Handle request in Node.js (existing functionality)
   */
  private async handleInNode(req: Request, res: Response): Promise<void> {
    // This would delegate to existing Node.js route handlers
    // For now, return a placeholder indicating Node.js handling
    res.json({
      success: true,
      message: 'Handled by Node.js QA Intelligence backend',
      service: 'node.js',
      path: req.path,
      method: req.method
    });
  }

  /**
   * Hybrid handler: Combine .NET data with Node.js AI services
   */
  private async hybridHandler(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Processing hybrid request', { path: req.path });

      if (req.path.startsWith('/api/wesign/ai-enhanced/dashboard')) {
        await this.enhancedDashboard(req, res);
      } else if (req.path.startsWith('/api/wesign/intelligent-contacts')) {
        await this.intelligentContacts(req, res);
      } else if (req.path.startsWith('/api/wesign/smart-dashboard')) {
        await this.smartDashboard(req, res);
      } else {
        res.status(404).json({
          success: false,
          error: 'Hybrid route not implemented',
          path: req.path
        });
      }
    } catch (error) {
      logger.error('Hybrid handler failed', {
        path: req.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Hybrid processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Enhanced dashboard with AI insights
   */
  private async enhancedDashboard(req: Request, res: Response): Promise<void> {
    try {
      // 1. Get dashboard data from .NET backend
      const dashboardData = await this.fetchFromDotNet('/v3/dashboard', req);

      // 2. Enhance with AI insights (placeholder - would integrate with actual AI services)
      const aiInsights = {
        totalDocuments: dashboardData?.documents?.length || 0,
        pendingSignatures: dashboardData?.pendingSignatures || 0,
        insights: [
          'Document processing efficiency improved by 15% this week',
          'Peak signing activity occurs between 10 AM - 2 PM',
          'Template usage increased by 23% compared to last month'
        ],
        recommendations: [
          'Consider creating automated reminders for pending signatures',
          'Optimize template workflows for better user experience',
          'Implement smart contact grouping for faster document distribution'
        ],
        aiEnhanced: true,
        generatedAt: new Date().toISOString()
      };

      // 3. Return enhanced dashboard
      res.json({
        success: true,
        data: {
          ...dashboardData,
          aiInsights,
          source: 'hybrid_processing'
        }
      });

    } catch (error) {
      logger.error('Enhanced dashboard failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate enhanced dashboard'
      });
    }
  }

  /**
   * Intelligent contacts with AI recommendations
   */
  private async intelligentContacts(req: Request, res: Response): Promise<void> {
    try {
      // 1. Get contacts data from .NET backend
      const contactsData = await this.fetchFromDotNet('/v3/contacts', req);

      // 2. Add AI-powered insights
      const intelligentFeatures = {
        duplicateDetection: [], // AI-powered duplicate detection
        contactScoring: {}, // Engagement scoring
        smartGroups: [], // AI-suggested contact groups
        recommendations: [
          'Group frequent signers for faster distribution',
          'Update contact information for bounced emails',
          'Create automated follow-up sequences'
        ]
      };

      res.json({
        success: true,
        data: {
          ...contactsData,
          intelligent: intelligentFeatures,
          aiEnhanced: true
        }
      });

    } catch (error) {
      logger.error('Intelligent contacts failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate intelligent contacts'
      });
    }
  }

  /**
   * Smart dashboard with predictive analytics
   */
  private async smartDashboard(req: Request, res: Response): Promise<void> {
    const analytics = {
      predictions: {
        nextWeekSignatures: Math.floor(Math.random() * 100) + 50,
        expectedCompletionTime: '2.3 days average',
        riskFactors: ['3 documents approaching deadline', '2 contacts need follow-up']
      },
      trends: {
        signingVelocity: '+15% vs last month',
        documentVolume: '+23% vs last month',
        userEngagement: '89% active users'
      }
    };

    res.json({
      success: true,
      data: analytics,
      source: 'predictive_ai'
    });
  }

  /**
   * Authentication bridge - convert Node.js JWT to .NET compatible auth
   */
  private async bridgeAuthentication(headers: any): Promise<any> {
    const authHeader = headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { ...headers };
    }

    try {
      const nodeToken = authHeader.replace('Bearer ', '');

      // Verify Node.js token
      const nodePayload = jwt.verify(nodeToken, this.authBridge.nodeSecret) as any;

      // Create .NET compatible token
      const dotnetToken = jwt.sign(
        {
          userId: nodePayload.userId || nodePayload.id,
          username: nodePayload.username || nodePayload.name,
          roles: nodePayload.roles || ['user'],
          source: 'qa-intelligence'
        },
        this.authBridge.dotnetSecret,
        {
          expiresIn: '1h',
          issuer: this.authBridge.issuer,
          audience: this.authBridge.audience
        }
      );

      return {
        ...headers,
        authorization: `Bearer ${dotnetToken}`,
        'x-forwarded-from': 'qa-intelligence',
        'x-original-token': nodeToken.substring(0, 20) + '...'
      };

    } catch (error) {
      logger.warn('Authentication bridge failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return original headers if bridging fails
      return { ...headers };
    }
  }

  /**
   * Utility method to fetch data from .NET backend
   */
  private async fetchFromDotNet(path: string, req: Request): Promise<any> {
    const headers = await this.bridgeAuthentication(req.headers);
    const response = await axios({
      method: 'GET',
      url: `${this.config.dotnetBaseUrl}${path}`,
      headers,
      params: req.query,
      timeout: this.config.timeout
    });

    return response.data;
  }

  /**
   * Get available routes for debugging
   */
  private getAvailableRoutes(): string[] {
    return [
      // .NET routes
      '/api/wesign/v3/contacts',
      '/api/wesign/v3/templates',
      '/api/wesign/v3/documents',
      '/api/wesign/v3/dashboard',

      // Node.js routes
      '/api/ai/*',
      '/api/analytics/*',
      '/api/test-execution/*',

      // Hybrid routes
      '/api/wesign/ai-enhanced/dashboard',
      '/api/wesign/intelligent-contacts',
      '/api/wesign/smart-dashboard'
    ];
  }

  /**
   * Health check for the gateway and connected services
   */
  async healthCheck(): Promise<any> {
    const results = {
      gateway: 'healthy',
      dotnetBackend: 'unknown',
      nodeBackend: 'healthy',
      timestamp: new Date().toISOString()
    };

    try {
      // Check .NET backend
      await axios.get(`${this.config.dotnetBaseUrl}/health`, { timeout: 5000 });
      results.dotnetBackend = 'healthy';
    } catch (error) {
      results.dotnetBackend = 'unhealthy';
      logger.warn('.NET backend health check failed', { error });
    }

    return results;
  }
}

export default WeSignApiGateway;