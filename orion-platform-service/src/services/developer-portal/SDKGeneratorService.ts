/**
 * SDKGeneratorService - 开发者门户多语言 SDK 生成服务
 *
 * 根据 API 规范（OpenAPI/Swagger）自动生成多语言 SDK 代码骨架。
 * 支持 TypeScript、Python、Go、Java、C# 五种语言。
 */

import { randomUUID } from 'crypto';
import { DevPortalSDKTaskRepository } from '../../repositories/DevPortalSDKTaskRepository';

// ==================== Type Definitions ====================

export type SDKLanguage = 'typescript' | 'python' | 'go' | 'java' | 'csharp';

export interface SDKGenerationTask {
  id: string;
  tenantId: string;
  name: string;
  apiSpec: string;
  language: SDKLanguage;
  packageName: string;
  version: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output: string;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface SDKGenerateInput {
  tenantId: string;
  name: string;
  apiSpec: string;
  language: SDKLanguage;
  packageName: string;
  version?: string;
}

export interface SDKTemplateConfig {
  language: SDKLanguage;
  fileExtension: string;
  packageManager: string;
  httpClient: string;
  typeSystem: string;
}

// Language-specific template configurations
const LANGUAGE_CONFIGS: Record<SDKLanguage, SDKTemplateConfig> = {
  typescript: {
    language: 'typescript',
    fileExtension: '.ts',
    packageManager: 'npm',
    httpClient: 'axios',
    typeSystem: 'TypeScript interfaces',
  },
  python: {
    language: 'python',
    fileExtension: '.py',
    packageManager: 'pip',
    httpClient: 'httpx',
    typeSystem: 'Pydantic models',
  },
  go: {
    language: 'go',
    fileExtension: '.go',
    packageManager: 'go mod',
    httpClient: 'net/http',
    typeSystem: 'Go structs',
  },
  java: {
    language: 'java',
    fileExtension: '.java',
    packageManager: 'maven',
    httpClient: 'OkHttp',
    typeSystem: 'Java POJOs',
  },
  csharp: {
    language: 'csharp',
    fileExtension: '.cs',
    packageManager: 'nuget',
    httpClient: 'HttpClient',
    typeSystem: 'C# classes',
  },
};

export class SDKGeneratorServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SDKGeneratorServiceError';
  }
}

// ==================== Service ====================

