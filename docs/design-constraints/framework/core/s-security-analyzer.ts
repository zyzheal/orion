/**
 * S 安全层检测器
 * 检测安全相关的 25 项设计约束 (100% 覆盖率)
 * - S1: 身份认证与访问控制 (5项)
 * - S2: 数据安全 (5项)
 * - S3: 基础设施安全 (5项)
 * - S4: 安全审计 (5项)
 * - S5: 第三方集成 (5项)
 *
 * 已实现 25/25 项检测:
 * S1: 登录认证、权限模型、权限校验、会话管理、密码策略
 * S2: HTTPS传输、存储加密、脱敏规则、数据隔离、隐私合规
 * S3: SQL注入、XSS、CSRF、文件上传、命令注入
 * S4: 审计日志、日志保留、异常检测、漏洞扫描、安全响应
 * S5: API密钥、OAuth2、Webhook签名、回调校验、依赖扫描
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface SecurityIssue {
  file: string;
  line: number;
  column: number;
  type: SecurityIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  checkId: string; // Sx-xx
}

export type SecurityIssueType =
  // S1 身份认证与访问控制
  | 'missing-mfa'
  | 'missing-auth-middleware'
  | 'missing-permission-check'
  | 'missing-session-timeout'
  | 'missing-password-policy'
  // S2 数据安全
  | 'missing-https'
  | 'missing-storage-encryption'
  | 'missing-data-masking'
  | 'missing-tenant-isolation'
  | 'missing-privacy-compliance'
  // S3 基础设施安全
  | 'sql-injection'
  | 'xss-vulnerability'
  | 'missing-csrf-protection'
  | 'missing-file-upload-security'
  | 'command-injection'
  // S4 安全审计
  | 'missing-audit-log'
  | 'missing-log-retention'
  | 'missing-anomaly-detection'
  | 'missing-vulnerability-scan'
  | 'missing-incident-response'
  // S5 第三方集成
  | 'api-key-hardcoded'
  | 'missing-oauth2'
  | 'missing-webhook-signature'
  | 'missing-callback-validation'
  | 'missing-dependency-scan';

export interface SecurityScanResult {
  file: string;
  issues: SecurityIssue[];
  language: 'frontend' | 'backend';
}

// ============ 前端安全检测器 ============

export class SSecurityAnalyzerFrontend {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  analyze(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // S1-03: 权限校验 (前端按钮级)
    issues.push(...this.detectMissingPermissionCheck());

    // S2-03: 脱敏规则
    issues.push(...this.detectMissingDataMasking());

    // S2-05: 隐私合规 (P0)
    issues.push(...this.detectMissingPrivacyCompliance());

    // S3-03: CSRF防护
    issues.push(...this.detectMissingCSRFProtection());

    // S3-04: 文件上传安全
    issues.push(...this.detectMissingFileUploadSecurity());

    // S4-01: 操作审计日志
    issues.push(...this.detectMissingAuditLog());

    // S5-01: API密钥管理 (已在 code-quality-analyzer 中实现，这里补充前端检测)
    issues.push(...this.detectHardcodedAPIKeys());

    // S5-05: 依赖安全扫描 (P1) - package.json
    issues.push(...this.detectMissingDependencyScan());

    return issues;
  }

  // ============ S1-03: 权限校验 (P0) ============

  /**
   * 检测前端按钮/操作是否有权限控制
   */
  private detectMissingPermissionCheck(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感操作按钮
    const hasSensitiveButton = /<Button|<a[^>]*delete|<a[^>]*remove|<a[^>]*edit|danger|删除|修改|管理/i.test(this.content);

    if (!hasSensitiveButton) return issues;

    // 检测权限控制模式
    const hasPermissionControl =
      // 方式1: 权限组件
      /hasPermission|canAccess|checkPermission|authorized|authorizedRule/i.test(this.content) ||
      // 方式2: 隐藏 disabled
      /(disabled|hidden)\s*=.*auth|(auth|permission).*\(/.test(this.content) ||
      // 方式3: 使用 useAuth
      /useAuth|usePermission|AuthContext|PermissionContext/i.test(this.content) ||
      // 方式4: 条件渲染
      /\{\s*.*auth.*\}/.test(this.content);

    // 检测是否有权限相关导入
    const hasAuthImport = /import.*permission|import.*auth/i.test(this.content);

    if (hasSensitiveButton && !hasPermissionControl && !hasAuthImport) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-permission-check',
        severity: 'P0',
        message: '敏感操作按钮缺少权限控制',
        suggestion: '使用 hasPermission/canAccess 或 AuthContext 进行权限校验',
        checkId: 'S1-03',
      });
    }

    return issues;
  }

  // ============ S2-03: 脱敏规则 (P0) ============

  /**
   * 检测敏感数据（手机号、身份证）是否脱敏
   */
  private detectMissingDataMasking(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感字段
    const hasSensitiveField =
      /phone|mobile|telephone|手机|电话/i.test(this.content) ||
      /idCard|identityCard|身份证|证件号/i.test(this.content) ||
      /bankCard|creditCard|银行卡|信用卡/i.test(this.content) ||
      /email|邮箱/i.test(this.content);

    if (!hasSensitiveField) return issues;

    // 检测脱敏函数
    const hasMaskingFunction =
      /mask|hide|sensitive|脱敏|加密|Privacy/i.test(this.content) ||
      // 常见脱敏模式
      /(\d{3})\d{4}(\d{4})/.test(this.content) || // 手机号脱敏模式
      /\.\*+/.test(this.content); // 星号脱敏模式

    if (hasSensitiveField && !hasMaskingFunction) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-data-masking',
        severity: 'P0',
        message: '敏感字段缺少脱敏处理',
        suggestion: '使用 maskPhone/maskIdCard 等脱敏函数',
        checkId: 'S2-03',
      });
    }

    return issues;
  }

  // ============ S3-03: CSRF防护 (P0) ============

  /**
   * 检测前端请求是否包含 CSRF token
   */
  private detectMissingCSRFProtection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测是否有 API 请求
    const hasAPIRequest =
      /axios\.|fetch\(|request\(|http\./i.test(this.content) ||
      /useRequest|useFetch/i.test(this.content);

    if (!hasAPIRequest) return issues;

    // 检测 CSRF token 机制
    const hasCSRFProtection =
      // 方式1: 请求头包含 token
      /headers.*XSRF-TOKEN|xsrf|csrf|_token|anti-csrf/i.test(this.content) ||
      // 方式2: 使用安全请求库
      /withCredentials/i.test(this.content) ||
      // 方式3: 请求拦截器
      /interceptors.*request|request.*interceptor/i.test(this.content);

    // 检测是否有登录态（可能是公开接口）
    const hasAuth = /token|login|auth|session/i.test(this.content);

    // 只对需要认证的接口报告问题
    if (hasAPIRequest && hasAuth && !hasCSRFProtection) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-csrf-protection',
        severity: 'P0',
        message: '前端请求可能缺少 CSRF 防护',
        suggestion: '在请求头中包含 XSRF-TOKEN 或使用 withCredentials',
        checkId: 'S3-03',
      });
    }

    return issues;
  }

  // ============ S3-04: 文件上传安全 (P0) ============

  /**
   * 检测文件上传是否有安全控制
   */
  private detectMissingFileUploadSecurity(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测文件上传组件
    const hasUploadComponent =
      /<Upload|<input.*type="file"|Dragger|uppy|react-dropzone/i.test(this.content);

    if (!hasUploadComponent) return issues;

    // 检测安全控制
    const hasSecurityControl =
      // 方式1: 文件类型限制
      /accept\s*=|fileType|file.*type|mime|extension/i.test(this.content) ||
      // 方式2: 文件大小限制
      /maxFileSize|fileSize|size.*limit|maxSize|beforeUpload/i.test(this.content) ||
      // 方式3: 文件名检查
      /fileName|name.*validation|sanitize/i.test(this.content) ||
      // 方式4: 病毒扫描回调
      /onChange.*file|scan|virus|malware/i.test(this.content);

    if (hasUploadComponent && !hasSecurityControl) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-file-upload-security',
        severity: 'P0',
        message: '文件上传缺少安全控制',
        suggestion: '添加文件类型、大小限制和病毒扫描',
        checkId: 'S3-04',
      });
    }

    return issues;
  }

  // ============ S4-01: 操作审计日志 (P0) ============

  /**
   * 检测敏感操作是否有日志记录
   */
  private detectMissingAuditLog(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感操作
    const sensitiveOpRegex = /delete|remove|destroy|注销|deleteUser|deleteFile|updatePermission|modifyRole|changePassword|resetPwd|login|logout|signOut/i;
    const hasSensitiveOperation = sensitiveOpRegex.test(this.content);

    if (!hasSensitiveOperation) return issues;

    // 检测日志记录
    const hasAuditLog =
      // 方式1: 显式日志
      /log\(|logger\.|audit|记录|日志/i.test(this.content) ||
      // 方式2: 埋点
      /track|analytics|monitor|metric|埋点/i.test(this.content) ||
      // 方式3: 上报
      /report|send|upload.*log/i.test(this.content);

    // 检测是否调用了后端 API（假设后端会记录）
    const hasAPICall = /axios\.|fetch\(|request\(/i.test(this.content);

    // 如果是前端直接操作且没有日志记录，报告问题
    if (hasSensitiveOperation && !hasAuditLog && !hasAPICall) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-audit-log',
        severity: 'P0',
        message: '敏感操作缺少审计日志记录',
        suggestion: '添加操作日志或调用审计 API',
        checkId: 'S4-01',
      });
    }

    return issues;
  }

  // ============ S5-01: API密钥硬编码 (P0) ============

  /**
   * 检测前端是否硬编码 API 密钥
   */
  private detectHardcodedAPIKeys(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测可能的 API 密钥模式
    const patterns = [
      { regex: /apiKey\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, msg: '可能存在硬编码 API Key' },
      { regex: /apikey\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, msg: '可能存在硬编码 API Key' },
      { regex: /secretKey\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, msg: '可能存在硬编码 Secret Key' },
      { regex: /accessToken\s*[:=]\s*['"][a-zA-Z0-9\-_]{16,}['"]/i, msg: '可能存在硬编码 Access Token' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      // 跳过注释和类型定义
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('interface ')) {
        return;
      }

      for (const p of patterns) {
        if (p.regex.test(line)) {
          issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('apiKey') + 1 || line.indexOf('secretKey') + 1,
            type: 'api-key-hardcoded',
            severity: 'P0',
            message: p.msg,
            suggestion: '使用环境变量或后端代理，不要在前端存储密钥',
            checkId: 'S5-01',
          });
        }
      }
    });

    return issues;
  }

  // ============ S2-05: 隐私合规 (前端) (P0) ============

  /**
   * 检测前端是否缺少隐私合规处理
   */
  private detectMissingPrivacyCompliance(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感个人信息处理
    const hasPersonalData =
      /phone|mobile|email|idCard|identityCard|bankCard|creditCard/i.test(this.content) ||
      /realName|real_name|name.*身份证/i.test(this.content);

    if (!hasPersonalData) return issues;

    // 检测隐私合规机制
    const hasPrivacyCompliance =
      /consent|agreement|policy|privacy|GDPR|cookie.*consent|accept.*term/i.test(this.content) ||
      /localStorage.*notice|sessionStorage.*notice/i.test(this.content) ||
      /onCollect|onTrack|opt-out|optIn|optOut/i.test(this.content);

    if (hasPersonalData && !hasPrivacyCompliance) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-privacy-compliance',
        severity: 'P0',
        message: '处理个人敏感信息缺少隐私合规机制',
        suggestion: '添加用户同意弹窗、Cookie 声明和_opt-out_机制',
        checkId: 'S2-05',
      });
    }

    return issues;
  }

  // ============ S5-05: 依赖安全扫描 (前端) (P1) ============

  /**
   * 检测前端是否配置了依赖安全扫描
   */
  private detectMissingDependencyScan(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 只检查 package.json 文件
    if (!this.filePath.includes('package.json')) return issues;

    // 检测是否配置了安全扫描
    const hasSecurityScan =
      /npm.*audit|audit.*security|dependabot|snyk|renovate/i.test(this.content) ||
      /"security"/.test(this.content);

    if (!hasSecurityScan) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-dependency-scan',
        severity: 'P1',
        message: 'package.json 缺少依赖安全扫描配置',
        suggestion: '配置 npm audit、dependabot 或 snyk 进行依赖漏洞扫描',
        checkId: 'S5-05',
      });
    }

    return issues;
  }
}

