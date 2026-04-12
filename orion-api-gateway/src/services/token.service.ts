/**
 * Token 管理服务
 *
 * 实现双 Token 机制（Access Token + Refresh Token）
 * - Access Token: 24 小时有效期
 * - Refresh Token: 7 天有效期
 * - 使用 Redis 存储 Refresh Token，支持并发刷新保护
 * - 设备指纹绑定
 * - 异地登录检测
 */

import { FastifyInstance } from 'fastify';
import { getConfig } from '../config';
import { generateId } from '../utils';
import { createHash } from 'crypto';
import {
  DeviceFingerprintService,
  DeviceInfo,
  AnomalousLoginEvent,
  TokenRefreshGuard,
  RefreshResult,
} from './auth';

export interface TokenPayload {
  sub: string; // 用户 ID
  email?: string;
  roles?: string[];
  permissions?: string[];
  deviceId?: string; // 设备指纹
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshTokenExpiresIn: number;
  anomalousLogin?: AnomalousLoginEvent; // 异地登录告警
}

export interface RefreshTokenData {
  userId: string;
  deviceId?: string;
  fingerprint?: string;
  jti: string; // Token ID，用于防止重放攻击
  exp: number;
}

export interface TokenRefreshOptions {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export class TokenService {
  private redisClient: any;
  private deviceFingerprintService: DeviceFingerprintService;
  private tokenRefreshGuard: TokenRefreshGuard;

  constructor(private app: FastifyInstance) {
    this.redisClient = null;
    this.deviceFingerprintService = new DeviceFingerprintService(app);
    this.tokenRefreshGuard = new TokenRefreshGuard(app);
  }

  /**
   * 设置 Redis 客户端
   */
  setRedisClient(client: any): void {
    this.redisClient = client;
    this.deviceFingerprintService.setRedisClient(client);
    this.tokenRefreshGuard.setRedisClient(client);
    this.tokenRefreshGuard.setDeviceFingerprintService(this.deviceFingerprintService);
  }

  /**
   * 生成设备指纹（基于 User-Agent + IP/24 + DeviceID）
   * 使用 DeviceFingerprintService 进行增强
   */
  generateDeviceFingerprint(userAgent?: string, ip?: string, deviceId?: string): string {
    const deviceInfo: DeviceInfo = {
      userAgent: userAgent || 'unknown',
      ip: ip || 'unknown',
      deviceId,
    };
    return this.deviceFingerprintService.generateFingerprint(deviceInfo);
  }

  /**
   * 生成 Access Token
   */
  async generateAccessToken(payload: TokenPayload): Promise<string> {
    const config = getConfig();

    return this.app.jwt.sign({
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      deviceId: payload.deviceId,
    });
  }

  /**
   * 生成 Refresh Token 并存储到 Redis
   */
  async generateRefreshToken(payload: {
    userId: string;
    deviceId?: string;
    fingerprint?: string;
  }): Promise<{ refreshToken: string; jti: string; expiresAt: number }> {
    const jti = generateId();
    const refreshToken = generateId() + generateId(); // 更长的随机字符串

    // Refresh Token 有效期 7 天
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const tokenData: RefreshTokenData = {
      userId: payload.userId,
      deviceId: payload.deviceId,
      fingerprint: payload.fingerprint,
      jti,
      exp: expiresAt,
    };

    // 存储到 Redis
    if (this.redisClient) {
      await this.redisClient.set(
        `refresh_token:${refreshToken}`,
        JSON.stringify(tokenData),
        'PX',
        7 * 24 * 60 * 60 * 1000 // 7 天
      );

      // 同时存储 jti 到已使用列表，用于防止重放攻击
      await this.redisClient.set(
        `used_jti:${jti}`,
        '1',
        'PX',
        7 * 24 * 60 * 60 * 1000
      );
    }

    return { refreshToken, jti, expiresAt };
  }

  /**
   * 验证并刷新 Token（使用 TokenRefreshGuard 进行保护）
   */
  async refreshTokens(
    refreshToken: string,
    options: TokenRefreshOptions = {}
  ): Promise<TokenPair | null> {
    if (!this.redisClient) {
      // 没有 Redis，直接返回 null
      return null;
    }

    // 先检查黑名单
    const isBlacklisted = await this.tokenRefreshGuard.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      this.app.log.warn({ refreshToken: refreshToken.substring(0, 8) }, 'Token is blacklisted');
      return null;
    }

    // 获取当前 token 数据
    const tokenDataStr = await this.redisClient.get(`refresh_token:${refreshToken}`);
    if (!tokenDataStr) {
      return null;
    }

    const tokenData: RefreshTokenData = JSON.parse(tokenDataStr);

    // 生成新的设备指纹
    const fingerprint = this.generateDeviceFingerprint(
      options.userAgent,
      options.ip,
      options.deviceId
    );

    // 使用 TokenRefreshGuard 处理刷新
    const result = await this.tokenRefreshGuard.handleRefresh(
      {
        refreshToken,
        userId: tokenData.userId,
        deviceId: options.deviceId || tokenData.deviceId,
        fingerprint,
        ip: options.ip || 'unknown',
        userAgent: options.userAgent,
      },
      async () => {
        // 生成新的 token 对
        const newRefreshResult = await this.generateRefreshToken({
          userId: tokenData.userId,
          deviceId: options.deviceId || tokenData.deviceId,
          fingerprint,
        });

        const accessToken = await this.generateAccessToken({
          sub: tokenData.userId,
          deviceId: options.deviceId || tokenData.deviceId,
        });

        return {
          accessToken,
          refreshToken: newRefreshResult.refreshToken,
          jti: newRefreshResult.jti,
        };
      }
    );

