import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { KnowledgeIngestionService } from '@/services/ai/knowledgeIngestionService';
import { logger } from '@/utils/logger';
import { join } from 'path';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files at once
  }
});

// Upload and ingest files
router.post('/upload', upload.array('files'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    const category = req.body.category || 'uploaded';
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    logger.info('Knowledge upload requested', { 
      fileCount: files.length,
      category,
      files: files.map(f => ({ name: f.originalname, size: f.size }))
    });
    
    const service = new KnowledgeIngestionService();
    const results = [];
    let totalChunks = 0;
    let successCount = 0;
    
    // Process each uploaded file
    for (const file of files) {
      try {
        const result = await service.ingestFile(file.path, category);
        
        // Add original filename to result
        result.originalName = file.originalname;
        result.fileSize = file.size;
        results.push(result);
        
        if (result.success) {
          totalChunks += result.chunks;
          successCount++;
        }
        
      } catch (error) {
        logger.error('File ingestion error:', error);
        results.push({
          success: false,
          originalName: file.originalname,
          error: error.message
        });
      } finally {
        // Clean up temporary file
        try {
          unlinkSync(file.path);
          logger.debug(`Cleaned up temporary file: ${file.path}`);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp file ${file.path}:`, cleanupError);
        }
      }
    }
    
    service.close();
    
    logger.info('Knowledge upload completed', {
      successCount,
      totalFiles: files.length,
      totalChunks,
      category
    });
    
    res.json({
      success: true,
      summary: {
        totalFiles: files.length,
        successCount,
        totalChunks,
        category
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Knowledge upload endpoint error:', error);
    next(error);
  }
});

// Get ingestion statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Knowledge stats requested');
    
    const service = new KnowledgeIngestionService();
    const stats = await service.getIngestionStats();
    service.close();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
    
  } catch (error) {
    logger.error('Knowledge stats endpoint error:', error);
    next(error);
  }
});

// Search knowledge base
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    logger.info('Knowledge search requested', { 
      query: query.substring(0, 100),
      limit 
    });
    
    const service = new KnowledgeIngestionService();
    const results = await service.searchKnowledge(query, limit);
    service.close();
    
    res.json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Knowledge search endpoint error:', error);
    next(error);
  }
});

// Clear category
router.delete('/category/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    
    logger.info('Knowledge category clear requested', { category });
    
    const service = new KnowledgeIngestionService();
    const deletedCount = await service.clearCategory(category);
    service.close();
    
    res.json({
      success: true,
      category,
      deletedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Knowledge category clear endpoint error:', error);
    next(error);
  }
});

// Ingest from directory (admin endpoint)
router.post('/ingest-directory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { directoryPath, category = 'directory', extensions = [] } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({
        success: false,
        error: 'Directory path is required'
      });
    }
    
    logger.info('Directory ingestion requested', { 
      directoryPath,
      category,
      extensions 
    });
    
    const service = new KnowledgeIngestionService();
    const results = await service.ingestFromDirectory(directoryPath, category, extensions);
    service.close();
    
    res.json({
      success: true,
      directoryPath,
      category,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Directory ingestion endpoint error:', error);
    next(error);
  }
});

// Error handling middleware
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Knowledge router error:', error);
  res.status(500).json({
    success: false,
    error: 'Knowledge service error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

export { router as knowledgeRouter };