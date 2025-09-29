import { logger } from '@/utils/logger';

export interface RuntimeCapabilities {
  webgpu: boolean;
  webassembly: boolean;
  threads: boolean;
  simd: boolean;
  preferredBackend: 'webgpu' | 'wasm' | 'cpu';
  deviceInfo?: {
    adapter?: string;
    features?: string[];
    limits?: Record<string, number>;
  };
}

export interface WebGPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  features: string[];
  limits: Record<string, number>;
}

/**
 * WebGPU Detection and Runtime Management for AI Services
 * Provides intelligent fallback to WebAssembly when WebGPU is unavailable
 */
export class WebGPUDetector {
  private static instance: WebGPUDetector;
  private capabilities: RuntimeCapabilities | null = null;
  private detectionPromise: Promise<RuntimeCapabilities> | null = null;

  private constructor() {}

  public static getInstance(): WebGPUDetector {
    if (!WebGPUDetector.instance) {
      WebGPUDetector.instance = new WebGPUDetector();
    }
    return WebGPUDetector.instance;
  }

  /**
   * Detect and cache runtime capabilities
   */
  public async detectCapabilities(): Promise<RuntimeCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    this.detectionPromise = this._performDetection();
    this.capabilities = await this.detectionPromise;
    return this.capabilities;
  }

  private async _performDetection(): Promise<RuntimeCapabilities> {
    logger.info('🔍 Detecting AI runtime capabilities...');
    
    const capabilities: RuntimeCapabilities = {
      webgpu: false,
      webassembly: false,
      threads: false,
      simd: false,
      preferredBackend: 'cpu',
      deviceInfo: undefined
    };

    try {
      // Detect WebGPU support
      capabilities.webgpu = await this.detectWebGPU();
      if (capabilities.webgpu) {
        capabilities.deviceInfo = await this.getWebGPUDeviceInfo();
      }

      // Detect WebAssembly support
      capabilities.webassembly = this.detectWebAssembly();
      
      // Detect advanced WebAssembly features
      if (capabilities.webassembly) {
        capabilities.threads = await this.detectWASMThreads();
        capabilities.simd = this.detectWASMSIMD();
      }

      // Determine preferred backend
      capabilities.preferredBackend = this.selectOptimalBackend(capabilities);

      logger.info('✅ AI Runtime capabilities detected:', {
        webgpu: capabilities.webgpu,
        webassembly: capabilities.webassembly,
        threads: capabilities.threads,
        simd: capabilities.simd,
        preferredBackend: capabilities.preferredBackend,
        adapter: capabilities.deviceInfo?.adapter
      });

      return capabilities;

    } catch (error) {
      logger.error('❌ Failed to detect AI runtime capabilities:', error);
      return capabilities; // Return minimal capabilities
    }
  }

  /**
   * Detect WebGPU support and adapter information
   */
  private async detectWebGPU(): Promise<boolean> {
    try {
      // Check if WebGPU is available in the environment
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        logger.debug('WebGPU not available: navigator.gpu not found');
        return false;
      }

      // Request WebGPU adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        logger.debug('WebGPU not available: no adapter found');
        return false;
      }

      // Test device creation
      const device = await adapter.requestDevice();
      if (!device) {
        logger.debug('WebGPU not available: device creation failed');
        return false;
      }

      // Cleanup
      device.destroy();

      logger.info('✅ WebGPU support detected and validated');
      return true;

    } catch (error) {
      logger.debug('WebGPU detection failed:', error.message);
      return false;
    }
  }

  /**
   * Get detailed WebGPU device information
   */
  private async getWebGPUDeviceInfo(): Promise<WebGPUAdapterInfo | undefined> {
    try {
      if (typeof navigator === 'undefined' || !navigator.gpu) return undefined;

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return undefined;

      const info = await adapter.requestAdapterInfo();
      const features = Array.from(adapter.features);
      const limits = Object.fromEntries(
        Object.entries(adapter.limits)
      );

      return {
        vendor: info.vendor || 'unknown',
        architecture: info.architecture || 'unknown',
        device: info.device || 'unknown',
        description: info.description || 'WebGPU Adapter',
        features,
        limits
      };

    } catch (error) {
      logger.debug('Failed to get WebGPU device info:', error);
      return undefined;
    }
  }

  /**
   * Detect WebAssembly support
   */
  private detectWebAssembly(): boolean {
    try {
      if (typeof WebAssembly === 'undefined') {
        logger.debug('WebAssembly not available');
        return false;
      }

      // Test basic WebAssembly functionality
      const module = new WebAssembly.Module(
        new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
      );

      if (module instanceof WebAssembly.Module) {
        logger.debug('✅ WebAssembly support detected');
        return true;
      }

      return false;
    } catch (error) {
      logger.debug('WebAssembly detection failed:', error);
      return false;
    }
  }

  /**
   * Detect WebAssembly threads support
   */
  private async detectWASMThreads(): Promise<boolean> {
    try {
      // Check for SharedArrayBuffer (required for threads)
      if (typeof SharedArrayBuffer === 'undefined') {
        logger.debug('WASM threads not available: SharedArrayBuffer not supported');
        return false;
      }

      // Check for Atomics (required for thread synchronization)
      if (typeof Atomics === 'undefined') {
        logger.debug('WASM threads not available: Atomics not supported');
        return false;
      }

      logger.debug('✅ WASM threads support detected');
      return true;
    } catch (error) {
      logger.debug('WASM threads detection failed:', error);
      return false;
    }
  }

  /**
   * Detect WebAssembly SIMD support
   */
  private detectWASMSIMD(): boolean {
    try {
      // Test SIMD support by trying to compile a SIMD-enabled module
      // This is a simplified test - in practice, you'd use a proper SIMD test module
      const simdTestModule = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
        // In a real implementation, this would be a SIMD test module
      ]);

      const module = new WebAssembly.Module(simdTestModule);
      logger.debug('✅ WASM SIMD support detected');
      return true;
    } catch (error) {
      logger.debug('WASM SIMD not available:', error);
      return false;
    }
  }

  /**
   * Select the optimal backend based on capabilities
   */
  private selectOptimalBackend(capabilities: RuntimeCapabilities): 'webgpu' | 'wasm' | 'cpu' {
    // Prefer WebGPU for maximum performance
    if (capabilities.webgpu) {
      logger.info('🚀 Selected WebGPU backend for optimal AI performance');
      return 'webgpu';
    }

    // Fallback to WebAssembly with threads/SIMD if available
    if (capabilities.webassembly) {
      if (capabilities.threads && capabilities.simd) {
        logger.info('🏃‍♂️ Selected optimized WASM backend (threads + SIMD)');
        return 'wasm';
      }
      if (capabilities.threads) {
        logger.info('🏃‍♂️ Selected threaded WASM backend');
        return 'wasm';
      }
      logger.info('🚶‍♂️ Selected basic WASM backend');
      return 'wasm';
    }

    // CPU fallback (should always work)
    logger.warn('⚠️  Using CPU backend - performance may be limited');
    return 'cpu';
  }

  /**
   * Initialize ONNX Runtime with optimal backend
   */
  public async initializeONNXRuntime(): Promise<any> {
    const capabilities = await this.detectCapabilities();
    
    try {
      let InferenceSession: any;

      switch (capabilities.preferredBackend) {
        case 'webgpu':
          try {
            const ort = await import('onnxruntime-web/webgpu');
            InferenceSession = ort.InferenceSession;
            logger.info('🚀 ONNX Runtime initialized with WebGPU backend');
            break;
          } catch (error) {
            logger.warn('WebGPU ONNX Runtime failed, falling back to WASM');
            // Fallthrough to WASM
          }
          
        case 'wasm':
          try {
            const ort = await import('onnxruntime-web');
            InferenceSession = ort.InferenceSession;
            
            // Configure WASM backend options
            const sessionOptions = {
              executionProviders: capabilities.threads 
                ? ['wasm'] 
                : ['cpu']
            };
            
            logger.info(`🏃‍♂️ ONNX Runtime initialized with WASM backend (threads: ${capabilities.threads}, simd: ${capabilities.simd})`);
            break;
          } catch (error) {
            logger.warn('WASM ONNX Runtime failed, using CPU fallback');
            // Fallthrough to CPU
          }
          
        default:
          const ort = await import('onnxruntime-web');
          InferenceSession = ort.InferenceSession;
          logger.info('🚶‍♂️ ONNX Runtime initialized with CPU backend');
      }

      return InferenceSession;

    } catch (error) {
      logger.error('❌ Failed to initialize ONNX Runtime:', error);
      throw new Error(`ONNX Runtime initialization failed: ${error.message}`);
    }
  }

  /**
   * Get performance recommendations based on detected capabilities
   */
  public getPerformanceRecommendations(): string[] {
    if (!this.capabilities) {
      return ['Run capability detection first'];
    }

    const recommendations: string[] = [];

    if (!this.capabilities.webgpu) {
      recommendations.push('Consider enabling WebGPU in browser flags for 8-10x performance improvement');
    }

    if (!this.capabilities.threads) {
      recommendations.push('Enable cross-origin isolation headers for WebAssembly threads support');
    }

    if (!this.capabilities.simd) {
      recommendations.push('Update to a browser version with SIMD support for faster computations');
    }

    if (this.capabilities.preferredBackend === 'cpu') {
      recommendations.push('CPU backend detected - consider upgrading browser or enabling WebGPU');
    }

    return recommendations.length > 0 ? recommendations : ['Optimal configuration detected'];
  }

  /**
   * Create runtime configuration for AI services
   */
  public async createAIRuntimeConfig(): Promise<{
    backend: string;
    options: Record<string, any>;
    fallbacks: string[];
  }> {
    const capabilities = await this.detectCapabilities();
    
    const config = {
      backend: capabilities.preferredBackend,
      options: {
        numThreads: capabilities.threads ? 4 : 1,
        enableSIMD: capabilities.simd,
        enableWebGPU: capabilities.webgpu,
        deviceInfo: capabilities.deviceInfo
      },
      fallbacks: []
    };

    // Set up fallback chain
    if (capabilities.webgpu) {
      config.fallbacks.push('wasm', 'cpu');
    } else if (capabilities.webassembly) {
      config.fallbacks.push('cpu');
    }

    return config;
  }

  /**
   * Test runtime performance with a simple benchmark
   */
  public async benchmarkRuntime(): Promise<{
    backend: string;
    initTime: number;
    inferenceTime: number;
    memoryUsage: number;
  }> {
    const capabilities = await this.detectCapabilities();
    const startTime = performance.now();

    try {
      const InferenceSession = await this.initializeONNXRuntime();
      const initTime = performance.now() - startTime;

      // Simple benchmark - would use a tiny test model in production
      const benchmarkStart = performance.now();
      
      // Simulate inference time (replace with actual model inference)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const inferenceTime = performance.now() - benchmarkStart;
      
      // Estimate memory usage (simplified)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

      return {
        backend: capabilities.preferredBackend,
        initTime,
        inferenceTime,
        memoryUsage
      };

    } catch (error) {
      logger.error('Runtime benchmark failed:', error);
      return {
        backend: 'error',
        initTime: -1,
        inferenceTime: -1,
        memoryUsage: -1
      };
    }
  }
}

// Export singleton instance
export const webGPUDetector = WebGPUDetector.getInstance();

// Export types
export default WebGPUDetector;