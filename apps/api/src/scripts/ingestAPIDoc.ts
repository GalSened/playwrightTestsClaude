import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestionService';
import { logger } from '../utils/logger';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

class WeSignAPIDocumentationIngestor {
  private service: KnowledgeIngestionService;
  
  constructor() {
    this.service = new KnowledgeIngestionService();
  }
  
  async ingestComprehensiveAPIDocumentation(): Promise<void> {
    console.log('🚀 Starting WeSign API documentation ingestion...\n');
    
    const apiDocumentation = {
      "api": {
        "name": "WeSign API",
        "version": "v3",
        "baseUrl": "https://devtest.comda.co.il/userapi",
        "description": "Electronic document signing platform API - comprehensive bilingual system for document workflows, digital signatures, and user management",
        "authentication": {
          "method": "JWT Bearer Token",
          "flow": {
            "step1": "POST /login with credentials",
            "step2": "Receive JWT token in response",
            "step3": "Include 'Authorization: Bearer {token}' in all subsequent requests",
            "step4": "Token expires after session timeout (3600 seconds)"
          },
          "credentials": {
            "demo": {
              "username": "nirk@comsign.co.il",
              "password": "Comsign1!"
            }
          }
        }
      },
      "endpoints": {
        "authentication": {
          "/login": {
            "method": "POST",
            "description": "User authentication endpoint",
            "request": {
              "contentType": "application/json",
              "fields": {
                "username": "string (email format)",
                "password": "string (min 6 chars)"
              }
            },
            "responses": {
              "200": {
                "description": "Login successful",
                "fields": {
                  "token": "string (JWT)",
                  "user": "object (user details)",
                  "sessionId": "string",
                  "expiresAt": "datetime"
                }
              },
              "401": "Invalid credentials",
              "429": "Too many login attempts"
            }
          },
          "/logout": {
            "method": "POST",
            "description": "Logout and invalidate session",
            "authorization": "Required"
          }
        },
        "users": {
          "/ui/v3/users": {
            "method": "GET",
            "description": "Get user list with pagination",
            "authorization": "Required",
            "queryParams": {
              "page": "number (default 1)",
              "limit": "number (max 100)",
              "search": "string (optional)",
              "status": "enum [active, inactive, pending]"
            }
          },
          "/ui/v3/users/{id}": {
            "method": "GET",
            "description": "Get specific user details",
            "authorization": "Required"
          },
          "/ui/v3/users/create": {
            "method": "POST",
            "description": "Create new user",
            "authorization": "Admin required",
            "request": {
              "fields": {
                "email": "string (required, unique)",
                "firstName": "string (required)",
                "lastName": "string (required)",
                "role": "enum [user, admin, manager]",
                "language": "enum [en, he]"
              }
            }
          }
        },
        "documents": {
          "/ui/v3/documents": {
            "method": "GET",
            "description": "List documents with filtering",
            "authorization": "Required",
            "queryParams": {
              "status": "enum [draft, sent, signed, completed, cancelled]",
              "dateFrom": "date (YYYY-MM-DD)",
              "dateTo": "date (YYYY-MM-DD)",
              "search": "string"
            }
          },
          "/ui/v3/documents/upload": {
            "method": "POST",
            "description": "Upload document for signing",
            "authorization": "Required",
            "request": {
              "contentType": "multipart/form-data",
              "fields": {
                "file": "file (required)",
                "title": "string (optional)",
                "description": "string (optional)",
                "category": "string (optional)"
              }
            },
            "fileConstraints": {
              "maxSize": "10MB per file",
              "supportedFormats": ["PDF", "DOCX", "DOC", "JPEG", "PNG"],
              "maxFiles": 10
            }
          },
          "/ui/v3/documents/{id}/send": {
            "method": "POST",
            "description": "Send document for signatures",
            "authorization": "Required",
            "request": {
              "fields": {
                "recipients": "array of objects",
                "message": "string (optional)",
                "dueDate": "date (optional)",
                "signatureFields": "array of objects"
              }
            }
          },
          "/ui/v3/documents/{id}/merge": {
            "method": "POST",
            "description": "Merge multiple documents",
            "authorization": "Required",
            "request": {
              "fields": {
                "documentIds": "array of strings (document IDs)",
                "mergeOrder": "array of numbers (optional)",
                "outputTitle": "string (required)"
              }
            }
          }
        },
        "templates": {
          "/ui/v3/templates": {
            "method": "GET",
            "description": "Get document templates",
            "authorization": "Required",
            "queryParams": {
              "category": "string (optional)",
              "language": "enum [en, he]"
            }
          },
          "/ui/v3/templates/create": {
            "method": "POST",
            "description": "Create new template",
            "authorization": "Required",
            "request": {
              "fields": {
                "name": "string (required)",
                "content": "string (required)",
                "category": "string (optional)",
                "language": "enum [en, he]",
                "customFields": "array of objects"
              }
            }
          }
        },
        "contacts": {
          "/ui/v3/contacts": {
            "method": "GET",
            "description": "Get contacts with pagination",
            "authorization": "Required",
            "queryParams": {
              "page": "number (default 1)",
              "limit": "number (max 100)",
              "search": "string (optional)"
            }
          },
          "/ui/v3/contacts/create": {
            "method": "POST",
            "description": "Add new contact",
            "authorization": "Required",
            "request": {
              "fields": {
                "email": "string (required, email format)",
                "firstName": "string (required)",
                "lastName": "string (required)",
                "phone": "string (optional)",
                "company": "string (optional)",
                "notes": "string (optional)"
              }
            }
          },
          "/ui/v3/contacts/import": {
            "method": "POST",
            "description": "Import contacts from CSV/Excel",
            "authorization": "Required",
            "request": {
              "contentType": "multipart/form-data",
              "fields": {
                "file": "file (CSV or XLSX)",
                "mapping": "object (field mapping configuration)"
              }
            }
          }
        },
        "configuration": {
          "/ui/v3/configuration": {
            "method": "GET",
            "description": "Get system configuration",
            "authorization": "Required",
            "response": {
              "fields": {
                "features": "object (enabled features)",
                "limits": "object (file size, user limits)",
                "branding": "object (colors, logos)",
                "languages": "array (supported languages)"
              }
            }
          }
        }
      },
      "errorCodes": {
        "1": "Success",
        "2": "Invalid request format",
        "3": "Missing required field",
        "4": "Invalid field value",
        "5": "Authentication required",
        "6": "Access denied",
        "7": "Resource not found",
        "8": "Duplicate resource",
        "9": "File upload error",
        "10": "File too large",
        "11": "Unsupported file format",
        "12": "Database error",
        "13": "External service error",
        "14": "Session expired",
        "15": "Rate limit exceeded",
        "20": "Document processing error",
        "21": "Invalid document state",
        "22": "Signature validation failed",
        "23": "Template not found",
        "24": "Template validation error",
        "25": "Contact validation error",
        "30": "User creation failed",
        "31": "User not found",
        "32": "User already exists",
        "33": "Invalid user role",
        "40": "Email sending failed",
        "41": "SMS sending failed",
        "50": "Payment processing error",
        "51": "Subscription expired",
        "60": "System maintenance",
        "61": "Service temporarily unavailable",
        "70": "Hebrew text processing error",
        "71": "RTL layout error",
        "72": "Language switching error",
        "75": "Bilingual validation error"
      },
      "fieldTypes": {
        "signature": {
          "type": "signature",
          "required": true,
          "validation": "Electronic signature capture"
        },
        "text": {
          "type": "text",
          "maxLength": 500,
          "required": false
        },
        "date": {
          "type": "date",
          "format": "YYYY-MM-DD",
          "required": false
        },
        "checkbox": {
          "type": "checkbox",
          "defaultValue": false
        },
        "dropdown": {
          "type": "dropdown",
          "options": "array of strings"
        }
      },
      "webhooks": {
        "documentSigned": {
          "event": "document.signed",
          "method": "POST",
          "description": "Triggered when document is fully signed"
        },
        "documentExpired": {
          "event": "document.expired",
          "method": "POST",
          "description": "Triggered when document expires"
        }
      },
      "bilingual": {
        "languages": ["English", "Hebrew"],
        "defaultLanguage": "English",
        "rtlSupport": true,
        "hebrewEndpoints": {
          "description": "All endpoints support Hebrew content",
          "headers": {
            "Accept-Language": "he-IL for Hebrew, en-US for English"
          }
        }
      },
      "limits": {
        "fileUpload": {
          "maxFileSize": "10MB",
          "maxFilesPerUpload": 10,
          "supportedFormats": ["PDF", "DOCX", "DOC", "JPEG", "PNG", "TXT"]
        },
        "api": {
          "rateLimit": "1000 requests per hour per user",
          "maxPageSize": 100,
          "maxSearchResults": 500
        },
        "account": {
          "maxDocumentsPerMonth": 1000,
          "maxContactsPerAccount": 10000,
          "maxTemplatesPerAccount": 100
        }
      }
    };

    // Create temporary file for ingestion
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = join(tempDir, 'wesign-api-documentation.json');
    writeFileSync(tempFile, JSON.stringify(apiDocumentation, null, 2));

    try {
      console.log('📝 Ingesting comprehensive WeSign API documentation...');
      
      const result = await this.service.ingestFile(tempFile, 'wesign-api');
      
      console.log('✅ API Documentation ingestion completed!');
      console.log(`   Documents created: ${result.chunks}`);
      console.log(`   Category: wesign-api`);
      console.log(`   Source file: wesign-api-documentation.json`);
      
      // Clean up temp file
      try {
        const fs = require('fs');
        fs.unlinkSync(tempFile);
        console.log('🧹 Cleaned up temporary file');
      } catch (e: any) {
        console.warn('⚠️ Could not clean up temp file:', e.message);
      }
      
    } catch (error) {
      console.error('❌ API documentation ingestion failed:', error);
      throw error;
    }
  }

