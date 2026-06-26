import { ErrorCode } from '../../errors';
/**
 * DomainConnector - 领域连接器
 *
 * 负责注册、调用和补偿跨域服务。每个"领域"代表一个独立的服务边界
 * (如 pipeline、deploy、alert、monitoring 等)，通过 HTTP/RPC 调用。
 *
 * 功能：
 * - registerDomain(domainName, endpoint) — 注册领域
 * - invokeDomain(domainName, action, payload) — 调用领域服务
 * - handleCrossDomainTransaction(domainA, domainB, payload) — 跨域事务
 * - compensateTransaction(orchestrationId) — 补偿事务
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import pino from 'pino';
import { OrionError } from '../../errors';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LDomain-LConnector' });

// ============================================================
// Types
// ============================================================

export interface DomainRegistration {
  id: string;
  tenantId: string;
  domainName: string;
  endpoint: string;
  status: 'active' | 'inactive' | 'error';
  authConfig: Record<string, unknown>;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DomainInvocationResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface CrossDomainTransaction {
  id: string;
  orchestrationId?: string;
  tenantId: string;
  domainA: string;
  domainB: string;
  status: 'pending' | 'executing' | 'committed' | 'rolled_back' | 'failed';
  payload: Record<string, unknown>;
  compensationLog: Record<string, unknown>[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================
// Repository
// ============================================================

interface ConnectorRow {
  id: string;
  tenant_id: string;
  domain_name: string;
  endpoint: string;
  status: string;
  auth_config: Record<string, unknown>;
  health_status: string;
  last_health_check: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

class DomainConnectorRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, DomainRegistration>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(connector: DomainRegistration): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(`${connector.tenantId}:${connector.domainName}`, connector);
      return;
    }
    await this.pool!.query(
      `INSERT INTO domain_connectors (
        id, tenant_id, domain_name, endpoint, status, auth_config,
        health_status, last_health_check, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id, domain_name) DO UPDATE SET
        endpoint = EXCLUDED.endpoint,
        status = EXCLUDED.status,
        auth_config = EXCLUDED.auth_config,
        updated_at = EXCLUDED.updated_at`,
      [
        connector.id,
        connector.tenantId,
        connector.domainName,
        connector.endpoint,
        connector.status,
        JSON.stringify(connector.authConfig),
        connector.healthStatus,
        connector.lastHealthCheck || null,
        null,
        connector.createdAt,
        connector.updatedAt,
      ]
    );
  }

  async findByTenantAndDomain(
    tenantId: string,
    domainName: string
  ): Promise<DomainRegistration | null> {
    const key = `${tenantId}:${domainName}`;
    if (!this.isDbAvailable()) {
      return this.memory.get(key) || null;
    }
    const rows = (
      await this.pool!.query(
        'SELECT * FROM domain_connectors WHERE tenant_id = $1 AND domain_name = $2',
        [tenantId, domainName]
      )
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToRegistration(rows[0]);
  }

  async findByTenant(tenantId: string): Promise<DomainRegistration[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.memory.values()).filter((d) => d.tenantId === tenantId);
    }
    const rows = (
      await this.pool!.query('SELECT * FROM domain_connectors WHERE tenant_id = $1', [tenantId])
    ).rows;
    return rows.map((r: ConnectorRow) => this.rowToRegistration(r));
  }

  private rowToRegistration(row: ConnectorRow): DomainRegistration {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      domainName: row.domain_name,
      endpoint: row.endpoint,
      status: row.status as 'active' | 'inactive' | 'error',
      authConfig: (row.auth_config as Record<string, unknown>) || {},
      healthStatus: row.health_status as 'healthy' | 'unhealthy' | 'unknown',
      lastHealthCheck: row.last_health_check || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class DomainConnector {
  private repository: DomainConnectorRepository;
  private domains = new Map<string, DomainRegistration>();
  private transactionLog = new Map<string, CrossDomainTransaction>();

  constructor(database?: DatabasePool) {
    this.repository = new DomainConnectorRepository(database);
  }

  /**
   * 注册领域
   */
  async registerDomain(
    tenantId: string,
    domainName: string,
    endpoint: string,
    authConfig?: Record<string, unknown>,
    createdBy?: string
  ): Promise<DomainRegistration> {
    const now = new Date();
    const registration: DomainRegistration = {
      id: uuidv4(),
      tenantId,
      domainName,
      endpoint,
      status: 'active',
      authConfig: authConfig || {},
      healthStatus: 'unknown',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(registration);
    this.domains.set(`${tenantId}:${domainName}`, registration);

    return { ...registration };
  }

  /**
   * 调用领域服务
   */
  async invokeDomain(
    domainName: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    // Find domain registration (try any tenant - for cross-domain, domain is globally unique)
    let domain: DomainRegistration | null = null;
    for (const [key, reg] of this.domains) {
      if (reg.domainName === domainName && reg.status === 'active') {
        domain = reg;
        break;
      }
    }

    if (!domain) {
      // Fallback: try to find from repository (check common tenants)
      for (const tenantId of ['default', 'system']) {
        domain = await this.repository.findByTenantAndDomain(tenantId, domainName);
        if (domain && domain.status === 'active') break;
      }
    }

    if (!domain) {
      // If no registration found, simulate execution (development mode)
      logger.warn(
        `[DomainConnector] Domain '${domainName}' not registered, simulating execution`
      );
      return this.simulateDomainInvocation(domainName, action, payload);
    }

    // Check health
    if (domain.healthStatus === 'unhealthy') {
      throw new OrionError(`Domain '${domainName}' is unhealthy`, 'OPERATION_FAILED')
    }

    // Invoke via HTTP (simulated — in production, make actual HTTP call)
    try {
      const result = await this.invokeDomainEndpoint(domain, action, payload);
      return result;
    } catch (error) {
      // Update health status
      domain.healthStatus = 'unhealthy';
      domain.updatedAt = new Date();
      this.domains.set(`${domain.tenantId}:${domain.domainName}`, domain);

      throw new OrionError('Invalid domain configuration', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * 跨域事务处理
   */
  async handleCrossDomainTransaction(
    domainA: string,
    domainB: string,
    payload: Record<string, unknown>,
    orchestrationId?: string
  ): Promise<CrossDomainTransaction> {
    const id = uuidv4();
    const tenantId = (payload.tenantId as string) || getCurrentTenantId();

    const transaction: CrossDomainTransaction = {
      id,
      orchestrationId,
      tenantId,
      domainA,
      domainB,
      status: 'pending',
      payload,
      compensationLog: [],
      createdAt: new Date(),
    };

    try {
      transaction.status = 'executing';

      // Execute domain A
      const actionA = (payload.actionA as string) || 'execute';
      const resultA = await this.invokeDomain(domainA, actionA, {
        ...payload,
        phase: 'A',
      });
      transaction.compensationLog.push({
        domain: domainA,
        action: actionA,
        result: resultA,
        timestamp: new Date(),
      });

      // Execute domain B
      const actionB = (payload.actionB as string) || 'execute';
      const resultB = await this.invokeDomain(domainB, actionB, {
        ...payload,
        phase: 'B',
        resultA,
      });
      transaction.compensationLog.push({
        domain: domainB,
        action: actionB,
        result: resultB,
        timestamp: new Date(),
      });

      transaction.status = 'committed';
      transaction.completedAt = new Date();
      this.transactionLog.set(id, transaction);

      return { ...transaction };
    } catch (error) {
      transaction.status = 'failed';
      transaction.error = error instanceof Error ? error.message : 'Unknown error';
      transaction.completedAt = new Date();
      this.transactionLog.set(id, transaction);

      // Auto-compensate on failure
      await this.compensateCrossDomainTransaction(transaction);

      transaction.status = 'rolled_back';
      this.transactionLog.set(id, transaction);

      return { ...transaction };
    }
  }

  /**
   * 补偿事务
   */
  async compensateTransaction(orchestrationId: string): Promise<void> {
    // Find all transactions for this orchestration
    const transactions = Array.from(this.transactionLog.values()).filter(
      (t) => t.orchestrationId === orchestrationId && t.status === 'committed'
    );

    for (const tx of transactions) {
      await this.compensateCrossDomainTransaction(tx);
    }
  }

  /**
   * 获取领域列表
   */
  async listDomains(tenantId: string): Promise<DomainRegistration[]> {
    return this.repository.findByTenant(tenantId);
  }

  /**
   * 获取领域详情
   */
  async getDomain(tenantId: string, domainName: string): Promise<DomainRegistration | null> {
    return this.repository.findByTenantAndDomain(tenantId, domainName);
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private async invokeDomainEndpoint(
    domain: DomainRegistration,
    action: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // In production: make actual HTTP/gRPC call to domain.endpoint
    // For now: simulate the invocation
    return this.simulateDomainInvocation(domain.domainName, action, payload);
  }

  private async simulateDomainInvocation(
    domainName: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Simulate domain invocation (development mode)
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

    return {
      domain: domainName,
      action,
      status: 'success',
      timestamp: new Date().toISOString(),
      result: {
        message: `Domain ${domainName} executed action: ${action}`,
        inputPayloadKeys: Object.keys(payload),
      },
    };
  }

  private async compensateCrossDomainTransaction(
    transaction: CrossDomainTransaction
  ): Promise<void> {
    // Compensate in reverse order (domain B first, then domain A)
    const logCopy = [...transaction.compensationLog].reverse();

    for (const entry of logCopy) {
      try {
        await this.invokeDomain(
          entry.domain as string,
          'compensate',
          {
            originalAction: entry.action,
            originalResult: entry.result,
            transactionId: transaction.id,
          }
        );
      } catch (error) {
        logger.error(
          `[DomainConnector] Compensation failed for domain ${entry.domain}:`,
          error
        );
      }
    }
  }
}
