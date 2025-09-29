/**
 * Health Check Utilities
 * Shared health check functions for enterprise services
 */

import { supabaseClient } from '../database/supabase-client';
import { logger } from './logger';

export async function checkStorageHealth(): Promise<boolean> {
  try {
    const config = {
      NODE_ENV: process.env.NODE_ENV || 'development'
    };

    if (config.NODE_ENV === 'development') {
      // Check local storage directory
      const fs = await import('fs/promises');
      const storageDir = process.env.STORAGE_PATH || './storage';
      
      try {
        await fs.access(storageDir);
        // Try to create a test file
        const testFile = `${storageDir}/health-check-${Date.now()}.tmp`;
        await fs.writeFile(testFile, 'health check');
        await fs.unlink(testFile);
        return true;
      } catch (error) {
        logger.warn('Local storage health check failed', { error });
        return false;
      }
    } else {
      // Check Supabase storage
      if (!supabaseClient) {
        return false;
      }
      
      // Try to list buckets to verify connection
      const { data, error } = await supabaseClient.storage.listBuckets();
      if (error) {
        logger.warn('Supabase storage health check failed', { error });
        return false;
      }
      
      return Array.isArray(data);
    }
  } catch (error) {
    logger.error('Storage health check error', { error });
    return false;
  }
}