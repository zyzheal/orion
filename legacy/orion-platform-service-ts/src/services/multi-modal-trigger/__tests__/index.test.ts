/**
 * Multi-Modal Trigger module export verification tests
 */
describe('Multi-Modal Trigger module exports', () => {
  it('should export UnifiedTriggerService', async () => {
    const mod = await import('../index');
    expect(mod.UnifiedTriggerService).toBeDefined();
    expect(typeof mod.UnifiedTriggerService).toBe('function');
  });

  it('should export WebhookTriggerHandler', async () => {
    const mod = await import('../index');
    expect(mod.WebhookTriggerHandler).toBeDefined();
    expect(typeof mod.WebhookTriggerHandler).toBe('function');
  });

  it('should export ChatTriggerHandler', async () => {
    const mod = await import('../index');
    expect(mod.ChatTriggerHandler).toBeDefined();
    expect(typeof mod.ChatTriggerHandler).toBe('function');
  });
});