// ============ 后端安全检测器 ============

export class SSecurityAnalyzerBackend {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
  }

  analyze(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // S1-01: 登录认证
    issues.push(...this.detectMissingAuthentication());

    // S1-02: 权限模型
    issues.push(...this.detectMissingPermissionModel());

    // S1-03: 权限校验
    issues.push(...this.detectMissingAuthMiddleware());

    // S1-04: 会话管理
    issues.push(...this.detectMissingSessionTimeout());

    // S1-05: 密码策略 (P0)
    issues.push(...this.detectMissingPasswordPolicy());

    // S2-01: HTTPS/TLS
    issues.push(...this.detectMissingHTTPS());

    // S2-02: 存储加密 (P1)
    issues.push(...this.detectMissingStorageEncryption());

    // S2-04: 数据隔离（多租户）
    issues.push(...this.detectMissingTenantIsolation());

    // S2-05: 隐私合规 (P0)
    issues.push(...this.detectMissingPrivacyCompliance());

    // S3-01: SQL注入 (已在 code-quality-analyzer 中实现)
    issues.push(...this.detectSQLInjection());

    // S3-02: XSS防护
    issues.push(...this.detectXSSProtection());

    // S3-03: CSRF防护
    issues.push(...this.detectBackendCSRFProtection());

    // S3-05: 命令注入 (已有)
    issues.push(...this.detectCommandInjection());

    // S4-01: 操作审计日志
    issues.push(...this.detectBackendAuditLog());

    // S4-02: 日志保留
    issues.push(...this.detectMissingLogRetention());

    // S4-03: 异常行为检测 (P1)
    issues.push(...this.detectMissingAnomalyDetection());

    // S4-04: 漏洞扫描 (P1)
    issues.push(...this.detectMissingVulnerabilityScan());

    // S4-05: 安全事件响应 (P1)
    issues.push(...this.detectMissingIncidentResponse());

    // S5-02: OAuth2
    issues.push(...this.detectMissingOAuth2());

    // S5-03: Webhook签名
    issues.push(...this.detectMissingWebhookSignature());

    // S5-04: 回调数据校验
    issues.push(...this.detectMissingCallbackValidation());

    // S5-05: 依赖安全扫描 (P1)
    issues.push(...this.detectMissingDependencyScan());

    return issues;
  }

  // ============ S1-01: 登录认证 (P0) ============

  /**
   * 检测登录接口是否有认证机制
   */
  private detectMissingAuthentication(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测登录相关代码
    const isAuthEndpoint =
      /login|signIn|authenticate|登录|认证/i.test(this.filePath) ||
      /router.*post.*login|route.*auth/i.test(this.content);

    if (!isAuthEndpoint) return issues;

    // 检测认证机制
    const hasAuthMechanism =
      /jwt|token|password.*hash|bcrypt|argon2|scrypt/i.test(this.content) ||
      /mfa|totp|otp|twoFactor/i.test(this.content) ||
      /verify.*password|compare.*password/i.test(this.content);

    if (isAuthEndpoint && !hasAuthMechanism) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-mfa',
        severity: 'P0',
        message: '登录接口缺少安全认证机制',
        suggestion: '实现密码哈希、多因素认证等安全机制',
        checkId: 'S1-01',
      });
    }

    return issues;
  }

  // ============ S1-02: 权限模型 (P0) ============

  /**
   * 检测是否有 RBAC 权限模型
   */
  private detectMissingPermissionModel(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测是否有权限相关服务
    const hasPermissionService =
      /role|permission|acl|authorization|rbac|access\s*control/i.test(this.content);

    if (!hasPermissionService) return issues;

    // 检测权限定义
    const hasPermissionDef =
      /roleDefinition|permissionDef|policy|AccessControlList/i.test(this.content) ||
      /admin|user|guest|moderator/i.test(this.content);

    if (hasPermissionService && !hasPermissionDef) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-auth-middleware',
        severity: 'P0',
        message: '缺少明确的权限模型定义',
        suggestion: '定义 RBAC 角色和权限关系',
        checkId: 'S1-02',
      });
    }

    return issues;
  }

  // ============ S1-03: 权限校验中间件 (P0) ============

  /**
   * 检测 API 路由是否有权限校验中间件
   */
  private detectMissingAuthMiddleware(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测 API 路由定义
    const hasAPIRoute =
      /router\.(get|post|put|delete)|route\(|@Router|app\.(get|post)/i.test(this.content);

    if (!hasAPIRoute) return issues;

    // 检测中间件
    const hasMiddleware =
      /middleware|authMiddleware|verifyToken|checkAuth|validateSession/i.test(this.content) ||
      /\.use\(.*auth/i.test(this.content);

    // 排除公开接口
    const isPublicEndpoint =
      /public|login|register|health|status/i.test(this.content.toLowerCase());

    if (hasAPIRoute && !hasMiddleware && !isPublicEndpoint) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-permission-check',
        severity: 'P0',
        message: 'API 路由缺少权限校验中间件',
        suggestion: '添加 authMiddleware 或 verifyToken 中间件',
        checkId: 'S1-03',
      });
    }

    return issues;
  }

  // ============ S1-04: 会话管理 (P0) ============

  /**
   * 检测是否有会话超时控制
   */
  private detectMissingSessionTimeout(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测会话相关代码
    const hasSessionCode =
      /session|token|jwt|cookie|redis.*session/i.test(this.content);

    if (!hasSessionCode) return issues;

    // 检测超时配置
    const hasTimeoutConfig =
      /expires|expiry|timeout|maxAge|max_age|ttl|expire/i.test(this.content) ||
      /refreshToken|token.*refresh/i.test(this.content);

    if (hasSessionCode && !hasTimeoutConfig) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-session-timeout',
        severity: 'P0',
        message: '会话/Token 缺少过期时间配置',
        suggestion: '设置合理的过期时间和刷新机制',
        checkId: 'S1-04',
      });
    }

    return issues;
  }

  // ============ S2-01: HTTPS/TLS (P0) ============

  /**
   * 检测是否有 HTTPS 配置
   */
  private detectMissingHTTPS(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测服务器配置
    const isServerConfig =
      /server|app\.listen|https\.createServer|express|fastify|koa/i.test(this.content);

    if (!isServerConfig) return issues;

    // 检测 HTTPS 配置
    const hasHTTPSConfig =
      /https|ssl|tls|certificate|key.*pem|cert.*pem/i.test(this.content) ||
      /secure\s*:\s*true/i.test(this.content);

    // 检测环境配置
    const hasEnvHTTPS = /HTTPS|SSL|TLS/i.test(this.content);

    if (isServerConfig && !hasHTTPSConfig && !hasEnvHTTPS) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-https',
        severity: 'P0',
        message: '服务器缺少 HTTPS/TLS 配置',
        suggestion: '配置 SSL 证书启用 HTTPS',
        checkId: 'S2-01',
      });
    }

    return issues;
  }

  // ============ S2-04: 多租户数据隔离 (P0) ============

  /**
   * 检测是否有租户隔离机制
   */
  private detectMissingTenantIsolation(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测数据库操作
    const hasDBOperation =
      /query|select|insert|update|delete|repository|model/i.test(this.content);

    if (!hasDBOperation) return issues;

    // 检测租户过滤
    const tenantFilterRegex = /tenantId|tenant_id|tenant|organizationId|org_id|where.*tenant|filter.*tenant/i;
    const hasTenantFilter = tenantFilterRegex.test(this.content);

    // 如果是业务服务但没有租户过滤，报告问题
    const isBusinessLogic = /service|business|logic/i.test(this.filePath);

    if (hasDBOperation && isBusinessLogic && !hasTenantFilter) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-tenant-isolation',
        severity: 'P0',
        message: '数据库操作缺少租户隔离',
        suggestion: '在查询中添加 tenant_id 过滤条件',
        checkId: 'S2-04',
      });
    }

    return issues;
  }

  // ============ S3-01: SQL注入防护 (P0) ============

  /**
   * 检测 SQL 注入风险
   */
  private detectSQLInjection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测字符串拼接 SQL
    const sqlConcatPatterns = [
      { regex: /`.*SELECT.*\$\{.*\}/, msg: '模板字符串中使用变量拼接 SQL' },
      { regex: /['"]SELECT.*\+.*['"]/, msg: '字符串拼接 SQL 语句' },
      { regex: /query\s*\(\s*['"`].*\$\{/, msg: '查询中使用字符串插值' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of sqlConcatPatterns) {
        if (p.regex.test(line)) {
          issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'sql-injection',
            severity: 'P0',
            message: p.msg,
            suggestion: '使用参数化查询或 ORM',
            checkId: 'S3-01',
          });
        }
      }
    });

    return issues;
  }

  // ============ S3-02: XSS防护 (P0) ============

  /**
   * 检测 XSS 防护
   */
  private detectXSSProtection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测用户输入处理
    const hasUserInput =
      /req\.body|request\.body|params|query\.param|input/i.test(this.content);

    if (!hasUserInput) return issues;

    // 检测输出编码
    const hasOutputEncoding =
      /escape|encode|sanitize|xss|htmlspecialchars/i.test(this.content) ||
      /DOMPurify|sanitize-html|he\.encode/i.test(this.content);

    // 检测内容安全策略
    const hasCSP = /Content-Security-Policy|csp|script-src/i.test(this.content);

    if (hasUserInput && !hasOutputEncoding && !hasCSP) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'xss-vulnerability',
        severity: 'P0',
        message: '可能缺少 XSS 防护',
        suggestion: '使用输出编码或 CSP',
        checkId: 'S3-02',
      });
    }

    return issues;
  }

  // ============ S3-03: CSRF防护 (后端) (P0) ============

  /**
   * 检测后端 CSRF 防护
   */
  private detectBackendCSRFProtection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测是否有 cookie/session 设置
    const hasCookieOrSession =
      /cookie|session|express-session|cookie-parser/i.test(this.content);

    if (!hasCookieOrSession) return issues;

    // 检测 CSRF 保护
    const hasCSRFProtection =
      /csrf|csrfToken|csrf-protection|csrf-sync|double-submit/i.test(this.content) ||
      /sameSite/i.test(this.content);

    if (hasCookieOrSession && !hasCSRFProtection) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-csrf-protection',
        severity: 'P0',
        message: '后端缺少 CSRF 防护机制',
        suggestion: '使用 csrf 中间件并配置 sameSite cookie',
        checkId: 'S3-03',
      });
    }

    return issues;
  }

  // ============ S3-05: 命令注入防护 (P0) ============

  /**
   * 检测命令注入风险
   */
  private detectCommandInjection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测危险函数
    const dangerousPatterns = [
      { regex: /exec\s*\(\s*.*\$\{/, msg: 'exec 中使用字符串插值' },
      { regex: /execSync\s*\(\s*.*\$\{/, msg: 'execSync 中使用字符串插值' },
      { regex: /spawn\s*\(\s*.*\$\{/, msg: 'spawn 中使用字符串插值' },
      { regex: /system\s*\(/, msg: '使用 system() 函数' },
      { regex: /child_process.*\$\{/, msg: 'child_process 中使用变量' },
    ];

    const lines = this.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of dangerousPatterns) {
        if (p.regex.test(line)) {
          issues.push({
            file: this.filePath,
            line: i + 1,
            column: 1,
            type: 'command-injection',
            severity: 'P0',
            message: p.msg,
            suggestion: '使用白名单或安全的 API',
            checkId: 'S3-05',
          });
        }
      }
    });

    return issues;
  }

  // ============ S4-01: 操作审计日志 (P0) ============

  /**
   * 检测敏感操作是否有审计日志
   */
  private detectBackendAuditLog(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感操作
    const sensitiveOperations = [
      'delete', 'remove', 'drop', 'truncate',
      'update.*permission', 'modify.*role',
      'login', 'logout', 'password', 'reset'
    ];

    const hasSensitiveOp = sensitiveOperations.some(op =>
      new RegExp(op, 'i').test(this.content)
    );

    if (!hasSensitiveOp) return issues;

    // 检测审计日志
    const auditLogRegex = /audit|审计|log\.(info|warn|error).*操作|operation.*log|EventLog|AuditTrail|ActivityLog/i;
    const hasAuditLog = auditLogRegex.test(this.content);

    if (hasSensitiveOp && !hasAuditLog) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-audit-log',
        severity: 'P0',
        message: '敏感操作缺少审计日志',
        suggestion: '使用审计日志记录操作人、时间、行为、结果',
        checkId: 'S4-01',
      });
    }

    return issues;
  }

  // ============ S4-02: 日志保留 (P0) ============

  /**
   * 检测日志是否有保留策略
   */
  private detectMissingLogRetention(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测日志配置
    const hasLogging = /log|logger|winston|pino|morgan/i.test(this.content);

    if (!hasLogging) return issues;

    // 检测保留策略
    const retentionRegex = /retention|expire|TTL|maxDays|maxFiles|rotate|compress|archive/i;
    const hasRetentionPolicy = retentionRegex.test(this.content);

    // 检测日志存储
    const hasLogStorage = /filesystem|file|disk|cloud|elasticsearch/i.test(this.content);

    if (hasLogging && hasLogStorage && !hasRetentionPolicy) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-log-retention',
        severity: 'P0',
        message: '日志缺少保留策略',
        suggestion: '配置日志过期时间和归档策略',
        checkId: 'S4-02',
      });
    }

    return issues;
  }

  // ============ S5-02: OAuth2 (P1) ============

  /**
   * 检测是否有 OAuth2 实现
   */
  private detectMissingOAuth2(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测第三方登录
    const hasThirdPartyAuth =
      /oauth|oauth2|google|github|wechat|weixin|facebook|gitlab/i.test(this.content);

    if (!hasThirdPartyAuth) return issues;

    // 检测 OAuth 实现
    const hasOAuthImpl =
      /oauth2|OAuth2|authorize|token.*endpoint|client.*secret/i.test(this.content) ||
      /passport|pkce/i.test(this.content);

    if (hasThirdPartyAuth && !hasOAuthImpl) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-oauth2',
        severity: 'P1',
        message: '第三方登录可能缺少标准 OAuth2 实现',
        suggestion: '使用 passport.js 或实现标准 OAuth2 流程',
        checkId: 'S5-02',
      });
    }

    return issues;
  }

  // ============ S5-03: Webhook 签名 (P1) ============

  /**
   * 检测 Webhook 是否有签名验证
   */
  private detectMissingWebhookSignature(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测 webhook 处理
    const hasWebhook = /webhook|hook|callback|notify/i.test(this.content);

    if (!hasWebhook) return issues;

    // 检测签名验证
    const hasSignatureCheck =
      /signature|sign|verify|hmac|sha256.*webhook|hookSecret/i.test(this.content) ||
      /crypto.*verify|verifySignature/i.test(this.content);

    if (hasWebhook && !hasSignatureCheck) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-webhook-signature',
        severity: 'P1',
        message: 'Webhook 缺少签名验证',
        suggestion: '使用 HMAC-SHA256 验证请求签名',
        checkId: 'S5-03',
      });
    }

    return issues;
  }

  // ============ S5-04: 回调数据校验 (P0) ============

  /**
   * 检测回调数据是否有校验
   */
  private detectMissingCallbackValidation(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测回调/webhook 端点
    const hasCallback = /callback|webhook|notify|ipn|async/i.test(this.content);

    if (!hasCallback) return issues;

    // 检测数据校验
    const hasValidation =
      /validate|verify|check.*data|schema|joi|zod|Yup|validator/i.test(this.content);

    // 检测签名验证
    const hasSignatureCheck = /signature|sign|verify/i.test(this.content);

    if (hasCallback && !hasValidation && !hasSignatureCheck) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-callback-validation',
        severity: 'P0',
        message: '回调接口缺少数据校验',
        suggestion: '使用 schema 验证回调数据并验证签名',
        checkId: 'S5-04',
      });
    }

    return issues;
  }

  // ============ S1-05: 密码策略 (P0) ============

  /**
   * 检测密码策略实现（复杂度、哈希等）
   */
  private detectMissingPasswordPolicy(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测密码处理代码
    const hasPasswordHandling =
      /password|passwd|pwd|登录|register|signUp|createUser/i.test(this.content);

    if (!hasPasswordHandling) return issues;

    // 检测密码策略
    const hasPasswordPolicy =
      // 密码哈希
      /bcrypt|argon2|scrypt|pbkdf2|hash.*password/i.test(this.content) ||
      // 复杂度验证
      /password.*policy|password.*rule|password.*validation|complexity|minLength.*password/i.test(this.content) ||
      // 密码强度检测
      /zxcvbn|password.*strength|check.*password.*strength/i.test(this.content) ||
      // 密码不匹配检测
      /password.*confirm|confirm.*password/i.test(this.content);

    if (hasPasswordHandling && !hasPasswordPolicy) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-password-policy',
        severity: 'P0',
        message: '密码处理缺少安全策略',
        suggestion: '实现密码哈希（bcrypt/argon2）和复杂度验证',
        checkId: 'S1-05',
      });
    }

    return issues;
  }

  // ============ S2-02: 存储加密 (P1) ============

  /**
   * 检测是否有敏感数据存储加密
   */
  private detectMissingStorageEncryption(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测敏感数据存储
    const hasSensitiveDataStorage =
      /password|secret|token|key|credential|apiKey|privateKey/i.test(this.content) &&
      /save|store|insert|update|create.*user|create.*account/i.test(this.content);

    if (!hasSensitiveDataStorage) return issues;

    // 检测加密机制
    const hasEncryption =
      /encrypt|aes|crypto|cipher|mask.*sensitive|hash.*password/i.test(this.content) ||
      /crypto.*encrypt|encrypt.*password|encrypt.*secret/i.test(this.content) ||
      /dotenv.*encrypt|secure.*storage|keyVault|keyvault/i.test(this.content);

    if (hasSensitiveDataStorage && !hasEncryption) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-storage-encryption',
        severity: 'P1',
        message: '敏感数据存储可能缺少加密',
        suggestion: '使用 AES-256 加密敏感字段或使用密钥管理服务',
        checkId: 'S2-02',
      });
    }

    return issues;
  }

  // ============ S2-05: 隐私合规 (后端) (P0) ============

  /**
   * 检测后端隐私合规机制
   */
  private detectMissingPrivacyCompliance(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测个人数据处理
    const hasPersonalDataProcessing =
      /user.*personal|personal.*data|pii|person.*info/i.test(this.content) ||
      /phone|mobile|email|idCard|identityCard|bankCard/i.test(this.content) ||
      /gdpr|privacy.*law|personal.*data.*protect|consent/i.test(this.content);

    if (!hasPersonalDataProcessing) return issues;

    // 检测合规机制
    const hasCompliance =
      /gdpr|consent|right.*erasure|right.*access|data.*deletion|anonymize|pseudonymize/i.test(this.content) ||
      /data.*retention|privacy.*policy|personal.*data.*protect.*law/i.test(this.content) ||
      /user.*consent|opt-out|optIn|optOut/i.test(this.content) ||
      /data.*export|data.*portability/i.test(this.content);

    if (hasPersonalDataProcessing && !hasCompliance) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-privacy-compliance',
        severity: 'P0',
        message: '处理个人数据缺少隐私合规机制',
        suggestion: '实现 GDPR/个保法要求的同意、删除、导出等机制',
        checkId: 'S2-05',
      });
    }

    return issues;
  }

  // ============ S4-03: 异常行为检测 (P1) ============

  /**
   * 检测是否有异常行为检测
   */
  private detectMissingAnomalyDetection(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测登录相关代码
    const hasAuthRelated =
      /login|signIn|authenticate|password|attempt|fail/i.test(this.content);

    if (!hasAuthRelated) return issues;

    // 检测异常行为检测机制
    const hasAnomalyDetection =
      /rate.*limit|rateLimit|throttle|lockout|failed.*attempt/i.test(this.content) ||
      /brute.*force|unusual.*activity|anomaly|abuse.*detection/i.test(this.content) ||
      /max.*attempt|retry.*limit|login.*fail/i.test(this.content) ||
      /suspicious.*activity|security.*event|threat.*detect/i.test(this.content);

    if (hasAuthRelated && !hasAnomalyDetection) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-anomaly-detection',
        severity: 'P1',
        message: '认证相关操作缺少异常行为检测',
        suggestion: '实现登录失败次数限制、暴力破解检测、异常行为监控',
        checkId: 'S4-03',
      });
    }

    return issues;
  }

  // ============ S4-04: 漏洞扫描 (P1) ============

  /**
   * 检测是否有漏洞扫描配置
   */
  private detectMissingVulnerabilityScan(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 只检查配置文件
    const isConfigFile =
      /package\.json|Dockerfile|\.github|ci\.yml|docker-compose|\.gitlab-ci/i.test(this.filePath);

    if (!isConfigFile) return issues;

    // 检测漏洞扫描
    const hasVulnScan =
      /npm.*audit|security.*scan|snyk|dependabot|whitesource|sonatype/i.test(this.content) ||
      /trivy|anchore|clair|bandit|safety/i.test(this.content) ||
      /code.*scan|security.*check|vulnerability.*scan/i.test(this.content);

    if (!hasVulnScan) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-vulnerability-scan',
        severity: 'P1',
        message: '配置中缺少漏洞扫描',
        suggestion: '配置 npm audit、dependabot、trivy 等进行依赖和容器漏洞扫描',
        checkId: 'S4-04',
      });
    }

    return issues;
  }

  // ============ S4-05: 安全事件响应 (P1) ============

  /**
   * 检测是否有安全事件响应机制
   */
  private detectMissingIncidentResponse(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测安全相关代码
    const hasSecurityCode =
      /security|incident|breach|alert|alarm|threat|attack/i.test(this.content);

    if (!hasSecurityCode) return issues;

    // 检测事件响应机制
    const hasIncidentResponse =
      /incident.*response|security.*playbook|escalation|notify.*security/i.test(this.content) ||
      /alert.*rule|alert.*policy|security.*team|security.*notify/i.test(this.content) ||
      /SIEM|SOAR|security.*incident|breach.*response/i.test(this.content) ||
      /emergency.*contact|security.*contact|critical.*alert/i.test(this.content);

    if (hasSecurityCode && !hasIncidentResponse) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-incident-response',
        severity: 'P1',
        message: '安全模块缺少事件响应机制',
        suggestion: '定义安全事件响应流程、告警升级策略和应急联系人',
        checkId: 'S4-05',
      });
    }

    return issues;
  }

  // ============ S5-05: 依赖安全扫描 (后端) (P1) ============

  /**
   * 检测依赖安全扫描配置
   */
  private detectMissingDependencyScan(): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 只检查 package.json 文件
    if (!this.filePath.includes('package.json')) return issues;

    // 检测安全扫描配置
    const hasSecurityScan =
      /npm.*audit|audit.*security|dependabot|snyk|renovate/i.test(this.content) ||
      /"security"/.test(this.content);

    if (!hasSecurityScan) {
      issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-dependency-scan',
        severity: 'P1',
        message: 'package.json 缺少依赖安全扫描配置',
        suggestion: '配置 npm audit、dependabot 或 snyk 进行依赖漏洞扫描',
        checkId: 'S5-05',
      });
    }

    return issues;
  }
}

