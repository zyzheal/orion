/**
 * DockerRegistryClient - OCI/Docker Registry HTTP API V2 Client
 *
 * 支持 Registry 类型: Docker Hub, Harbor, Nexus, AWS ECR, GCP GCR, Azure ACR
 * 认证方式: Basic Auth, Bearer Token
 *
 * 协议参考: https://docs.docker.com/registry/spec/api/
 */

import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'docker-registry-client' });

// ==================== Types ====================

export enum RegistryType {
  DOCKER_HUB = 'DOCKER_HUB',
  HARBOR = 'HARBOR',
  NEXUS = 'NEXUS',
  AWS_ECR = 'AWS_ECR',
  GCP_GCR = 'GCP_GCR',
  AZURE_ACR = 'AZURE_ACR',
  GENERIC = 'GENERIC',
}

export enum AuthType {
  BASIC = 'BASIC',
  BEARER = 'BEARER',
  NONE = 'NONE',
}

export interface RegistryAuth {
  type: AuthType;
  username?: string;
  password?: string;
  bearerToken?: string;
  // Cloud provider credentials
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  gcpProjectId?: string;
  gcpServiceAccountKey?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
}

export interface RegistryConfig {
  url: string;           // e.g. https://registry.hub.docker.com, https://harbor.example.com
  type: RegistryType;
  auth: RegistryAuth;
  insecure?: boolean;    // 允许自签名证书
}

export interface ImageInfo {
  name: string;          // repository name, e.g. "library/nginx"
  tag: string;           // tag, e.g. "latest"
  digest?: string;       // sha256:...
  sizeBytes?: number;
  createdAt?: string;
  mediaType?: string;
  labels?: Record<string, string>;
}

export interface ImageListResult {
  repositories: string[];
  nextLink?: string;
}

export interface TagListResult {
  name: string;
  tags: string[];
  nextLink?: string;
}

export interface PushResult {
  image: string;
  tag: string;
  digest: string;
  sizeBytes: number;
  layersPushed: number;
}

export interface PullResult {
  image: string;
  tag: string;
  digest: string;
  manifest: any;
  sizeBytes: number;
}

export interface DeleteResult {
  image: string;
  tag: string;
  digest: string;
  deletedAt: string;
}

export interface RegistryError {
  code: string;
  message: string;
  statusCode?: number;
}

// ==================== Auth Helpers ====================

