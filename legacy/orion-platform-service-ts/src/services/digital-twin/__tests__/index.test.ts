/**
 * Digital Twin module export verification tests
 */
describe('Digital Twin module exports', () => {
  it('should export ProductionSnapshotService', async () => {
    const mod = await import('../index');
    expect(mod.ProductionSnapshotService).toBeDefined();
    expect(typeof mod.ProductionSnapshotService).toBe('function');
  });

  it('should export TrafficRecordingService', async () => {
    const mod = await import('../index');
    expect(mod.TrafficRecordingService).toBeDefined();
    expect(typeof mod.TrafficRecordingService).toBe('function');
  });

  it('should export TrafficReplayService', async () => {
    const mod = await import('../index');
    expect(mod.TrafficReplayService).toBeDefined();
    expect(typeof mod.TrafficReplayService).toBe('function');
  });

  it('should export DigitalTwinRepository', async () => {
    const mod = await import('../index');
    expect(mod.DigitalTwinRepository).toBeDefined();
    expect(typeof mod.DigitalTwinRepository).toBe('function');
  });

  it('should export DigitalTwinError', async () => {
    const mod = await import('../index');
    expect(mod.DigitalTwinError).toBeDefined();
    expect(typeof mod.DigitalTwinError).toBe('function');
  });
});
