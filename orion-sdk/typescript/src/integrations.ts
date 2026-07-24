import { ApiBase } from './client';

/**
 * Integration request
 */
export interface IntegrationRequest {
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * Integration response
 */
export interface IntegrationResponse {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Integration connection test result
 */
export interface IntegrationTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Integration type info
 */
export interface IntegrationType {
  id: string;
  name: string;
  description: string;
}

/**
 * Integration API Module
 * Provides methods for managing third-party integrations
 */
export class IntegrationAPI extends ApiBase {
  /**
   * Create a new integration
   * @param request - Integration configuration
   */
  async create(request: IntegrationRequest): Promise<IntegrationResponse> {
    return this.post<IntegrationResponse>('/v1/integrations', request);
  }

  /**
   * List all integrations
   */
  async list(): Promise<IntegrationResponse[]> {
    return this.get<IntegrationResponse[]>('/v1/integrations');
  }

  /**
   * Get a specific integration by ID
   * @param id - The ID of the integration
   */
  async getById(id: string): Promise<IntegrationResponse> {
    return this.get<IntegrationResponse>(`/v1/integrations/${id}`);
  }

  /**
   * Update an existing integration
   * @param id - The ID of the integration
   * @param data - Updated integration data
   */
  async update(
    id: string,
    data: Partial<IntegrationRequest>
  ): Promise<IntegrationResponse> {
    return this.put<IntegrationResponse>(`/v1/integrations/${id}`, data);
  }

  /**
   * Delete an integration
   * @param id - The ID of the integration to delete
   */
  async remove(id: string): Promise<void> {
    await this.delete(`/v1/integrations/${id}`);
  }

  /**
   * Test connection for an integration
   * @param id - The ID of the integration
   */
  async testConnection(id: string): Promise<IntegrationTestResult> {
    return this.post<IntegrationTestResult>(
      `/v1/integrations/${id}/test`
    );
  }

  /**
   * Sync an integration
   * @param id - The ID of the integration
   */
  async sync(id: string): Promise<void> {
    await this.post(`/v1/integrations/${id}/sync`);
  }

  /**
   * Enable an integration
   * @param id - The ID of the integration
   */
  async enable(id: string): Promise<IntegrationResponse> {
    return this.post<IntegrationResponse>(`/v1/integrations/${id}/enable`);
  }

  /**
   * Disable an integration
   * @param id - The ID of the integration
   */
  async disable(id: string): Promise<IntegrationResponse> {
    return this.post<IntegrationResponse>(`/v1/integrations/${id}/disable`);
  }

  /**
   * Get integration types
   */
  async listTypes(): Promise<IntegrationType[]> {
    return this.get<IntegrationType[]>(
      '/v1/integrations/types'
    );
  }
}