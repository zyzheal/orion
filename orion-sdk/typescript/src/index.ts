/**
 * Orion Platform TypeScript SDK
 *
 * A comprehensive SDK for interacting with the Orion Platform API.
 *
 * @packageDocumentation
 */

// Core client
export { OrionClient, ApiBase, OrionConfig, ApiResponse } from './client';

// Agent API
export {
  AgentAPI,
  AgentRunRequest,
  AgentRunResponse,
  AgentStatusResponse,
  AgentInfo,
} from './agents';

// Pipeline API
export {
  PipelineAPI,
  PipelineExecuteRequest,
  PipelineRunResponse,
  PipelineStage,
  PipelineLogResponse,
  PipelineInfo,
} from './pipelines';

// Diagnostic API
export {
  DiagnosticAPI,
  DiagnosticRunRequest,
  DiagnosticRunResponse,
  DiagnosticResult,
  DiagnosticType,
} from './diagnostics';

// Integration API
export {
  IntegrationAPI,
  IntegrationRequest,
  IntegrationResponse,
  IntegrationTestResult,
} from './integrations';

// Re-export axios types for advanced usage
export type {
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';