export class SDKGeneratorService {
  private tasks: Map<string, SDKGenerationTask> = new Map();
  private repository: DevPortalSDKTaskRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new DevPortalSDKTaskRepository(db);
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): SDKTemplateConfig[] {
    return Object.values(LANGUAGE_CONFIGS);
  }

  /**
   * 创建 SDK 生成任务
   */
  async createTask(input: SDKGenerateInput): Promise<SDKGenerationTask> {
    if (!input.name || input.name.trim().length === 0) {
      throw new SDKGeneratorServiceError('Name is required', 'INVALID_INPUT');
    }
    if (!input.apiSpec || input.apiSpec.trim().length === 0) {
      throw new SDKGeneratorServiceError('API spec is required', 'INVALID_INPUT');
    }
    if (!input.packageName || input.packageName.trim().length === 0) {
      throw new SDKGeneratorServiceError('Package name is required', 'INVALID_INPUT');
    }
    if (!LANGUAGE_CONFIGS[input.language]) {
      throw new SDKGeneratorServiceError(`Unsupported language: ${input.language}`, 'INVALID_INPUT');
    }

    const now = new Date();
    const task: SDKGenerationTask = {
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name.trim(),
      apiSpec: input.apiSpec,
      language: input.language,
      packageName: input.packageName.trim(),
      version: input.version ?? '1.0.0',
      status: 'pending',
      output: '',
      error: null,
      createdAt: now,
      completedAt: null,
    };

    this.tasks.set(task.id, task);

    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.create({
        id: task.id,
        tenantId: task.tenantId,
        name: task.name,
        apiSpec: task.apiSpec,
        language: task.language,
        packageName: task.packageName,
        version: task.version,
        status: 'pending',
        output: '',
        error: null,
        completedAt: null,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    // Simulate async SDK generation
    this.processTask(task.id).catch(() => { /* swallowed */ });

    return task;
  }

  /**
   * 获取任务详情
   */
  async getTaskById(id: string): Promise<SDKGenerationTask> {
    // Try repository first
    if (this.repository) {
      try {
        const entity = await this.repository.findById(id);
        if (entity) {
          const task = this.entityToTask(entity);
          this.tasks.set(id, task); // update cache
          return task;
        }
      } catch { /* fallback to Map */ }
    }
    const task = this.tasks.get(id);
    if (!task) {
      throw new SDKGeneratorServiceError(`SDK generation task not found: ${id}`, 'TASK_NOT_FOUND');
    }
    return task;
  }

  /**
   * 列出租户下所有 SDK 生成任务
   */
  async listTasks(
    tenantId: string,
    options?: { language?: SDKLanguage; status?: string; page?: number; pageSize?: number }
  ): Promise<{ data: SDKGenerationTask[]; total: number; page: number; totalPages: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    // Try repository first
    if (this.repository) {
      try {
        const entities = await this.repository.findByTenant(tenantId, {
          language: options?.language,
          status: options?.status,
        });
        const total = entities.length;
        const start = (page - 1) * pageSize;
        const data = entities.slice(start, start + pageSize).map(e => this.entityToTask(e));
        return { data, total, page, totalPages: Math.ceil(total / pageSize) };
      } catch { /* fallback to Map */ }
    }

    let tasks = Array.from(this.tasks.values()).filter((t) => t.tenantId === tenantId);

    if (options?.language) {
      tasks = tasks.filter((t) => t.language === options.language);
    }
    if (options?.status) {
      tasks = tasks.filter((t) => t.status === options.status);
    }

    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = tasks.length;
    const start = (page - 1) * pageSize;
    const data = tasks.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 删除 SDK 生成任务
   */
  async deleteTask(id: string): Promise<boolean> {
    if (!this.tasks.has(id)) {
      throw new SDKGeneratorServiceError(`SDK generation task not found: ${id}`, 'TASK_NOT_FOUND');
    }
    this.tasks.delete(id);
    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.delete(id).catch(() => { /* 持久化失败不阻塞 */ });
    }
    return true;
  }

  /**
   * 重新生成 SDK
   */
  async regenerateTask(id: string): Promise<SDKGenerationTask> {
    // Try repository first
    let task = this.tasks.get(id);
    if (!task && this.repository) {
      try {
        const entity = await this.repository.findById(id);
        if (entity) {
          task = this.entityToTask(entity);
          this.tasks.set(id, task); // update cache
        }
      } catch { /* fallback */ }
    }
    if (!task) {
      throw new SDKGeneratorServiceError(`SDK generation task not found: ${id}`, 'TASK_NOT_FOUND');
    }
    task.status = 'pending';
    task.output = '';
    task.error = null;
    task.completedAt = null;

    this.processTask(task.id).catch(() => { /* swallowed */ });

    return task;
  }

  /**
   * 获取 SDK 生成统计
   */
  async getStats(tenantId: string): Promise<{ total: number; completed: number; failed: number; pending: number }> {
    // Try repository first
    if (this.repository) {
      try {
        const entities = await this.repository.findByTenant(tenantId);
        return {
          total: entities.length,
          completed: entities.filter((t) => t.status === 'completed').length,
          failed: entities.filter((t) => t.status === 'failed').length,
          pending: entities.filter((t) => t.status === 'pending' || t.status === 'generating').length,
        };
      } catch { /* fallback to Map */ }
    }

    const tasks = Array.from(this.tasks.values()).filter((t) => t.tenantId === tenantId);
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      pending: tasks.filter((t) => t.status === 'pending' || t.status === 'generating').length,
    };
  }

  // ==================== Internal ====================

  /**
   * 模拟 SDK 生成过程
   */
  private async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'generating';

    // Simulate generation delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const config = LANGUAGE_CONFIGS[task.language];
      task.output = this.generateSampleCode(task, config);
      task.status = 'completed';
      task.completedAt = new Date();
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Unknown generation error';
      task.completedAt = new Date();
    }

    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.updateStatus(taskId, task.status, task.output, task.error || undefined).catch(() => {});
    }
  }

  /**
   * 生成示例 SDK 代码骨架
   */
  private generateSampleCode(task: SDKGenerationTask, config: SDKTemplateConfig): string {
    const className = task.packageName.replace(/[-_.]/g, '')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    switch (config.language) {
      case 'typescript':
        return `// Generated by Orion SDK Generator
// Package: ${task.packageName} v${task.version}
// HTTP Client: ${config.httpClient}

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class ${className}Client {
  private http: AxiosInstance;

  constructor(options: ClientOptions) {
    this.http = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { 'Authorization': \`Bearer \${options.apiKey}\` } : {}),
      },
    });
  }

  async request<T>(method: string, path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.http.request<T>({ method, url: path, data, ...config });
    return response.data;
  }
}

export default ${className}Client;`;

      case 'python':
        return `# Generated by Orion SDK Generator
# Package: ${task.packageName} v${task.version}
# HTTP Client: ${config.httpClient}

from typing import Optional, Any
import httpx

class ${className}Client:
    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout: float = 30.0):
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.Client(base_url=base_url, timeout=timeout, headers=headers)

    def request(self, method: str, path: str, data: Optional[Any] = None, **kwargs) -> Any:
        response = self._client.request(method, path, json=data, **kwargs)
        response.raise_for_status()
        return response.json()

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()`;

      case 'go':
        return `// Generated by Orion SDK Generator
// Package: ${task.packageName} v${task.version}
// HTTP Client: ${config.httpClient}

package ${task.packageName.replace(/-/g, '').replace(/\./g, '')}

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/http"
\t"time"
)

type Client struct {
\tBaseURL    string
\tHTTPClient *http.Client
\tAPIKey     string
}

func NewClient(baseURL string, apiKey string) *Client {
\treturn &Client{
\t\tBaseURL: baseURL,
\t\tAPIKey:  apiKey,
\t\tHTTPClient: &http.Client{Timeout: 30 * time.Second},
\t}
}

func (c *Client) Request(method, path string, body interface{}) (map[string]interface{}, error) {
\tvar reqBody io.Reader
\tif body != nil {
\t\tjsonBytes, err := json.Marshal(body)
\t\tif err != nil {
\t\t\treturn nil, fmt.Errorf("marshal body: %w", err)
\t\t}
\t\treqBody = bytes.NewReader(jsonBytes)
\t}
\treq, err := http.NewRequest(method, c.BaseURL+path, reqBody)
\tif err != nil {
\t\treturn nil, fmt.Errorf("create request: %w", err)
\t}
\treq.Header.Set("Content-Type", "application/json")
\tif c.APIKey != "" {
\t\treq.Header.Set("Authorization", "Bearer "+c.APIKey)
\t}
\tresp, err := c.HTTPClient.Do(req)
\tif err != nil {
\t\treturn nil, fmt.Errorf("do request: %w", err)
\t}
\tdefer resp.Body.Close()
\tvar result map[string]interface{}
\tif err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
\t\treturn nil, fmt.Errorf("decode response: %w", err)
\t}
\treturn result, nil
}`;

      case 'java':
        return `// Generated by Orion SDK Generator
// Package: ${task.packageName} v${task.version}
// HTTP Client: ${config.httpClient}

package ${task.packageName};

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class ${className}Client {
    private final OkHttpClient httpClient;
    private final String baseUrl;
    private final ObjectMapper mapper = new ObjectMapper();

    public ${className}Client(String baseUrl, String apiKey) {
        this.baseUrl = baseUrl;
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(chain -> {
                var req = chain.request().newBuilder()
                    .header("Content-Type", "application/json");
                if (apiKey != null && !apiKey.isEmpty()) {
                    req.header("Authorization", "Bearer " + apiKey);
                }
                return chain.proceed(req.build());
            })
            .build();
    }

    public Map<String, Object> request(String method, String path, Object body) throws IOException {
        RequestBody reqBody = body != null
            ? RequestBody.create(mapper.writeValueAsString(body), MediaType.parse("application/json"))
            : RequestBody.create(new byte[0], MediaType.parse("application/json"));

        Request request = new Request.Builder()
            .url(baseUrl + path)
            .method(method, reqBody)
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            return mapper.readValue(response.body().string(), Map.class);
        }
    }
}`;

      case 'csharp':
        return `// Generated by Orion SDK Generator
// Package: ${task.packageName} v${task.version}
// HTTP Client: ${config.httpClient}

using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace ${className}
{
    public class ${className}Client : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;

        public ${className}Client(string baseUrl, string? apiKey = null)
        {
            _baseUrl = baseUrl;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");
            if (!string.IsNullOrEmpty(apiKey))
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        }

        public async Task<JsonElement> RequestAsync(string method, string path, object? body = null)
        {
            var request = new HttpRequestMessage(new HttpMethod(method), _baseUrl + path);
            if (body != null)
                request.Content = new StringContent(
                    JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JsonElement>(json);
        }

        public void Dispose() => _httpClient.Dispose();
    }
}`;

      default:
        return `// Unsupported language: ${config.language}`;
    }
  }

  private entityToTask(entity: any): SDKGenerationTask {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      apiSpec: entity.apiSpec ?? '',
      language: entity.language,
      packageName: entity.packageName,
      version: entity.version ?? '1.0.0',
      status: entity.status ?? 'pending',
      output: entity.output ?? '',
      error: entity.error ?? null,
      createdAt: entity.created_at ? new Date(entity.created_at) : new Date(),
      completedAt: entity.completedAt ? new Date(entity.completedAt) : null,
    };
  }
}
