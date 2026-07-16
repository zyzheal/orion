/**
 * integration index.ts export verification tests
 */

import * as IntegrationExports from '../index';

describe('integration index exports', () => {
  it('should export ConnectorCapability enum', () => {
    expect(IntegrationExports.ConnectorCapability).toBeDefined();
    expect(IntegrationExports.ConnectorCapability.SourceControl).toBe('source:control');
  });

  it('should export ConnectorRegistry class', () => {
    expect(IntegrationExports.ConnectorRegistry).toBeDefined();
    expect(typeof IntegrationExports.ConnectorRegistry).toBe('function');
  });

  it('should export globalConnectorRegistry instance', () => {
    expect(IntegrationExports.globalConnectorRegistry).toBeDefined();
  });

  it('should export IntegrationService class', () => {
    expect(IntegrationExports.IntegrationService).toBeDefined();
    expect(typeof IntegrationExports.IntegrationService).toBe('function');
  });

  it('should export integrationService singleton', () => {
    expect(IntegrationExports.integrationService).toBeDefined();
    expect(IntegrationExports.integrationService).toBeInstanceOf(IntegrationExports.IntegrationService);
  });

  it('should export GitLabConnector class', () => {
    expect(IntegrationExports.GitLabConnector).toBeDefined();
    expect(typeof IntegrationExports.GitLabConnector).toBe('function');
  });

  it('should export JiraConnector class', () => {
    expect(IntegrationExports.JiraConnector).toBeDefined();
    expect(typeof IntegrationExports.JiraConnector).toBe('function');
  });
});
