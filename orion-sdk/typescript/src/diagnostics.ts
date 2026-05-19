import { ApiBase } from './client';

/**
 * Diagnostic run request
 */
export interface DiagnosticRunRequest {
  targetType: 'service' | 'container' | 'pod' | 'node' | 'cluster';
  targetId: string;
  diagnosticTypes?: string[];
}

/**
 * Diagnostic run response
 */
export interface DiagnosticRunResponse {
  diagnosticId: string;
  targetType: 'service' | 'container' | 'pod' | 'node' | 'cluster';
  targetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosticTypes?: string[];
  results?: DiagnosticResult[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Individual diagnostic result
 */
export interface DiagnosticResult {
  type: string;
  status: 'pass' | 'warning' | 'fail';
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Diagnostic type info
 */
export interface DiagnosticType {
  id: string;
  name: string;
  description: string;
  category: string;
}

/**
 * Diagnostic API Module
 * Provides methods for running diagnostics on system components
 */
export class DiagnosticAPI extends ApiBase {
  /**
   * Run diagnostics on a target
   * @param targetType - Type of target (service, container, pod, node, cluster)
   * @param targetId - ID of the target
   * @param diagnosticTypes - Optional array of diagnostic types to run
   */
  async run(
    targetType: 'service' | 'container' | 'pod' | 'node' | 'cluster',
    targetId: string,
    diagnosticTypes?: string[]
  ): Promise<DiagnosticRunResponse> {
    return this.post<DiagnosticRunResponse>('/v1/diagnostics/run', {
      targetType,
      targetId,
      diagnosticTypes,
    });
  }

  /**
   * Get the status of a diagnostic run
   * @param diagnosticId - The ID of the diagnostic run
   */
  async getStatus(diagnosticId: string): Promise<DiagnosticRunResponse> {
    return this.get<DiagnosticRunResponse>(
      `/v1/diagnostics/${diagnosticId}/status`
    );
  }

  /**
   * List all available diagnostic types
   */
  async listTypes(): Promise<DiagnosticType[]> {
    return this.get<DiagnosticType[]>('/v1/diagnostics/types');
  }

  /**
   * Get diagnostic results
   * @param diagnosticId - The ID of the diagnostic run
   */
  async getResults(diagnosticId: string): Promise<DiagnosticRunResponse> {
    return this.get<DiagnosticRunResponse>(`/v1/diagnostics/${diagnosticId}`);
  }

  /**
   * List diagnostic history for a target
   * @param targetType - Type of target
   * @param targetId - ID of the target
   * @param limit - Maximum number of results (default: 20)
   */
  async listHistory(
    targetType: string,
    targetId: string,
    limit: number = 20
  ): Promise<DiagnosticRunResponse[]> {
    return this.get<DiagnosticRunResponse[]>(
      `/v1/diagnostics/history?targetType=${targetType}&targetId=${targetId}&limit=${limit}`
    );
  }

  /**
   * Cancel a running diagnostic
   * @param diagnosticId - The ID of the diagnostic run to cancel
   */
  async cancel(diagnosticId: string): Promise<void> {
    await this.post(`/v1/diagnostics/${diagnosticId}/cancel`);
  }
}