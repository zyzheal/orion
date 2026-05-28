/**
 * Builder Image Service - 构建镜像管理服务
 *
 * 职责：
 * - 管理预置构建器镜像（Node.js、Python、Go、Java 等）
 * - 自定义镜像注册
 * - 镜像版本管理
 * - 镜像拉取策略管理
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
import { OrionError, ErrorCode } from '../../../errors';

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
  {
    name: 'node-20',
    displayName: 'Node.js 20 Builder',
    image: 'node:20-slim',
    type: PresetImageType.NODE,
    version: '20-slim',
    description: 'Node.js 20 精简版构建镜像',
    env: { NODE_ENV: 'production' },
  },
  {
    name: 'node-18',
    displayName: 'Node.js 18 Builder',
    image: 'node:18-slim',
    type: PresetImageType.NODE,
    version: '18-slim',
    description: 'Node.js 18 精简版构建镜像',
    env: { NODE_ENV: 'production' },
  },
  {
    name: 'python-312',
    displayName: 'Python 3.12 Builder',
    image: 'python:3.12-slim',
    type: PresetImageType.PYTHON,
    version: '3.12-slim',
    description: 'Python 3.12 精简版构建镜像',
  },
  {
    name: 'python-311',
    displayName: 'Python 3.11 Builder',
    image: 'python:3.11-slim',
    type: PresetImageType.PYTHON,
    version: '3.11-slim',
    description: 'Python 3.11 精简版构建镜像',
  },
  {
    name: 'go-122',
    displayName: 'Go 1.22 Builder',
    image: 'golang:1.22-slim',
    type: PresetImageType.GO,
    version: '1.22-alpine',
    description: 'Go 1.22 Alpine 构建镜像',
    env: { GOPATH: '/go', GONOSUMCHECK: '*' },
  },
  {
    name: 'go-121',
    displayName: 'Go 1.21 Builder',
    image: 'golang:1.21-slim',
    type: PresetImageType.GO,
    version: '1.21-alpine',
    description: 'Go 1.21 Alpine 构建镜像',
    env: { GOPATH: '/go', GONOSUMCHECK: '*' },
  },
  {
    name: 'java-21',
    displayName: 'Java 21 Builder',
    image: 'eclipse-temurin:21-jdk-slim',
    type: PresetImageType.JAVA,
    version: '21-jdk-alpine',
    description: 'Java 21 (Temurin) Alpine 构建镜像',
    env: { JAVA_HOME: '/opt/java/openjdk' },
  },
  {
    name: 'java-17',
    displayName: 'Java 17 Builder',
    image: 'eclipse-temurin:17-jdk-slim',
    type: PresetImageType.JAVA,
    version: '17-jdk-alpine',
    description: 'Java 17 (Temurin) Alpine 构建镜像',
    env: { JAVA_HOME: '/opt/java/openjdk' },
  },
  {
    name: 'dotnet-8',
    displayName: '.NET 8 Builder',
    image: 'mcr.microsoft.com/dotnet/sdk:8.0-slim',
    type: PresetImageType.DOTNET,
    version: '8.0-alpine',
    description: '.NET 8 SDK Alpine 构建镜像',
  },
  {
    name: 'rust-177',
    displayName: 'Rust 1.77 Builder',
    image: 'rust:1.77-slim',
    type: PresetImageType.RUST,
    version: '1.77-slim',
    description: 'Rust 1.77 精简版构建镜像',
  },
];

/**
 * 内存存储
 */
const images = new Map<string, BuilderImage>();

export class BuilderImageService {
  constructor() {
    // 初始化预置镜像
    this.initializePresets();
  }

