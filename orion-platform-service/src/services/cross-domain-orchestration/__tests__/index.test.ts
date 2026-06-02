/**
 * Cross-Domain Orchestration module export verification tests
 */
describe('Cross-Domain Orchestration module exports', () => {
  it('should export CrossDomainOrchestrator', async () => {
    const mod = await import('../index');
    expect(mod.CrossDomainOrchestrator).toBeDefined();
    expect(typeof mod.CrossDomainOrchestrator).toBe('function');
  });

  it('should export DomainConnector', async () => {
    const mod = await import('../index');
    expect(mod.DomainConnector).toBeDefined();
    expect(typeof mod.DomainConnector).toBe('function');
  });
});
