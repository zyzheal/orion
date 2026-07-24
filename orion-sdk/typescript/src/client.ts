import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { AgentAPI } from './agents';
import { PipelineAPI } from './pipelines';
import { DiagnosticAPI } from './diagnostics';
import { IntegrationAPI } from './integrations';

/**
 * Orion Platform SDK Configuration
 */
export interface OrionConfig {
  /** Base URL of the Orion API (e.g., 'http://localhost:3001') */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Bearer token for authentication */
  token?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retries for 5xx errors (default: 3) */
  retries?: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message?: string;
}

/**
 * Abstract base class for all API modules
 * Provides common HTTP methods with retry logic
 */
abstract class ApiBase {
  protected client: AxiosInstance;
  protected baseUrl: string;

  constructor(client: AxiosInstance, baseUrl: string) {
    this.client = client;
    this.baseUrl = baseUrl;
  }

  /**
   * Perform GET request
   */
  protected async get<T = unknown>(
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(
      this.buildPath(path),
      config
    );
    return response.data.data;
  }

  /**
   * Perform POST request
   */
  protected async post<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(
      this.buildPath(path),
      data,
      config
    );
    return response.data.data;
  }

  /**
   * Perform PUT request
   */
  protected async put<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(
      this.buildPath(path),
      data,
      config
    );
    return response.data.data;
  }

  /**
   * Perform PATCH request
   */
  protected async patch<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(
      this.buildPath(path),
      data,
      config
    );
    return response.data.data;
  }

  /**
   * Perform DELETE request
   */
  protected async delete<T = unknown>(
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(
      this.buildPath(path),
      config
    );
    return response.data.data;
  }

  /**
   * Build full URL path, avoiding duplicate prefixes.
   * Note: axios already handles baseURL, so we only need to
   * ensure the path doesn't already include the baseURL.
   */
  protected buildPath(path: string): string {
    if (path.startsWith('http')) return path; // already absolute
    // If path already starts with our baseURL, use as-is (axios will handle it)
    if (path.startsWith(this.baseUrl)) {
      return path.replace(this.baseUrl.replace(/\/$/, ''), '');
    }
    return path;
  }
}

/**
 * Main Orion Platform SDK Client
 * Provides access to all API modules (agents, pipelines, diagnostics, integrations)
 */
export class OrionClient {
  public agents: AgentAPI;
  public pipelines: PipelineAPI;
  public diagnostics: DiagnosticAPI;
  public integrations: IntegrationAPI;

  private client: AxiosInstance;

  constructor(config: OrionConfig) {
    const {
      baseUrl,
      apiKey,
      token,
      timeout = 30000,
      retries = 3,
    } = config;

    // Create axios instance with retry logic
    this.client = axios.create({
      baseURL: baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    // Add retry interceptor for 5xx errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: unknown) => {
        const axiosError = error as { config?: AxiosRequestConfig & { _retryCount?: number }; response?: { status?: number } };

        if (!axiosError.config) {
          return Promise.reject(error);
        }

        const originalRequest = axiosError.config;
        const retryCount = originalRequest._retryCount || 0;

        // Retry on 5xx errors if retries remaining
        if (
          axiosError.response?.status &&
          axiosError.response.status >= 500 &&
          retryCount < retries
        ) {
          originalRequest._retryCount = retryCount + 1;
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );

    // Initialize sub-apis with proper Axios client
    this.agents = new AgentAPI(this.client, baseUrl);
    this.pipelines = new PipelineAPI(this.client, baseUrl);
    this.diagnostics = new DiagnosticAPI(this.client, baseUrl);
    this.integrations = new IntegrationAPI(this.client, baseUrl);
  }

  /**
   * Get the underlying axios client for custom requests
   */
  public getHttpClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Update authentication token
   */
  public setToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Close the underlying HTTP client and clean up resources
   */
  public close(): void {
    // Cancel any pending requests and clean up interceptors
    this.client.interceptors.request.clear();
    this.client.interceptors.response.clear();
  }
}

export { ApiBase };
export type { AxiosRequestConfig, AxiosResponse } from 'axios';