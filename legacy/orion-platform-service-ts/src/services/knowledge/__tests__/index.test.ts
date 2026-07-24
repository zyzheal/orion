/**
 * Knowledge module export verification tests
 */
describe('Knowledge module exports', () => {
  it('should export KnowledgeRepository', async () => {
    const mod = await import('../index');
    expect(mod.KnowledgeRepository).toBeDefined();
    expect(typeof mod.KnowledgeRepository).toBe('function');
  });

  it('should export KnowledgeService', async () => {
    const mod = await import('../index');
    expect(mod.KnowledgeService).toBeDefined();
    expect(typeof mod.KnowledgeService).toBe('function');
  });

  it('should export KnowledgeServiceError', async () => {
    const mod = await import('../index');
    expect(mod.KnowledgeServiceError).toBeDefined();
    expect(typeof mod.KnowledgeServiceError).toBe('function');
  });
});
