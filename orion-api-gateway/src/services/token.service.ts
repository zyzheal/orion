/**
 * Token 管理服务
 *
 * 实现双 Token 机制（Access Token + Refresh Token）
 * - Access Token: 24 小时有效期
 * - Refresh Token: 7 天有效期
 * - 使用 Redis 存储 Refresh Token，支持并发刷新保护
 */

import { FastifyInstance } from 'fastify';
import { getConfig } from '../config';
import { generateId } from '../utils';
import { createHash } from 'crypto';

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
}

export interface RefreshTokenData {
  userId: string;
  deviceId?: string;
  jti: string; // Token ID，用于防止重放攻击
  exp: number;
}

export class TokenService {
  private redisClient: any;

  constructor(private app: FastifyInstance) {
    this.redisClient = null;
  }

  /**
   * 设置 Redis 客户端
   */
  setRedisClient(client: any): void {
    this.redisClient = client;
  }

  /**
   * 生成设备指纹（基于 User-Agent + IP）
   */
  generateDeviceFingerprint(userAgent?: string, ip?: string): string {
    const data = `${userAgent || 'unknown'}:${ip || 'unknown'}:${generateId()}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 32);
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
  }): Promise<{ refreshToken: string; jti: string; expiresAt: number }> {
    const jti = generateId();
    const refreshToken = generateId() + generateId(); // 更长的随机字符串

    // Refresh Token 有效期 7 天
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const tokenData: RefreshTokenData = {
      userId: payload.userId,
      deviceId: payload.deviceId,
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
   * 验证并刷新 Token（使用 Lua 脚本保证原子性）
   */
  async refreshTokens(refreshToken: string, deviceId?: string): Promise<TokenPair | null> {
    if (!this.redisClient) {
      // 没有 Redis，直接返回 null
      return null;
    }

    // 使用 Lua 脚本进行原子操作
    const luaScript = `
      local refreshTokenKey = KEYS[1]
      local usedJtiKey = KEYS[2]
      local deviceId = ARGV[1]

      -- 1. 获取 Refresh Token 数据
      local tokenData = redis.call('GET', refreshTokenKey)
      if not tokenData then
        return nil
      end

      local data = cjson.decode(tokenData)

      -- 2. 检查设备指纹是否匹配
      if deviceId and data.deviceId and data.deviceId ~= deviceId then
        return nil
      end

      -- 3. 检查 JTI 是否已被使用（防止重放攻击）
      local jtiUsed = redis.call('GET', usedJtiKey)
      if jtiUsed then
        -- Token 已被使用，删除旧 token
        redis.call('DEL', refreshTokenKey)
        return nil
      end

      -- 4. 标记 JTI 为已使用
      redis.call('SET', usedJtiKey, '1', 'PX', 604800000)

      -- 5. 删除旧的 Refresh Token
      redis.call('DEL', refreshTokenKey)

      -- 6. 返回用户信息
      return cjson.encode({ userId = data.userId, deviceId = data.deviceId })
    `;

    try {
      const result = await this.redisClient.eval(
        luaScript,
        2,
        `refresh_token:${refreshToken}`,
        `used_jti:${refreshToken}`,
        deviceId || ''
      );

      if (!result) {
        return null;
      }

      const data = typeof result === 'string' ? JSON.parse(result) : result;

      // 生成新的 Token 对
      const newRefreshResult = await this.generateRefreshToken({
        userId: data.userId,
        deviceId: data.deviceId,
      });

      const accessToken = await this.generateAccessToken({
        sub: data.userId,
        deviceId: data.deviceId,
      });

      return {
        accessToken,
        refreshToken: newRefreshResult.refreshToken,
        expiresIn: 24 * 60 * 60, // 24 小时
        refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 天
      };
    } catch (error) {
      this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Token refresh failed');
      return null;
    }
  }

  /**
   * 生成完整的 Token 对
   */
  async generateTokenPair(payload: {
    userId: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    deviceId?: string;
  }): Promise<TokenPair> {
    const accessToken = await this.generateAccessToken({
      sub: payload.userId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      deviceId: payload.deviceId,
    });

    const refreshResult = await this.generateRefreshToken({
      userId: payload.userId,
      deviceId: payload.deviceId,
    });

    return {
      accessToken,
      refreshToken: refreshResult.refreshToken,
      expiresIn: 24 * 60 * 60, // 24 小时（秒）
      refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 天（秒）
    };
  }

  /**
   * 验证 Refresh Token
   */
  async validateRefreshToken(refreshToken: string): Promise<RefreshTokenData | null> {
    if (!this.redisClient) {
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

    // 查找所有属于该用户的 Refresh Token
    const keys = await this.redisClient.keys(`refresh_token:*`);
    for (const key of keys) {
      const data = await this.redisClient.get(key);
      if (data) {
        const tokenData: RefreshTokenData = JSON.parse(data);
        if (tokenData.userId === userId) {
          const refreshToken = key.replace('refresh_token:', '');
          await this.revokeToken(refreshToken);
        }
      }
    }
  }
}
