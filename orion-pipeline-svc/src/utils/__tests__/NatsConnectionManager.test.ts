import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NatsConnectionManager } from '../NatsConnectionManager';

// Mock the nats module
vi.mock('nats', () => {
  let closed = false;
  const mockNatsConnection = {
    get isClosedValue() { return closed; },
    isClosed: vi.fn().mockImplementation(() => closed),
    close: vi.fn().mockImplementation(async () => { closed = true; }),
    jetstreamManager: vi.fn().mockResolvedValue({}),
    status: vi.fn().mockImplementation(async function* () {
      yield { type: 'disconnect' };
    }),
    publish: vi.fn(),
    subscribe: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: vi.fn().mockImplementation(async function* () {
        yield {};
      }),
    }),
  };

  return {
    connect: vi.fn().mockResolvedValue(mockNatsConnection),
    JetStreamManager: vi.fn(),
    StringCodec: vi.fn().mockReturnValue({
      encode: vi.fn((str: string) => new TextEncoder().encode(str)),
      decode: vi.fn((data: Uint8Array) => new TextDecoder().decode(data)),
    }),
  };
});

describe('NatsConnectionManager', () => {
  let manager: NatsConnectionManager;

  beforeEach(() => {
    manager = new NatsConnectionManager({
      servers: ['nats://localhost:4222'],
      jetStreamEnabled: false,
    });
  });

  afterEach(async () => {
    await manager.close();
  });

  it('should connect to NATS successfully', async () => {
    const connection = await manager.connect();
    expect(connection).toBeDefined();
    expect(manager.isConnected()).toBe(true);
  });

  it('should return existing connection if already connected', async () => {
    const conn1 = await manager.connect();
    const conn2 = await manager.connect();
    expect(conn1).toBe(conn2);
  });

  it('should throw error when JetStream is not enabled and getJetStreamManager is called', async () => {
    await manager.connect();
    await expect(manager.getJetStreamManager()).rejects.toThrow('JetStream not enabled');
  });

  it('should report not connected before connect is called', () => {
    expect(manager.isConnected()).toBe(false);
  });

  it('should close connection successfully', async () => {
    await manager.connect();
    await manager.close();
    // After close, isClosed should return true on the mock
    expect(manager.isConnected()).toBe(false);
  });
});
