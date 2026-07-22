/**
 * SSRF Protection Integration Guide
 *
 * This file documents all outbound HTTP request call sites in orion-platform-service
 * and provides integration examples for replacing native fetch() with ssrfProtectedFetch.
 *
 * Background:
 *   Multiple services directly use fetch(), axios, or https.request for outbound HTTP
 *   requests, creating SSRF (Server-Side Request Forgery) attack surfaces.
 *   The existing SSRFProtection middleware (src/middleware/ssrfProtection.ts) and
 *   safeFetch utility (src/utils/safeFetch.ts) are already available.
 *
 * Risk Levels:
 *   HIGH   - URL is fully or partially user-controlled (webhook, callback, health check)
 *   MEDIUM - URL is derived from config/external system but not directly user-editable
 *   LOW    - URL is hardcoded to known safe external APIs
 */

import { SSRFProtection, ssrfProtection } from './ssrfProtection';
import { safeFetch, safeFetchWithDomains } from '../utils/safeFetch';

// ============================================================================
// Integration Status Report
// ============================================================================

interface SSRFIntegrationReport {
  totalCallSites: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  integrated: number;
  pending: string[];
  recommendations: string[];
}

/**
 * Returns the current SSRF protection integration status.
 *
 * Call this from a Fastify route or admin endpoint to get a report
 * of which services have been integrated.
 */
export function integrateSSRFProtection(): SSRFIntegrationReport {
  // This is a static inventory. The actual integration requires modifying
  // each service file to use ssrfProtectedFetch instead of native fetch().
  // After integration, update the `integrated` count accordingly.

  const highRisk: string[] = [
    'src/services/webhook/WebhookService.ts:67',          // webhook.url (user-provided)
    'src/services/webhook/WebhookService.ts:373',         // url (user-provided)
    'src/services/config/ConfigWebhookService.ts:178',    // webhook.url (user-provided)
    'src/services/chatops/WebhookService.ts:228',         // webhook.url (user-provided)
    'src/services/chatops/WebhookService.ts:303',         // webhook.url (user-provided)
    'src/services/notification/NotificationChannelService.ts:225', // config.url (user-provided)
    'src/services/health-check-service.ts:295',           // url (user-provided health check target)
    'src/services/pipeline/WebhookNotifier.ts:295',       // config.url (webhook target)
    'src/services/pipeline/im-adapters/FeishuAdapter.ts:51',   // config.webhookUrl
    'src/services/pipeline/im-adapters/WeComAdapter.ts:22',    // config.webhookUrl
    'src/services/pipeline/im-adapters/DingTalkAdapter.ts:23', // config.webhookUrl
  ];

  const mediumRisk: string[] = [
    'src/services/pipeline/PullRequestService.ts:104',    // GitHub PR URL (from external system)
    'src/services/pipeline/PullRequestService.ts:187',    // GitHub PR URL (from external system)
    'src/services/pipeline/RunnerPoolService.ts:216',     // runnerEndpoint (from config)
    'src/services/pipeline/QualityGateService.ts:404',    // SonarQube URL (from config)
    'src/services/pipeline/QualityGateService.ts:458',    // quality gate URL (from config)
    'src/services/pipeline/DeploymentStrategyService.ts:855', // deployment endpoint (from config)
    'src/services/developer-portal/SDKGeneratorService.ts:311', // SDK API (axios)
    'src/clients/GitHubClient.ts',                        // GitHub API (multiple calls)
    'src/clients/GitLabClient.ts',                        // GitLab API (multiple calls)
    'src/services/integration/connectors/GitLabConnector.ts', // GitLab API
    'src/services/integration/connectors/JiraConnector.ts',   // Jira API
    'src/services/code-repo/GitLabAdapter.ts',            // GitLab API
    'src/services/auth/WechatWorkService.ts',             // WeChat Work API
    'src/services/sbom/VulnerabilityDatabaseClient.ts',   // vulnerability DB (private fetch)
  ];

  const lowRisk: string[] = [
    'src/services/security/SupplyChainService.ts:782',    // npm registry (hardcoded)
    'src/services/security/SupplyChainService.ts:879',    // GitHub API (hardcoded)
    'src/services/supply-chain/SbomService.ts:1329',      // NVD API (hardcoded)
    'src/services/supply-chain/SbomService.ts:1422',      // GitHub Advisory (hardcoded)
    'src/services/security/NVDClient.ts:173',             // NVD API (hardcoded)
    'src/services/pipeline/apk-uploaders.ts',             // Hardcoded OAuth/store URLs
  ];

  const totalCallSites = highRisk.length + mediumRisk.length + lowRisk.length;

  return {
    totalCallSites,
    highRisk: highRisk.length,
    mediumRisk: mediumRisk.length,
    lowRisk: lowRisk.length,
    integrated: 0, // Update this as services are migrated
    pending: [...highRisk, ...mediumRisk],
    recommendations: [
      '1. Start with HIGH-risk services (webhook, health-check, notification) - these accept user-provided URLs',
      '2. Use safeFetch() from src/utils/safeFetch.ts for simple replacements',
      '3. Use safeFetchWithDomains() when you need a custom allowed domain list per service',
      '4. For services with hardcoded external URLs, register those domains in SSRFProtection DEFAULT_ALLOWED_DOMAINS',
      '5. For axios instances, create an axios interceptor that calls ssrfProtection.validateUrl()',
      '6. For https.request/http.request, wrap the callback with SSRF validation before execution',
      '7. Add integration tests that verify blocked URLs throw OrionError with FORBIDDEN code',
      '8. Consider adding a Fastify decorator for ssrfProtectedFetch that is pre-configured with allowed domains',
    ],
  };
}

