/**
 * Builder Image Models - 构建镜像数据模型
 */

export enum BuilderImageStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  DEPRECATED = 'deprecated',
}

export enum PresetImageType {
  NODE = 'node',
  PYTHON = 'python',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  RUST = 'rust',
  CUSTOM = 'custom',
}

export enum ImagePullPolicy {
  ALWAYS = 'always',
  IF_NOT_PRESENT = 'if-not-present',
  NEVER = 'never',
}

export interface BuilderImage {
  id: string;
  name: string;
  displayName: string;
  image: string;
  type: PresetImageType;
  version: string;
  description: string;
  status: BuilderImageStatus;
  pullPolicy: ImagePullPolicy;
  env?: Record<string, string>;
  isPreset?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuilderImageCreateInput {
  name: string;
  displayName?: string;
  image: string;
  type: PresetImageType;
  version: string;
  description?: string;
  pullPolicy?: ImagePullPolicy;
  env?: Record<string, string>;
}

export interface BuilderImageUpdateInput {
  displayName?: string;
  description?: string;
  status?: BuilderImageStatus;
  pullPolicy?: ImagePullPolicy;
  env?: Record<string, string>;
}

export interface BuilderImageQueryOptions {
  type?: PresetImageType;
  status?: BuilderImageStatus;
  isPreset?: boolean;
  limit?: number;
  offset?: number;
}

export function createBuilderImage(input: BuilderImageCreateInput): BuilderImage {
  const now = new Date();
  return {
    id: `image-${Date.now()}`,
    name: input.name,
    displayName: input.displayName || input.name,
    image: input.image,
    type: input.type,
    version: input.version,
    description: input.description || '',
    status: BuilderImageStatus.ACTIVE,
    pullPolicy: input.pullPolicy || ImagePullPolicy.IF_NOT_PRESENT,
    env: input.env,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateBuilderImage(image: BuilderImage, input: BuilderImageUpdateInput): BuilderImage {
  return { ...image, ...input, updatedAt: new Date() };
}

export function isImageAvailable(image: BuilderImage): boolean {
  return image.status === BuilderImageStatus.ACTIVE;
}