// ============ 批量扫描器 ============

export class SSecurityScanner {
  private frontendPath: string;
  private backendPath: string;

  constructor(
    frontendPath: string = 'orion-frontend/src/pages/',
    backendPath: string = 'orion-platform-service/src/services/'
  ) {
    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
  }

  /**
   * 扫描前端文件
   */
  async scanFrontend(maxFiles: number = 50): Promise<SecurityIssue[]> {
    const allIssues: SecurityIssue[] = [];
    const files = this.getTsxFiles(this.frontendPath).slice(0, maxFiles);

    console.log(`🔒 开始扫描前端安全 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new SSecurityAnalyzerFrontend(file);
        const issues = analyzer.analyze();
        allIssues.push(...issues);
      } catch {
        // 忽略解析错误
      }
    }

    console.log(`✅ 前端安全扫描完成，发现 ${allIssues.length} 个问题`);
    return allIssues;
  }

  /**
   * 扫描后端文件
   */
  async scanBackend(maxFiles: number = 50): Promise<SecurityIssue[]> {
    const allIssues: SecurityIssue[] = [];
    const files = this.getTsFiles(this.backendPath).slice(0, maxFiles);

    console.log(`🔒 开始扫描后端安全 (${files.length} 个)...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new SSecurityAnalyzerBackend(file);
        const issues = analyzer.analyze();
        allIssues.push(...issues);
      } catch {
        // 忽略解析错误
      }
    }

