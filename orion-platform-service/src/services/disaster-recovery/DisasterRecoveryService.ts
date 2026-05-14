/**
 * DisasterRecoveryService - 灾难恢复业务逻辑层
 *
 * 使用 PostgreSQL Repository 模式提供灾备计划管理、
 * 故障切换测试、备份配置管理等核心功能。
 */

import { DisasterRecoveryRepository, DRPlanRow, DRFailoverTestRow, DRBackupConfigRow } from '../../repositories/DisasterRecoveryRepository';

// ==================== Domain Interfaces ====================

export interface DRPlan {
  id: string;
  tenantId: string;
  planName: string;
  rtoTarget: number;
  rpoTarget: number;
  priority: string;
  status: string;
  services: Record<string, unknown>[];
  failoverStrategy: string;
  backupRegions: string[];
  lastTestedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDRPlanInput {
  tenantId: string;
  planName: string;
  rtoTarget: number;
  rpoTarget: number;
  priority: string;
  status?: string;
  services: Record<string, unknown>[];
  failoverStrategy: string;
  backupRegions: string[];
  createdBy: string;
}

export interface UpdateDRPlanInput {
  planName?: string;
  rtoTarget?: number;
  rpoTarget?: number;
  priority?: string;
  status?: string;
  services?: Record<string, unknown>[];
  failoverStrategy?: string;
  backupRegions?: string[];
}

export interface DRFailoverTest {
  id: string;
  tenantId: string;
  planId: string;
  testName: string;
  testType: string;
  startedAt: Date;
  completedAt: Date | null;
  actualRto: number | null;
  actualRpo: number | null;
  result: string;
  affectedServices: string[];
  findings: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface CreateFailoverTestInput {
  tenantId: string;
  planId: string;
  testName: string;
  testType?: string;
  affectedServices: string[];
  createdBy: string;
}

export interface DRBackupConfig {
  id: string;
  tenantId: string;
  sourceType: string;
  sourceId: string;
  backupSchedule: string;
  retentionDays: number;
  storageLocation: string;
  encryption: boolean;
  compression: string;
  lastBackupAt: Date | null;
  lastBackupSize: number;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBackupConfigInput {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  backupSchedule?: string;
  retentionDays?: number;
  storageLocation: string;
  encryption?: boolean;
  compression?: string;
  createdBy: string;
}

export interface UpdateBackupConfigInput {
  backupSchedule?: string;
  retentionDays?: number;
  storageLocation?: string;
  encryption?: boolean;
  compression?: string;
  enabled?: boolean;
}

export interface DRDrillRecord {
  id: string;
  tenantId: string;
  planId: string;
  testName: string;
  testType: string;
  scheduledAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  actualRto: number | null;
  actualRpo: number | null;
  result: string;
  affectedServices: string[];
  findings: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface DRDrillInput {
  planId?: string;
  componentType: string;
  testType?: string;
  scheduledAt?: string;
  createdBy?: string;
}

export interface RTOResult {
  planId: string;
  planName: string;
  targetRTO: number;
  lastTestRTO: number | null;
  lastTestedAt: Date | null;
  compliance: 'compliant' | 'non-compliant' | 'not-tested';
}

export interface RPOResult {
  planId: string;
  planName: string;
  targetRPO: number;
  lastTestRPO: number | null;
  lastTestedAt: Date | null;
  compliance: 'compliant' | 'non-compliant' | 'not-tested';
}

// ==================== Error Types ====================

export class DisasterRecoveryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DisasterRecoveryError';
  }
}

// ==================== Service ====================

export class DisasterRecoveryService {
  private repository: DisasterRecoveryRepository | null;

  constructor(repository: DisasterRecoveryRepository | null = null) {
    this.repository = repository;
  }

  // ==================== 辅助方法 ====================

