/**
 * Integration Service - Business logic for managing integrations
 *
 * Provides CRUD operations for integrations and sync management
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Connector,
  ConnectorCapability,
  ConnectorConfig,
  globalConnectorRegistry,
} from './ConnectorRegistry';
import { GitLabConnector } from './connectors/GitLabConnector';
import { JiraConnector } from './connectors/JiraConnector';
import { OrionError, ErrorCode } from '../../../errors';

// Auto-register built-in connectors
let connectorsRegistered = false;

function registerBuiltinConnectors(): void {
  if (connectorsRegistered) return;

  globalConnectorRegistry.register(new GitLabConnector());
  globalConnectorRegistry.register(new JiraConnector());
  connectorsRegistered = true;
}

// Database types (would be imported from repository in production)
export interface Integration {
  id: string;
  tenantId: string;
  provider: string;
  name: string;
  config: ConnectorConfig;
  status: 'active' | 'inactive' | 'error';
  lastSyncAt: Date | null;
  syncStatus: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationMapping {
  id: string;
  integrationId: string;
  resourceType: string;
  resourceId: string;
  externalId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  syncType: string;
  status: 'running' | 'success' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * IntegrationService - Manages external system integrations
 */
export class IntegrationService {
  private integrations: Map<string, Integration> = new Map();
  private mappings: Map<string, IntegrationMapping[]> = new Map();

  constructor() {
    registerBuiltinConnectors();
  }

  /**
   * Create a new integration
   */
  async createIntegration(params: {
    tenantId: string;
    provider: string;
    name: string;
    config: ConnectorConfig;
    createdBy?: string;
  }): Promise<Integration> {
    const { tenantId, provider, name, config, createdBy } = params;

    // Validate connector exists
    const connector = globalConnectorRegistry.get(provider);
    if (!connector) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Unknown provider: ${provider}. Available: ${this.listAvailableProviders().join(', ')}`);
    }

    // Validate config
    const isValid = await connector.validateConfig(config);
    if (!isValid) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Invalid configuration for ${provider}`);
    }

    // Test connection
    const connected = await connector.testConnection(config);
    if (!connected) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, `Failed to connect to ${provider}. Please check your credentials.`);
    }

    const integration: Integration = {
      id: uuidv4(),
      tenantId,
      provider,
      name,
      config: this.sanitizeConfig(config),
      status: 'active',
      lastSyncAt: null,
      syncStatus: null,
      errorMessage: null,
      createdBy: createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.integrations.set(integration.id, integration);
    return integration;
  }

  /**
   * Get integration by ID
   */
  async getIntegration(id: string): Promise<Integration | null> {
    return this.integrations.get(id) || null;
  }

  /**
   * List integrations for a tenant
   */
  async listIntegrations(tenantId: string, provider?: string): Promise<Integration[]> {
    const result: Integration[] = [];
    for (const integration of this.integrations.values()) {
      if (integration.tenantId === tenantId) {
        if (!provider || integration.provider === provider) {
          result.push(integration);
        }
      }
    }
    return result;
  }

  /**
   * Update integration
   */
  async updateIntegration(
    id: string,
    updates: Partial<Pick<Integration, 'name' | 'config' | 'status'>>
  ): Promise<Integration> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // If updating config, validate and test
    if (updates.config) {
      const connector = globalConnectorRegistry.get(integration.provider);
      if (connector) {
        const isValid = await connector.validateConfig(updates.config);
        if (!isValid) {
          throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid configuration');
        }
        const connected = await connector.testConnection(updates.config);
        if (!connected) {
          throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to connect with new configuration');
        }
        updates.config = this.sanitizeConfig(updates.config);
      }
    }

    const updated: Integration = {
      ...integration,
      ...updates,
      updatedAt: new Date(),
    };

    this.integrations.set(id, updated);
    return updated;
  }

  /**
   * Delete integration
   */
  async deleteIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Integration not found: ${id}`);
    }

    this.integrations.delete(id);
    this.mappings.delete(id);
  }

  /**
   * Execute action on a connector
   */
  async executeConnectorAction(
    integrationId: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Integration not found: ${integrationId}`);
    }

    if (integration.status !== 'active') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Integration is not active: ${integrationId}`);
    }

    const connector = globalConnectorRegistry.get(integration.provider);
    if (!connector) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Connector not found: ${integration.provider}`);
    }

    // Initialize connector with stored config
    await connector.initialize(integration.config);

    return connector.execute(action, params);
  }

  /**
   * Test connection for an integration
   */
  async testConnection(integrationId: string): Promise<boolean> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Integration not found: ${integrationId}`);
    }

    const connector = globalConnectorRegistry.get(integration.provider);
    if (!connector) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Connector not found: ${integration.provider}`);
    }

    return connector.testConnection(integration.config);
  }

  /**
   * Create resource mapping
   */
  async createMapping(params: {
    integrationId: string;
    resourceType: string;
    resourceId: string;
    externalId: string;
    metadata?: Record<string, unknown>;
  }): Promise<IntegrationMapping> {
    const { integrationId, resourceType, resourceId, externalId, metadata } = params;

    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Integration not found: ${integrationId}`);
    }

    const mapping: IntegrationMapping = {
      id: uuidv4(),
      integrationId,
      resourceType,
      resourceId,
      externalId,
      metadata: metadata || {},
      createdAt: new Date(),
    };

    const existing = this.mappings.get(integrationId) || [];
    existing.push(mapping);
    this.mappings.set(integrationId, existing);

    return mapping;
  }

  /**
   * Get mappings by resource
   */
  async getMappingsByResource(
    integrationId: string,
    resourceType: string,
    resourceId: string
  ): Promise<IntegrationMapping | null> {
    const mappings = this.mappings.get(integrationId) || [];
    return (
      mappings.find(
        (m) => m.resourceType === resourceType && m.resourceId === resourceId
      ) || null
    );
  }

  /**
   * Get mapping by external ID
   */
  async getMappingByExternalId(
    integrationId: string,
    externalId: string
  ): Promise<IntegrationMapping | null> {
    const mappings = this.mappings.get(integrationId) || [];
    return mappings.find((m) => m.externalId === externalId) || null;
  }

  /**
   * List available connector providers
   */
  listAvailableProviders(): string[] {
    return globalConnectorRegistry.listAll().map((c) => c.name);
  }

  /**
   * Get connector capabilities
   */
  getConnectorCapabilities(provider: string): ConnectorCapability[] {
    const connector = globalConnectorRegistry.get(provider);
    return connector?.capabilities || [];
  }

  /**
   * List all registered connectors
   */
  listConnectors(): { name: string; version: string; capabilities: ConnectorCapability[] }[] {
    return globalConnectorRegistry.listAll();
  }

  /**
   * Register a custom connector
   */
  registerConnector(connector: Connector): void {
    globalConnectorRegistry.register(connector);
  }

  /**
   * Remove sensitive data from config before storage
   */
  private sanitizeConfig(config: ConnectorConfig): ConnectorConfig {
    const sanitized = { ...config };
    // Remove sensitive fields from stored config
    delete sanitized.password;
    // Keep token but in production this would be encrypted
    return sanitized;
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();