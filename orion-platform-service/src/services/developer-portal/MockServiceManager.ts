/**
 * MockServiceManager - 开发者门户 Mock 服务管理
 *
 * 管理 Mock 规则：创建、编辑、删除、启用/禁用。
 * 支持基于请求路径和方法匹配 Mock 规则，返回预设响应。
 */

import { randomUUID } from 'crypto';
import { DevPortalMockRuleRepository, DevPortalMockRuleEntity } from '../../repositories/DevPortalMockRuleRepository';

// ==================== Type Definitions ====================

export interface MockRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  delay: number;
  enabled: boolean;
  priority: number;
  matchType: 'exact' | 'prefix' | 'regex';
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRuleCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  method: string;
  path: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delay?: number;
  priority?: number;
  matchType?: 'exact' | 'prefix' | 'regex';
}

export interface MockRuleUpdateInput {
  name?: string;
  description?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delay?: number;
  enabled?: boolean;
  priority?: number;
  matchType?: 'exact' | 'prefix' | 'regex';
}

export interface MockMatchResult {
  matched: boolean;
  rule?: MockRule;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  delay: number;
}

export class MockServiceManagerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MockServiceManagerError';
  }
}

// ==================== Service ====================

export class MockServiceManager {
  private rules: Map<string, MockRule> = new Map();
  private repository: DevPortalMockRuleRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new DevPortalMockRuleRepository(db);
    }
  }

  /**
   * 创建 Mock 规则
   */
  async createRule(input: MockRuleCreateInput): Promise<MockRule> {
    if (!input.name || input.name.trim().length === 0) {
      throw new MockServiceManagerError('Name is required', 'INVALID_INPUT');
    }
    if (!input.method || input.method.trim().length === 0) {
      throw new MockServiceManagerError('HTTP method is required', 'INVALID_INPUT');
    }
    if (!input.path || input.path.trim().length === 0) {
      throw new MockServiceManagerError('Path is required', 'INVALID_INPUT');
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const method = input.method.toUpperCase();
    if (!validMethods.includes(method)) {
      throw new MockServiceManagerError(`Invalid HTTP method: ${input.method}`, 'INVALID_INPUT');
    }

    const now = new Date();
    const rule: MockRule = {
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      method,
      path: input.path.trim(),
      statusCode: input.statusCode ?? 200,
      headers: input.headers ?? { 'Content-Type': 'application/json' },
      body: input.body ?? {},
      delay: input.delay ?? 0,
      enabled: true,
      priority: input.priority ?? 0,
      matchType: input.matchType ?? 'exact',
      createdAt: now,
      updatedAt: now,
    };

    this.rules.set(rule.id, rule);

    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.create({
        id: rule.id,
        tenantId: rule.tenantId,
        name: rule.name,
        description: rule.description,
        method: rule.method,
        path: rule.path,
        statusCode: rule.statusCode,
        headers: rule.headers,
        body: rule.body,
        delay: rule.delay,
        enabled: rule.enabled,
        priority: rule.priority,
        matchType: rule.matchType,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return rule;
  }

  /**
   * 获取 Mock 规则详情
   */
  async getRuleById(id: string): Promise<MockRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new MockServiceManagerError(`Mock rule not found: ${id}`, 'RULE_NOT_FOUND');
    }
    return rule;
  }

  /**
   * 列出租户下所有 Mock 规则
   */
  async listRules(
    tenantId: string,
    options?: { enabled?: boolean; method?: string; page?: number; pageSize?: number }
  ): Promise<{ data: MockRule[]; total: number; page: number; totalPages: number }> {
    let rules = Array.from(this.rules.values()).filter((r) => r.tenantId === tenantId);

    if (options?.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === options.enabled);
    }
    if (options?.method) {
      rules = rules.filter((r) => r.method === options.method!.toUpperCase());
    }

    // Sort by priority DESC, then createdAt DESC
    rules.sort((a, b) => b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime());

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const total = rules.length;
    const start = (page - 1) * pageSize;
    const data = rules.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 更新 Mock 规则
   */
  async updateRule(id: string, input: MockRuleUpdateInput): Promise<MockRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new MockServiceManagerError(`Mock rule not found: ${id}`, 'RULE_NOT_FOUND');
    }

    if (input.method) {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      const method = input.method.toUpperCase();
      if (!validMethods.includes(method)) {
        throw new MockServiceManagerError(`Invalid HTTP method: ${input.method}`, 'INVALID_INPUT');
      }
      rule.method = method;
    }
    if (input.name !== undefined) rule.name = input.name.trim();
    if (input.description !== undefined) rule.description = input.description.trim();
    if (input.path !== undefined) rule.path = input.path.trim();
    if (input.statusCode !== undefined) rule.statusCode = input.statusCode;
    if (input.headers !== undefined) rule.headers = input.headers;
    if (input.body !== undefined) rule.body = input.body;
    if (input.delay !== undefined) rule.delay = input.delay;
    if (input.enabled !== undefined) rule.enabled = input.enabled;
    if (input.priority !== undefined) rule.priority = input.priority;
    if (input.matchType !== undefined) rule.matchType = input.matchType;

    rule.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.update(id, {
        name: rule.name,
        description: rule.description,
        method: rule.method,
        path: rule.path,
        statusCode: rule.statusCode,
        headers: rule.headers,
        body: rule.body as any,
        delay: rule.delay,
        enabled: rule.enabled,
        priority: rule.priority,
        matchType: rule.matchType,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return rule;
  }

  /**
   * 删除 Mock 规则
   */
  async deleteRule(id: string): Promise<boolean> {
    if (!this.rules.has(id)) {
      throw new MockServiceManagerError(`Mock rule not found: ${id}`, 'RULE_NOT_FOUND');
    }
    this.rules.delete(id);
    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.delete(id).catch(() => { /* 持久化失败不阻塞 */ });
    }
    return true;
  }

  /**
   * 切换 Mock 规则启用状态
   */
  async toggleRule(id: string): Promise<MockRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new MockServiceManagerError(`Mock rule not found: ${id}`, 'RULE_NOT_FOUND');
    }
    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date();
    // PostgreSQL 持久化（异步）
    if (this.repository) {
      this.repository.toggleEnabled(id).catch(() => { /* 持久化失败不阻塞 */ });
    }
    return rule;
  }

  /**
   * 模拟请求匹配：根据 method + path 匹配规则，返回 Mock 响应
   */
  async matchRequest(
    tenantId: string,
    method: string,
    path: string
  ): Promise<MockMatchResult> {
    const rules = Array.from(this.rules.values())
      .filter((r) => r.tenantId === tenantId && r.enabled && r.method === method.toUpperCase())
      .sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      let matched = false;

      switch (rule.matchType) {
        case 'exact':
          matched = path === rule.path;
          break;
        case 'prefix':
          matched = path.startsWith(rule.path);
          break;
        case 'regex':
          try {
            matched = new RegExp(rule.path).test(path);
          } catch {
            matched = false;
          }
          break;
      }

      if (matched) {
        return {
          matched: true,
          rule,
          statusCode: rule.statusCode,
          headers: { ...rule.headers },
          body: rule.body,
          delay: rule.delay,
        };
      }
    }

    return { matched: false, statusCode: 404, headers: {}, body: null, delay: 0 };
  }

  /**
   * 获取 Mock 统计
   */
  async getStats(tenantId: string): Promise<{ total: number; enabled: number; disabled: number }> {
    const rules = Array.from(this.rules.values()).filter((r) => r.tenantId === tenantId);
    return {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
    };
  }
}
