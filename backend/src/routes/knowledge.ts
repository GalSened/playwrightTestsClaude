import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { KnowledgeIngestionService } from '@/services/ai/knowledgeIngestionService';
import { WeSignKnowledgeIntegrator } from '@/services/ai/wesignKnowledgeIntegrator';
import { wesignKnowledgeInitializer } from '@/services/ai/wesignKnowledgeInitializer';
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

// WeSign-specific endpoints

// Initialize WeSign knowledge base
router.post('/wesign/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('WeSign knowledge base initialization requested');

    const integrator = new WeSignKnowledgeIntegrator();
    const knowledgeBase = await integrator.initializeWeSignKnowledge();

    res.json({
      success: true,
      message: 'WeSign knowledge base initialized successfully',
      summary: {
        components: knowledgeBase.componentMap.size,
        workflows: knowledgeBase.workflowMap.size,
        selectors: knowledgeBase.selectorMap.size,
        apis: knowledgeBase.apiEndpointMap.size,
        lastUpdated: knowledgeBase.lastUpdated
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign knowledge initialization error:', error);
    next(error);
  }
});

// Get WeSign component knowledge
router.get('/wesign/components', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { component } = req.query;

    logger.info('WeSign component knowledge requested', { component });

    const integrator = new WeSignKnowledgeIntegrator();
    const knowledgeBase = await integrator.initializeWeSignKnowledge();

    if (component) {
      const componentKnowledge = knowledgeBase.componentMap.get(component as string);
      if (!componentKnowledge) {
        return res.status(404).json({
          success: false,
          error: `Component '${component}' not found`,
          availableComponents: Array.from(knowledgeBase.componentMap.keys())
        });
      }

      res.json({
        success: true,
        component: componentKnowledge,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        components: Array.from(knowledgeBase.componentMap.values()),
        count: knowledgeBase.componentMap.size,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('WeSign component knowledge error:', error);
    next(error);
  }
});

// Get WeSign workflow knowledge
router.get('/wesign/workflows', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflow } = req.query;

    logger.info('WeSign workflow knowledge requested', { workflow });

    const integrator = new WeSignKnowledgeIntegrator();
    const knowledgeBase = await integrator.initializeWeSignKnowledge();

    if (workflow) {
      const workflowKnowledge = knowledgeBase.workflowMap.get(workflow as string);
      if (!workflowKnowledge) {
        return res.status(404).json({
          success: false,
          error: `Workflow '${workflow}' not found`,
          availableWorkflows: Array.from(knowledgeBase.workflowMap.keys())
        });
      }

      res.json({
        success: true,
        workflow: workflowKnowledge,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        workflows: Array.from(knowledgeBase.workflowMap.values()),
        count: knowledgeBase.workflowMap.size,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('WeSign workflow knowledge error:', error);
    next(error);
  }
});

// Get WeSign selector recommendations
router.get('/wesign/selectors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { component, element } = req.query;

    logger.info('WeSign selector knowledge requested', { component, element });

    const integrator = new WeSignKnowledgeIntegrator();
    const knowledgeBase = await integrator.initializeWeSignKnowledge();

    let selectors = Array.from(knowledgeBase.selectorMap.values());

    if (component) {
      selectors = selectors.filter(s => s.component === component);
    }

    if (element) {
      selectors = selectors.filter(s => s.element.includes(element as string));
    }

    res.json({
      success: true,
      selectors,
      count: selectors.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign selector knowledge error:', error);
    next(error);
  }
});

// Query WeSign knowledge with AI-enhanced search
router.post('/wesign/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, context = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    logger.info('WeSign knowledge query requested', {
      query: query.substring(0, 100),
      context: Object.keys(context)
    });

    const integrator = new WeSignKnowledgeIntegrator();
    const results = await integrator.getKnowledgeForQuery(query);

    res.json({
      success: true,
      query,
      context,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign knowledge query error:', error);
    next(error);
  }
});

// Update WeSign knowledge
router.post('/wesign/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, content, metadata = {} } = req.body;

    if (!category || !content) {
      return res.status(400).json({
        success: false,
        error: 'Category and content are required'
      });
    }

    logger.info('WeSign knowledge update requested', {
      category,
      contentLength: content.length,
      metadata: Object.keys(metadata)
    });

    const integrator = new WeSignKnowledgeIntegrator();
    await integrator.updateKnowledge(category, content);

    res.json({
      success: true,
      message: 'WeSign knowledge updated successfully',
      category,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign knowledge update error:', error);
    next(error);
  }
});

// Get WeSign knowledge base status
router.get('/wesign/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('WeSign knowledge status requested');

    // Get initialization status
    const initStatus = wesignKnowledgeInitializer.getStatus();

    // Get regular knowledge base stats
    const service = new KnowledgeIngestionService();
    const stats = await service.getIngestionStats();
    service.close();

    // Filter WeSign-specific stats
    const wesignStats = {
      summary: stats.summary,
      wesignCategories: stats.bySourceAndType.filter((item: any) =>
        item.source && (
          item.source.includes('wesign') ||
          item.type && item.type.includes('wesign')
        )
      ),
      recentWeSignIngestion: stats.recentTypes.filter((item: any) =>
        item.type && item.type.includes('wesign')
      )
    };

    res.json({
      success: true,
      status: initStatus.initialized ? 'operational' : 'initializing',
      initialization: initStatus,
      wesignStats,
      codebasePath: 'C:\\Users\\gals\\Desktop\\wesign-client-DEV',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign knowledge status error:', error);
    next(error);
  }
});

// Force refresh WeSign knowledge base
router.post('/wesign/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('WeSign knowledge base refresh requested');

    await wesignKnowledgeInitializer.refresh();
    const status = wesignKnowledgeInitializer.getStatus();

    res.json({
      success: true,
      message: 'WeSign knowledge base refreshed successfully',
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign knowledge refresh error:', error);
    next(error);
  }
});

// Analyze WeSign codebase and update knowledge
router.post('/wesign/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: customPath, forceRefresh = false } = req.body;

    logger.info('WeSign codebase analysis requested', { customPath, forceRefresh });

    const integrator = new WeSignKnowledgeIntegrator();

    // This would trigger a fresh analysis of the WeSign codebase
    const knowledgeBase = await integrator.initializeWeSignKnowledge();

    res.json({
      success: true,
      message: 'WeSign codebase analyzed and knowledge updated',
      analysis: {
        components: knowledgeBase.componentMap.size,
        workflows: knowledgeBase.workflowMap.size,
        selectors: knowledgeBase.selectorMap.size,
        apis: knowledgeBase.apiEndpointMap.size,
        lastAnalyzed: knowledgeBase.lastUpdated
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('WeSign codebase analysis error:', error);
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