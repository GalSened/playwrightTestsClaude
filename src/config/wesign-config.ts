/**
 * Centralized WeSign Test Configuration
 * 
 * Consolidates all WeSign test configurations into a single,
 * type-safe, environment-aware configuration system.
 */

import { resolve } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

// Core interfaces
export interface WeSignEnvironment {
  name: string;
  baseUrl: string;
  apiUrl: string;
  wsUrl: string;
  timeout: number;
  retries: number;
}

export interface WeSignCredentials {
  email: string;
  password: string;
  serverCertId?: string;
  serverPassword?: string;
  role: 'company_user' | 'basic_user' | 'editor_user' | 'management_user' | 'expired_account';
}

export interface WeSignFileAssets {
  path: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'image';
  size: 'small' | 'medium' | 'large' | 'xlarge';
  pages?: number;
  language?: 'hebrew' | 'english' | 'mixed';
  hasFields?: boolean;
  isSigned?: boolean;
}

export interface BilingualStrings {
  hebrew: string;
  english: string;
}

export interface WeSignSelectors {
  [key: string]: {
    primary: string[];
    fallback: string[];
    hebrew?: string[];
    english?: string[];
    mobile?: string[];
  };
}

export interface TestThresholds {
  pageLoad: number;
  fileUpload: number;
  documentMerge: number;
  documentSend: number;
  signatureProcess: number;
  uiResponse: number;
}

// Main configuration class
export class WeSignTestConfig {
  private static instance: WeSignTestConfig;
  
  // Environment configuration
  public readonly environment: WeSignEnvironment;
  public readonly isCI: boolean;
  public readonly currentEnv: 'development' | 'staging' | 'production';

  // Test data
  public readonly credentials: Record<string, WeSignCredentials>;
  public readonly fileAssets: Record<string, WeSignFileAssets>;
  public readonly testRecipients: Array<{
    name: BilingualStrings;
    email: string;
    phone: string;
    country?: string;
  }>;

  // UI Configuration
  public readonly selectors: WeSignSelectors;
  public readonly texts: Record<string, BilingualStrings>;
  
