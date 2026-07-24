/**
 * @file Tests for NatsServiceRegistry connection state
 * Verifies: isConnected is set to true after init(), enabling publishing
 */

import { NatsServiceRegistry } from '../nats-registry';

const mockDb = {
  query: async () => ({ rows: [], rowCount: 0 }),
};

describe('NatsServiceRegistry connection state', () => {
  let registry: NatsServiceRegistry;
  const mockConn = { publish: jest.fn() };

  afterEach(() => {
    registry?.setConnected(false); // stops heartbeat
    registry?.removeAllListeners();
  });

  test('should block publishing before init', async () => {
    registry = new NatsServiceRegistry(mockConn, mockDb as any);

    registry['isConnected'] = false;
    await (registry as any).publishRegistration({
      id: 'test', name: 'test', host: 'localhost', port: 3000,
      status: 'healthy', registeredAt: new Date(), lastHeartbeat: new Date(),
    });

    expect(mockConn.publish).not.toHaveBeenCalled();
  });

  test('should allow publishing after init', async () => {
    registry = new NatsServiceRegistry(mockConn, mockDb as any);

    expect(registry['isConnected']).toBe(false);
    await registry.init();
    expect(registry['isConnected']).toBe(true);

    await (registry as any).publishRegistration({
      id: 'test', name: 'test', host: 'localhost', port: 3000,
      status: 'healthy', registeredAt: new Date(), lastHeartbeat: new Date(),
    });

    expect(mockConn.publish).toHaveBeenCalled();
  });

  test('should set connected to false on setConnected(false)', async () => {
    registry = new NatsServiceRegistry(mockConn, mockDb as any);

    await registry.init();
    expect(registry['isConnected']).toBe(true);

    registry.setConnected(false);
    expect(registry['isConnected']).toBe(false);
  });
});
