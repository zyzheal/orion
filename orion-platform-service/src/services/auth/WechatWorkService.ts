/**
 * WeChat Work (企业微信) SSO Service
 *
 * Provides enterprise WeChat SSO authentication for orion-platform-service.
 * Migrated from orion-knowledge to unify authentication under platform SSO.
 *
 * Configuration via environment variables:
 *   WECHAT_WORK_CORP_ID     - Enterprise WeChat Corp ID
 *   WECHAT_WORK_AGENT_ID    - Agent ID for the application
 *   WECHAT_WORK_CORP_SECRET - Corp Secret for API access
 *   WECHAT_WORK_ENABLED     - Set to "true" to enable WeChat Work SSO
 *
 * OAuth Flow:
 *   1. User clicks "Login with WeChat Work" → redirect to authorization URL
 *   2. User authorizes → callback with code
 *   3. Exchange code for access_token → get user info
 *   4. Find or create local user → issue JWT
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// WeChat Work API endpoints
const WECHAT_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';
const AUTHORIZATION_URL = 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect';

export interface WechatWorkConfig {
  corpId: string;
  agentId: string;
  corpSecret: string;
  enabled: boolean;
}

export interface WechatWorkUserProfile {
  userid: string;          // 企业微信用户ID
  name: string;            // 姓名
  email?: string;          // 邮箱
  mobile?: string;         // 手机号
  department?: number[];   // 部门ID列表
  position?: string;       // 职位
  avatar?: string;         // 头像URL
}

export interface WechatWorkTokenResponse {
  access_token: string;
  expires_in: number;
  errcode: number;
  errmsg: string;
}

export interface WechatWorkUserInfoResponse {
  errcode: number;
  errmsg: string;
  userid: string;
  name: string;
  email?: string;
  mobile?: string;
  departments?: { id: number; name: string }[];
  position?: string;
  avatar?: string;
}

export interface LocalUserMapping {
  userId: string;          // 本地系统用户ID
  username: string;
  email: string;
  name: string;
  roles: string[];
  tenantId?: number;
}

/**
 * Token cache entry with expiration
 */
interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

/**
 * WeChat Work SSO Service
 *
 * Handles enterprise WeChat OAuth2 authentication flow.
 * Implements token caching to avoid excessive API calls.
 */
export class WechatWorkService {
  private config: WechatWorkConfig;
  private tokenCache: TokenCacheEntry | null = null;

  constructor(config: WechatWorkConfig) {
    this.config = config;
  }

  /**
   * Check if WeChat Work SSO is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !!(this.config.corpId && this.config.corpSecret);
  }

  /**
   * Get the authorization URL for redirecting users to WeChat Work SSO
   * @param redirectUri - The callback URL after authorization
   * @param state - CSRF protection state parameter
   * @returns Full authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    if (!this.isEnabled()) {
      throw new OrionError('WECHAT_WORK_SSO_DISABLED', ErrorCode.OPERATION_FAILED);
    }

    const params = new URLSearchParams({
      appid: this.config.corpId,
      agentid: this.config.agentId,
      redirect_uri: redirectUri,
      state: state,
    });

    return `${AUTHORIZATION_URL}?${params.toString()}`;
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get a valid access_token (with caching)
   * Tokens expire after ~7200 seconds, cache with 5-minute buffer
   */
  private async getAccessToken(): Promise<string> {
    if (!this.isEnabled()) {
      throw new OrionError('WECHAT_WORK_SSO_DISABLED', ErrorCode.OPERATION_FAILED);
    }

    // Check cache
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.tokenCache.token;
    }

    try {
      const url = `${WECHAT_API_BASE}/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.corpSecret}`;
      const response = await fetch(url);
      const data: WechatWorkTokenResponse = await response.json() as WechatWorkTokenResponse;

      if (data.errcode !== 0) {
        logger.error(`[WechatWorkService] Failed to get access_token: ${data.errmsg}`);
        throw new OrionError(`WECHAT_TOKEN_ERROR: ${data.errmsg}`, 'OPERATION_FAILED')
      }

      // Cache token with TTL (expires_in - 5 minute buffer)
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      };