    if (!result.success) {
      this.app.log.warn(
        { refreshToken: refreshToken.substring(0, 8), revoked: result.revoked },
        'Token refresh failed'
      );
      return null;
    }

    return {
      accessToken: result.accessToken!,
      refreshToken: result.refreshToken!,
      expiresIn: result.expiresIn!,
      refreshTokenExpiresIn: result.refreshTokenExpiresIn!,
      anomalousLogin: result.anomalousLogin,
    };
  }

  /**
   * 生成完整的 Token 对
   */
  async generateTokenPair(
    payload: {
      userId: string;
      email?: string;
      roles?: string[];
      permissions?: string[];
    },
    deviceOptions?: TokenRefreshOptions
  ): Promise<TokenPair> {
    // 生成设备指纹
    const fingerprint = this.generateDeviceFingerprint(
      deviceOptions?.userAgent,
      deviceOptions?.ip,
      deviceOptions?.deviceId
    );

    const accessToken = await this.generateAccessToken({
      sub: payload.userId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      deviceId: deviceOptions?.deviceId,
    });

    const refreshResult = await this.generateRefreshToken({
      userId: payload.userId,
      deviceId: deviceOptions?.deviceId,
      fingerprint,
    });

    // 存储设备指纹
    if (this.redisClient && fingerprint) {
      await this.deviceFingerprintService.storeFingerprint(
        payload.userId,
        fingerprint,
        {
          userAgent: deviceOptions?.userAgent || 'unknown',
          ip: deviceOptions?.ip || 'unknown',
          deviceId: deviceOptions?.deviceId,
        }
      );
    }

    // 检测是否为新设备
    let anomalousLogin: AnomalousLoginEvent | undefined;
    if (this.redisClient && fingerprint) {
      const isNewDevice = await this.deviceFingerprintService.isNewDevice(
        payload.userId,
        fingerprint
      );

      if (!isNewDevice && deviceOptions?.ip) {
        // 如果不是新设备，检查是否有异地登录
        anomalousLogin = await this.deviceFingerprintService.detectAnomalousLogin(
          payload.userId,
          fingerprint,
          deviceOptions.ip
        );
      }
    }

    return {
      accessToken,
      refreshToken: refreshResult.refreshToken,
      expiresIn: 24 * 60 * 60, // 24 小时（秒）
      refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 天（秒）
      anomalousLogin,
    };
  }

  /**
   * 验证 Refresh Token
   */
  async validateRefreshToken(refreshToken: string): Promise<RefreshTokenData | null> {
    if (!this.redisClient) {
      return null;
    }

    // 先检查黑名单
    const isBlacklisted = await this.tokenRefreshGuard.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      return null;
    }

    const data = await this.redisClient.get(`refresh_token:${refreshToken}`);
    if (!data) {
      return null;
    }

    const tokenData: RefreshTokenData = JSON.parse(data);

    // 检查是否过期
    if (tokenData.exp < Date.now()) {
      await this.revokeToken(refreshToken);
      return null;
    }

    return tokenData;
  }

  /**
   * 撤销 Token（登出时调用）
   */
  async revokeToken(refreshToken: string): Promise<void> {
    if (this.redisClient) {
      const data = await this.redisClient.get(`refresh_token:${refreshToken}`);
      if (data) {
        const tokenData: RefreshTokenData = JSON.parse(data);
        // 同时删除 JTI 记录
        await this.redisClient.del(`used_jti:${tokenData.jti}`);
        // 添加到黑名单
        await this.tokenRefreshGuard.blacklistToken(refreshToken, tokenData.exp);
      }
      await this.redisClient.del(`refresh_token:${refreshToken}`);
    }
  }

  /**
   * 撤销用户所有 Token（强制下线）
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    // 使用 TokenRefreshGuard 的撤销方法
    await this.tokenRefreshGuard.revokeAllUserTokens(userId);

    // 同时移除所有设备指纹
    await this.deviceFingerprintService.removeAllDevices(userId);
  }

  /**
   * 验证设备指纹
   */
  async validateDeviceFingerprint(userId: string, fingerprint: string): Promise<boolean> {
    return this.deviceFingerprintService.validateFingerprint(userId, fingerprint);
  }

  /**
   * 获取用户所有设备
   */
  async getUserDevices(userId: string) {
    return this.deviceFingerprintService.getUserDevices(userId);
  }

  /**
   * 移除设备（设备解绑）
   */
  async removeDevice(userId: string, fingerprint: string): Promise<void> {
    await this.deviceFingerprintService.removeFingerprint(userId, fingerprint);
  }

  /**
   * 获取刷新审计日志
   */
  async getRefreshAuditLog(userId: string, limit?: number) {
    return this.tokenRefreshGuard.getRefreshAuditLog(userId, limit);
  }

  /**
   * 检查 Token 是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.tokenRefreshGuard.isTokenBlacklisted(token);
  }
}