  async verifyIngestion(): Promise<void> {
    console.log('\n🔍 Verifying API documentation ingestion...');
    
    try {
      const stats = await this.service.getIngestionStats();
      console.log('📊 Current knowledge base stats:');
      console.log(`   Total documents: ${stats.totalDocuments}`);
      console.log(`   Categories: ${stats.categories}`);
      
      // Search for API-specific content
      const searchResults = await this.service.searchKnowledge('WeSign API endpoints authentication', 5);
      console.log(`\n🔍 Search results for "WeSign API endpoints": ${searchResults.length} matches found`);
      
      if (searchResults.length > 0) {
        console.log('✅ API documentation successfully ingested and searchable');
        console.log('📋 Sample results:');
        searchResults.slice(0, 2).forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.content.substring(0, 100)}...`);
        });
      } else {
        console.log('⚠️ No search results found - ingestion may have failed');
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }

  close(): void {
    this.service.close();
  }

  async run(): Promise<void> {
    try {
      await this.ingestComprehensiveAPIDocumentation();
      await this.verifyIngestion();
    } catch (error) {
      console.error('❌ API documentation ingestion process failed:', error);
      throw error;
    } finally {
      this.close();
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const ingestor = new WeSignAPIDocumentationIngestor();
  ingestor.run().catch(console.error);
}

export { WeSignAPIDocumentationIngestor };