  /**
   * 初始化预置镜像
   */
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
      // 标记为预置
      (image as any).isPreset = true;
      images.set(image.id, image);
    }
  }

  /**
   * 注册新的构建镜像
   */
  async register(input: BuilderImageCreateInput): Promise<BuilderImage> {
    // 检查名称是否已存在
    const existing = Array.from(images.values()).find(
      img => img.name === input.name && img.status !== BuilderImageStatus.DISABLED
    );
    if (existing) {
      throw new OrionError('VALIDATION_ERROR', `Builder image '${input.name}' already exists`)
    }

    const image = createBuilderImage(input);
    images.set(image.id, image);
    return image;
  }

  /**
   * 获取镜像详情
   */
  async getById(id: string): Promise<BuilderImage | null> {
    return images.get(id) || null;
  }

  /**
   * 按名称获取镜像
   */
  async getByName(name: string): Promise<BuilderImage | null> {
    return Array.from(images.values()).find(
      img => img.name === name
    ) || null;
  }

  /**
   * 查询镜像列表
   */
  async list(options?: BuilderImageQueryOptions): Promise<BuilderImage[]> {
    let result = Array.from(images.values());

    if (options?.type) {
      result = result.filter(img => img.type === options.type);
    }

    if (options?.status) {
      result = result.filter(img => img.status === options.status);
    }

    if (options?.isPreset !== undefined) {
      result = result.filter(img => img.isPreset === options.isPreset);
    }

    // 排序
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 更新镜像
   */
  async update(id: string, input: BuilderImageUpdateInput): Promise<BuilderImage | null> {
    const image = images.get(id);
    if (!image) {
      return null;
    }

    // 预置镜像不允许删除，但可以修改部分属性
    const updated = updateBuilderImage(image, input);
    images.set(id, updated);
    return updated;
  }

  /**
   * 禁用镜像（软删除）
   */
  async disable(id: string): Promise<boolean> {
    const image = images.get(id);
    if (!image) {
      return false;
    }

    // 预置镜像不能禁用，只能标记为 deprecated
    if (image.isPreset) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Cannot disable preset images. Use deprecate instead.');
    }

    const updated = updateBuilderImage(image, {
      status: BuilderImageStatus.DISABLED,
    });
    images.set(id, updated);
    return true;
  }

  /**
   * 弃用镜像
   */
  async deprecate(id: string): Promise<BuilderImage | null> {
    const image = images.get(id);
    if (!image) {
      return null;
    }

    const updated = updateBuilderImage(image, {
      status: BuilderImageStatus.DEPRECATED,
    });
    images.set(id, updated);
    return updated;
  }

  /**
   * 恢复镜像
   */
  async restore(id: string): Promise<BuilderImage | null> {
    const image = images.get(id);
    if (!image) {
      return null;
    }

    const updated = updateBuilderImage(image, {
      status: BuilderImageStatus.ACTIVE,
    });
    images.set(id, updated);
    return updated;
  }

  /**
   * 获取所有预置镜像
   */
  async getPresets(): Promise<BuilderImage[]> {
    return this.list({ isPreset: true });
  }

  /**
   * 获取可用的镜像（Active 状态）
   */
  async getAvailable(): Promise<BuilderImage[]> {
    return Array.from(images.values()).filter(isImageAvailable);
  }

  /**
   * 按类型获取可用镜像
   */
  async getByType(type: PresetImageType): Promise<BuilderImage[]> {
    return Array.from(images.values()).filter(
      img => img.type === type && img.status === BuilderImageStatus.ACTIVE
    );
  }

  /**
   * 获取镜像拉取策略
   */
  getPullPolicy(imageName: string): ImagePullPolicy {
    const image = images.get(imageName) ||
      Array.from(images.values()).find(img => img.name === imageName);
    return image?.pullPolicy || ImagePullPolicy.IF_NOT_PRESENT;
  }

  /**
   * 删除镜像（仅限自定义镜像）
   */
  async delete(id: string): Promise<boolean> {
    const image = images.get(id);
    if (!image) {
      return false;
    }

    if (image.isPreset) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Cannot delete preset images');
    }

    images.delete(id);
    return true;
  }
}

export const builderImageService = new BuilderImageService();