// ============================================================================
// Fastify Decorator Registration
// ============================================================================

/**
 * Register ssrfProtectedFetch as a Fastify decorator.
 *
 * Call this in your Fastify plugin setup:
 *
 *   fastify.register(require('./middleware/ssrfIntegration')).ready(err => { ... });
 *
 * Then access via: fastify.ssrfProtectedFetch
 */
export function registerSSRFProtectedFetch(fastify: any): void {
  // Create a per-service SSRF instance with service-specific allowed domains
  const serviceSSRF = new SSRFProtection({
    // Start with the global defaults; add service-specific domains as needed
    allowedDomains: [...Array.from(ssrfProtection['allowedDomains'])],
  });

  // Expose the safe fetch as a Fastify decorator
  fastify.decorate('ssrfProtectedFetch', async (url: string, options?: RequestInit): Promise<Response> => {
    await serviceSSRF.validateUrl(url);
    return fetch(url, options);
  });

  // Expose the SSRF instance so services can add allowed domains at runtime
  fastify.decorate('ssrfProtection', serviceSSRF);

  fastify.log.info('Registered ssrfProtectedFetch Fastify decorator');
}

// ============================================================================
// Per-Service Adapter Examples (Commented - for reference only)
// ============================================================================

/*
 * ---------------------------------------------------------------------------
 * 1. WebhookService (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/webhook/WebhookService.ts
 * Risk: User-provided webhook URLs - direct SSRF vector
 *
 * BEFORE (line 67):
 *   const response = await fetch(webhook.url, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ event, payload, timestamp: ... }),
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(webhook.url, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ event, payload, timestamp: ... }),
 *     signal: controller.signal,
 *   });
 *
 * NOTE: Webhook URLs are user-defined. You must either:
 *   a) Add the user's domain to the allowed list dynamically via ssrfProtection.addAllowedDomain(),
 *      OR
 *   b) Use a per-request SSRF config with safeFetchWithDomains() that validates the URL
 *      against a whitelist of known safe domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 2. WebhookService (line 373) - outgoing webhook callback
 * ---------------------------------------------------------------------------
 * File: src/services/webhook/WebhookService.ts
 * Risk: User-provided webhook callback URL
 *
 * BEFORE:
 *   const response = await fetch(url, {
 *     method: 'POST',
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(url, {
 *     method: 'POST',
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 3. ConfigWebhookService (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/config/ConfigWebhookService.ts
 * Risk: User-configured webhook URLs
 *
 * BEFORE (line 178):
 *   const response = await fetch(url, {
 *     method,
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(url, {
 *     method,
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 4. Chatops WebhookService (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/chatops/WebhookService.ts
 * Risk: User-provided webhook URLs for chat integrations
 *
 * BEFORE (line 228):
 *   const response = await fetch(webhook.url, {
 *     method: 'POST',
 *     headers: { ... },
 *     body: JSON.stringify({ event: 'test', ... }),
 *     signal: AbortSignal.timeout(...),
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(webhook.url, {
 *     method: 'POST',
 *     headers: { ... },
 *     body: JSON.stringify({ event: 'test', ... }),
 *     signal: AbortSignal.timeout(...),
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 5. Chatops WebhookService (line 303) - event delivery
 * ---------------------------------------------------------------------------
 * File: src/services/chatops/WebhookService.ts
 * Risk: User-provided webhook URL
 *
 * BEFORE:
 *   const response = await fetch(webhook.url, { ... });
 *
 * AFTER:
 *   const response = await safeFetch(webhook.url, { ... });
 */

