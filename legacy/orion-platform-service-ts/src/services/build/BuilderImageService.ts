/**
 * Builder Image Service - 构建镜像管理服务
 *
 * 职责：
 * - 管理预置构建器镜像（Node.js、Python、Go、Java 等）
 * - 自定义镜像注册
 * - 镜像版本管理
 * - 镜像拉取策略管理
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map.
 */

import {
  BuilderImage,
  BuilderImageStatus,
  PresetImageType,
  ImagePullPolicy,
  BuilderImageCreateInput,
  BuilderImageUpdateInput,
  BuilderImageQueryOptions,
  createBuilderImage,
  updateBuilderImage,
  isImageAvailable,
} from '../../models/BuilderImage';
import { OrionError, ErrorCode } from '../../errors';
import { BuilderImageRepository, type BuilderImageEntity } from '../../repositories/BuilderImageRepository';

/**
 * 预置镜像定义
 */
interface PresetImageDef {
  name: string;
  displayName: string;
  image: string;
  type: PresetImageType;
  version: string;
  description: string;
  env?: Record<string, string>;
}

/**
 * 常用预置构建镜像
 */
const PRESET_IMAGES: PresetImageDef[] = [
  { name: 'node-20', displayName: 'Node.js 20 Builder', image: 'node:20-slim', type: PresetImageType.NODE, version: '20-slim', description: 'Node.js 20 精简版构建镜像', env: { NODE_ENV: 'production' } },
  { name: 'node-18', displayName: 'Node.js 18 Builder', image: 'node:18-slim', type: PresetImageType.NODE, version: '18-slim', description: 'Node.js 18 精简版构建镜像', env: { NODE_ENV: 'production' } },
  { name: 'python-312', displayName: 'Python 3.12 Builder', image: 'python:3.12-slim', type: PresetImageType.PYTHON, version: '3.12-slim', description: 'Python 3.12 精简版构建镜像' },
  { name: 'python-311', displayName: 'Python 3.11 Builder', image: 'python:3.11-slim', type: PresetImageType.PYTHON, version: '3.11-slim', description: 'Python 3.11 精简版构建镜像' },
  { name: 'go-122', displayName: 'Go 1.22 Builder', image: 'golang:1.22-slim', type: PresetImageType.GO, version: '1.22-alpine', description: 'Go 1.22 Alpine 构建镜像', env: { GOPATH: '/go', GONOSUMCHECK: '*' } },
  { name: 'go-121', displayName: 'Go 1.21 Builder', image: 'golang:1.21-slim', type: PresetImageType.GO, version: '1.21-alpine', description: 'Go 1.21 Alpine 构建镜像', env: { GOPATH: '/go', GONOSUMCHECK: '*' } },
  { name: 'java-21', displayName: 'Java 21 Builder', image: 'eclipse-temurin:21-jdk-slim', type: PresetImageType.JAVA, version: '21-jdk-alpine', description: 'Java 21 (Temurin) Alpine 构建镜像', env: { JAVA_HOME: '/opt/java/openjdk' } },
  { name: 'java-17', displayName: 'Java 17 Builder', image: 'eclipse-temurin:17-jdk-slim', type: PresetImageType.JAVA, version: '17-jdk-alpine', description: 'Java 17 (Temurin) Alpine 构建镜像', env: { JAVA_HOME: '/opt/java/openjdk' } },
  { name: 'dotnet-8', displayName: '.NET 8 Builder', image: 'mcr.microsoft.com/dotnet/sdk:8.0-slim', type: PresetImageType.DOTNET, version: '8.0-alpine', description: '.NET 8 SDK Alpine 构建镜像' },
  { name: 'rust-177', displayName: 'Rust 1.77 Builder', image: 'rust:1.77-slim', type: PresetImageType.RUST, version: '1.77-slim', description: 'Rust 1.77 精简版构建镜像' },
];

// In-memory fallback storage
const images = new Map<string, BuilderImage>();

/** Convert entity to API response */
function entityToImage(e: BuilderImageEntity): BuilderImage {
  return {
    id: e.id, name: e.name, displayName: e.displayName, image: e.image,
    type: e.type as PresetImageType, version: e.version,
    description: e.description, pullPolicy: e.pullPolicy as ImagePullPolicy,
    status: e.status as BuilderImageStatus, isPreset: e.isPreset,
    env: e.env, labels: e.labels, createdBy: e.createdBy,
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  };
}

