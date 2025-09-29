import { readFileSync } from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';

export class UniversalFileProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }
  
  async processFile(filePath: string, metadata: any = {}): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    console.log(`📄 Processing ${fileName} (${ext})`);
    
    let documents: Document[] = [];
    
    try {
      // Detect file type and process accordingly
      switch (ext) {
        case '.json':
          documents = await this.processJSON(filePath, metadata);
          break;
          
        case '.md':
        case '.markdown':
          documents = await this.processMarkdown(filePath, metadata);
          break;
          
        case '.yaml':
        case '.yml':
          documents = await this.processYAML(filePath, metadata);
          break;
          
        case '.pdf':
          documents = await this.processPDF(filePath, metadata);
          break;
          
        case '.py':
        case '.ts':
        case '.js':
        case '.tsx':
        case '.jsx':
          documents = await this.processCode(filePath, metadata);
          break;
          
        case '.txt':
        case '.log':
          documents = await this.processText(filePath, metadata);
          break;
          
        case '.csv':
          documents = await this.processCSV(filePath, metadata);
          break;
          
        case '.docx':
          documents = await this.processDOCX(filePath, metadata);
          break;
          
        default:
          // Try to process as text
          console.log(`⚠️ Unknown file type ${ext}, treating as text`);
          documents = await this.processText(filePath, metadata);
      }
      
      console.log(`✅ Processed ${fileName}: ${documents.length} chunks`);
      return documents;
      
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      return [];
    }
  }
  
  async processJSON(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Special handling for different JSON structures
    if (filePath.includes('settings') || filePath.includes('config')) {
      return this.processSettingsJSON(data, metadata);
    } else if (data.paths) {
      return this.processOpenAPIJSON(data, metadata);
    } else if (data.info && data.item) {
      return this.processPostmanJSON(data, metadata);
    }
    
    // Generic JSON processing
    const docs: Document[] = [];
    const processObject = (obj: any, objectPath: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = objectPath ? `${objectPath}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            docs.push(new Document({
              pageContent: `${currentPath}: ${JSON.stringify(value, null, 2)}`,
              metadata: { ...metadata, type: 'json-array', path: currentPath, source: path.basename(filePath) }
            }));
          } else {
            processObject(value, currentPath);
          }
        } else {
          docs.push(new Document({
            pageContent: `${currentPath}: ${value}`,
            metadata: { ...metadata, type: 'json-value', path: currentPath, source: path.basename(filePath) }
          }));
        }
      }
    };
    
    processObject(data);
    return docs;
  }
  
  async processSettingsJSON(data: any, metadata: any): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Extract meaningful sections
    const sections = {
      'API Configuration': data.api || data.endpoints || {},
      'Features': data.features || data.featureFlags || {},
      'Authentication': data.auth || data.authentication || {},
      'Languages': data.languages || data.locales || [],
      'Modules': data.modules || {},
      'Environment': data.environment || data.env || {},
      'Database': data.database || data.db || {},
      'UI Settings': data.ui || data.interface || {}
    };
    
    for (const [section, content] of Object.entries(sections)) {
      if (content && (Array.isArray(content) ? content.length > 0 : Object.keys(content).length > 0)) {
        documents.push(new Document({
          pageContent: `WeSign ${section}:\n${JSON.stringify(content, null, 2)}`,
          metadata: {
            ...metadata,
            type: 'settings',
            section,
            source: 'settings.json'
          }
        }));
      }
    }
    
    // Also store the full settings for context
    documents.push(new Document({
      pageContent: `Complete Settings Configuration:\n${JSON.stringify(data, null, 2)}`,
      metadata: {
        ...metadata,
        type: 'settings-full',
        source: 'settings.json'
      }
    }));
    
    return documents;
  }
  
  async processOpenAPIJSON(data: any, metadata: any): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Process API info
    if (data.info) {
      documents.push(new Document({
        pageContent: `API Information:\n${JSON.stringify(data.info, null, 2)}`,
        metadata: { ...metadata, type: 'api-info', source: path.basename(metadata.source || 'api.json') }
      }));
    }
    
    // Process each endpoint
    if (data.paths) {
      for (const [pathKey, pathData] of Object.entries(data.paths)) {
        for (const [method, methodData] of Object.entries(pathData as any)) {
          documents.push(new Document({
            pageContent: `${method.toUpperCase()} ${pathKey}:\n${JSON.stringify(methodData, null, 2)}`,
            metadata: {
              ...metadata,
              type: 'api-endpoint',
              method: method.toUpperCase(),
              path: pathKey,
              source: path.basename(metadata.source || 'api.json')
            }
          }));
        }
      }
    }
    
    return documents;
  }
  
  async processPostmanJSON(data: any, metadata: any): Promise<Document[]> {
    const documents: Document[] = [];
    
    // Process collection info
    if (data.info) {
      documents.push(new Document({
        pageContent: `Postman Collection: ${data.info.name}\n${data.info.description || ''}`,
        metadata: { ...metadata, type: 'postman-collection', source: path.basename(metadata.source || 'postman.json') }
      }));
    }
    
    // Process requests
    if (data.item) {
      const processItems = (items: any[], folder: string = '') => {
        for (const item of items) {
          if (item.item) {
            // It's a folder
            processItems(item.item, item.name);
          } else if (item.request) {
            // It's a request
            documents.push(new Document({
              pageContent: `${folder ? folder + ' - ' : ''}${item.name}:\n${JSON.stringify(item.request, null, 2)}`,
              metadata: {
                ...metadata,
                type: 'postman-request',
                folder,
                requestName: item.name,
                source: path.basename(metadata.source || 'postman.json')
              }
            }));
          }
        }
      };
      
      processItems(data.item);
    }
    
    return documents;
  }
  
  async processMarkdown(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    
    // Split by headers for better context
    const sections = content.split(/^(#+\s+.*$)/gm);
    const documents: Document[] = [];
    
    for (let i = 0; i < sections.length; i += 2) {
      const header = sections[i + 1];
      const body = sections[i + 2] || '';
      
      if (body && body.trim().length > 50) {
        // Split long sections
        const chunks = await this.textSplitter.splitText(body);
        for (const chunk of chunks) {
          documents.push(new Document({
            pageContent: (header ? header + '\n' : '') + chunk,
            metadata: {
              ...metadata,
              type: 'markdown',
              section: header?.replace(/^#+\s+/, '') || 'content',
              source: path.basename(filePath)
            }
          }));
        }
      } else if (header || body) {
        documents.push(new Document({
          pageContent: (header || '') + (body || ''),
          metadata: {
            ...metadata,
            type: 'markdown',
            section: header?.replace(/^#+\s+/, '') || 'content',
            source: path.basename(filePath)
          }
        }));
      }
    }
    
    return documents;
  }
  
  async processCode(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const documents: Document[] = [];
    
    // Extract test functions, classes, and important patterns
    const patterns = {
      'test-function': /(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      'function': /(?:function|const|let)\s+(\w+)\s*[=\(]/g,
      'class': /class\s+(\w+)/g,
      'import': /import.*from\s+['"`]([^'"`]+)['"`]/g,
      'export': /export\s+(?:default\s+)?(?:class|function|const|let)\s+(\w+)/g
    };
    
    for (const [patternType, regex] of Object.entries(patterns)) {
      const matches = [...content.matchAll(regex)];
      for (const match of matches) {
        documents.push(new Document({
          pageContent: `${patternType}: ${match[1] || match[0]}`,
          metadata: {
            ...metadata,
            type: 'code-pattern',
            language: ext.substring(1),
            pattern: patternType,
            source: path.basename(filePath)
          }
        }));
      }
    }
    
    // Also store the full file for context, but chunked
    const chunks = await this.textSplitter.splitText(content);
    for (let i = 0; i < chunks.length; i++) {
      documents.push(new Document({
        pageContent: chunks[i],
        metadata: {
          ...metadata,
          type: 'code-full',
          language: ext.substring(1),
          chunkIndex: i,
          source: path.basename(filePath)
        }
      }));
    }
    
    return documents;
  }
  
  async processYAML(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    const data = YAML.parse(content);
    
    // Convert to JSON and process
    const tempFilePath = filePath.replace(/\.ya?ml$/, '.json');
    return this.processJSON(tempFilePath, { 
      ...metadata, 
      originalFormat: 'yaml',
      source: path.basename(filePath)
    });
  }
  
  async processPDF(filePath: string, metadata: any): Promise<Document[]> {
    const dataBuffer = readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    const chunks = await this.textSplitter.splitText(data.text);
    
    return chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: {
        ...metadata,
        type: 'pdf',
        pages: data.numpages,
        chunkIndex: index,
        source: path.basename(filePath)
      }
    }));
  }
  
  async processText(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    const chunks = await this.textSplitter.splitText(content);
    
    return chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: {
        ...metadata,
        type: 'text',
        chunkIndex: index,
        source: path.basename(filePath)
      }
    }));
  }
  
  async processCSV(filePath: string, metadata: any): Promise<Document[]> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0]?.split(',') || [];
    const documents: Document[] = [];
    
    // Store CSV structure
    documents.push(new Document({
      pageContent: `CSV Structure: ${headers.join(', ')}\nTotal rows: ${lines.length - 1}`,
      metadata: {
        ...metadata,
        type: 'csv-structure',
        headers,
        totalRows: lines.length - 1,
        source: path.basename(filePath)
      }
    }));
    
    // Sample first 10 rows for context
    for (let i = 1; i < Math.min(11, lines.length); i++) {
      if (lines[i]?.trim()) {
        documents.push(new Document({
          pageContent: `Row ${i}: ${lines[i]}`,
          metadata: {
            ...metadata,
            type: 'csv-data',
            row: i,
            source: path.basename(filePath)
          }
        }));
      }
    }
    
    return documents;
  }
  
  async processDOCX(filePath: string, metadata: any): Promise<Document[]> {
    const result = await mammoth.extractRawText({ path: filePath });
    const chunks = await this.textSplitter.splitText(result.value);
    
    return chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: {
        ...metadata,
        type: 'docx',
        chunkIndex: index,
        source: path.basename(filePath)
      }
    }));
  }
}