/*
 * ---------------------------------------------------------------------------
 * 6. NotificationChannelService (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/notification/NotificationChannelService.ts
 * Risk: Notification channel URLs may be user-configured
 *
 * BEFORE (line 225):
 *   const response = await fetch(config.url, {
 *     method,
 *     headers: { 'Content-Type': 'application/json', ...config.headers },
 *     body: JSON.stringify(payload),
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(config.url, {
 *     method,
 *     headers: { 'Content-Type': 'application/json', ...config.headers },
 *     body: JSON.stringify(payload),
 *     signal: controller.signal,
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 7. Health Check Service (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/health-check-service.ts
 * Risk: User-provided URL for health check endpoint
 *
 * BEFORE (line 295):
 *   const response = await fetch(url, {
 *     method: 'GET',
 *     signal: controller.signal,
 *     headers: { 'Accept': 'application/json' },
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(url, {
 *     method: 'GET',
 *     signal: controller.signal,
 *     headers: { 'Accept': 'application/json' },
 *   });
 *
 * NOTE: Health checks should have a separate allowed list of internal services.
 *       Consider creating a HealthCheckSSRF instance with internal-only allowed domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 8. WebhookNotifier (HIGH RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/WebhookNotifier.ts
 * Risk: Webhook notification URLs from pipeline config
 *
 * BEFORE (line 295):
 *   const response = await fetch(config.url, {
 *     method: 'POST',
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(config.url, {
 *     method: 'POST',
 *     headers,
 *     body,
 *     signal: controller.signal,
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 9-11. IM Adapters: FeishuAdapter, WeComAdapter, DingTalkAdapter (HIGH RISK)
 * ---------------------------------------------------------------------------
 * Files:
 *   src/services/pipeline/im-adapters/FeishuAdapter.ts (line 51)
 *   src/services/pipeline/im-adapters/WeComAdapter.ts (line 22)
 *   src/services/pipeline/im-adapters/DingTalkAdapter.ts (line 23)
 * Risk: Webhook URLs from IM configuration (could be user-influenced)
 *
 * BEFORE:
 *   const response = await fetch(config.webhookUrl, { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(config.webhookUrl, { ... });
 *
 * NOTE: Add feishu.cn, qyapi.weixin.qq.com, oapi.dingtalk.com to allowed domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 12. PullRequestService (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/PullRequestService.ts
 * Lines: 104, 187
 * Risk: GitHub/GitLab PR URLs derived from repository config (not directly user-editable)
 *
 * BEFORE (line 104):
 *   const response = await fetch(url, {
 *     method,
 *     headers: {
 *       'Authorization': `token ${this.token}`,
 *       'Accept': 'application/vnd.github.v3+json',
 *       'Content-Type': 'application/json',
 *     },
 *     body: body ? JSON.stringify(body) : undefined,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   // GitHub URLs are constructed from this.apiBase which is set from config.
 *   // safeFetch will validate the resolved hostname against the allowed domains list.
 *   const response = await safeFetch(url, {
 *     method,
 *     headers: {
 *       'Authorization': `token ${this.token}`,
 *       'Accept': 'application/vnd.github.v3+json',
 *       'Content-Type': 'application/json',
 *     },
 *     body: body ? JSON.stringify(body) : undefined,
 *   });
 *
 * NOTE: Ensure api.github.com and raw.githubusercontent.com are in the allowed list.
 */