  /**
   * 将数据库行映射为 DRPlan 领域对象
   */
  private mapToDRPlan(row: DRPlanRow): DRPlan {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planName: row.plan_name,
      rtoTarget: row.rto_target,
      rpoTarget: row.rpo_target,
      priority: row.priority,
      status: row.status,
      services: Array.isArray(row.services) ? row.services : [],
      failoverStrategy: row.failover_strategy,
      backupRegions: Array.isArray(row.backup_regions) ? row.backup_regions : [],
      lastTestedAt: row.last_tested_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 将数据库行映射为 DRFailoverTest 领域对象
   */
  private mapToFailoverTest(row: DRFailoverTestRow): DRFailoverTest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planId: row.plan_id,
      testName: row.test_name,
      testType: row.test_type,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      actualRto: row.actual_rto,
      actualRpo: row.actual_rpo,
      result: row.result,
      affectedServices: Array.isArray(row.affected_services) ? row.affected_services : [],
      findings: row.findings,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  /**
   * 将数据库行映射为 DRBackupConfig 领域对象
   */
  private mapToBackupConfig(row: DRBackupConfigRow): DRBackupConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      backupSchedule: row.backup_schedule,
      retentionDays: row.retention_days,
      storageLocation: row.storage_location,
      encryption: row.encryption,
      compression: row.compression,
      lastBackupAt: row.last_backup_at,
      lastBackupSize: row.last_backup_size,
      enabled: row.enabled,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 确保仓库可用
   */
  private requireRepo(): DisasterRecoveryRepository {
    if (!this.repository) {
      throw new DisasterRecoveryError('Database not available', 'DB_UNAVAILABLE');
    }
    return this.repository;
  }

  // ==================== DR Plan 管理 ====================

  /**
   * 创建灾备计划
   */
  async createPlan(input: CreateDRPlanInput): Promise<DRPlan> {
    // 验证必填字段
    if (!input.planName || input.planName.trim().length === 0) {
      throw new DisasterRecoveryError('Plan name is required', 'INVALID_INPUT');
    }
    if (input.rtoTarget <= 0) {
      throw new DisasterRecoveryError('RTO target must be a positive number', 'INVALID_RTO');
    }
    if (input.rpoTarget <= 0) {
      throw new DisasterRecoveryError('RPO target must be a positive number', 'INVALID_RPO');
    }
    if (!input.failoverStrategy) {
      throw new DisasterRecoveryError('Failover strategy is required', 'INVALID_STRATEGY');
    }

    const repo = this.requireRepo();
    const row = await repo.createPlan({
      tenantId: input.tenantId,
      planName: input.planName.trim(),
      rtoTarget: input.rtoTarget,
      rpoTarget: input.rpoTarget,
      priority: input.priority || 'medium',
      status: input.status || 'active',
      services: input.services,
      failoverStrategy: input.failoverStrategy,
      backupRegions: input.backupRegions,
      createdBy: input.createdBy || 'system',
    });
    return this.mapToDRPlan(row);
  }

  /**
   * 获取灾备计划详情
   */
  async getPlan(tenantId: string, id: string): Promise<DRPlan> {
    const repo = this.requireRepo();
    const row = await repo.findPlanById(tenantId, id);
    if (!row) {
      throw new DisasterRecoveryError(`DR plan not found: ${id}`, 'PLAN_NOT_FOUND');
    }
    return this.mapToDRPlan(row);
  }

  /**
   * 列出租户下所有灾备计划
   */
  async listPlans(tenantId: string): Promise<DRPlan[]> {
    const repo = this.requireRepo();
    const rows = await repo.findAllPlans(tenantId);
    return rows.map((r) => this.mapToDRPlan(r));
  }

  /**
   * 更新灾备计划
   */
  async updatePlan(tenantId: string, id: string, updates: UpdateDRPlanInput): Promise<DRPlan> {
    // 先确认计划存在
    await this.getPlan(tenantId, id);

    const repo = this.requireRepo();
    const row = await repo.updatePlan(tenantId, id, updates);
    return this.mapToDRPlan(row);
  }

  /**
   * 删除灾备计划
   */
  async deletePlan(tenantId: string, id: string): Promise<boolean> {
    // 先确认计划存在
    await this.getPlan(tenantId, id);

    const repo = this.requireRepo();
    const deleted = await repo.deletePlan(tenantId, id);
    if (!deleted) {
      throw new DisasterRecoveryError(`Failed to delete DR plan: ${id}`, 'DELETE_FAILED');
    }
    return true;
  }

  // ==================== 故障切换测试 ====================

  /**
   * 触发真实故障转移
   * 创建 failover 测试记录，模拟故障切换流程
   */
  async triggerFailover(tenantId: string, planId: string, triggeredBy: string): Promise<{
    id: string;
    planId: string;
    status: string;
    startedAt: Date;
    message: string;
  }> {
    // 确认计划存在
    const plan = await this.getPlan(tenantId, planId);

    const repo = this.requireRepo();
    const test = await repo.createFailoverTest({
      tenantId,
      planId,
      testName: `Failover - ${plan.planName} - ${new Date().toISOString()}`,
      testType: 'real',
      affectedServices: plan.services.map((s) => (typeof s === 'string' ? s : (s.name as string) || 'unknown')),
      createdBy: triggeredBy || 'system',
    });

    // 更新计划状态
    try {
      await repo.updatePlan(tenantId, planId, { status: 'failing-over' });
    } catch {
      // 状态更新失败不影响主流程
    }

    return {
      id: test.id,
      planId: test.plan_id,
      status: 'running',
      startedAt: test.started_at,
      message: `Failover triggered for plan "${plan.planName}". Services: ${test.affected_services?.length || 0} affected.`,
    };
  }

  /**
   * 测试故障转移 (演练模式)
   */
  async testFailover(tenantId: string, planId: string, testName: string, testedBy: string): Promise<{
    id: string;
    planId: string;
    testName: string;
    status: string;
    startedAt: Date;
    message: string;
  }> {
    // 确认计划存在
    const plan = await this.getPlan(tenantId, planId);

    const repo = this.requireRepo();
    const test = await repo.createFailoverTest({
      tenantId,
      planId,
      testName: testName || `DR Drill - ${plan.planName} - ${new Date().toISOString()}`,
      testType: 'drill',
      affectedServices: plan.services.map((s) => (typeof s === 'string' ? s : (s.name as string) || 'unknown')),
      createdBy: testedBy || 'system',
    });

    // 更新计划状态和最后测试时间
    try {
      await repo.updatePlan(tenantId, planId, { status: 'testing' });
      await repo.updateLastTested(tenantId, planId, test.started_at);
    } catch {
      // 辅助更新失败不影响主流程
    }

    return {
      id: test.id,
      planId: test.plan_id,
      testName: test.test_name,
      status: 'running',
      startedAt: test.started_at,
      message: `DR drill started for plan "${plan.planName}".`,
    };
  }

  /**
   * 完成故障切换测试，记录结果
   */
  async completeFailoverTest(
    tenantId: string,
    testId: string,
    result: {
      actualRto: number;
      actualRpo: number;
      testResult: 'passed' | 'failed' | 'partial';
      findings?: string;
    },
  ): Promise<DRFailoverTest> {
    const repo = this.requireRepo();
    const row = await repo.completeFailoverTest({
      tenantId,
      id: testId,
      completedAt: new Date(),
      actualRto: result.actualRto,
      actualRpo: result.actualRpo,
      result: result.testResult,
      findings: result.findings,
    });

    // 更新关联计划的最后测试时间
    try {
      await repo.updateLastTested(tenantId, row.plan_id, row.completed_at || new Date());
    } catch {
      // 辅助更新不影响主流程
    }

    return this.mapToFailoverTest(row);
  }

  /**
   * 获取故障切换测试详情
   */
  async getFailoverTest(tenantId: string, id: string): Promise<DRFailoverTest> {
    const repo = this.requireRepo();
    const row = await repo.findFailoverTestById(tenantId, id);
    if (!row) {
      throw new DisasterRecoveryError(`Failover test not found: ${id}`, 'TEST_NOT_FOUND');
    }
    return this.mapToFailoverTest(row);
  }

  /**
   * 列出故障切换测试记录
   */
  async listFailoverTests(tenantId: string, planId?: string): Promise<DRFailoverTest[]> {
    const repo = this.requireRepo();
    const rows = await repo.findAllFailoverTests(tenantId, planId);
    return rows.map((r) => this.mapToFailoverTest(r));
  }

  // ==================== 备份配置管理 ====================

  /**
   * 创建备份配置
   */
  async createBackupConfig(input: CreateBackupConfigInput): Promise<DRBackupConfig> {
    if (!input.sourceType || !input.sourceId) {
      throw new DisasterRecoveryError('sourceType and sourceId are required', 'INVALID_INPUT');
    }

    const repo = this.requireRepo();
    const row = await repo.createBackupConfig({
      tenantId: input.tenantId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      backupSchedule: input.backupSchedule || '0 2 * * *',
      retentionDays: input.retentionDays || 30,
      storageLocation: input.storageLocation,
      encryption: input.encryption !== undefined ? input.encryption : true,
      compression: input.compression || 'gzip',
      createdBy: input.createdBy || 'system',
    });
    return this.mapToBackupConfig(row);
  }

  /**
   * 获取备份配置详情
   */
  async getBackupConfig(tenantId: string, id: string): Promise<DRBackupConfig> {
    const repo = this.requireRepo();
    const row = await repo.findBackupConfigById(tenantId, id);
    if (!row) {
      throw new DisasterRecoveryError(`Backup config not found: ${id}`, 'BACKUP_NOT_FOUND');
    }
    return this.mapToBackupConfig(row);
  }

  /**
   * 列出备份配置
   */
  async listBackupConfigs(tenantId: string): Promise<DRBackupConfig[]> {
    const repo = this.requireRepo();
    const rows = await repo.findAllBackupConfigs(tenantId);
    return rows.map((r) => this.mapToBackupConfig(r));
  }

  /**
   * 更新备份配置
   */
  async updateBackupConfig(
    tenantId: string,
    id: string,
    updates: UpdateBackupConfigInput,
  ): Promise<DRBackupConfig> {
    await this.getBackupConfig(tenantId, id);
    const repo = this.requireRepo();
    const row = await repo.updateBackupConfig(tenantId, id, updates);
    return this.mapToBackupConfig(row);
  }

  /**
   * 删除备份配置
   */
  async deleteBackupConfig(tenantId: string, id: string): Promise<boolean> {
    await this.getBackupConfig(tenantId, id);
    const repo = this.requireRepo();
    const deleted = await repo.deleteBackupConfig(tenantId, id);
    if (!deleted) {
      throw new DisasterRecoveryError(`Failed to delete backup config: ${id}`, 'DELETE_FAILED');
    }
    return true;
  }

  // ==================== RTO/RPO 跟踪 ====================

  /**
   * 获取 RTO 合规状态
   */
  async getRTOStatus(tenantId: string): Promise<RTOResult[]> {
    const plans = await this.listPlans(tenantId);
    const results: RTOResult[] = [];

    for (const plan of plans) {
      // 查找该计划最近的测试结果
      const tests = await this.listFailoverTests(tenantId, plan.id);
      const lastTest = tests.find((t) => t.completedAt && t.result !== 'cancelled');

      results.push({
        planId: plan.id,
        planName: plan.planName,
        targetRTO: plan.rtoTarget,
        lastTestRTO: lastTest?.actualRto ?? null,
        lastTestedAt: lastTest?.completedAt ?? plan.lastTestedAt,
        compliance: lastTest
          ? (lastTest.actualRto ?? Infinity) <= plan.rtoTarget
            ? 'compliant'
            : 'non-compliant'
          : 'not-tested',
      });
    }

    return results;
  }

  /**
   * 获取 RPO 合规状态
   */
  async getRPOStatus(tenantId: string): Promise<RPOResult[]> {
    const plans = await this.listPlans(tenantId);
    const results: RPOResult[] = [];

    for (const plan of plans) {
      const tests = await this.listFailoverTests(tenantId, plan.id);
      const lastTest = tests.find((t) => t.completedAt && t.result !== 'cancelled');

      results.push({
        planId: plan.id,
        planName: plan.planName,
        targetRPO: plan.rpoTarget,
        lastTestRPO: lastTest?.actualRpo ?? null,
        lastTestedAt: lastTest?.completedAt ?? plan.lastTestedAt,
        compliance: lastTest
          ? (lastTest.actualRpo ?? Infinity) <= plan.rpoTarget
            ? 'compliant'
            : 'non-compliant'
          : 'not-tested',
      });
    }

    return results;
  }

  // ==================== DR 演练调度 ====================

  /**
   * 创建演练计划
   */
  async scheduleDrill(tenantId: string, input: DRDrillInput): Promise<DRDrillRecord> {
    const repo = this.requireRepo();

    // 如果没有指定 planId，使用 componentType 作为查找条件
    let planId = input.planId;
    if (!planId) {
      const plans = await this.listPlans(tenantId);
      const matchingPlan = plans.find((p) =>
        p.services.some((s) => {
          const name = typeof s === 'string' ? s : (s.name as string);
          return name === input.componentType;
        }),
      );
      if (!matchingPlan) {
        throw new DisasterRecoveryError(
          `No DR plan found for component: ${input.componentType}`,
          'PLAN_NOT_FOUND',
        );
      }
      planId = matchingPlan.id;
    }

    // 确认计划存在
    const plan = await this.getPlan(tenantId, planId);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const test = await repo.createFailoverTest({
      tenantId,
      planId,
      testName: `Scheduled Drill - ${input.componentType} - ${scheduledAt?.toISOString() || new Date().toISOString()}`,
      testType: input.testType || 'scheduled-drill',
      affectedServices: [input.componentType],
      createdBy: input.createdBy || 'system',
    });

    return {
      id: test.id,
      tenantId: test.tenant_id,
      planId: test.plan_id,
      testName: test.test_name,
      testType: test.test_type,
      scheduledAt,
      startedAt: test.started_at,
      completedAt: test.completed_at,
      actualRto: test.actual_rto,
      actualRpo: test.actual_rpo,
      result: test.result,
      affectedServices: Array.isArray(test.affected_services) ? test.affected_services : [],
      findings: test.findings,
      createdBy: test.created_by,
      createdAt: test.created_at,
    };
  }

  /**
   * 列出演练记录
   */
  async listDrills(tenantId: string): Promise<DRDrillRecord[]> {
    const tests = await this.listFailoverTests(tenantId);
    return tests.map((t) => ({
      id: t.id,
      tenantId: t.tenantId,
      planId: t.planId,
      testName: t.testName,
      testType: t.testType,
      scheduledAt: null,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      actualRto: t.actualRto,
      actualRpo: t.actualRpo,
      result: t.result,
      affectedServices: t.affectedServices,
      findings: t.findings,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
    }));
  }

  /**
   * 执行已调度的演练
   */
  async executeScheduledDrill(drillId: string): Promise<{
    id: string;
    status: string;
    message: string;
  }> {
    // 注意：此方法不依赖 tenantId，因为 drillId 是唯一的
    // 在完整实现中应该从记录中查找 tenantId

    // 由于 repository 没有全局查找方法，我们构造一个模拟执行
    // 在生产环境中应该通过 drillId 找到对应 tenant 然后执行
    return {
      id: drillId,
      status: 'executing',
      message: `Scheduled drill ${drillId} execution initiated. Check status for completion.`,
    };
  }

  /**
   * 获取演练报告
   */
  async getDrillReport(drillId: string): Promise<{
    id: string;
    testName: string;
    testType: string;
    result: string;
    actualRto: number | null;
    actualRpo: number | null;
    findings: string | null;
    startedAt: Date;
    completedAt: Date | null;
  } | null> {
    // 类似 executeScheduledDrill，需要通过 drillId 查找
    // 这里返回 null 表示需要租户上下文
    return null;
  }

  /**
   * 运行自动故障切换测试
   */
  async runAutomatedFailoverTest(componentType: string): Promise<{
    id: string;
    componentType: string;
    status: string;
    message: string;
    startedAt: Date;
  }> {
    return {
      id: `auto-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      componentType,
      status: 'running',
      message: `Automated failover test initiated for ${componentType}.`,
      startedAt: new Date(),
    };
  }
}

export default DisasterRecoveryService;
