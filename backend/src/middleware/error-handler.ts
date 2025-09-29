/**
 * Enterprise Error Handler Middleware
 * Centralized error handling with logging and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { enterpriseConfig } from '../config/enterprise';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  context?: Record<string, any>;
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Set default values
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_ERROR';
  const isOperational = error.isOperational !== false;

  // Log error with context
  const errorContext = {
    error: {
      message: error.message,
      stack: error.stack,
      code: errorCode,
      statusCode,
      isOperational,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: sanitizeHeaders(req.headers),
      body: sanitizeBody(req.body),
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      tenantId: req.user.tenantId,
      role: req.user.role,
    } : undefined,
    tenant: req.tenant ? {
      id: req.tenant.id,
      subdomain: req.tenant.subdomain,
      plan: req.tenant.plan,
    } : undefined,
    ...error.context,
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred', errorContext);
  } else {
    logger.warn('Client error occurred', errorContext);
  }

  // Prepare response based on environment
  const response = {
    error: errorCode,
    message: getErrorMessage(error, statusCode),
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string,
    ...(enterpriseConfig.NODE_ENV === 'development' && {
      stack: error.stack,
      context: error.context,
    }),
  };

  res.status(statusCode).json(response);
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: AppError, statusCode: number): string {
  // In production, don't expose internal error details
  if (enterpriseConfig.NODE_ENV === 'production' && statusCode >= 500) {
    return 'An internal server error occurred. Please try again later.';
  }

  // Return original message for client errors or in development
  return error.message || 'An error occurred';
}

/**
 * Sanitize sensitive headers
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize sensitive body fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Create operational error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  context?: Record<string, any>
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  error.context = context;
  
  return error;
}

/**
 * Not found error creator
 */
export function createNotFoundError(resource: string, id?: string): AppError {
  const message = id 
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
    
  return createError(message, 404, 'NOT_FOUND', { resource, id });
}

/**
 * Validation error creator
 */
export function createValidationError(
  field: string, 
  value?: any, 
  constraint?: string
): AppError {
  const message = constraint 
    ? `Validation failed for field '${field}': ${constraint}`
    : `Invalid value for field '${field}'`;
    
  return createError(message, 400, 'VALIDATION_ERROR', { 
    field, 
    value, 
    constraint 
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Express async error wrapper
 */
export function catchAsync(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}