/*
 * ---------------------------------------------------------------------------
 * 13. RunnerPoolService (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/RunnerPoolService.ts
 * Line: 216
 * Risk: runnerEndpoint from task configuration
 *
 * BEFORE:
 *   const response = await fetch(`${runnerEndpoint}/execute`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(`${runnerEndpoint}/execute`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *
 * NOTE: Runner endpoints are internal service URLs. Consider adding them to a
 *       separate allowed list for internal services, or use a per-service SSRF config.
 */

/*
 * ---------------------------------------------------------------------------
 * 14. QualityGateService (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/QualityGateService.ts
 * Lines: 404, 458
 * Risk: External quality gate URLs (SonarQube, etc.) from pipeline config
 *
 * BEFORE (line 404):
 *   const response = await fetch(url, { headers });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(url, { headers });
 */

/*
 * ---------------------------------------------------------------------------
 * 15. DeploymentStrategyService (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/DeploymentStrategyService.ts
 * Line: 855
 * Risk: Deployment endpoint from strategy config
 *
 * BEFORE:
 *   const response = await fetch(endpoint, {
 *     method: 'GET',
 *     signal: controller.signal,
 *   });
 *
 * AFTER:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(endpoint, {
 *     method: 'GET',
 *     signal: controller.signal,
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 16. SDKGeneratorService (MEDIUM RISK - uses axios)
 * ---------------------------------------------------------------------------
 * File: src/services/developer-portal/SDKGeneratorService.ts
 * Line: 311
 * Risk: External SDK generation API (axios instance)
 *
 * BEFORE:
 *   const response = await this.http.request<T>({ method, url: path, data, ...config });
 *
 * AFTER - Option A: Replace axios instance with safeFetch:
 *   import { safeFetch } from '../../utils/safeFetch';
 *
 *   const response = await safeFetch(path, {
 *     method,
 *     headers: config.headers,
 *     body: data ? JSON.stringify(data) : undefined,
 *   });
 *
 * AFTER - Option B: Add axios request interceptor:
 *   this.http.interceptors.request.use(async (requestConfig) => {
 *     await ssrfProtection.validateUrl(requestConfig.url!);
 *     return requestConfig;
 *   });
 */

