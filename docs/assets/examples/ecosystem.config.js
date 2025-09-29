/**
 * PM2 Ecosystem Configuration for QA Intelligence
 * Production-ready process management configuration
 */

module.exports = {
  apps: [
    {
      name: 'qa-intelligence-backend',
      script: './dist/server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'cluster',

      // Environment configuration
      env: {
        NODE_ENV: 'development',
        PORT: 8082,
        DATABASE_URL: 'sqlite:../memory.sqlite',
        JWT_SECRET: 'your-jwt-secret-here',
        WESIGN_BASE_URL: 'https://devtest.comda.co.il',
        LOG_LEVEL: 'info'
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 8082,
        DATABASE_URL: 'postgresql://username:password@localhost:5432/qa_intelligence',
        JWT_SECRET: process.env.JWT_SECRET,
        WESIGN_BASE_URL: 'https://app.wesign.com',
        LOG_LEVEL: 'warn'
      },

      // Performance settings
      node_args: '--max-old-space-size=2048',
      max_memory_restart: '1G',

      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Auto-restart settings
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Health monitoring
      health_check_url: 'http://localhost:8082/api/health',
      health_check_grace_period: 3000
    },

    {
      name: 'qa-intelligence-frontend',
      script: 'npm',
      args: 'start',
      cwd: './apps/frontend/dashboard',
      instances: 1,
      exec_mode: 'fork',

      // Environment configuration
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'http://localhost:8082/api',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:8082'
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'https://api.qa-intelligence.company.com/api',
        NEXT_PUBLIC_WS_URL: 'wss://api.qa-intelligence.company.com'
      },

      // Performance settings
      max_memory_restart: '512M',

      // Logging
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',

      // Auto-restart settings
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    },

    {
      name: 'qa-intelligence-scheduler',
      script: './dist/workers/scheduler.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',

      // Environment configuration
      env: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'scheduler',
        DATABASE_URL: 'sqlite:../memory.sqlite',
        MAX_CONCURRENT_EXECUTIONS: 4
      },

      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'scheduler',
        DATABASE_URL: 'postgresql://username:password@localhost:5432/qa_intelligence',
        MAX_CONCURRENT_EXECUTIONS: 8
      },

      // Worker-specific settings
      max_memory_restart: '256M',
      cron_restart: '0 2 * * *', // Restart daily at 2 AM

      // Logging
      log_file: './logs/scheduler-combined.log',
      out_file: './logs/scheduler-out.log',
      error_file: './logs/scheduler-error.log'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server-1', 'production-server-2'],
      ref: 'origin/main',
      repo: 'git@github.com:company/qa-intelligence.git',
      path: '/var/www/qa-intelligence',

      // Pre-deployment hooks
      'pre-setup': 'apt update -y; apt install git -y',
      'pre-deploy-local': 'echo "This is run on the local machine"',
      'pre-deploy': 'git reset --hard',

      // Post-deployment hooks
      'post-deploy': `
        npm install --production &&
        npm run build &&
        pm2 reload ecosystem.config.js --env production &&
        pm2 save
      `,

      // Post-setup hooks
      'post-setup': `
        ls -la &&
        npm install --production &&
        npm run build &&
        pm2 start ecosystem.config.js --env production &&
        pm2 save &&
        pm2 startup
      `
    },

    staging: {
      user: 'deploy',
      host: 'staging-server',
      ref: 'origin/develop',
      repo: 'git@github.com:company/qa-intelligence.git',
      path: '/var/www/qa-intelligence-staging',

      'post-deploy': `
        npm install &&
        npm run build &&
        pm2 reload ecosystem.config.js --env staging &&
        pm2 save
      `
    }
  }
};