/**
 * Visor Service - 运维平台代理
 *
 * 代理 Dromara Visor Java 后端服务，提供统一的 HTTP 接口
 * 同时集成 NATS 事件总线和租户隔离
 */

import { config } from '../config';
import type {
  Host,
  Script,
  Task,
  TerminalSession,
  CreateHostInput,
  ExecuteScriptInput,
  VisorQuery,
} from '../types/visor';

export class VisorService {
  private visorUrl: string;
  private apiKey: string;

  constructor() {
    this.visorUrl = config.visor.url;
    this.apiKey = config.visor.apiKey;
  }

  private async proxyToVisor(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.visorUrl}/api${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.visor.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Visor backend error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ==================== Host Management ====================

  async createHost(tenantId: string, input: CreateHostInput): Promise<Host> {
    const result = await this.proxyToVisor('POST', '/v1/hosts', {
      ...input,
      tenantId,
    });
    return result.data;
  }

  async listHosts(query: VisorQuery): Promise<{ data: Host[]; total: number }> {
    const result = await this.proxyToVisor('GET', `/v1/hosts?tenantId=${query.tenantId || ''}&page=${query.page || 1}&limit=${query.limit || 20}`);
    return result.data;
  }

  async getHost(id: string): Promise<Host | null> {
    const result = await this.proxyToVisor('GET', `/v1/hosts/${id}`);
    return result.data;
  }

  async updateHost(id: string, input: Partial<Host>): Promise<Host> {
    const result = await this.proxyToVisor('PUT', `/v1/hosts/${id}`, input);
    return result.data;
  }

  async deleteHost(id: string): Promise<void> {
    await this.proxyToVisor('DELETE', `/v1/hosts/${id}`);
  }

  async pingHost(id: string): Promise<{ online: boolean; latency: number }> {
    const result = await this.proxyToVisor('POST', `/v1/hosts/${id}/ping`);
    return result.data;
  }

  // ==================== Script Management ====================

  async createScript(tenantId: string, userId: string, input: Omit<Script, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<Script> {
    const result = await this.proxyToVisor('POST', '/v1/scripts', {
      ...input,
      tenantId,
      createdBy: userId,
    });
    return result.data;
  }

  async listScripts(tenantId: string): Promise<Script[]> {
    const result = await this.proxyToVisor('GET', `/v1/scripts?tenantId=${tenantId}`);
    return result.data;
  }

  async getScript(id: string): Promise<Script | null> {
    const result = await this.proxyToVisor('GET', `/v1/scripts/${id}`);
    return result.data;
  }

  async updateScript(id: string, input: Partial<Script>): Promise<Script> {
    const result = await this.proxyToVisor('PUT', `/v1/scripts/${id}`, input);
    return result.data;
  }

  async deleteScript(id: string): Promise<void> {
    await this.proxyToVisor('DELETE', `/v1/scripts/${id}`);
  }

  // ==================== Task Execution ====================

  async executeTask(tenantId: string, userId: string, input: ExecuteScriptInput): Promise<Task> {
    const result = await this.proxyToVisor('POST', '/v1/tasks', {
      ...input,
      tenantId,
      createdBy: userId,
    });
    return result.data;
  }

  async listTasks(query: VisorQuery): Promise<{ data: Task[]; total: number }> {
    const result = await this.proxyToVisor('GET', `/v1/tasks?tenantId=${query.tenantId || ''}&page=${query.page || 1}&limit=${query.limit || 20}`);
    return result.data;
  }

  async getTask(id: string): Promise<Task | null> {
    const result = await this.proxyToVisor('GET', `/v1/tasks/${id}`);
    return result.data;
  }

  async cancelTask(id: string): Promise<Task> {
    const result = await this.proxyToVisor('POST', `/v1/tasks/${id}/cancel`);
    return result.data;
  }

  async getTaskLog(id: string): Promise<string> {
    const result = await this.proxyToVisor('GET', `/v1/tasks/${id}/log`);
    return result.data;
  }

  // ==================== Terminal ====================

  async createTerminalSession(hostId: string, userId: string): Promise<TerminalSession> {
    const result = await this.proxyToVisor('POST', '/v1/terminal', {
      hostId,
      userId,
    });
    return result.data;
  }

  async closeTerminalSession(id: string): Promise<void> {
    await this.proxyToVisor('DELETE', `/v1/terminal/${id}`);
  }

  async listActiveSessions(userId: string): Promise<TerminalSession[]> {
    const result = await this.proxyToVisor('GET', `/v1/terminal?userId=${userId}`);
    return result.data;
  }
}