    console.log(`✅ 后端安全扫描完成，发现 ${allIssues.length} 个问题`);
    return allIssues;
  }

  /**
   * 完整扫描
   */
  async scan(frontendMax: number = 50, backendMax: number = 50): Promise<SecurityIssue[]> {
    const frontendIssues = await this.scanFrontend(frontendMax);
    const backendIssues = await this.scanBackend(backendMax);

    return [...frontendIssues, ...backendIssues];
  }

  /**
   * 按严重程度分组
   */
  groupBySeverity(issues: SecurityIssue[]): Record<string, SecurityIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
      P2: issues.filter(i => i.severity === 'P2'),
    };
  }

  /**
   * 按检查项分组
   */
  groupByCheckId(issues: SecurityIssue[]): Record<string, SecurityIssue[]> {
    const groups: Record<string, SecurityIssue[]> = {};

    for (const issue of issues) {
      if (!groups[issue.checkId]) {
        groups[issue.checkId] = [];
      }
      groups[issue.checkId].push(issue);
    }

    return groups;
  }

  private getTsxFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
            files.push(fullPath);
          }
        }
      } catch {
        // 忽略访问错误
      }
    };

    traverse(dir);
    return files;
  }

  private getTsFiles(dir: string): string[] {
    const files: string[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            traverse(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
          }
        }
      } catch {
        // 忽略访问错误
      }
    };

    traverse(dir);
    return files;
  }
}

// ============ CLI 入口 ============

export async function runSecurityScan(
  frontendPath: string = 'orion-frontend/src/pages/',
  backendPath: string = 'orion-platform-service/src/services/',
  frontendMax: number = 50,
  backendMax: number = 50
): Promise<SecurityIssue[]> {
  const scanner = new SSecurityScanner(frontendPath, backendPath);
  return scanner.scan(frontendMax, backendMax);
}

// 使用示例
// runSecurityScan().then(issues => {
//   console.log(JSON.stringify(issues, null, 2));
// });