/*
 * ---------------------------------------------------------------------------
 * 17-18. GitHubClient (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/clients/GitHubClient.ts
 * Lines: 67, 109, 144, 208, 235, 262, 289, 333, 361, 388
 * Risk: GitHub API URLs (controlled but external)
 *
 * BEFORE:
 *   const response = await fetch(url, { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(url, { ... });
 *
 * NOTE: Register api.github.com and raw.githubusercontent.com in allowed domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 19-20. GitLabClient (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/clients/GitLabClient.ts
 * Lines: 65, 105, 140, 202, 229, 256, 283, 321
 * Risk: GitLab API URLs (controlled but external)
 *
 * BEFORE:
 *   const response = await fetch(url, { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(url, { ... });
 *
 * NOTE: Register gitlab.com and api.gitlab.com in allowed domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 21-22. Integration Connectors (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * Files:
 *   src/services/integration/connectors/GitLabConnector.ts (lines 134, 385, 404)
 *   src/services/integration/connectors/JiraConnector.ts (lines 158, 489, 513, 540)
 * Risk: External SaaS API URLs from integration config
 *
 * BEFORE (GitLabConnector):
 *   const response = await fetch(`${baseUrl}/api/v4/user`, { ... });
 *
 * AFTER:
 *   import { safeFetchWithDomains } from '../../utils/safeFetch';
 *
 *   // Allow the specific GitLab instance domain
 *   const response = await safeFetchWithDomains(`${baseUrl}/api/v4/user`, { ... }, [
 *     new URL(baseUrl).hostname,
 *   ]);
 *
 * NOTE: For connectors, the baseUrl comes from user-configured integrations.
 *       Use safeFetchWithDomains to dynamically allow the specific instance domain.
 */

/*
 * ---------------------------------------------------------------------------
 * 23. GitLabAdapter (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/code-repo/GitLabAdapter.ts
 * Lines: 85, 109, 134
 * Risk: GitLab API URLs from repository config
 *
 * BEFORE:
 *   const response = await fetch(this.apiUrl(path), { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(this.apiUrl(path), { ... });
 */

/*
 * ---------------------------------------------------------------------------
 * 24. WechatWorkService (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/auth/WechatWorkService.ts
 * Lines: 149, 186, 201
 * Risk: WeChat Work API URLs (hardcoded but external)
 *
 * BEFORE:
 *   const response = await fetch(url);
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(url);
 *
 * NOTE: Add qyapi.weixin.qq.com to allowed domains.
 */

/*
 * ---------------------------------------------------------------------------
 * 25. NVDClient / SbomService (LOW RISK)
 * ---------------------------------------------------------------------------
 * Files:
 *   src/services/security/NVDClient.ts (line 173)
 *   src/services/supply-chain/SbomService.ts (lines 1329, 1422)
 *   src/services/security/SupplyChainService.ts (lines 782, 879)
 * Risk: Hardcoded external URLs to known safe APIs (NVD, npm, GitHub)
 *
 * These are LOW risk because URLs are hardcoded, but still benefit from SSRF protection.
 *
 * BEFORE (using https.get):
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 *
 * AFTER - Option A: Replace with safeFetch:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(url, {
 *     headers: { 'Accept': 'application/json' },
 *   });
 *   // Then handle response body manually
 *
 * AFTER - Option B: Wrap https.get with SSRF validation:
 *   await ssrfProtection.validateUrl(url);
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 */

/*
 * ---------------------------------------------------------------------------
 * 26. apk-uploaders (LOW RISK - hardcoded URLs)
 * ---------------------------------------------------------------------------
 * File: src/services/pipeline/apk-uploaders.ts
 * Lines: 81, 112, 131, 148, 168, 186, 201, 216, 289, 321, 411, 429, 442, 459, 473, 489, 577, 659, 688, 703, 777, 810, 825, 922, 943, 963, 1033, 1066
 * Risk: Hardcoded URLs to known app store APIs (Huawei, Xiaomi, OPPO, VIVO, Honor, Tencent, Google, Samsung)
 *
 * BEFORE:
 *   const response = await fetch('https://oauth-login.cloud.huawei.com/oauth2/v3/token', { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch('https://oauth-login.cloud.huawei.com/oauth2/v3/token', { ... });
 *
 * NOTE: Add all app store domains to DEFAULT_ALLOWED_DOMAINS in ssrfProtection.ts:
 *   - oauth-login.cloud.huawei.com
 *   - developer.huawei.com
 *   - connect.xiaomi.com
 *   - api.vivo.com.cn
 *   - openapi.developer.oppo.com
 *   - developer.honor.com
 *   - open.tencent.com
 *   - androidpublisher.googleapis.com
 *   - seller.samsungapps.com
 */

