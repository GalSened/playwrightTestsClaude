import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import WeSignKnowledgeBase from '@/services/ai/wesign-knowledge-base';

const router = Router();

/**
 * POST /api/wesign-knowledge/ingest
 * Ingest WeSign test suite into knowledge base
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const { testSuitePath } = req.body;

    if (!testSuitePath) {
      return res.status(400).json({
        success: false,
        error: 'testSuitePath is required'
      });
    }

    const knowledgeBase = new WeSignKnowledgeBase();

    // Start ingestion process
    await knowledgeBase.ingestWeSignTestSuite(testSuitePath);

    // Get stats after ingestion
    const stats = await knowledgeBase.getKnowledgeStats();
    knowledgeBase.close();

    res.json({
      success: true,
      message: 'WeSign test suite ingested successfully',
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to ingest WeSign test suite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest WeSign test suite'
    });
  }
});

/**
 * POST /api/wesign-knowledge/query
 * Query the WeSign knowledge base
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required'
      });
    }

    const knowledgeBase = new WeSignKnowledgeBase();
    const results = await knowledgeBase.queryKnowledge(query, parseInt(limit));
    knowledgeBase.close();

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to query WeSign knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query WeSign knowledge base'
    });
  }
});

/**
 * GET /api/wesign-knowledge/stats
 * Get knowledge base statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const knowledgeBase = new WeSignKnowledgeBase();
    const stats = await knowledgeBase.getKnowledgeStats();
    knowledgeBase.close();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get knowledge base stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get knowledge base stats'
    });
  }
});

/**
 * POST /api/wesign-knowledge/add-entry
 * Add a single knowledge entry
 */
router.post('/add-entry', async (req: Request, res: Response) => {
  try {
    const { type, title, content, metadata = {} } = req.body;

    if (!type || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'type, title, and content are required'
      });
    }

    const knowledgeBase = new WeSignKnowledgeBase();

    await knowledgeBase.addKnowledgeEntry({
      id: `manual_${Date.now()}`,
      type,
      title,
      content,
      metadata
    });

    knowledgeBase.close();

    res.json({
      success: true,
      message: 'Knowledge entry added successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to add knowledge entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add knowledge entry'
    });
  }
});

/**
 * POST /api/wesign-knowledge/smart-recommendations
 * Get AI-powered test recommendations based on query
 */
router.post('/smart-recommendations', async (req: Request, res: Response) => {
  try {
    const { context, testType = 'any', language = 'any' } = req.body;

    if (!context) {
      return res.status(400).json({
        success: false,
        error: 'context is required'
      });
    }

    const knowledgeBase = new WeSignKnowledgeBase();

    // Query for relevant knowledge
    const searchQuery = `${context} ${testType} ${language} test automation`;
    const knowledgeResults = await knowledgeBase.queryKnowledge(searchQuery, 5);

    knowledgeBase.close();

    // Format recommendations
    const recommendations = knowledgeResults.map(result => ({
      type: result.entry.type,
      title: result.entry.title,
      relevanceScore: result.relevanceScore,
      summary: result.summary,
      metadata: result.entry.metadata,
      codeSnippet: result.entry.content.substring(0, 300) + '...'
    }));

    res.json({
      success: true,
      context,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get smart recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get smart recommendations'
    });
  }
});

/**
 * POST /api/wesign-knowledge/auto-ingest
 * Automatically ingest from default WeSign test locations
 */
router.post('/auto-ingest', async (req: Request, res: Response) => {
  try {
    const knowledgeBase = new WeSignKnowledgeBase();

    // Default WeSign test locations to try
    const defaultPaths = [
      'C:\\Users\\gals\\seleniumpythontests-1',
      'C:\\Users\\gals\\seleniumpythontests-1\\playwright_tests',
      './tests',
      '../tests',
      process.cwd()
    ];

    let ingestionResults = [];

    for (const path of defaultPaths) {
      try {
        await knowledgeBase.ingestWeSignTestSuite(path);
        ingestionResults.push({
          path,
          status: 'success',
          message: 'Ingested successfully'
        });
        break; // Stop after first successful ingestion
      } catch (error) {
        ingestionResults.push({
          path,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const stats = await knowledgeBase.getKnowledgeStats();
    knowledgeBase.close();

    const successful = ingestionResults.some(r => r.status === 'success');

    res.json({
      success: successful,
      message: successful ? 'Auto-ingestion completed' : 'Auto-ingestion failed for all paths',
      ingestionResults,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed auto-ingestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed auto-ingestion'
    });
  }
});

export { router as wesignKnowledgeRouter };