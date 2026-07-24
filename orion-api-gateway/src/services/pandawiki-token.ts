/**
 * PandaWiki Token Service
 *
 * 管理 PandaWiki 服务 token 的生命周期：
 * - 首次使用时通过账号密码登录获取 token
 * - 缓存 token，避免频繁登录
 * - 401 时自动重新登录刷新 token
 */

interface PandaWikiLoginConfig {
  targetUrl: string;
  account: string;
  password: string;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0; // Unix timestamp in ms
let loginConfig: PandaWikiLoginConfig | null = null;
let loginPromise: Promise<string> | null = null;

/**
 * 初始化 PandaWiki 登录配置
 * 如果配置已存在且相同，跳过初始化（避免清空 token 缓存）
 */
export function initPandaWikiAuth(config: PandaWikiLoginConfig): void {
  if (
    loginConfig &&
    loginConfig.targetUrl === config.targetUrl &&
    loginConfig.account === config.account
  ) {
    return; // 配置已存在，跳过重新初始化
  }
  loginConfig = config;
  cachedToken = null;
  tokenExpiry = 0;
}

/**
 * 获取有效的 PandaWiki token
 * 如果缓存过期则自动重新登录
 */
export async function getPandaWikiToken(): Promise<string> {
  if (!loginConfig) {
    throw new Error('PandaWiki auth not initialized');
  }

  // 如果有有效 token 直接返回
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // 如果已有登录请求在进行，复用
  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = doLogin();
  try {
    const token = await loginPromise;
    return token;
  } finally {
    loginPromise = null;
  }
}

/**
 * 执行登录获取 token
 */
async function doLogin(): Promise<string> {
  if (!loginConfig) {
    throw new Error('PandaWiki auth not initialized');
  }

  const { targetUrl, account, password } = loginConfig;
  const loginUrl = `${targetUrl}/api/v1/user/login`;

  console.log(`[PandaWikiToken] Logging in to ${loginUrl}`);

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
    signal: AbortSignal.timeout(10000),
  });

  const result = (await response.json()) as { success: boolean; message?: string; data?: { token?: string } };

  if (!result.success) {
    throw new Error(`PandaWiki login failed: ${result.message}`);
  }

  // 响应格式: { success: true, data: { token: "..." } }
  const token = result.data?.token;
  if (!token) {
    throw new Error('PandaWiki login response missing token');
  }

  cachedToken = token;
  // token 有效期默认 24 小时
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;

  console.log('[PandaWikiToken] Token acquired successfully');
  return token;
}

/**
 * 清除缓存的 token（用于 token 失效时强制重新登录）
 */
export function invalidateToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}
