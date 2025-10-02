import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { knowledgeService } from '../knowledge/index';

// Create API Gateway for QA Intelligence System
const gateway = new Elysia()
  .use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3004'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }))
  .use(swagger({
    documentation: {
      info: {
        title: 'QA Intelligence API Gateway',
        version: '1.0.0',
        description: 'Elysia-powered API Gateway for QA Intelligence automation testing platform'
      },
      servers: [
        { url: 'http://localhost:3100', description: 'Development server' }
      ]
    },
    path: '/docs'
  }))
  
  // Health check endpoint
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gateway: 'operational',
      knowledge: 'pending',
      ai_insights: 'pending',
      test_execution: 'pending'
    }
  }))
  
  // Basic info endpoint
  .get('/', () => ({
    message: 'QA Intelligence Elysia Gateway',
    version: '1.0.0',
    framework: 'Elysia',
    runtime: 'Bun',
    documentation: '/docs',
    health: '/health'
  }))
  
  // Knowledge Base service integration
  .use(knowledgeService)
  
  // Placeholder routes for other services (to be implemented)
  .group('/api', (app) => 
    app
      .get('/ai-insights/status', () => ({ service: 'ai-insights', status: 'ready' }))
      .get('/test-execution/status', () => ({ service: 'test-execution', status: 'ready' }))
  )

console.log('🚀 QA Intelligence Elysia Gateway starting...')
console.log('📚 API Documentation: http://localhost:3100/docs')
console.log('💚 Health Check: http://localhost:3100/health')

export default gateway;