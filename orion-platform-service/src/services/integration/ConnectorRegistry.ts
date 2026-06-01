import { OrionError } from '../../errors';
import { ConnectorRegistryRepository } from '../../repositories/ConnectorRegistryRepository';
/**
 * Connector Registry - Unified connector system for external integrations
 *
 * Provides a plugin-based architecture for integrating with external systems
 * like GitLab, Jira, GitHub, Slack, etc.
 */

export enum ConnectorCapability {
  SourceControl = 'source:control',
  SourceRead = 'source:read',
  IssueTracker = 'issue:tracker',
  CICD = 'ci:cd',
  Notification = 'notification',
  Monitoring = 'monitoring',
  ArtifactRegistry = 'artifact:registry',
  CloudProvider = 'cloud:provider',
  SecurityScan = 'security:scan',
}

export interface ConnectorConfig {
  host?: string;
  token?: string;
  username?: string;
  password?: string;
  organization?: string;
  project?: string;
  apiVersion?: string;
  webhookSecret?: string;
  [key: string]: unknown;
}

export interface IntegrationEvent {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  externalId?: string;
}

export interface Connector {
  name: string;
  version: string;
  capabilities: ConnectorCapability[];
  initialize(config: ConnectorConfig): Promise<void>;
  validateConfig(config: ConnectorConfig): Promise<boolean>;
  testConnection(config: ConnectorConfig): Promise<boolean>;
  execute(action: string, params: Record<string, unknown>): Promise<unknown>;
  transformEvent?(rawEvent: unknown): IntegrationEvent;
  disconnect?(): Promise<void>;
}

export interface ConnectorInfo {
  name: string;
  version: string;
  capabilities: ConnectorCapability[];
}

export class ConnectorRegistry {
  private connectors: Map<string, Connector> = new Map();
  private repo: ConnectorRegistryRepository | null;
  private tenantId: string;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, tenantId?: string) {
    this.repo = db ? new ConnectorRegistryRepository(db) : null;
    this.tenantId = tenantId || 'default';
  }

  /**
   * Register a connector with the registry
   */
  register(connector: Connector): void {
    if (this.connectors.has(connector.name)) {
      throw new OrionError(`Connector with name '${connector.name}' is already registered`, 'VALIDATION_ERROR')
    }
    this.connectors.set(connector.name, connector);

    // Persist registration metadata to PostgreSQL (fire-and-forget)
    this.repo?.upsertByName(connector.name, {
      version: connector.version,
      capabilities: JSON.stringify(connector.capabilities),
      tenantId: this.tenantId,
    }).catch(() => {});
  }

  /**
   * Get a connector by name
   */
  get(name: string): Connector | undefined {
    return this.connectors.get(name);
  }

  /**
   * Get all connectors that support a specific capability
   */
  getByCapability(capability: ConnectorCapability): Connector[] {
    const result: Connector[] = [];
    for (const connector of this.connectors.values()) {
      if (connector.capabilities.includes(capability)) {
        result.push(connector);
      }
    }
    return result;
  }

  /**
   * List all registered connectors
   */
  listAll(): ConnectorInfo[] {
    const result: ConnectorInfo[] = [];
    for (const connector of this.connectors.values()) {
      result.push({
        name: connector.name,
        version: connector.version,
        capabilities: connector.capabilities,
      });
    }
    return result;
  }

  /**
   * Check if a connector is registered
   */
  has(name: string): boolean {
    return this.connectors.has(name);
  }

  /**
   * Unregister a connector
   */
  unregister(name: string): boolean {
    const deleted = this.connectors.delete(name);
    // Remove from PostgreSQL (fire-and-forget)
    if (deleted && this.repo) {
      this.repo.findByName(name).then(entity => {
        if (entity) {
          this.repo!.delete(entity.id).catch(() => {});
        }
      }).catch(() => {});
    }
    return deleted;
  }

  /**
   * Clear all connectors
   */
  clear(): void {
    this.connectors.clear();
    // Note: PostgreSQL records are not cleared on clear() to preserve audit trail
  }
}

// Global registry instance
export const globalConnectorRegistry = new ConnectorRegistry();