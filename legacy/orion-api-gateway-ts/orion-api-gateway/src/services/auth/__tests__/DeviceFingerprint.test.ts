/**
 * Device Fingerprint Service Tests
 */

import { DeviceFingerprintService, DeviceInfo } from '../DeviceFingerprint';
import { FastifyInstance, FastifyBaseLogger } from 'fastify';

describe('DeviceFingerprintService', () => {
  let service: DeviceFingerprintService;
  let mockApp: Partial<FastifyInstance>;
  let mockLog: FastifyBaseLogger;

  beforeEach(() => {
    mockLog = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn().mockReturnThis(),
      level: 'info',
    } as unknown as FastifyBaseLogger;

    mockApp = {
      log: mockLog,
    };

    service = new DeviceFingerprintService(mockApp as FastifyInstance);
  });

  describe('generateFingerprint', () => {
    it('should generate a consistent fingerprint for same inputs', () => {
      const deviceInfo: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
        deviceId: 'device123',
      };

      const fingerprint1 = service.generateFingerprint(deviceInfo);
      const fingerprint2 = service.generateFingerprint(deviceInfo);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32);
    });

    it('should generate different fingerprints for different user agents', () => {
      const deviceInfo1: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
      };
      const deviceInfo2: DeviceInfo = {
        userAgent: 'Chrome/90.0',
        ip: '192.168.1.100',
      };

      const fingerprint1 = service.generateFingerprint(deviceInfo1);
      const fingerprint2 = service.generateFingerprint(deviceInfo2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate same fingerprint for IPs in same subnet', () => {
      const deviceInfo1: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
      };
      const deviceInfo2: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.200', // Different IP, same subnet
      };

      const fingerprint1 = service.generateFingerprint(deviceInfo1);
      const fingerprint2 = service.generateFingerprint(deviceInfo2);

      // Should be same because IP/24 is used
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for IPs in different subnets', () => {
      const deviceInfo1: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
      };
      const deviceInfo2: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.2.100', // Different subnet
      };

      const fingerprint1 = service.generateFingerprint(deviceInfo1);
      const fingerprint2 = service.generateFingerprint(deviceInfo2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle undefined device ID', () => {
      const deviceInfo: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
      };

      const fingerprint = service.generateFingerprint(deviceInfo);
      expect(fingerprint).toHaveLength(32);
    });

    it('should handle IPv6 addresses', () => {
      const deviceInfo: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      };

      const fingerprint = service.generateFingerprint(deviceInfo);
      expect(fingerprint).toHaveLength(32);
    });
  });

  describe('storeFingerprint', () => {
    it('should store fingerprint in Redis', async () => {
      const mockRedis = {
        set: jest.fn().mockResolvedValue('OK'),
        sadd: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      };

      service.setRedisClient(mockRedis as any);

      const deviceInfo: DeviceInfo = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.100',
        deviceId: 'device123',
      };
      const fingerprint = service.generateFingerprint(deviceInfo);

      await service.storeFingerprint('user123', fingerprint, deviceInfo);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'user_devices:user123',
        fingerprint
      );
    });

    it('should handle Redis not connected', async () => {
      await service.storeFingerprint('user123', 'fingerprint', {
        userAgent: 'Mozilla',
        ip: '192.168.1.1',
      });
      // Should not throw
    });
  });

  describe('validateFingerprint', () => {
    it('should return true when Redis is not connected', async () => {
      const result = await service.validateFingerprint('user123', 'fingerprint');
      expect(result).toBe(true);
    });

    it('should return true for valid fingerprint', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            fingerprint: 'fp123',
            userAgent: 'Mozilla/5.0',
            ipPrefix: '192.168.1.0/24',
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          })
        ),
        set: jest.fn().mockResolvedValue('OK'),
        exists: jest.fn().mockResolvedValue(1),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.validateFingerprint('user123', 'fp123');
      expect(result).toBe(true);
    });

    it('should return false for non-existent fingerprint', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.validateFingerprint('user123', 'fp123');
      expect(result).toBe(false);
    });
  });

  describe('isNewDevice', () => {
    it('should return true for new device', async () => {
      const mockRedis = {
        exists: jest.fn().mockResolvedValue(0),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.isNewDevice('user123', 'fp123');
      expect(result).toBe(true);
    });

    it('should return false for known device', async () => {
      const mockRedis = {
        exists: jest.fn().mockResolvedValue(1),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.isNewDevice('user123', 'fp123');
      expect(result).toBe(false);
    });

    it('should return false when Redis is not connected', async () => {
      const result = await service.isNewDevice('user123', 'fp123');
      expect(result).toBe(false);
    });
  });

  describe('getUserDevices', () => {
    it('should return empty array when Redis is not connected', async () => {
      const result = await service.getUserDevices('user123');
      expect(result).toEqual([]);
    });

    it('should return all devices for a user', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue(['fp1', 'fp2']),
        get: jest.fn().mockImplementation((key: string) => {
          if (key.includes('fp1')) {
            return JSON.stringify({
              fingerprint: 'fp1',
              userAgent: 'Mozilla/5.0',
              ipPrefix: '192.168.1.0/24',
              createdAt: Date.now(),
              lastSeenAt: Date.now(),
            });
          }
          if (key.includes('fp2')) {
            return JSON.stringify({
              fingerprint: 'fp2',
              userAgent: 'Chrome/90.0',
              ipPrefix: '192.168.2.0/24',
              createdAt: Date.now(),
              lastSeenAt: Date.now(),
            });
          }
          return null;
        }),
      };

      service.setRedisClient(mockRedis as any);

      const devices = await service.getUserDevices('user123');
      expect(devices).toHaveLength(2);
    });
  });

  describe('detectAnomalousLogin', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await service.detectAnomalousLogin(
        'user123',
        'fp123',
        '10.0.0.1'
      );
      expect(result).toBeNull();
    });

    it('should return null when no previous devices', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue([]),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.detectAnomalousLogin(
        'user123',
        'fp123',
        '10.0.0.1'
      );
      expect(result).toBeNull();
    });

    it('should return null when device is known', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue(['fp123']),
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            fingerprint: 'fp123',
            userAgent: 'Mozilla/5.0',
            ipPrefix: '192.168.1.0/24',
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          })
        ),
      };

      service.setRedisClient(mockRedis as any);

      const result = await service.detectAnomalousLogin(
        'user123',
        'fp123',
        '192.168.1.100'
      );
      expect(result).toBeNull();
    });

    it('should return null when new device but same subnet', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue(['fp_existing']),
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            fingerprint: 'fp_existing',
            userAgent: 'Chrome/90.0',
            ipPrefix: '192.168.1.0/24',
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          })
        ),
      };

      service.setRedisClient(mockRedis as any);

      // Different fingerprint but same subnet
      const result = await service.detectAnomalousLogin(
        'user123',
        'fp_new',
        '192.168.1.200'
      );
      expect(result).toBeNull();
    });

    it('should return event for truly anomalous login', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue(['fp_existing']),
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            fingerprint: 'fp_existing',
            userAgent: 'Mozilla/5.0',
            ipPrefix: '192.168.1.0/24',
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            location: 'Beijing',
          })
        ),
      };

      service.setRedisClient(mockRedis as any);

      // Different fingerprint and different subnet
      const result = await service.detectAnomalousLogin(
        'user123',
        'fp_new',
        '10.0.0.100', // Different subnet
        'Shanghai'
      );

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.previousIp).toBe('192.168.1.0/24');
      expect(result?.currentIp).toBe('10.0.0.100');
      expect(mockLog.warn).toHaveBeenCalled();
    });
  });

  describe('removeFingerprint', () => {
    it('should remove fingerprint from Redis', async () => {
      const mockRedis = {
        del: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
      };

      service.setRedisClient(mockRedis as any);

      await service.removeFingerprint('user123', 'fp123');

      expect(mockRedis.del).toHaveBeenCalledWith('device_fingerprint:user123:fp123');
      expect(mockRedis.srem).toHaveBeenCalledWith('user_devices:user123', 'fp123');
    });
  });

  describe('removeAllDevices', () => {
    it('should remove all devices for a user', async () => {
      const mockRedis = {
        smembers: jest.fn().mockResolvedValue(['fp1', 'fp2']),
        get: jest.fn().mockImplementation((key: string) =>
          JSON.stringify({
            fingerprint: key.includes('fp1') ? 'fp1' : 'fp2',
            userAgent: 'Mozilla/5.0',
            ipPrefix: '192.168.1.0/24',
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
          })
        ),
        del: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
      };

      service.setRedisClient(mockRedis as any);

      await service.removeAllDevices('user123');

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.srem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDeviceCount', () => {
    it('should return device count', async () => {
      const mockRedis = {
        scard: jest.fn().mockResolvedValue(3),
      };

      service.setRedisClient(mockRedis as any);

      const count = await service.getDeviceCount('user123');
      expect(count).toBe(3);
    });

    it('should return 0 when Redis is not connected', async () => {
      const count = await service.getDeviceCount('user123');
      expect(count).toBe(0);
    });
  });
});