/*
 * ---------------------------------------------------------------------------
 * 27. SupplyChainService (LOW RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/security/SupplyChainService.ts
 * Lines: 782, 879
 * Risk: Hardcoded URLs to npm registry and GitHub
 *
 * BEFORE:
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 *
 * AFTER:
 *   import { ssrfProtection } from '../middleware/ssrfProtection';
 *
 *   await ssrfProtection.validateUrl(url);
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 */

/*
 * ---------------------------------------------------------------------------
 * 28. SbomService (LOW RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/supply-chain/SbomService.ts
 * Lines: 1329, 1422
 * Risk: Hardcoded URLs to NVD and GitHub Advisory
 *
 * BEFORE:
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 *
 * AFTER:
 *   import { ssrfProtection } from '../../middleware/ssrfProtection';
 *
 *   await ssrfProtection.validateUrl(url);
 *   const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => { ... });
 */

/*
 * ---------------------------------------------------------------------------
 * 29. VulnerabilityDatabaseClient (LOW RISK)
 * ---------------------------------------------------------------------------
 * File: src/services/sbom/VulnerabilityDatabaseClient.ts
 * Line: 256 (calls this.fetch at line 269)
 * Risk: Private fetch method for vulnerability database
 *
 * BEFORE:
 *   private fetch(url: string, options: ...): Promise<any> {
 *     return fetch(url, options);
 *   }
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   private async fetch(url: string, options: ...): Promise<any> {
 *     return safeFetch(url, options);
 *   }
 */

/*
 * ---------------------------------------------------------------------------
 * 30. TaskRunner (MEDIUM RISK)
 * ---------------------------------------------------------------------------
 * File: src/engine/TaskRunner.ts
 * Line: 1556
 * Risk: Pipeline task endpoint (internal service URL)
 *
 * BEFORE:
 *   const response = await fetch(endpoint, { ... });
 *
 * AFTER:
 *   import { safeFetch } from '../utils/safeFetch';
 *
 *   const response = await safeFetch(endpoint, { ... });
 *
 * NOTE: Pipeline task endpoints are internal URLs. Add internal service domains
 *       to a separate allowed list or use a per-service SSRF config.
 */

// ============================================================================
// Axios Interceptor Helper
// ============================================================================

/**
 * Create an axios interceptor that validates URLs against SSRF rules.
 *
 * Usage:
 *   import { createSSRFInterceptor } from './middleware/ssrfIntegration';
 *   this.http.interceptors.request.use(createSSRFInterceptor(ssrfProtection));
 */
export function createSSRFInterceptor(
  ssrfInstance: SSRFProtection = ssrfProtection
): (config: any) => Promise<any> {
  return async (config: any): Promise<any> => {
    if (config.url) {
      // Handle relative URLs (axios baseURL prefix)
      const fullUrl = config.baseURL
        ? new URL(config.url, config.baseURL).href
        : config.url;

      await ssrfInstance.validateUrl(fullUrl);
    }
    return config;
  };
}

// ============================================================================
// https.request Wrapper Helper
// ============================================================================

/**
 * Wrapper for https.request that validates the URL before making the request.
 *
 * Usage:
 *   import { ssrfProtectedHttpsGet } from './middleware/ssrfIntegration';
 *   const response = await ssrfProtectedHttpsGet(url, { headers });
 */
export async function ssrfProtectedHttpsGet(
  url: string,
  options: { headers?: Record<string, string> } = {}
): Promise<any> {
  await ssrfProtection.validateUrl(url);

  return new Promise((resolve, reject) => {
    const { HttpsClient } = require('https');
    const req = HttpsClient.get(url, { headers: options.headers }, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  integrateSSRFProtection,
  registerSSRFProtectedFetch,
  createSSRFInterceptor,
  ssrfProtectedHttpsGet,
  safeFetch,
  safeFetchWithDomains,
  ssrfProtection,
};
