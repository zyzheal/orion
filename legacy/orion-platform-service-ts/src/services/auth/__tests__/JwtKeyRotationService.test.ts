// orion-platform-service/src/services/auth/__tests__/JwtKeyRotationService.test.ts
import { JwtKeyRotationService, JwtKeyRotationConfig, JwtKey } from '../JwtKeyRotationService';

// Mock @kubernetes/client-node to avoid ESM import issues
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    loadFromCluster: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({
      readNamespacedSecret: jest.fn().mockResolvedValue({ body: { data: {} } }),
      createNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
      replaceNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
      deleteNamespacedSecret: jest.fn().mockResolvedValue({ body: {} }),
      listNamespacedSecret: jest.fn().mockResolvedValue({ body: { items: [] } }),
    }),
  })),
  CoreV1Api: jest.fn(),
}));

// Helper to parse $N param references from SQL
function extractParamValue(sql: string, paramName: string, params: any[]): any {
  const match = sql.match(new RegExp(`(\\w+)\\s*=\\s*\\$${paramName}`));
  if (!match) return undefined;
  const idx = parseInt(paramName, 10) - 1;
  return params[idx];
}

// Stateful mock db for JwtKeyRotationRepository queries
let keyStore: Map<string, any>;

function createMockDbPool() {
  keyStore = new Map();
  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // INSERT ... RETURNING *
      if (sql.includes('INSERT INTO jwt_key_rotation')) {
        const colsMatch = sql.match(/\(([^)]+)\)/);
        const cols = colsMatch ? colsMatch[1].split(', ').map((c) => c.trim()) : [];
        const row: any = { id: keyStore.size + 1 };
        cols.forEach((col, i) => {
          row[col] = params?.[i];
        });
        row.created_at = new Date();
        row.updated_at = new Date();
        keyStore.set(row.key_id, row);
        return { rows: [row], rowCount: 1 };
      }
      // UPDATE ... WHERE key_id = $N RETURNING *
      if (sql.includes('UPDATE jwt_key_rotation')) {
        // Parse WHERE key_id = $N
        const whereMatch = sql.match(/WHERE key_id = \$(\d+)/);
        const keyIdIdx = whereMatch ? parseInt(whereMatch[1], 10) - 1 : params!.length - 1;
        const keyId = params?.[keyIdIdx];
        const existing = keyStore.get(keyId);
        if (!existing) return { rows: [], rowCount: 0 };
        // Parse SET clauses
        const setMatch = sql.match(/SET (.+?) WHERE/);
        if (setMatch) {
          const assignments = setMatch[1].split(', ');
          for (const assignment of assignments) {
            const parts = assignment.split(' = ');
            const col = parts[0].trim();
            const paramRef = parts[1].trim();
            const paramMatch = paramRef.match(/\$(\d+)/);
            if (paramMatch) {
              const paramIdx = parseInt(paramMatch[1], 10) - 1;
              existing[col] = params?.[paramIdx];
            }
          }
        }
        existing.updated_at = new Date();
        keyStore.set(keyId, existing);
        return { rows: [existing], rowCount: 1 };
      }
      // SELECT ... WHERE status = ANY($1)
      if (sql.includes('status = ANY')) {
        const statuses = params?.[0] || [];
        const rows = Array.from(keyStore.values()).filter((r) => statuses.includes(r.status));
        return { rows, rowCount: rows.length };
      }
      // SELECT ... WHERE key_id = $1
      if (sql.includes('WHERE key_id = $1')) {
        const keyId = params?.[0];
        const row = keyStore.get(keyId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT ... WHERE status = 'active'
      if (sql.includes("WHERE status = 'active'")) {
        const rows = Array.from(keyStore.values()).filter((r) => r.status === 'active');
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: jest.fn(),
    transaction: jest.fn(),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up', latency: 1 }),
    close: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(true),
    getPoolSize: jest.fn().mockReturnValue(10),
    getIdleCount: jest.fn().mockReturnValue(5),
  };
}

describe('JwtKeyRotationService', () => {
  let service: JwtKeyRotationService;
  let mockDbPool: ReturnType<typeof createMockDbPool>;

  beforeEach(() => {
    mockDbPool = createMockDbPool();
    service = new JwtKeyRotationService(mockDbPool as any, {
      rotationIntervalDays: 90,
      overlapDays: 7,
      keyStrength: '256-bit',
    });
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('generateNewKey', () => {
    it('should generate a 256-bit key with correct properties', async () => {
      const key = await service.generateNewKey();

      expect(key.keyId).toBeDefined();
      expect(key.keyId).toMatch(/^jwt_key_\d+_[a-f0-9]{16}$/);
      expect(key.keyHash).toBeDefined();
      expect(key.keyHash.length).toBe(64); // SHA-256 produces 64 hex characters
      expect(key.keyStrength).toBe('256-bit');
      expect(key.status).toBe('pending');
      expect(key.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique key IDs', async () => {
      const key1 = await service.generateNewKey();
      const key2 = await service.generateNewKey();

      expect(key1.keyId).not.toBe(key2.keyId);
    });
  });

  describe('getCurrentActiveKey', () => {
    it('should return null when no key is active', () => {
      const key = service.getCurrentActiveKey();
      expect(key).toBeNull();
    });

    it('should return the active key after initialization', async () => {
      await service.initialize();
      const key = service.getCurrentActiveKey();

      expect(key).toBeDefined();
      expect(key?.status).toBe('active');
    });
  });

  describe('activateKey', () => {
    it('should activate a pending key', async () => {
      const newKey = await service.generateNewKey();
      expect(newKey.status).toBe('pending');

      await service.activateKey(newKey.keyId);

      const activeKey = service.getCurrentActiveKey();
      expect(activeKey?.keyId).toBe(newKey.keyId);
      expect(activeKey?.status).toBe('active');
      expect(activeKey?.activatedAt).toBeInstanceOf(Date);
    });

    it('should mark previous active key as expiring during overlap period', async () => {
      // Initialize creates and activates first key
      await service.initialize();
      const firstKey = service.getCurrentActiveKey();

      // Generate and activate new key
      const newKey = await service.generateNewKey();
      await service.activateKey(newKey.keyId);

      // First key should now be expiring
      const verificationKeys = service.getVerificationKeys();
      expect(verificationKeys).toHaveLength(2);
      expect(verificationKeys.find((k) => k.keyId === firstKey?.keyId)?.status).toBe('expiring');
      expect(verificationKeys.find((k) => k.keyId === newKey.keyId)?.status).toBe('active');
    });

    it('should throw error for non-existent key', async () => {
      await expect(service.activateKey('non-existent-key')).rejects.toThrow('Key not found');
    });
  });

  describe('getVerificationKeys', () => {
    it('should return empty array when no keys exist', () => {
      const keys = service.getVerificationKeys();
      expect(keys).toEqual([]);
    });

    it('should return active key only when no overlap', async () => {
      await service.initialize();
      const keys = service.getVerificationKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0].status).toBe('active');
    });

    it('should return both active and expiring keys during overlap', async () => {
      await service.initialize();
      const newKey = await service.generateNewKey();
      await service.activateKey(newKey.keyId);

      const keys = service.getVerificationKeys();
      expect(keys).toHaveLength(2);
      expect(keys.some((k) => k.status === 'active')).toBe(true);
      expect(keys.some((k) => k.status === 'expiring')).toBe(true);
    });
  });

  describe('calculateNextRotationDate', () => {
    it('should calculate next rotation date correctly', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const nextRotation = service.calculateNextRotationDate(now);

      expect(nextRotation.toISOString().slice(0, 10)).toBe('2026-04-01');
    });

    it('should use configured rotation interval', () => {
      const customMockDbPool = createMockDbPool();
      const customService = new JwtKeyRotationService(customMockDbPool as any, {
        rotationIntervalDays: 30,
        overlapDays: 7,
        keyStrength: '256-bit',
      });

      const now = new Date('2026-01-01T00:00:00Z');
      const nextRotation = customService.calculateNextRotationDate(now);

      expect(nextRotation.toISOString().slice(0, 10)).toBe('2026-01-31');

      customService.shutdown();
    });

    it('should handle year boundary correctly', () => {
      const now = new Date('2026-11-01T00:00:00Z');
      const nextRotation = service.calculateNextRotationDate(now);

      // 90 days from Nov 1 should be around Jan 30, 2027
      expect(nextRotation.getFullYear()).toBe(2027);
    });
  });

  describe('key status management', () => {
    it('should support all key statuses: pending, active, expiring, expired', async () => {
      const key = await service.generateNewKey();
      expect(key.status).toBe('pending');

      await service.activateKey(key.keyId);
      const activeKey = service.getCurrentActiveKey();
      expect(activeKey?.status).toBe('active');

      // Generate new key to trigger overlap
      const newKey = await service.generateNewKey();
      await service.activateKey(newKey.keyId);

      // Previous key should be expiring
      const keys = service.getVerificationKeys();
      const expiringKey = keys.find((k) => k.keyId === key.keyId);
      expect(expiringKey?.status).toBe('expiring');
    });
  });

  describe('events', () => {
    it('should emit key:activated event when a key is activated', async () => {
      const eventHandler = jest.fn();
      service.on('key:activated', eventHandler);

      const key = await service.generateNewKey();
      await service.activateKey(key.keyId);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          keyId: key.keyId,
          status: 'active',
        }),
      );
    });

    it('should emit rotation:completed event after rotation', async () => {
      const eventHandler = jest.fn();
      service.on('rotation:completed', eventHandler);

      await service.initialize();
      const newKey = await service.generateNewKey();
      await service.activateKey(newKey.keyId);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('key strength options', () => {
    it('should support 128-bit keys', async () => {
      const customMockDbPool = createMockDbPool();
      const customService = new JwtKeyRotationService(customMockDbPool as any, {
        rotationIntervalDays: 90,
        overlapDays: 7,
        keyStrength: '128-bit',
      });

      const key = await customService.generateNewKey();
      expect(key.keyStrength).toBe('128-bit');

      customService.shutdown();
    });

    it('should support 192-bit keys', async () => {
      const customMockDbPool = createMockDbPool();
      const customService = new JwtKeyRotationService(customMockDbPool as any, {
        rotationIntervalDays: 90,
        overlapDays: 7,
        keyStrength: '192-bit',
      });

      const key = await customService.generateNewKey();
      expect(key.keyStrength).toBe('192-bit');

      customService.shutdown();
    });
  });

  describe('overlap period', () => {
    it('should set correct expiration for expiring key', async () => {
      await service.initialize();
      const firstKey = service.getCurrentActiveKey();

      const newKey = await service.generateNewKey();
      await service.activateKey(newKey.keyId);

      const keys = service.getVerificationKeys();
      const expiringKey = keys.find((k) => k.keyId === firstKey?.keyId);

      // Expiring key should have expiresAt set
      expect(expiringKey?.expiresAt).toBeDefined();

      // Should expire in approximately 7 days (overlap period)
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(expiringKey!.expiresAt!.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(5000); // Within 5 seconds tolerance
    });
  });

  describe('restart recovery', () => {
    it('should trigger rotation immediately when overlap window has already passed', async () => {
      // Step 1: Initialize and create an active key
      await service.initialize();
      const initialKey = service.getCurrentActiveKey();
      expect(initialKey).toBeDefined();
      expect(initialKey?.status).toBe('active');

      // Step 2: Shutdown (clears timer)
      service.shutdown();

      // Step 3: Simulate process restart with a key that has an expired overlap window
      // Directly manipulate the stored key to set expiresAt in the past
      const pastExpiry = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // expired 10 days ago
      const updatedRow = await mockDbPool.query(
        'UPDATE jwt_key_rotation SET expires_at = $1, status = $2 WHERE key_id = $3 RETURNING *',
        [pastExpiry, 'active', initialKey!.keyId],
      );
      keyStore.set(initialKey!.keyId, updatedRow.rows[0]);

      // Step 4: Create new service instance and initialize (simulates restart)
      const restartedService = new JwtKeyRotationService(mockDbPool as any, {
        rotationIntervalDays: 90,
        overlapDays: 7,
        keyStrength: '256-bit',
      });

      const rotationCompletedHandler = jest.fn();
      restartedService.on('rotation:completed', rotationCompletedHandler);

      // Step 5: Initialize should trigger rotation immediately since overlap window passed
      await restartedService.initialize();

      // Should have emitted rotation:completed because overlap window was in the past
      expect(rotationCompletedHandler).toHaveBeenCalled();

      // After rotation, there should be a new active key
      const newActiveKey = restartedService.getCurrentActiveKey();
      expect(newActiveKey).toBeDefined();
      expect(newActiveKey?.keyId).not.toBe(initialKey?.keyId);
      expect(newActiveKey?.status).toBe('active');

      restartedService.shutdown();
    });

    it('should schedule timer normally when overlap window is in the future', async () => {
      // Initialize with a key that has a future expiry
      await service.initialize();
      const initialKey = service.getCurrentActiveKey();
      expect(initialKey?.expiresAt).toBeDefined();

      // Shutdown and restart
      service.shutdown();

      const restartedService = new JwtKeyRotationService(mockDbPool as any, {
        rotationIntervalDays: 90,
        overlapDays: 7,
        keyStrength: '256-bit',
      });

      const rotationCompletedHandler = jest.fn();
      restartedService.on('rotation:completed', rotationCompletedHandler);

      await restartedService.initialize();

      // Should NOT have emitted rotation:completed yet (timer is pending)
      expect(rotationCompletedHandler).not.toHaveBeenCalled();

      // Should have a timer scheduled
      expect(restartedService['rotationTimer']).toBeDefined();

      restartedService.shutdown();
    });
  });
});