export class BuilderImageService {
  private repo?: BuilderImageRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repo = new BuilderImageRepository(db);
    } else {
      // Initialize presets in in-memory mode
      this.initializePresets();
    }
  }

  private initializePresets(): void {
    for (const preset of PRESET_IMAGES) {
      const image = createBuilderImage({
        name: preset.name,
        displayName: preset.displayName,
        image: preset.image,
        type: preset.type,
        version: preset.version,
        description: preset.description,
        pullPolicy: ImagePullPolicy.IF_NOT_PRESENT,
        env: preset.env,
      });
      (image as any).isPreset = true;
      images.set(image.id, image);
    }
  }

  /**
   * Register a new builder image
   */
  async register(input: BuilderImageCreateInput): Promise<BuilderImage> {
    // Check for duplicate name
    if (this.repo) {
      const existing = await this.repo.findByName(input.name);
      if (existing && existing.status !== BuilderImageStatus.DISABLED) {
        throw new OrionError(`Builder image '${input.name}' already exists`, 'VALIDATION_ERROR');
      }
    } else {
      const existing = Array.from(images.values()).find(
        img => img.name === input.name && img.status !== BuilderImageStatus.DISABLED,
      );
      if (existing) {
        throw new OrionError(`Builder image '${input.name}' already exists`, 'VALIDATION_ERROR');
      }
    }

    const image = createBuilderImage(input);
    if (this.repo) {
      const saved = await this.repo.create(image);
      return entityToImage(saved);
    }
    images.set(image.id, image);
    return image;
  }

  /**
   * Get image by ID
   */
  async getById(id: string): Promise<BuilderImage | null> {
    if (this.repo) {
      const entity = await this.repo.findById(id);
      return entity ? entityToImage(entity) : null;
    }
    const img = images.get(id);
    return img ? entityToImage({
      id: img.id, name: img.name, displayName: img.displayName, image: img.image,
      type: img.type, version: img.version, description: img.description,
      pullPolicy: img.pullPolicy, status: img.status, isPreset: (img as any).isPreset,
      env: img.env, labels: img.labels, createdBy: img.createdBy,
      createdAt: img.createdAt, updatedAt: img.updatedAt,
    }) : null;
  }

  /**
   * Get image by name
   */
  async getByName(name: string): Promise<BuilderImage | null> {
    if (this.repo) {
      const entity = await this.repo.findByName(name);
      return entity ? entityToImage(entity) : null;
    }
    const img = Array.from(images.values()).find(i => i.name === name);
    return img ? entityToImage({
      id: img.id, name: img.name, displayName: img.displayName, image: img.image,
      type: img.type, version: img.version, description: img.description,
      pullPolicy: img.pullPolicy, status: img.status, isPreset: (img as any).isPreset,
      env: img.env, labels: img.labels, createdBy: img.createdBy,
      createdAt: img.createdAt, updatedAt: img.updatedAt,
    }) : null;
  }

  /**
   * List images with optional filters
   */
  async list(options?: BuilderImageQueryOptions): Promise<BuilderImage[]> {
    let result: BuilderImage[] = [];

    if (this.repo) {
      let entities: BuilderImageEntity[] = [];
      if (options?.isPreset !== undefined) {
        entities = await this.repo.listByIsPreset(options.isPreset);
      } else if (options?.type) {
        entities = await this.repo.listByType(options.type);
      } else if (options?.status) {
        entities = await this.repo.listByStatus(options.status);
      } else {
        entities = (await this.repo.findAll({ limit: options?.limit ?? 100 })).entities;
      }
      result = entities.map(entityToImage);
    } else {
      result = Array.from(images.values()).map(entityToImage);
    }

    if (options?.type) {
      result = result.filter(img => img.type === options.type);
    }
    if (options?.status) {
      result = result.filter(img => img.status === options.status);
    }
    if (options?.isPreset !== undefined) {
      result = result.filter(img => (img as any).isPreset === options.isPreset);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * Update image
   */
  async update(id: string, input: BuilderImageUpdateInput): Promise<BuilderImage | null> {
    if (this.repo) {
      const current = await this.repo.findById(id);
      if (!current) return null;
      const updated = updateBuilderImage(entityToImage(current), input);
      const saved = await this.repo.update(id, updated);
      if (!saved) throw new OrionError('Failed to update builder image', ErrorCode.OPERATION_FAILED);
      return entityToImage(saved);
    }
    const image = images.get(id);
    if (!image) return null;
    const updated = updateBuilderImage(image, input);
    images.set(id, updated);
    return updated;
  }

  /**
   * Disable image (soft delete)
   */
  async disable(id: string): Promise<boolean> {
    if (this.repo) {
      const current = await this.repo.findById(id);
      if (!current) return false;
      if (current.isPreset) {
        throw new OrionError('Cannot disable preset images. Use deprecate instead.', ErrorCode.OPERATION_FAILED);
      }
      await this.repo.updateStatus(id, BuilderImageStatus.DISABLED);
      return true;
    }
    const image = images.get(id);
    if (!image) return false;
    if ((image as any).isPreset) {
      throw new OrionError('Cannot disable preset images. Use deprecate instead.', ErrorCode.OPERATION_FAILED);
    }
    const updated = updateBuilderImage(image, { status: BuilderImageStatus.DISABLED });
    images.set(id, updated);
    return true;
  }

  /**
   * Deprecate image
   */
  async deprecate(id: string): Promise<BuilderImage | null> {
    if (this.repo) {
      const updated = await this.repo.updateStatus(id, BuilderImageStatus.DEPRECATED);
      return updated ? entityToImage(updated) : null;
    }
    const image = images.get(id);
    if (!image) return null;
    const updated = updateBuilderImage(image, { status: BuilderImageStatus.DEPRECATED });
    images.set(id, updated);
    return updated;
  }

  /**
   * Restore image
   */
  async restore(id: string): Promise<BuilderImage | null> {
    if (this.repo) {
      const updated = await this.repo.updateStatus(id, BuilderImageStatus.ACTIVE);
      return updated ? entityToImage(updated) : null;
    }
    const image = images.get(id);
    if (!image) return null;
    const updated = updateBuilderImage(image, { status: BuilderImageStatus.ACTIVE });
    images.set(id, updated);
    return updated;
  }

  /**
   * Get all preset images
   */
  async getPresets(): Promise<BuilderImage[]> {
    return this.list({ isPreset: true });
  }

  /**
   * Get available images (active status)
   */
  async getAvailable(): Promise<BuilderImage[]> {
    if (this.repo) {
      const entities = await this.repo.findActive();
      return entities.map(entityToImage);
    }
    return Array.from(images.values()).filter(isImageAvailable);
  }

  /**
   * Get available images by type
   */
  async getByType(type: PresetImageType): Promise<BuilderImage[]> {
    if (this.repo) {
      const entities = await this.repo.findByTypeAndActive(type);
      return entities.map(entityToImage);
    }
    return Array.from(images.values()).filter(
      img => img.type === type && img.status === BuilderImageStatus.ACTIVE,
    );
  }

  /**
   * Get image pull policy
   */
  getPullPolicy(imageName: string): ImagePullPolicy {
    if (this.repo) {
      // Fall back to in-memory for now since we don't have a name-based query in the repo
      const img = images.get(imageName) || Array.from(images.values()).find(i => i.name === imageName);
      return img?.pullPolicy || ImagePullPolicy.IF_NOT_PRESENT;
    }
    const image = images.get(imageName) || Array.from(images.values()).find(img => img.name === imageName);
    return image?.pullPolicy || ImagePullPolicy.IF_NOT_PRESENT;
  }

  /**
   * Delete image (custom images only)
   */
  async delete(id: string): Promise<boolean> {
    if (this.repo) {
      const current = await this.repo.findById(id);
      if (!current) return false;
      if (current.isPreset) {
        throw new OrionError('Cannot delete preset images', ErrorCode.OPERATION_FAILED);
      }
      return await this.repo.delete(id);
    }
    const image = images.get(id);
    if (!image) return false;
    if ((image as any).isPreset) {
      throw new OrionError('Cannot delete preset images', ErrorCode.OPERATION_FAILED);
    }
    images.delete(id);
    return true;
  }
}

// Singleton with no DB (routes will inject DB when available)
export const builderImageService = new BuilderImageService();