function buildAuthHeader(registry: RegistryConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (registry.auth.type) {
    case AuthType.BASIC:
      if (registry.auth.username && registry.auth.password) {
        const credentials = Buffer.from(`${registry.auth.username}:${registry.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
    case AuthType.BEARER:
      if (registry.auth.bearerToken) {
        headers['Authorization'] = `Bearer ${registry.auth.bearerToken}`;
      }
      break;
    case AuthType.NONE:
      break;
  }

  return headers;
}

async function getBearerToken(
  registry: RegistryConfig,
  realm: string,
  service: string,
  scope?: string
): Promise<string> {
  logger.info({ realm, service, scope }, 'Fetching bearer token from auth service');

  const authHeader = buildAuthHeader(registry);
  const url = new URL(realm);
  if (service) url.searchParams.set('service', service);
  if (scope) url.searchParams.set('scope', scope);
  if (registry.auth.type === AuthType.BASIC && registry.auth.username) {
    url.searchParams.set('account', registry.auth.username);
  }

  const response = await fetch(url.toString(), {
    headers: authHeader,
  });

  if (!response.ok) {
    throw new DockerRegistryError(
      `Failed to obtain bearer token: ${response.statusText}`,
      'TOKEN_FETCH_FAILED',
      response.status
    );
  }

  const tokenData = await response.json() as { token?: string; access_token?: string };
  return tokenData.token || tokenData.access_token || '';
}

function getDockerHubAuthRealm(): string {
  return 'https://auth.docker.io/token';
}

function getECRAuthUrl(region: string): string {
  return `https://${region}.amazonaws.com`;
}

function getGCRAuthUrl(projectId: string): string {
  return `https://oauth2.googleapis.com/token`;
}

function getACRAuthUrl(loginServer: string): string {
  return `https://${loginServer}/oauth2/exchange`;
}

// ==================== HTTP Request Helper ====================

async function registryFetch(
  registry: RegistryConfig,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    skipAuth?: boolean;
  } = {}
): Promise<{ response: Response; headers: Headers }> {
  const { method = 'GET', headers = {}, body, skipAuth = false } = options;

  const url = new URL(path, registry.url).toString();

  const requestHeaders: Record<string, string> = {
    'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
    ...headers,
  };

  // Only add auth header for non-challenge requests (avoid leaking tokens in HEAD/GET for v2 check)
  if (!skipAuth) {
    const authHeaders = buildAuthHeader(registry);
    Object.assign(requestHeaders, authHeaders);
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!fetchOptions.headers!['Content-Type']) {
      fetchOptions.headers!['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, fetchOptions);

  // Handle 401 authentication challenge
  if (response.status === 401 && !skipAuth) {
    const wwwAuth = response.headers.get('www-authenticate');
    if (wwwAuth && wwwAuth.startsWith('Bearer')) {
      const challenge = parseBearerChallenge(wwwAuth);
      const bearerToken = await getBearerToken(registry, challenge.realm, challenge.service, challenge.scope);

      // Retry with bearer token
      const retryHeaders: Record<string, string> = {
        ...requestHeaders,
        'Authorization': `Bearer ${bearerToken}`,
      };

      const retryOptions: RequestInit = {
        method,
        headers: retryHeaders,
      };

      if (body) {
        retryOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!retryOptions.headers!['Content-Type']) {
          retryOptions.headers!['Content-Type'] = 'application/json';
        }
      }

      const retryResponse = await fetch(url, retryOptions);
      return { response: retryResponse, headers: retryResponse.headers };
    }
  }

  return { response, headers: response.headers };
}

interface BearerChallenge {
  realm: string;
  service: string;
  scope?: string;
}

function parseBearerChallenge(header: string): BearerChallenge {
  const result: BearerChallenge = { realm: '', service: '' };

  // Parse "Bearer realm=...,service=...,scope=..."
  const params = new URLSearchParams(header.replace(/^Bearer\s+/i, ''));
  result.realm = params.get('realm') || '';
  result.service = params.get('service') || '';
  result.scope = params.get('scope') || undefined;

  return result;
}

// ==================== Error Class ====================

export class DockerRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DockerRegistryError';
  }
}

// ==================== Registry Client ====================

export class DockerRegistryClient {
  constructor(private registry: RegistryConfig) {
    if (!registry.url) {
      throw new DockerRegistryError('Registry URL is required', 'INVALID_CONFIG');
    }
  }

  // ==================== Version Check ====================

  /**
   * 检查 Registry API v2 是否可用
   */
  async ping(): Promise<boolean> {
    try {
      const { response } = await registryFetch(this.registry, '/v2/', {
        method: 'GET',
        skipAuth: true,
      });
      return response.status === 200 || response.status === 401;
    } catch (error) {
      logger.error({ error }, 'Registry ping failed');
      throw new DockerRegistryError(
        `Registry ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PING_FAILED'
      );
    }
  }

  // ==================== List Images ====================

  /**
   * 列出 Registry 中的所有镜像仓库
   */
  async listImages(): Promise<ImageListResult> {
    try {
      const { response } = await registryFetch(this.registry, '/v2/_catalog', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to list images: ${response.statusText}`,
          'LIST_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      const data = await response.json() as { repositories: string[] };
      return {
        repositories: data.repositories || [],
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error }, 'Failed to list images');
      throw new DockerRegistryError(
        `Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_FAILED'
      );
    }
  }

  // ==================== List Tags ====================

  /**
   * 列出指定镜像的所有标签
   */
  async listTags(imageName: string): Promise<TagListResult> {
    try {
      const encodedName = encodeURIComponent(imageName);
      const { response } = await registryFetch(this.registry, `/v2/${encodedName}/tags/list`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to list tags for ${imageName}: ${response.statusText}`,
          'LIST_TAGS_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      const data = await response.json() as { name: string; tags?: string[] };
      return {
        name: data.name,
        tags: data.tags || [],
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName }, 'Failed to list tags');
      throw new DockerRegistryError(
        `Failed to list tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_TAGS_FAILED'
      );
    }
  }

  // ==================== Get Manifest ====================

  /**
   * 获取镜像的 manifest
   */
  async getManifest(imageName: string, reference: string): Promise<any> {
    try {
      const encodedName = encodeURIComponent(imageName);
      const { response } = await registryFetch(
        this.registry,
        `/v2/${encodedName}/manifests/${reference}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to get manifest for ${imageName}:${reference}`,
          'GET_MANIFEST_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      const manifest = await response.json();
      return {
        manifest,
        digest: response.headers.get('docker-content-digest') || response.headers.get('digest') || '',
        mediaType: response.headers.get('content-type') || '',
        size: parseInt(response.headers.get('content-length') || '0'),
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName, reference }, 'Failed to get manifest');
      throw new DockerRegistryError(
        `Failed to get manifest: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_MANIFEST_FAILED'
      );
    }
  }

  // ==================== Pull Image ====================

  /**
   * 从 Registry 拉取镜像 manifest（获取镜像元数据）
   * 注意：完整的镜像拉取需要额外下载 blob，这里返回 manifest 信息
   */
  async pullImage(imageName: string, tag: string): Promise<PullResult> {
    try {
      const manifestInfo = await this.getManifest(imageName, tag);

      // 估算镜像大小
      let sizeBytes = 0;
      if (manifestInfo.manifest.config && manifestInfo.manifest.config.size) {
        sizeBytes += manifestInfo.manifest.config.size;
      }
      if (manifestInfo.manifest.layers) {
        for (const layer of manifestInfo.manifest.layers) {
          sizeBytes += layer.size || 0;
        }
      }

      return {
        image: imageName,
        tag,
        digest: manifestInfo.digest,
        manifest: manifestInfo.manifest,
        sizeBytes,
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName, tag }, 'Failed to pull image');
      throw new DockerRegistryError(
        `Failed to pull image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PULL_FAILED'
      );
    }
  }

  // ==================== Push Image ====================

  /**
   * 推送镜像到 Registry
   * 需要已构建好镜像并获取 manifest，然后上传到 registry
   */
  async pushImage(imageName: string, tag: string, manifest: any): Promise<PushResult> {
    try {
      const encodedName = encodeURIComponent(imageName);

      // 1. 先上传 manifest
      const { response } = await registryFetch(this.registry, `/v2/${encodedName}/manifests/${tag}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/vnd.docker.distribution.manifest.v2+json',
        },
        body: manifest,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to push image ${imageName}:${tag}: ${response.statusText}`,
          'PUSH_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      const digest = response.headers.get('docker-content-digest') || response.headers.get('digest') || '';
      const contentLength = response.headers.get('content-length') || '0';

      // 2. 统计 manifest 中的 layers 数量
      let layersPushed = 0;
      if (manifest.layers && Array.isArray(manifest.layers)) {
        layersPushed = manifest.layers.length;
      }

      logger.info({ image: imageName, tag, digest }, 'Image pushed successfully');

      return {
        image: imageName,
        tag,
        digest,
        sizeBytes: parseInt(contentLength),
        layersPushed,
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName, tag }, 'Failed to push image');
      throw new DockerRegistryError(
        `Failed to push image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PUSH_FAILED'
      );
    }
  }

  // ==================== Delete Image ====================

  /**
   * 删除 Registry 中的镜像
   */
  async deleteImage(imageName: string, tag: string): Promise<DeleteResult> {
    try {
      // 1. 获取 manifest 的 digest
      const manifestInfo = await this.getManifest(imageName, tag);
      const digest = manifestInfo.digest;

      if (!digest) {
        throw new DockerRegistryError(
          `Cannot delete image ${imageName}:${tag}: digest not found`,
          'DELETE_FAILED'
        );
      }

      // 2. 删除 manifest
      const encodedName = encodeURIComponent(imageName);
      const { response } = await registryFetch(
        this.registry,
        `/v2/${encodedName}/manifests/${digest}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok && response.status !== 202) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to delete image ${imageName}:${tag}: ${response.statusText}`,
          'DELETE_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      logger.info({ image: imageName, tag, digest }, 'Image deleted successfully');

      return {
        image: imageName,
        tag,
        digest,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName, tag }, 'Failed to delete image');
      throw new DockerRegistryError(
        `Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_FAILED'
      );
    }
  }

  // ==================== Upload Blob ====================

  /**
   * 启动 blob 上传会话
   */
  async startBlobUpload(imageName: string): Promise<{ uploadUrl: string }> {
    try {
      const encodedName = encodeURIComponent(imageName);
      const { response } = await registryFetch(this.registry, `/v2/${encodedName}/blobs/uploads/`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new DockerRegistryError(
          `Failed to start blob upload for ${imageName}: ${response.statusText}`,
          'BLOB_UPLOAD_FAILED',
          response.status,
          { body: errorBody }
        );
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new DockerRegistryError('No upload location in response', 'BLOB_UPLOAD_FAILED');
      }

      return { uploadUrl: location };
    } catch (error) {
      if (error instanceof DockerRegistryError) throw error;
      logger.error({ error, imageName }, 'Failed to start blob upload');
      throw new DockerRegistryError(
        `Failed to start blob upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BLOB_UPLOAD_FAILED'
      );
    }
  }

  /**
   * 上传 blob 数据到已启动的上传会话
   */
  async uploadBlobChunk(
    uploadUrl: string,
    data: Buffer,
    offset: number,
    totalSize: number
  ): Promise<{ nextOffset: number }> {
    const end = offset + data.length;
    const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;

    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        'Content-Range': contentRange,
        'Content-Type': 'application/octet-stream',
        ...buildAuthHeader(this.registry),
      },
      body: data,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DockerRegistryError(
        `Failed to upload blob chunk: ${response.statusText}`,
        'BLOB_UPLOAD_FAILED',
        response.status,
        { body: errorBody }
      );
    }

    return { nextOffset: end };
  }

  /**
   * 完成 blob 上传
   */
  async completeBlobUpload(uploadUrl: string, digest: string): Promise<void> {
    const url = new URL(uploadUrl);
    url.searchParams.set('digest', digest);

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        ...buildAuthHeader(this.registry),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DockerRegistryError(
        `Failed to complete blob upload: ${response.statusText}`,
        'BLOB_UPLOAD_FAILED',
        response.status,
        { body: errorBody }
      );
    }
  }

  // ==================== Registry Health ====================

  /**
   * 检查 Registry 健康状态
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; version?: string }> {
    const startTime = Date.now();
    try {
      const { response } = await registryFetch(this.registry, '/v2/', {
        method: 'GET',
        skipAuth: true,
      });

      const latencyMs = Date.now() - startTime;

      // 尝试解析版本信息
      let version: string | undefined;
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        version = (data as any)?.version;
      }

      return {
        healthy: response.ok || response.status === 401,
        latencyMs,
        version,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

// ==================== Registry Client Factory ====================

export class DockerRegistryClientFactory {
  /**
   * 根据配置创建 Registry 客户端
   */
  static create(config: RegistryConfig): DockerRegistryClient {
    // 根据 registry 类型自动调整配置
    const normalizedConfig = { ...config };

    // 自动补充 auth 信息
    switch (config.type) {
      case RegistryType.DOCKER_HUB:
        if (!normalizedConfig.url.includes('docker.io') && !normalizedConfig.url.includes('hub.docker.com')) {
          normalizedConfig.url = 'https://registry.hub.docker.com';
        }
        if (normalizedConfig.auth.type === AuthType.NONE && !normalizedConfig.auth.bearerToken) {
          // Docker Hub 匿名访问允许有限制的拉取
        }
        break;

      case RegistryType.HARBOR:
        // Harbor 默认路径
        if (!normalizedConfig.url.includes('/api/v2.0')) {
          // Harbor v2 API 不需要额外调整
        }
        break;

      case RegistryType.NEXUS:
        // Nexus3 默认路径
        break;

      case RegistryType.AWS_ECR:
        // AWS ECR 需要特殊处理：从 AWS 获取 auth token
        if (!normalizedConfig.auth.awsRegion) {
          normalizedConfig.auth.awsRegion = 'us-east-1';
        }
        break;

      case RegistryType.GCP_GCR:
        // GCP GCR 使用 OAuth2
        break;

      case RegistryType.AZURE_ACR:
        // Azure ACR 使用 AAD 登录
        break;
    }

    return new DockerRegistryClient(normalizedConfig);
  }

  /**
   * 创建 Docker Hub 客户端
   */
  static createDockerHub(auth?: { username?: string; password?: string; token?: string }): DockerRegistryClient {
    const registryAuth: RegistryAuth = auth?.token
      ? { type: AuthType.BEARER, bearerToken: auth.token }
      : { type: AuthType.BASIC, username: auth?.username, password: auth?.password };

    return this.create({
      url: 'https://registry.hub.docker.com',
      type: RegistryType.DOCKER_HUB,
      auth: registryAuth,
    });
  }

  /**
   * 创建 Harbor 客户端
   */
  static createHarbor(url: string, auth: { username: string; password: string }): DockerRegistryClient {
    return this.create({
      url,
      type: RegistryType.HARBOR,
      auth: { type: AuthType.BASIC, ...auth },
    });
  }

  /**
   * 创建 Nexus 客户端
   */
  static createNexus(url: string, auth: { username: string; password: string }): DockerRegistryClient {
    return this.create({
      url,
      type: RegistryType.NEXUS,
      auth: { type: AuthType.BASIC, ...auth },
    });
  }

  /**
   * 创建 AWS ECR 客户端
   */
  static createECR(region: string, auth?: { accessKeyId?: string; secretAccessKey?: string }): DockerRegistryClient {
    const accountId = auth?.accessKeyId ? '' : undefined; // 需要额外获取 account ID
    return this.create({
      url: `https://${accountId || 'XXX'}.dkr.ecr.${region}.amazonaws.com`,
      type: RegistryType.AWS_ECR,
      auth: {
        type: AuthType.BEARER,
        awsRegion: region,
        awsAccessKeyId: auth?.accessKeyId,
        awsSecretAccessKey: auth?.secretAccessKey,
      },
    });
  }

  /**
   * 创建 GCP GCR 客户端
   */
  static createGCR(projectId: string, serviceAccountKey?: string): DockerRegistryClient {
    return this.create({
      url: `https://gcr.io`,
      type: RegistryType.GCP_GCR,
      auth: {
        type: AuthType.BEARER,
        gcpProjectId: projectId,
        gcpServiceAccountKey: serviceAccountKey,
      },
    });
  }

  /**
   * 创建 Azure ACR 客户端
   */
  static createACR(loginServer: string, auth?: { tenantId?: string; clientId?: string; clientSecret?: string }): DockerRegistryClient {
    return this.create({
      url: `https://${loginServer}`,
      type: RegistryType.AZURE_ACR,
      auth: {
        type: AuthType.BEARER,
        azureTenantId: auth?.tenantId,
        azureClientId: auth?.clientId,
        azureClientSecret: auth?.clientSecret,
      },
    });
  }
}
