const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class WeSignScanner {
  constructor() {
    this.knowledge = {
      timestamp: new Date().toISOString(),
      authentication: {},
      navigation: {},
      pages: new Map(),
      forms: [],
      apis: [],
      workflows: [],
      components: {},
      hebrew: {},
      validations: {}
    };
    this.apiCalls = [];
  }
  
  async initialize() {
    console.log('🚀 Starting WeSign comprehensive scan...');
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--start-maximized']
    });
    
    this.page = await this.browser.newPage();
    
    // Intercept all network requests
    this.page.on('request', request => {
      if (request.url().includes('api/') || request.url().includes('services/')) {
        this.apiCalls.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Intercept responses for API documentation
    this.page.on('response', async response => {
      if (response.url().includes('api/') && response.status() === 200) {
        try {
          const data = await response.json();
          if (data && this.apiCalls.length > 0) {
            this.apiCalls[this.apiCalls.length - 1].response = data;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    });
  }
  
  async scanAuthentication() {
    console.log('📝 Scanning authentication...');
    
    await this.page.goto('https://devtest.comda.co.il');
    await this.page.waitForLoadState('networkidle');
    
    // Take a screenshot to debug
    await this.page.screenshot({ path: 'debug-login.png' });
    
    // Document login page
    this.knowledge.authentication = {
      loginUrl: this.page.url(),
      loginForm: await this.extractForm('form'),
      fields: await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          required: input.required,
          autocomplete: input.autocomplete
        }));
      })
    };
    
    // Perform login with correct credentials
    // Fill username/email field (from screenshot, looks like placeholder says "Username / Email")
    await this.page.fill('input[placeholder*="Username"], input[placeholder*="Email"]', 'nirk@comsign.co.il');
    
    // Fill password field
    await this.page.fill('input[placeholder*="Password"]', 'Comsign1!');
    
    // Click the "Sign in" button (visible in screenshot as blue button)
    await this.page.click('button:has-text("Sign in"), input[value="Sign in"]');
    
    try {
      // Wait for dashboard or any redirect
      await this.page.waitForURL('**/dashboard', { timeout: 10000 });
    } catch (e) {
      // Try waiting for any navigation change
      await this.page.waitForTimeout(5000);
    }
    
    console.log('✅ Authentication scanned and logged in');
  }
  
  async scanNavigation() {
    console.log('🗺️ Scanning navigation structure...');
    
    // Get all navigation elements
    this.knowledge.navigation = await this.page.evaluate(() => {
      const nav = {
        mainMenu: [],
        hamburgerMenu: [],
        breadcrumbs: [],
        footer: []
      };
      
      // Main navigation
      document.querySelectorAll('nav a, [role="navigation"] a').forEach(link => {
        nav.mainMenu.push({
          text: link.textContent?.trim(),
          href: link.getAttribute('href'),
          icon: link.querySelector('svg, i, img')?.className
        });
      });
      
      // Also look for sidebar links
      document.querySelectorAll('.sidebar a, .menu a, .nav-link').forEach(link => {
        nav.mainMenu.push({
          text: link.textContent?.trim(),
          href: link.getAttribute('href'),
          classes: link.className
        });
      });
      
      return nav;
    });
    
    // Click hamburger menu if exists
    try {
      const hamburger = await this.page.locator('[aria-label*="menu"], .hamburger, .menu-toggle').first();
      if (await hamburger.isVisible()) {
        await hamburger.click();
        await this.page.waitForTimeout(500);
        
        this.knowledge.navigation.hamburgerMenu = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('.menu-item, .dropdown-item')).map(item => ({
            text: item.textContent?.trim(),
            action: item.getAttribute('onclick') || item.getAttribute('href')
          }));
        });
      }
    } catch (e) {
      console.log('  No hamburger menu found');
    }
  }
  
  async scanAllPages() {
    console.log('📄 Scanning all pages...');
    
    const pages = [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Contacts', url: '/contacts', hebrew: 'אנשי קשר' },
      { name: 'Documents', url: '/documents', hebrew: 'מסמכים' },
      { name: 'Templates', url: '/templates', hebrew: 'תבניות' },
      { name: 'Upload', url: '/upload', hebrew: 'העלאת קובץ' },
      { name: 'Profile', url: '/profile' },
      { name: 'Settings', url: '/settings' }
    ];
    
    for (const pageInfo of pages) {
      try {
        console.log(`  Scanning ${pageInfo.name}...`);
        
        await this.page.goto(`https://devtest.comda.co.il${pageInfo.url}`);
        await this.page.waitForTimeout(2000);
        
        const pageData = {
          url: this.page.url(),
          title: await this.page.title(),
          forms: await this.extractAllForms(),
          buttons: await this.extractAllButtons(),
          inputs: await this.extractAllInputs(),
          tables: await this.extractAllTables(),
          modals: []
        };
        
        this.knowledge.pages.set(pageInfo.name, pageData);
        
      } catch (error) {
        console.log(`  ⚠️ Error scanning ${pageInfo.name}:`, error.message);
      }
    }
  }
  
  async scanWorkflows() {
    console.log('🔄 Scanning workflows...');
    
    // Document Upload Workflow
    console.log('  Testing document upload workflow...');
    try {
      await this.page.goto('https://devtest.comda.co.il/upload');
      await this.page.waitForTimeout(2000);
      
      const uploadWorkflow = {
        name: 'Document Upload',
        steps: [],
        validations: []
      };
      
      // Check for drag-drop area
      try {
        const dropZone = await this.page.locator('.dropzone, [data-testid*="drop"], .upload-area').first();
        if (await dropZone.isVisible()) {
          uploadWorkflow.steps.push({
            step: 'drag-drop',
            selector: await dropZone.evaluate(el => el.className),
            text: await dropZone.textContent()
          });
        }
      } catch (e) {}
      
      // Check for file input
      try {
        const fileInput = await this.page.locator('input[type="file"]').first();
        if (await fileInput.isVisible()) {
          uploadWorkflow.steps.push({
            step: 'file-input',
            accept: await fileInput.getAttribute('accept'),
            multiple: await fileInput.getAttribute('multiple')
          });
        }
      } catch (e) {}
      
      this.knowledge.workflows.push(uploadWorkflow);
      
    } catch (error) {
      console.log('    ⚠️ Upload page scan failed:', error.message);
    }
    
    // Contact Management Workflow
    console.log('  Testing contact management workflow...');
    try {
      await this.page.goto('https://devtest.comda.co.il/contacts');
      await this.page.waitForTimeout(2000);
      
      const contactWorkflow = {
        name: 'Contact Management',
        operations: []
      };
      
      // Check for Add button
      try {
        const addButton = await this.page.locator('button:has-text("Add"), button:has-text("הוסף")').first();
        if (await addButton.isVisible()) {
          contactWorkflow.operations.push('add');
          
          // Click to see add form
          await addButton.click();
          await this.page.waitForTimeout(1000);
          
          // Document the form that appears
          const addForm = await this.extractForm('.modal form, dialog form, form');
          if (addForm) {
            contactWorkflow.operations.push({ type: 'add-form', fields: addForm });
          }
          
          // Close modal if open
          try {
            const closeButton = await this.page.locator('.modal .close, [aria-label="Close"]').first();
            if (await closeButton.isVisible()) {
              await closeButton.click();
            }
          } catch (e) {}
        }
      } catch (e) {}
      
      this.knowledge.workflows.push(contactWorkflow);
      
    } catch (error) {
      console.log('    ⚠️ Contacts page scan failed:', error.message);
    }
  }
  
  async scanHebrewSupport() {
    console.log('🌐 Scanning Hebrew/RTL support...');
    
    try {
      // Look for language switcher
      const langSwitcher = await this.page.locator('[data-lang], .language-switcher, button:has-text("עברית")').first();
      
      if (await langSwitcher.isVisible()) {
        // Switch to Hebrew
        await langSwitcher.click();
        await this.page.waitForTimeout(2000);
        
        this.knowledge.hebrew = {
          hasLanguageSwitch: true,
          rtlSupport: await this.page.evaluate(() => {
            return document.dir === 'rtl' || document.body.dir === 'rtl';
          }),
          hebrewElements: await this.page.evaluate(() => {
            const elements = [];
            document.querySelectorAll('*').forEach(el => {
              if (el.textContent && /[\u0590-\u05FF]/.test(el.textContent) && el.children.length === 0) {
                elements.push({
                  tag: el.tagName,
                  text: el.textContent.trim(),
                  class: el.className
                });
              }
            });
            return elements.slice(0, 50); // First 50 Hebrew texts
          })
        };
        
        // Switch back to English
        await langSwitcher.click();
        await this.page.waitForTimeout(1000);
      } else {
        this.knowledge.hebrew = {
          hasLanguageSwitch: false,
          note: 'No language switcher found'
        };
      }
    } catch (error) {
      console.log('  ⚠️ Hebrew support scan failed:', error.message);
    }
  }
  
  async scanValidations() {
    console.log('⚠️ Scanning validations and error handling...');
    
    try {
      // Test login with invalid credentials
      await this.page.goto('https://devtest.comda.co.il');
      await this.page.fill('#username', 'invalid');
      await this.page.fill('#password', 'wrong');
      await this.page.click('button[type="submit"]');
      
      await this.page.waitForTimeout(2000);
      
      // Capture error message
      try {
        const errorMessage = await this.page.locator('.error, .alert-danger, [role="alert"]').first();
        if (await errorMessage.isVisible()) {
          this.knowledge.validations.loginError = await errorMessage.textContent();
        }
      } catch (e) {}
      
      // Re-login with correct credentials
      await this.page.fill('#username', 'nirk@comsign.co.il');
      await this.page.fill('#password', 'Comsign1!');
      await this.page.click('button[type="submit"]');
      await this.page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('  ⚠️ Validation scan failed:', error.message);
    }
  }
  
  // Helper methods
  async extractForm(selector) {
    try {
      const form = await this.page.locator(selector).first();
      if (!await form.isVisible()) return null;
      
      return await form.evaluate(formEl => {
        const inputs = Array.from(formEl.querySelectorAll('input, select, textarea'));
        return {
          action: formEl.getAttribute('action'),
          method: formEl.getAttribute('method'),
          fields: inputs.map(input => ({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name,
            id: input.id,
            required: input.required,
            placeholder: input.placeholder
          }))
        };
      });
    } catch (e) {
      return null;
    }
  }
  
  async extractAllForms() {
    try {
      return await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          action: form.action,
          method: form.method,
          fields: Array.from(form.querySelectorAll('input, select, textarea')).length
        }));
      });
    } catch (e) {
      return [];
    }
  }
  
  async extractAllButtons() {
    try {
      return await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, [role="button"]')).map(btn => ({
          text: btn.textContent?.trim(),
          type: btn.getAttribute('type'),
          onclick: btn.getAttribute('onclick'),
          disabled: btn.disabled,
          classes: btn.className
        }));
      });
    } catch (e) {
      return [];
    }
  }
  
  async extractAllInputs() {
    try {
      return await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          required: input.required
        }));
      });
    } catch (e) {
      return [];
    }
  }
  
  async extractAllTables() {
    try {
      return await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map(table => ({
          headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()),
          rows: table.querySelectorAll('tbody tr').length
        }));
      });
    } catch (e) {
      return [];
    }
  }
  
  async saveKnowledge() {
    console.log('💾 Saving extracted knowledge...');
    
    // Add API calls to knowledge
    this.knowledge.apis = this.apiCalls;
    
    // Save to file
    const outputPath = path.join(__dirname, '../../../docs/extracted/wesign-scan.json');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      outputPath,
      JSON.stringify(this.knowledge, (key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        return value;
      }, 2)
    );
    
    console.log(`✅ Knowledge saved to ${outputPath}`);
    
    // Generate summary
    console.log('\n📊 Scan Summary:');
    console.log(`  Pages scanned: ${this.knowledge.pages.size}`);
    console.log(`  Forms found: ${this.knowledge.forms.length}`);
    console.log(`  API endpoints: ${this.apiCalls.length}`);
    console.log(`  Workflows documented: ${this.knowledge.workflows.length}`);
    console.log(`  Hebrew support: ${this.knowledge.hebrew.hasLanguageSwitch ? 'Yes' : 'No'}`);
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  async run() {
    try {
      await this.initialize();
      await this.scanAuthentication();
      await this.scanNavigation();
      await this.scanAllPages();
      await this.scanWorkflows();
      await this.scanHebrewSupport();
      await this.scanValidations();
      await this.saveKnowledge();
    } catch (error) {
      console.error('❌ Scan failed:', error);
    } finally {
      await this.close();
    }
  }
}

// Run the scanner
const scanner = new WeSignScanner();
scanner.run().catch(console.error);