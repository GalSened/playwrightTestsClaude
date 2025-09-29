import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger';

export interface ArtifactStorageConfig {
  baseDir: string;
  maxFileSize: number; // bytes
  allowedTypes: string[];
  thumbnailSizes: { width: number; height: number }[];
  videoThumbnailTime: number; // seconds
}

export class ArtifactManager {
  private config: ArtifactStorageConfig;

  constructor(config?: Partial<ArtifactStorageConfig>) {
    this.config = {
      baseDir: process.env.ARTIFACTS_BASE_PATH || './artifacts',
      maxFileSize: parseInt(process.env.MAX_MEDIA_SIZE_MB || '100') * 1024 * 1024, // 100MB
      allowedTypes: [
        'image/png', 'image/jpeg', 'image/webp',
        'video/mp4', 'video/webm',
        'application/zip', 'application/json',
        'text/plain', 'text/html'
      ],
      thumbnailSizes: [
        { width: 150, height: 100 }, // small thumb
        { width: 300, height: 200 }  // medium thumb
      ],
      videoThumbnailTime: 1, // 1 second into video
      ...config
    };

    this.ensureBaseDirectory();
  }

  private async ensureBaseDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create artifacts base directory', error);
      throw error;
    }
  }

  private validateFile(buffer: Buffer, mimeType: string, originalName: string): void {
    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`File size ${buffer.length} exceeds maximum ${this.config.maxFileSize} bytes`);
    }

    if (!this.config.allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Additional validation based on file extension
    const ext = extname(originalName).toLowerCase();
    const expectedTypes: { [key: string]: string[] } = {
      '.png': ['image/png'],
      '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
      '.webp': ['image/webp'],
      '.mp4': ['video/mp4'],
      '.webm': ['video/webm'],
      '.zip': ['application/zip'],
      '.json': ['application/json'],
      '.txt': ['text/plain'],
      '.html': ['text/html'], '.htm': ['text/html']
    };

    if (expectedTypes[ext] && !expectedTypes[ext].includes(mimeType)) {
      logger.warn('Mime type mismatch', { ext, mimeType, expected: expectedTypes[ext] });
    }
  }

  private generateArtifactPath(runId: string, stepId: string | undefined, artifactType: string, filename: string): string {
    const hash = createHash('md5').update(`${runId}-${stepId}-${Date.now()}`).digest('hex').substring(0, 8);
    const ext = extname(filename);
    const baseName = basename(filename, ext);
    const safeFilename = `${baseName}-${hash}${ext}`;
    
    return join(runId, stepId || 'run-level', artifactType, safeFilename);
  }

  async storeArtifact(
    buffer: Buffer,
    runId: string,
    stepId: string | undefined,
    artifactType: string,
    originalName: string,
    mimeType?: string
  ): Promise<string> {
    // Detect mime type if not provided
    if (!mimeType) {
      mimeType = this.detectMimeType(buffer, originalName);
    }

    this.validateFile(buffer, mimeType, originalName);

    const relativePath = this.generateArtifactPath(runId, stepId, artifactType, originalName);
    const fullPath = join(this.config.baseDir, relativePath);

    // Ensure directory exists
    await fs.mkdir(dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, buffer);

    logger.info('Stored artifact', { 
      runId, stepId, artifactType, originalName, 
      relativePath, size: buffer.length 
    });

    return relativePath;
  }

  async getArtifactStream(relativePath: string): Promise<Readable | null> {
    const fullPath = join(this.config.baseDir, relativePath);
    
    try {
      await fs.access(fullPath);
      return createReadStream(fullPath);
    } catch (error) {
      logger.error('Artifact not found', { relativePath, fullPath });
      return null;
    }
  }

  async getArtifactBuffer(relativePath: string): Promise<Buffer | null> {
    const fullPath = join(this.config.baseDir, relativePath);
    
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      logger.error('Failed to read artifact', { relativePath, error });
      return null;
    }
  }

  async deleteArtifact(relativePath: string): Promise<void> {
    const fullPath = join(this.config.baseDir, relativePath);
    
    try {
      await fs.unlink(fullPath);
      
      // Try to remove empty parent directories
      let parentDir = dirname(fullPath);
      while (parentDir !== this.config.baseDir) {
        try {
          const entries = await fs.readdir(parentDir);
          if (entries.length === 0) {
            await fs.rmdir(parentDir);
            parentDir = dirname(parentDir);
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      logger.info('Deleted artifact', { relativePath });
    } catch (error) {
      logger.error('Failed to delete artifact', { relativePath, error });
      throw error;
    }
  }

  async generateThumbnail(relativePath: string, size?: { width: number; height: number }): Promise<string | null> {
    const fullPath = join(this.config.baseDir, relativePath);
    const ext = extname(relativePath).toLowerCase();

    try {
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        return await this.generateImageThumbnail(relativePath, size);
      } else if (['.mp4', '.webm'].includes(ext)) {
        return await this.generateVideoThumbnail(relativePath, size);
      } else {
        logger.warn('Cannot generate thumbnail for file type', { relativePath, ext });
        return null;
      }
    } catch (error) {
      logger.error('Failed to generate thumbnail', { relativePath, error });
      return null;
    }
  }

  private async generateImageThumbnail(
    relativePath: string, 
    size?: { width: number; height: number }
  ): Promise<string> {
    const fullPath = join(this.config.baseDir, relativePath);
    const thumbSize = size || this.config.thumbnailSizes[0];
    
    const thumbPath = relativePath.replace(extname(relativePath), `_thumb_${thumbSize.width}x${thumbSize.height}.webp`);
    const thumbFullPath = join(this.config.baseDir, thumbPath);

    await fs.mkdir(dirname(thumbFullPath), { recursive: true });

    await sharp(fullPath)
      .resize(thumbSize.width, thumbSize.height, {
        fit: 'cover',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(thumbFullPath);

    logger.info('Generated image thumbnail', { relativePath, thumbPath, size: thumbSize });
    return thumbPath;
  }

  private async generateVideoThumbnail(
    relativePath: string,
    size?: { width: number; height: number }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fullPath = join(this.config.baseDir, relativePath);
      const thumbSize = size || this.config.thumbnailSizes[0];
      
      const thumbPath = relativePath.replace(extname(relativePath), `_thumb_${thumbSize.width}x${thumbSize.height}.webp`);
      const thumbFullPath = join(this.config.baseDir, thumbPath);

      // Ensure directory exists
      fs.mkdir(dirname(thumbFullPath), { recursive: true }).then(() => {
        ffmpeg(fullPath)
          .seekInput(this.config.videoThumbnailTime)
          .frames(1)
          .size(`${thumbSize.width}x${thumbSize.height}`)
          .format('webp')
          .output(thumbFullPath)
          .on('end', () => {
            logger.info('Generated video thumbnail', { relativePath, thumbPath, size: thumbSize });
            resolve(thumbPath);
          })
          .on('error', (error) => {
            logger.error('Failed to generate video thumbnail', { relativePath, error });
            reject(error);
          })
          .run();
      }).catch(reject);
    });
  }

  private detectMimeType(buffer: Buffer, filename: string): string {
    const ext = extname(filename).toLowerCase();
    
    // Check file signature (magic numbers)
    if (buffer.length >= 8) {
      const signature = buffer.subarray(0, 8);
      
      // PNG signature
      if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
        return 'image/png';
      }
      
      // JPEG signature
      if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
        return 'image/jpeg';
      }
      
      // WebP signature
      if (buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && 
          buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) {
        return 'image/webp';
      }
      
      // MP4 signature
      if (buffer.subarray(4, 8).equals(Buffer.from('ftyp'))) {
        return 'video/mp4';
      }
      
      // ZIP signature
      if (signature[0] === 0x50 && signature[1] === 0x4B) {
        return 'application/zip';
      }
    }

    // Fallback to extension-based detection
    const extMimeMap: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html', '.htm': 'text/html'
    };

    return extMimeMap[ext] || 'application/octet-stream';
  }

  async getArtifactInfo(relativePath: string): Promise<{
    size: number;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  } | null> {
    const fullPath = join(this.config.baseDir, relativePath);
    
    try {
      const stats = await fs.stat(fullPath);
      const mimeType = this.detectMimeType(Buffer.alloc(0), relativePath);
      const ext = extname(relativePath).toLowerCase();

      const info: any = {
        size: stats.size,
        mimeType
      };

      // Get image dimensions
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        try {
          const metadata = await sharp(fullPath).metadata();
          info.width = metadata.width;
          info.height = metadata.height;
        } catch (error) {
          logger.warn('Failed to get image metadata', { relativePath, error });
        }
      }

      // Get video info
      if (['.mp4', '.webm'].includes(ext)) {
        info.duration = await this.getVideoDuration(fullPath);
      }

      return info;
    } catch (error) {
      logger.error('Failed to get artifact info', { relativePath, error });
      return null;
    }
  }

  private async getVideoDuration(fullPath: string): Promise<number | undefined> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(fullPath, (err, metadata) => {
        if (err) {
          logger.warn('Failed to get video duration', { fullPath, err });
          resolve(undefined);
        } else {
          const duration = metadata.format.duration;
          resolve(duration ? Math.round(duration * 1000) : undefined); // Convert to milliseconds
        }
      });
    });
  }

  async cleanupEmptyDirectories(runId?: string): Promise<void> {
    const startDir = runId ? join(this.config.baseDir, runId) : this.config.baseDir;
    
    try {
      await this.removeEmptyDirectoriesRecursive(startDir);
    } catch (error) {
      logger.error('Failed to cleanup empty directories', { startDir, error });
    }
  }

  private async removeEmptyDirectoriesRecursive(dirPath: string): Promise<void> {
    if (dirPath === this.config.baseDir) return;

    try {
      const entries = await fs.readdir(dirPath);
      
      // First, recursively clean subdirectories
      for (const entry of entries) {
        const entryPath = join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          await this.removeEmptyDirectoriesRecursive(entryPath);
        }
      }

      // Check if directory is now empty
      const remainingEntries = await fs.readdir(dirPath);
      if (remainingEntries.length === 0) {
        await fs.rmdir(dirPath);
        logger.debug('Removed empty directory', { dirPath });
      }
    } catch (error) {
      // Ignore errors (directory might not exist or not be empty)
      logger.debug('Could not remove directory', { dirPath, error: error.message });
    }
  }

  // Batch operations
  async storeMultipleArtifacts(artifacts: Array<{
    buffer: Buffer;
    runId: string;
    stepId?: string;
    artifactType: string;
    originalName: string;
    mimeType?: string;
  }>): Promise<string[]> {
    const results: string[] = [];
    
    for (const artifact of artifacts) {
      try {
        const path = await this.storeArtifact(
          artifact.buffer,
          artifact.runId,
          artifact.stepId,
          artifact.artifactType,
          artifact.originalName,
          artifact.mimeType
        );
        results.push(path);
      } catch (error) {
        logger.error('Failed to store artifact in batch', { artifact: artifact.originalName, error });
        throw error;
      }
    }

    return results;
  }

  async generateThumbnailBatch(relativePaths: string[]): Promise<{ [path: string]: string | null }> {
    const results: { [path: string]: string | null } = {};
    
    await Promise.all(
      relativePaths.map(async (path) => {
        try {
          results[path] = await this.generateThumbnail(path);
        } catch (error) {
          logger.error('Failed to generate thumbnail in batch', { path, error });
          results[path] = null;
        }
      })
    );

    return results;
  }

  // Storage statistics
  async getStorageStats(): Promise<{
    totalSize: number;
    fileCount: number;
    byType: { [type: string]: { count: number; size: number } };
  }> {
    const stats = {
      totalSize: 0,
      fileCount: 0,
      byType: {} as { [type: string]: { count: number; size: number } }
    };

    try {
      await this.calculateDirectoryStats(this.config.baseDir, stats);
    } catch (error) {
      logger.error('Failed to calculate storage stats', error);
    }

    return stats;
  }

  private async calculateDirectoryStats(dirPath: string, stats: any): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = join(dirPath, entry);
        const fileStat = await fs.stat(entryPath);
        
        if (fileStat.isDirectory()) {
          await this.calculateDirectoryStats(entryPath, stats);
        } else {
          const ext = extname(entry).toLowerCase();
          const mimeType = this.detectMimeType(Buffer.alloc(0), entry);
          
          stats.totalSize += fileStat.size;
          stats.fileCount += 1;
          
          if (!stats.byType[mimeType]) {
            stats.byType[mimeType] = { count: 0, size: 0 };
          }
          stats.byType[mimeType].count += 1;
          stats.byType[mimeType].size += fileStat.size;
        }
      }
    } catch (error) {
      logger.warn('Failed to read directory for stats', { dirPath, error });
    }
  }
}