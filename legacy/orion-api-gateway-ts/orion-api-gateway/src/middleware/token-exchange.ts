/**
 * Token Exchange 中间件
 *
 * 用于子应用认证代理：当请求转发到外部服务（如 PandaWiki）时，
 * 将 Orion JWT token 替换为该服务的动态获取的 token。
 *
 * 工作流程：
 * 1. 前端携带 Orion token 请求 /api/v1/knowledge_base/*
 * 2. Gateway 获取目标服务的有效 token（自动登录+缓存）
 * 3. Gateway 替换 Authorization header 为目标服务 token
 * 4. 请求转发到目标服务
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getPandaWikiToken, invalidateToken, initPandaWikiAuth } from '../services/pandawiki-token';

export interface ServiceTokenConfig {
  /** 目标服务 URL */
  targetUrl: string;
  /** 服务类型（决定获取 token 的方式） */
  serviceType: 'pandawiki' | 'static';
  /** 静态 token（仅 serviceType=static 时使用） */
  staticToken?: string;
  /** PandaWiki 登录凭据（仅 serviceType=pandawiki 时使用） */
  pandawikiAccount?: string;
  pandawikiPassword?: string;
}

/** 服务路径前缀到 token 配置的映射 */
const serviceTokenMap = new Map<string, ServiceTokenConfig>();

/**
 * 注册 token exchange 规则
 */
export function registerTokenExchange(prefix: string, config: ServiceTokenConfig): void {
  serviceTokenMap.set(prefix, config);

  // 如果是 PandaWiki 类型，初始化认证配置
  if (config.serviceType === 'pandawiki' && config.pandawikiAccount) {
    initPandaWikiAuth({
      targetUrl: config.targetUrl,
      account: config.pandawikiAccount,
      password: config.pandawikiPassword || '',
    });
  }
}

/**
 * 获取目标服务的 token
 */
async function getServiceToken(config: ServiceTokenConfig): Promise<string> {
  if (config.serviceType === 'pandawiki') {
    try {
      return await getPandaWikiToken();
    } catch (err) {
      // 登录失败时清除缓存重试一次
      invalidateToken();
      return await getPandaWikiToken();
    }
  }

  if (config.serviceType === 'static' && config.staticToken) {
    return config.staticToken;
  }

  throw new Error('No valid token configuration for service');
}

/**
 * Token Exchange 中间件
 * 在代理转发前调用，替换 Authorization header
 */
export async function tokenExchangeMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const url = request.raw.url || '';

  for (const [prefix, config] of serviceTokenMap) {
    if (url.startsWith(prefix)) {
      try {
        const token = await getServiceToken(config);
        request.headers.authorization = `Bearer ${token}`;
        request.log.debug(`[TokenExchange] Token swapped for request to ${url}`);
      } catch (err) {
        request.log.error(`[TokenExchange] Failed to get service token for ${url}: ${err}`);
        // 添加失败标记，便于追踪 token exchange 问题
        request.headers['x-token-exchange-failed'] = 'true';
        // 不阻断请求，继续转发（目标服务会返回 401）
      }
      return;
    }
  }
}

/**
 * 获取已注册的路径前缀列表
 */
export function getTokenExchangePrefixes(): string[] {
  return Array.from(serviceTokenMap.keys());
}

/**
 * 清理所有 token exchange 规则（用于热重载）
 */
export function clearTokenExchangeRules(): void {
  serviceTokenMap.clear();
}
