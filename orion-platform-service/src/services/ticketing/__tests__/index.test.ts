/**
 * Ticketing module export verification tests
 */
describe('Ticketing module exports', () => {
  it('should export TicketingRepository', async () => {
    const mod = await import('../index');
    expect(mod.TicketingRepository).toBeDefined();
    expect(typeof mod.TicketingRepository).toBe('function');
  });

  it('should export TicketingService', async () => {
    const mod = await import('../index');
    expect(mod.TicketingService).toBeDefined();
    expect(typeof mod.TicketingService).toBe('function');
  });

  it('should export TicketingServiceError', async () => {
    const mod = await import('../index');
    expect(mod.TicketingServiceError).toBeDefined();
    expect(typeof mod.TicketingServiceError).toBe('function');
  });

  it('should export TicketGenerator', async () => {
    const mod = await import('../index');
    expect(mod.TicketGenerator).toBeDefined();
    expect(typeof mod.TicketGenerator).toBe('function');
  });

  it('should export TicketWorkflowService', async () => {
    const mod = await import('../index');
    expect(mod.TicketWorkflowService).toBeDefined();
    expect(typeof mod.TicketWorkflowService).toBe('function');
  });

  it('should export TicketRelationAnalyzer', async () => {
    const mod = await import('../index');
    expect(mod.TicketRelationAnalyzer).toBeDefined();
    expect(typeof mod.TicketRelationAnalyzer).toBe('function');
  });

  it('should export TicketReportService', async () => {
    const mod = await import('../index');
    expect(mod.TicketReportService).toBeDefined();
    expect(typeof mod.TicketReportService).toBe('function');
  });

  it('should export TicketService', async () => {
    const mod = await import('../index');
    expect(mod.TicketService).toBeDefined();
    expect(typeof mod.TicketService).toBe('function');
  });

  it('should export DispatchEngine', async () => {
    const mod = await import('../index');
    expect(mod.DispatchEngine).toBeDefined();
    expect(typeof mod.DispatchEngine).toBe('function');
  });

  it('should export DispatchQueueManager', async () => {
    const mod = await import('../index');
    expect(mod.DispatchQueueManager).toBeDefined();
    expect(typeof mod.DispatchQueueManager).toBe('function');
  });

  it('should export LoadBalancer', async () => {
    const mod = await import('../index');
    expect(mod.LoadBalancer).toBeDefined();
    expect(typeof mod.LoadBalancer).toBe('function');
  });

  it('should export DispatchAnalytics', async () => {
    const mod = await import('../index');
    expect(mod.DispatchAnalytics).toBeDefined();
    expect(typeof mod.DispatchAnalytics).toBe('function');
  });

  it('should export TicketTransferService', async () => {
    const mod = await import('../index');
    expect(mod.TicketTransferService).toBeDefined();
    expect(typeof mod.TicketTransferService).toBe('function');
  });

  it('should export EngineerSuspendService', async () => {
    const mod = await import('../index');
    expect(mod.EngineerSuspendService).toBeDefined();
    expect(typeof mod.EngineerSuspendService).toBe('function');
  });

  it('should export TicketBIService', async () => {
    const mod = await import('../index');
    expect(mod.TicketBIService).toBeDefined();
    expect(typeof mod.TicketBIService).toBe('function');
  });
});
