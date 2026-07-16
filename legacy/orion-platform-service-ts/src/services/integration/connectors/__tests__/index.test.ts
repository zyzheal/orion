/**
 * integration/connectors index.ts export verification tests
 */

import * as ConnectorExports from '../index';

describe('connectors/index exports', () => {
  it('should export GitLabConnector', () => {
    expect(ConnectorExports.GitLabConnector).toBeDefined();
    expect(typeof ConnectorExports.GitLabConnector).toBe('function');
  });

  it('should export JiraConnector', () => {
    expect(ConnectorExports.JiraConnector).toBeDefined();
    expect(typeof ConnectorExports.JiraConnector).toBe('function');
  });

  it('should export ConnectorCapability enum', () => {
    expect(ConnectorExports.ConnectorCapability).toBeDefined();
    expect(ConnectorExports.ConnectorCapability.SourceControl).toBe('source:control');
  });

  it('should export globalConnectorRegistry', () => {
    expect(ConnectorExports.globalConnectorRegistry).toBeDefined();
  });

  it('should export ConnectorRegistry', () => {
    expect(ConnectorExports.ConnectorRegistry).toBeDefined();
    expect(typeof ConnectorExports.ConnectorRegistry).toBe('function');
  });
});
