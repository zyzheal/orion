/**
 * Builder Image 数据模型
 *
 * 管理构建用的基础镜像和自定义镜像
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 镜像拉取策略
 */
export enum ImagePullPolicy {
  ALWAYS = 'Always',        // 总是拉取
  IF_NOT_PRESENT = 'IfNotPresent',  // 本地不存在时拉取
  NEVER = 'Never',          // 从不拉取（使用本地镜像）
}

/**
 * 镜像状态
 */
export enum BuilderImageStatus {
  ACTIVE = 'active',        // 可用
  DEPRECATED = 'deprecated', // 已废弃（不推荐新使用）
  DISABLED = 'disabled',    // 已禁用（不可使用）
}

/**
 * 预置镜像类型
 */
export enum PresetImageType {
  NODE = 'node',
  PYTHON = 'python',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  RUST = 'rust',
  CUSTOM = 'custom',
}

/**
 * Builder 镜像定义
 */
export interface BuilderImage {
  id: string;
  name: string;             // 镜像名称，如 'node-builder'
  displayName: string;      // 显示名称，如 'Node.js Builder'
  image: string;            // 完整镜像地址，如 'node:20-slim'
  type: PresetImageType;    // 镜像类型
  version: string;          // 镜像版本标签
  description: string;      // 描述信息
  pullPolicy: ImagePullPolicy;  // 拉取策略
  status: BuilderImageStatus;   // 状态
  isPreset: boolean;        // 是否为预置镜像
  env?: Record<string, string>;  // 默认环境变量
  labels?: Record<string, string>;  // 标签
  createdBy?: string;       // 创建者
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 创建 Builder 镜像输入
 */
export interface BuilderImageCreateInput {
  name: string;
  displayName?: string;
  image: string;
  type?: PresetImageType;
  version?: string;
  description?: string;
  pullPolicy?: ImagePullPolicy;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  createdBy?: string;
}

/**
 * 更新 Builder 镜像输入
 */
export interface BuilderImageUpdateInput {
  displayName?: string;
  description?: string;
  pullPolicy?: ImagePullPolicy;
  status?: BuilderImageStatus;
  env?: Record<string, string>;
  labels?: Record<string, string>;
}

/**
 * 查询选项
 */
export interface BuilderImageQueryOptions {
  type?: PresetImageType;
  status?: BuilderImageStatus;
  isPreset?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 创建 Builder 镜像
 */
export function createBuilderImage(input: BuilderImageCreateInput): BuilderImage {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    displayName: input.displayName || input.name,
    image: input.image,
    type: input.type || PresetImageType.CUSTOM,
    version: input.version || 'latest',
    description: input.description || '',
    pullPolicy: input.pullPolicy || ImagePullPolicy.IF_NOT_PRESENT,
    status: BuilderImageStatus.ACTIVE,
    isPreset: false,
    env: input.env,
    labels: input.labels,
    createdBy: input.createdBy,
    createdAt: now,
  };
}

/**
 * 更新 Builder 镜像
 */
export function updateBuilderImage(
  image: BuilderImage,
  input: BuilderImageUpdateInput
): BuilderImage {
  return {
    ...image,
    displayName: input.displayName ?? image.displayName,
    description: input.description ?? image.description,
    pullPolicy: input.pullPolicy ?? image.pullPolicy,
    status: input.status ?? image.status,
    env: input.env ?? image.env,
    labels: input.labels ?? image.labels,
    updatedAt: new Date(),
  };
}

/**
 * 检查镜像是否可用
 */
export function isImageAvailable(image: BuilderImage): boolean {
  return image.status === BuilderImageStatus.ACTIVE;
}
