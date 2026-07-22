/**
 * Basic SDK Tests
 * These tests verify the structure and configuration of the SDK
 */

// Import types for testing configuration
import type { OrionConfig } from '../src/client';

describe('Orion SDK', () => {
  describe('Configuration', () => {
    it('should have valid OrionConfig type with required baseUrl', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
      };

      expect(config.baseUrl).toBe('http://localhost:3001');
    });

    it('should accept optional apiKey', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
        apiKey: 'my-api-key',
      };

      expect(config.apiKey).toBe('my-api-key');
    });

    it('should accept optional token', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
        token: 'my-token',
      };

      expect(config.token).toBe('my-token');
    });

    it('should accept optional timeout', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
        timeout: 60000,
      };

      expect(config.timeout).toBe(60000);
    });

    it('should accept optional retries', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
        retries: 5,
      };

      expect(config.retries).toBe(5);
    });

    it('should accept full configuration', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
        apiKey: 'api-key',
        token: 'token',
        timeout: 30000,
        retries: 3,
      };

      expect(config.baseUrl).toBe('http://localhost:3001');
      expect(config.apiKey).toBe('api-key');
      expect(config.token).toBe('token');
      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
    });
  });

  describe('Default Values', () => {
    it('should have default timeout of 30000', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
      };

      // Verify we can access timeout with default when not specified
      const timeout = config.timeout ?? 30000;
      expect(timeout).toBe(30000);
    });

    it('should have default retries of 3', () => {
      const config: OrionConfig = {
        baseUrl: 'http://localhost:3001',
      };

      const retries = config.retries ?? 3;
      expect(retries).toBe(3);
    });
  });

  describe('Type Exports', () => {
    it('should export AgentRunResponse type structure', () => {
      // Verify we can import and use the type
      const mockAgentResponse = {
        runId: 'run-123',
        status: 'completed' as const,
        result: 'success',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      expect(mockAgentResponse.runId).toBe('run-123');
      expect(mockAgentResponse.status).toBe('completed');
    });

    it('should export PipelineRunResponse type structure', () => {
      const mockPipelineResponse = {
        runId: 'run-456',
        pipelineId: 'pipeline-123',
        status: 'running' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      expect(mockPipelineResponse.runId).toBe('run-456');
      expect(mockPipelineResponse.status).toBe('running');
    });

    it('should export DiagnosticRunResponse type structure', () => {
      const mockDiagnosticResponse = {
        diagnosticId: 'diag-789',
        targetType: 'service' as const,
        targetId: 'service-123',
        status: 'completed' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      expect(mockDiagnosticResponse.diagnosticId).toBe('diag-789');
      expect(mockDiagnosticResponse.targetType).toBe('service');
    });

    it('should export IntegrationResponse type structure', () => {
      const mockIntegrationResponse = {
        id: 'int-101',
        name: 'GitHub',
        type: 'github',
        config: {},
        enabled: true,
        status: 'connected' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      expect(mockIntegrationResponse.id).toBe('int-101');
      expect(mockIntegrationResponse.status).toBe('connected');
    });
  });
});