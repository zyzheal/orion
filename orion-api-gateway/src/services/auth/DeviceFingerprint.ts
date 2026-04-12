/**
 * Device Fingerprint Service
 *
 * Generates and validates device fingerprints for JWT tokens
 * Based on User-Agent + IP/24 + DeviceID
 */

import { createHash } from 'crypto';
import { FastifyInstance } from 'fastify';

export interface DeviceInfo {
  userAgent: string;
  ip: string;
  deviceId?: string;
}

export interface DeviceFingerprintData {
  fingerprint: string;
  userAgent: string;
  ipPrefix: string; // IP/24
  deviceId?: string;
  createdAt: number;
  lastSeenAt: number;
  location?: string; // 地理位置信息（可选）
}

export interface AnomalousLoginEvent {
  userId: string;
  deviceId: string;
  fingerprint: string;
  previousIp: string;
  currentIp: string;
  previousLocation?: string;
  currentLocation?: string;
  timestamp: number;
}

export class DeviceFingerprintService {
  private redisClient: any;
  private readonly FINGERPRINT_PREFIX = 'device_fingerprint:';
  private readonly USER_DEVICES_PREFIX = 'user_devices:';
  private readonly FINGERPRINT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(private app: FastifyInstance) {
    this.redisClient = null;
  }

  /**
   * Set Redis client
   */
  setRedisClient(client: any): void {
    this.redisClient = client;
  }

  /**
   * Extract IP prefix (IP/24) for subnet-based comparison
   * This helps detect same network even with dynamic IPs
   */
  private extractIpPrefix(ip: string): string {
    // Handle IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length >= 3) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      }
    }
    // Handle IPv6 - use first 64 bits
    if (ip.includes(':')) {
      const parts = ip.split(':').slice(0, 4);
      return parts.join(':') + '::/64';
    }
    return ip;
  }

  /**
   * Generate device fingerprint from User-Agent + IP/24 + DeviceID
   */
  generateFingerprint(deviceInfo: DeviceInfo): string {
    const ipPrefix = this.extractIpPrefix(deviceInfo.ip);
    const data = [
      deviceInfo.userAgent || 'unknown',
      ipPrefix,
      deviceInfo.deviceId || '',
    ].join(':');

    return createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Store device fingerprint for a user
   */
  async storeFingerprint(
    userId: string,
    fingerprint: string,
    deviceInfo: DeviceInfo
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const now = Date.now();
    const data: DeviceFingerprintData = {
      fingerprint,
      userAgent: deviceInfo.userAgent || 'unknown',
      ipPrefix: this.extractIpPrefix(deviceInfo.ip),
      deviceId: deviceInfo.deviceId,
      createdAt: now,
      lastSeenAt: now,
    };

    // Store fingerprint data
    const key = `${this.FINGERPRINT_PREFIX}${userId}:${fingerprint}`;
    await this.redisClient.set(
      key,
      JSON.stringify(data),
      'PX',
      this.FINGERPRINT_TTL
    );

    // Add to user's device set
    const userDevicesKey = `${this.USER_DEVICES_PREFIX}${userId}`;
    await this.redisClient.sadd(userDevicesKey, fingerprint);
    await this.redisClient.expire(userDevicesKey, Math.floor(this.FINGERPRINT_TTL / 1000));
  }

  /**
   * Validate device fingerprint
   * Returns true if fingerprint matches, false otherwise
   */
  async validateFingerprint(
    userId: string,
    fingerprint: string
  ): Promise<boolean> {
    if (!this.redisClient) {
      return true; // Without Redis, skip validation
    }

    const key = `${this.FINGERPRINT_PREFIX}${userId}:${fingerprint}`;
    const data = await this.redisClient.get(key);

    if (!data) {
      return false;
    }

    // Update last seen time
    const fingerprintData: DeviceFingerprintData = JSON.parse(data);
    fingerprintData.lastSeenAt = Date.now();
    await this.redisClient.set(
      key,
      JSON.stringify(fingerprintData),
      'PX',
      this.FINGERPRINT_TTL
    );

    return true;
  }

  /**
   * Check if this is a new device for the user
   * Returns true if new device, false if known device
   */
  async isNewDevice(userId: string, fingerprint: string): Promise<boolean> {
    if (!this.redisClient) {
      return false;
    }

    const key = `${this.FINGERPRINT_PREFIX}${userId}:${fingerprint}`;
    const exists = await this.redisClient.exists(key);
    return exists === 0;
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceFingerprintData[]> {
    if (!this.redisClient) {
      return [];
    }

    const userDevicesKey = `${this.USER_DEVICES_PREFIX}${userId}`;
    const fingerprints = await this.redisClient.smembers(userDevicesKey);

    const devices: DeviceFingerprintData[] = [];
    for (const fp of fingerprints) {
      const key = `${this.FINGERPRINT_PREFIX}${userId}:${fp}`;
      const data = await this.redisClient.get(key);
      if (data) {
        devices.push(JSON.parse(data));
      }
    }

    return devices;
  }

  /**
   * Detect anomalous login (login from different location)
   * Returns AnomalousLoginEvent if detected, null otherwise
   */
  async detectAnomalousLogin(
    userId: string,
    currentFingerprint: string,
    currentIp: string,
    currentLocation?: string
  ): Promise<AnomalousLoginEvent | null> {
    if (!this.redisClient) {
      return null;
    }

    // Get user's known devices
    const devices = await this.getUserDevices(userId);

    // If no previous devices, this is not anomalous
    if (devices.length === 0) {
      return null;
    }

    // Check if current device is known
    const currentDevice = devices.find(d => d.fingerprint === currentFingerprint);
    if (currentDevice) {
      return null; // Known device, not anomalous
    }

    // Check for different IP subnet
    const currentIpPrefix = this.extractIpPrefix(currentIp);
    const knownSubnet = devices.some(d => d.ipPrefix === currentIpPrefix);

    // If same subnet but different device, it might be a new device in same network
    if (knownSubnet) {
      this.app.log.info(
        { userId, currentIpPrefix },
        'New device detected in known subnet'
      );
      return null;
    }

    // Different subnet = potentially anomalous login
    const previousDevice = devices[0]; // Get first known device for comparison
    const event: AnomalousLoginEvent = {
      userId,
      deviceId: currentFingerprint,
      fingerprint: currentFingerprint,
      previousIp: previousDevice.ipPrefix,
      currentIp,
      previousLocation: previousDevice.location,
      currentLocation,
      timestamp: Date.now(),
    };

    this.app.log.warn(
      { event },
      'Anomalous login detected: different location'
    );

    return event;
  }

  /**
   * Remove device fingerprint (for logout or device revocation)
   */
  async removeFingerprint(userId: string, fingerprint: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const key = `${this.FINGERPRINT_PREFIX}${userId}:${fingerprint}`;
    await this.redisClient.del(key);

    const userDevicesKey = `${this.USER_DEVICES_PREFIX}${userId}`;
    await this.redisClient.srem(userDevicesKey, fingerprint);
  }

  /**
   * Remove all devices for a user
   */
  async removeAllDevices(userId: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const devices = await this.getUserDevices(userId);
    for (const device of devices) {
      await this.removeFingerprint(userId, device.fingerprint);
    }
  }

  /**
   * Get fingerprint count for a user
   */
  async getDeviceCount(userId: string): Promise<number> {
    if (!this.redisClient) {
      return 0;
    }

    const userDevicesKey = `${this.USER_DEVICES_PREFIX}${userId}`;
    return await this.redisClient.scard(userDevicesKey);
  }
}