      logger.info('[WechatWorkService] Access token refreshed');
      return data.access_token;
    } catch (error) {
      logger.error('[WechatWorkService] Failed to fetch access token:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for user information
   * @param code - Authorization code from callback
   * @returns WeChat Work user profile
   */
  async getUserInfo(code: string): Promise<WechatWorkUserProfile> {
    if (!this.isEnabled()) {
      throw new OrionError('WECHAT_WORK_SSO_DISABLED', ErrorCode.OPERATION_FAILED);
    }

    try {
      const accessToken = await this.getAccessToken();

      // Step 1: Exchange code for user ID
      const userIdUrl = `${WECHAT_API_BASE}/user/getuserinfo?access_token=${accessToken}&code=${code}`;
      const userIdResponse = await fetch(userIdUrl);
      const userIdData = await userIdResponse.json() as { errcode: number; errmsg: string; UserId?: string; OpenId?: string };

      if (userIdData.errcode !== 0) {
        logger.error(`[WechatWorkService] Failed to get user info: ${userIdData.errmsg}`);
        throw new OrionError(`WECHAT_USERINFO_ERROR: ${userIdData.errmsg}`, 'OPERATION_FAILED')
      }

      const userId = userIdData.UserId || userIdData.OpenId;
      if (!userId) {
        throw new OrionError('WECHAT_NO_USERID: No UserId or OpenId in response', ErrorCode.OPERATION_FAILED);
      }

      // Step 2: Get detailed user information
      const userDetailUrl = `${WECHAT_API_BASE}/user/get?access_token=${accessToken}&userid=${userId}`;
      const userDetailResponse = await fetch(userDetailUrl);
      const userData: WechatWorkUserInfoResponse = await userDetailResponse.json() as WechatWorkUserInfoResponse;

      if (userData.errcode !== 0) {
        logger.error(`[WechatWorkService] Failed to get user details: ${userData.errmsg}`);
        throw new OrionError(`WECHAT_USERDETAIL_ERROR: ${userData.errmsg}`, 'OPERATION_FAILED')
      }

      return {
        userid: userData.userid,
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile,
        department: userData.departments?.map((d) => d.id),
        position: userData.position,
        avatar: userData.avatar,
      };
    } catch (error) {
      logger.error('[WechatWorkService] Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Handle the complete OAuth callback flow
   * @param code - Authorization code from callback
   * @returns Local user mapping for JWT issuance
   */
  async handleCallback(code: string): Promise<LocalUserMapping> {
    const profile = await this.getUserInfo(code);

    logger.info(`[WechatWorkService] Authenticated user: ${profile.userid} (${profile.name})`);

    // Map WeChat user to local user
    return {
      userId: `wechat_${profile.userid}`,
      username: profile.userid,
      email: profile.email || `${profile.userid}@wechat.work`,
      name: profile.name,
      roles: ['user'],
    };
  }

  /**
   * Get safe config for admin UI (excludes secret)
   */
  getSafeConfig(): Omit<WechatWorkConfig, 'corpSecret'> | null {
    if (!this.isEnabled()) return null;

    return {
      corpId: this.config.corpId,
      agentId: this.config.agentId,
      enabled: this.config.enabled,
    };
  }

  /**
   * Test WeChat Work connection
   */
  async testConnection(): Promise<{ success: boolean; message?: string }> {
    if (!this.isEnabled()) {
      return { success: false, message: '企业微信 SSO 未启用' };
    }

    try {
      await this.getAccessToken();
      return { success: true, message: '企业微信 API 连接成功' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance for convenience
export const wechatWorkService = new WechatWorkService({
  corpId: process.env.WECHAT_WORK_CORP_ID || '',
  agentId: process.env.WECHAT_WORK_AGENT_ID || '',
  corpSecret: process.env.WECHAT_WORK_CORP_SECRET || '',
  enabled: process.env.WECHAT_WORK_ENABLED === 'true',
});