  // Performance and reliability
  public readonly thresholds: TestThresholds;
  public readonly retryConfig: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };

  // Feature flags
  public readonly features: {
    selfHealing: boolean;
    bilingualTesting: boolean;
    performanceMonitoring: boolean;
    realtimeReporting: boolean;
    mobileOptimization: boolean;
  };

  private constructor() {
    this.isCI = !!process.env.CI;
    this.currentEnv = (process.env.NODE_ENV as any) || 'development';
    
    // Initialize environment
    this.environment = this.initializeEnvironment();
    
    // Initialize test data
    this.credentials = this.initializeCredentials();
    this.fileAssets = this.initializeFileAssets();
    this.testRecipients = this.initializeTestRecipients();
    
    // Initialize UI elements
    this.selectors = this.initializeSelectors();
    this.texts = this.initializeTexts();
    
    // Initialize performance settings
    this.thresholds = this.initializeThresholds();
    this.retryConfig = this.initializeRetryConfig();
    
    // Initialize feature flags
    this.features = this.initializeFeatures();
  }

  public static getInstance(): WeSignTestConfig {
    if (!WeSignTestConfig.instance) {
      WeSignTestConfig.instance = new WeSignTestConfig();
    }
    return WeSignTestConfig.instance;
  }

  private initializeEnvironment(): WeSignEnvironment {
    const envName = process.env.TEST_ENV || 'development';
    
    const environments: Record<string, Partial<WeSignEnvironment>> = {
      development: {
        baseUrl: 'https://devtest.comda.co.il/',
        apiUrl: 'https://devtest.comda.co.il/api/',
        wsUrl: 'wss://devtest.comda.co.il/ws',
        timeout: 60000,
        retries: 3
      },
      staging: {
        baseUrl: 'https://staging.comda.co.il/',
        apiUrl: 'https://staging.comda.co.il/api/',
        wsUrl: 'wss://staging.comda.co.il/ws',
        timeout: 45000,
        retries: 2
      },
      production: {
        baseUrl: 'https://wesign.comda.co.il/',
        apiUrl: 'https://wesign.comda.co.il/api/',
        wsUrl: 'wss://wesign.comda.co.il/ws',
        timeout: 30000,
        retries: 1
      }
    };

    const envConfig = environments[envName] || environments.development;
    
    return {
      name: envName,
      baseUrl: process.env.WESIGN_BASE_URL || envConfig.baseUrl!,
      apiUrl: process.env.WESIGN_API_URL || envConfig.apiUrl!,
      wsUrl: process.env.WESIGN_WS_URL || envConfig.wsUrl!,
      timeout: parseInt(process.env.DEFAULT_TIMEOUT || '') || envConfig.timeout!,
      retries: parseInt(process.env.MAX_RETRIES || '') || envConfig.retries!
    };
  }

  private initializeCredentials(): Record<string, WeSignCredentials> {
    return {
      companyUser: {
        email: process.env.COMPANY_USER_EMAIL || 'company@test.com',
        password: process.env.COMPANY_USER_PASSWORD || 'Test123!',
        serverCertId: process.env.SERVER_CERT_ID || '',
        serverPassword: process.env.SERVER_PASSWORD || '',
        role: 'company_user'
      },
      basicUser: {
        email: process.env.BASIC_USER_EMAIL || 'basic@test.com',
        password: process.env.BASIC_USER_PASSWORD || 'Test123!',
        role: 'basic_user'
      },
      editorUser: {
        email: process.env.EDITOR_USER_EMAIL || 'editor@test.com',
        password: process.env.EDITOR_USER_PASSWORD || 'Test123!',
        role: 'editor_user'
      },
      managementUser: {
        email: process.env.MANAGEMENT_USER_EMAIL || 'manager@test.com',
        password: process.env.MANAGEMENT_USER_PASSWORD || 'Test123!',
        role: 'management_user'
      },
      expiredUser: {
        email: process.env.EXPIRED_USER_EMAIL || 'expired@test.com',
        password: process.env.EXPIRED_USER_PASSWORD || 'Test123!',
        role: 'expired_account'
      }
    };
  }

  private initializeFileAssets(): Record<string, WeSignFileAssets> {
    const basePath = resolve(__dirname, '../../test-assets');
    
    return {
      smallPdf: {
        path: resolve(basePath, 'documents/small-3-pages.pdf'),
        type: 'pdf',
        size: 'small',
        pages: 3,
        language: 'english'
      },
      mediumPdf: {
        path: resolve(basePath, 'documents/medium-6-pages.pdf'),
        type: 'pdf',
        size: 'medium',
        pages: 6,
        language: 'mixed'
      },
      largePdf: {
        path: resolve(basePath, 'documents/large-60-pages.pdf'),
        type: 'pdf',
        size: 'large',
        pages: 60,
        language: 'english'
      },
      xlargePdf: {
        path: resolve(basePath, 'documents/xlarge-102-pages.pdf'),
        type: 'pdf',
        size: 'xlarge',
        pages: 102,
        language: 'english'
      },
      wordDocument: {
        path: resolve(basePath, 'documents/sample.docx'),
        type: 'docx',
        size: 'small',
        language: 'hebrew',
        hasFields: true
      },
      excelSpreadsheet: {
        path: resolve(basePath, 'documents/sample.xlsx'),
        type: 'xlsx',
        size: 'small',
        language: 'mixed'
      },
      pngImage: {
        path: resolve(basePath, 'images/signature.png'),
        type: 'image',
        size: 'small'
      },
      signedPdf: {
        path: resolve(basePath, 'documents/signed-sample.pdf'),
        type: 'pdf',
        size: 'medium',
        pages: 5,
        isSigned: true,
        hasFields: true
      }
    };
  }

  private initializeTestRecipients() {
    return [
      {
        name: { hebrew: 'יוסי כהן', english: 'Yossi Cohen' },
        email: process.env.RECIPIENT_1_EMAIL || 'recipient1@test.com',
        phone: process.env.ISRAELI_PHONE || '+972552603210',
        country: 'IL'
      },
      {
        name: { hebrew: 'מירי לוי', english: 'Miri Levy' },
        email: process.env.RECIPIENT_2_EMAIL || 'recipient2@test.com',
        phone: process.env.ISRAELI_PHONE_2 || '+972504821887',
        country: 'IL'
      },
      {
        name: { hebrew: 'דני אברהם', english: 'Danny Abraham' },
        email: process.env.RECIPIENT_3_EMAIL || 'recipient3@test.com',
        phone: process.env.US_PHONE || '+19783475606',
        country: 'US'
      }
    ];
  }

  private initializeSelectors(): WeSignSelectors {
    return {
      login: {
        primary: ['#login-form', '.login-container'],
        fallback: ['[data-testid="login"]', 'form[action*="login"]'],
        hebrew: ['[aria-label*="התחברות"]', '.התחברות'],
        english: ['[aria-label*="login"]', '.login']
      },
      emailField: {
        primary: ['input[name="email"]', '#email'],
        fallback: ['input[type="email"]', '[data-testid="email-input"]'],
        hebrew: ['input[placeholder*="מייל"]', 'input[aria-label*="מייל"]'],
        english: ['input[placeholder*="email"]', 'input[aria-label*="email"]']
      },
      passwordField: {
        primary: ['input[name="password"]', '#password'],
        fallback: ['input[type="password"]', '[data-testid="password-input"]'],
        hebrew: ['input[placeholder*="סיסמה"]', 'input[aria-label*="סיסמה"]'],
        english: ['input[placeholder*="password"]', 'input[aria-label*="password"]']
      },
      loginButton: {
        primary: ['button[type="submit"]', '.login-btn'],
        fallback: ['[data-testid="login-button"]', 'input[type="submit"]'],
        hebrew: ['button:text("התחבר")', 'input[value="התחבר"]'],
        english: ['button:text("Login")', 'input[value="Login"]']
      },
      fileUpload: {
        primary: ['input[type="file"]', '.upload-input'],
        fallback: ['[data-testid="file-upload"]', '.file-input'],
        hebrew: ['[aria-label*="העלאה"]', '.העלאה'],
        english: ['[aria-label*="upload"]', '.upload']
      },
      documentPreview: {
        primary: ['.document-preview', '.pdf-viewer'],
        fallback: ['[data-testid="document-preview"]', '.preview-container'],
        mobile: ['.mobile-preview', '.document-mobile']
      },
      signatureField: {
        primary: ['.signature-field', '[data-field-type="signature"]'],
        fallback: ['[data-testid="signature"]', '.sign-here'],
        hebrew: ['.חתימה', '[data-field-type="חתימה"]'],
        english: ['.signature', '[aria-label*="signature"]']
      },
      sendButton: {
        primary: ['.send-btn', 'button[type="submit"]'],
        fallback: ['[data-testid="send-document"]', '.submit-btn'],
        hebrew: ['button:text("שלח")', '.שלח'],
        english: ['button:text("Send")', '.send']
      }
    };
  }

  private initializeTexts(): Record<string, BilingualStrings> {
    return {
      loginSuccess: {
        hebrew: 'התחברת בהצלחה',
        english: 'Login successful'
      },
      uploadSuccess: {
        hebrew: 'הקובץ הועלה בהצלחה',
        english: 'File uploaded successfully'
      },
      documentSent: {
        hebrew: 'המסמך נשלח בהצלחה',
        english: 'Document sent successfully'
      },
      signatureComplete: {
        hebrew: 'החתימה הושלמה',
        english: 'Signature completed'
      },
      errorMessage: {
        hebrew: 'אירעה שגיאה',
        english: 'An error occurred'
      },
      networkError: {
        hebrew: 'שגיאת חיבור',
        english: 'Connection error'
      }
    };
  }

  private initializeThresholds(): TestThresholds {
    const multiplier = this.isCI ? 1.5 : 1; // Increase timeouts in CI
    
    return {
      pageLoad: 15000 * multiplier,
      fileUpload: 120000 * multiplier, // 2 minutes for large files
      documentMerge: 60000 * multiplier,
      documentSend: 90000 * multiplier,
      signatureProcess: 45000 * multiplier,
      uiResponse: 5000 * multiplier
    };
  }

  private initializeRetryConfig() {
    return {
      maxRetries: this.isCI ? 3 : 1,
      retryDelay: 2000,
      exponentialBackoff: true
    };
  }

  private initializeFeatures() {
    return {
      selfHealing: process.env.ENABLE_SELF_HEALING !== 'false',
      bilingualTesting: process.env.ENABLE_BILINGUAL !== 'false',
      performanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
      realtimeReporting: process.env.ENABLE_REALTIME_REPORTS === 'true',
      mobileOptimization: process.env.ENABLE_MOBILE_TESTS === 'true'
    };
  }

  // Utility methods
  public getCredentialsForRole(role: string): WeSignCredentials | null {
    return Object.values(this.credentials).find(cred => cred.role === role) || null;
  }

  public getFileByType(type: string, size?: string): WeSignFileAssets | null {
    return Object.values(this.fileAssets).find(file => 
      file.type === type && (!size || file.size === size)
    ) || null;
  }

  public getSelectorsForLanguage(element: string, language: 'hebrew' | 'english'): string[] {
    const selectorConfig = this.selectors[element];
    if (!selectorConfig) return [];
    
    const languageSelectors = selectorConfig[language] || [];
    return [...selectorConfig.primary, ...languageSelectors, ...selectorConfig.fallback];
  }

  public getTextForLanguage(key: string, language: 'hebrew' | 'english'): string {
    return this.texts[key]?.[language] || '';
  }

  public isFeatureEnabled(feature: keyof typeof this.features): boolean {
    return this.features[feature];
  }

  // Configuration validation
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate environment URLs
    if (!this.environment.baseUrl) {
      errors.push('Base URL is required');
    }

    // Validate credentials
    if (!this.credentials.companyUser?.email) {
      errors.push('Company user credentials are required');
    }

    // Validate file assets exist
    // Note: In a real implementation, you'd check file existence
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const wesignConfig = WeSignTestConfig.getInstance();