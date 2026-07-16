/**
 * Integration Module - Unified connector system for external integrations
 *
 * Export all integration components and auto-register built-in connectors
 */

export {
  ConnectorCapability,
  ConnectorRegistry,
  globalConnectorRegistry,
} from './ConnectorRegistry';

export type {
  Connector,
  ConnectorConfig,
  IntegrationEvent,
  ConnectorInfo,
} from './ConnectorRegistry';

export { IntegrationService, integrationService } from './IntegrationService';

export type {
  Integration,
  IntegrationMapping,
  IntegrationSyncLog,
} from './IntegrationService';

// Export all built-in connectors
export { GitLabConnector } from './connectors/GitLabConnector';
export { JiraConnector } from './connectors/JiraConnector';

// Auto-register built-in connectors on first import
import { globalConnectorRegistry } from './ConnectorRegistry';
import { GitLabConnector } from './connectors/GitLabConnector';
import { JiraConnector } from './connectors/JiraConnector';

// Register connectors if not already registered
if (!globalConnectorRegistry.has('gitlab')) {
  globalConnectorRegistry.register(new GitLabConnector());
}

if (!globalConnectorRegistry.has('jira')) {
  globalConnectorRegistry.register(new JiraConnector());
}