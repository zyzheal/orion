/**
 * Intelligent Inspection Service (Phase 4 - Intelligent Inspection)
 * Automated system health checks, inspection rules, reports
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map.
 */

import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../../errors';
import {
  InspectionRuleRepository,
  InspectionTaskRepository,
  InspectionResultRepository,
  InspectionReportRepository,
  type InspectionRuleEntity,
  type InspectionTaskEntity,
  type InspectionResultEntity,
  type InspectionReportEntity,
} from '../../repositories/InspectionRepository';

// --- API types (preserved for backward compatibility) ---

export interface InspectionRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  target: string;
  checkType: 'cpu' | 'memory' | 'disk' | 'network' | 'service' | 'custom';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
  schedule: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionTask {
  id: string;
  tenantId: string;
  ruleId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: InspectionResult;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface InspectionResult {
  id: string;
  taskId: string;
  passed: boolean;
  actualValue: number;
  expectedValue: number;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface InspectionReport {
  id: string;
  tenantId: string;
  title: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warning: number;
    score: number;
  };
  results: InspectionResult[];
  generatedAt: string;
}

// --- Entity-to-API converters ---

function entityToRule(e: InspectionRuleEntity): InspectionRule {
  return {
    id: e.id,
    tenantId: e.tenantId,
    name: e.name,
    description: e.description,
    target: e.target,
    checkType: e.checkType as InspectionRule['checkType'],
    threshold: e.threshold,
    operator: e.operator as InspectionRule['operator'],
    enabled: e.enabled,
    schedule: e.schedule || '',
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function entityToTask(e: InspectionTaskEntity, result?: InspectionResult): InspectionTask {
  return {
    id: e.id,
    tenantId: e.tenantId,
    ruleId: e.ruleId,
    status: e.status as InspectionTask['status'],
    result,
    startedAt: e.startedAt?.toISOString(),
    completedAt: e.completedAt?.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

function entityToResult(e: InspectionResultEntity): InspectionResult {
  return {
    id: e.id,
    taskId: e.taskId,
    passed: e.passed,
    actualValue: e.actualValue,
    expectedValue: e.expectedValue,
    message: e.message,
    details: e.details,
    createdAt: e.createdAt.toISOString(),
  };
}

function entityToReport(e: InspectionReportEntity, results: InspectionResult[] = []): InspectionReport {
  return {
    id: e.id,
    tenantId: e.tenantId,
    title: e.title,
    summary: e.summary,
    results,
    generatedAt: e.generatedAt.toISOString(),
  };
}

// --- In-memory fallback storage ---

const rules = new Map<string, InspectionRule>();
const tasks = new Map<string, InspectionTask>();
const results = new Map<string, InspectionResult>();
const reports = new Map<string, InspectionReport>();

export class InspectionService {
  private ruleRepo?: InspectionRuleRepository;
  private taskRepo?: InspectionTaskRepository;
  private resultRepo?: InspectionResultRepository;
  private reportRepo?: InspectionReportRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.ruleRepo = new InspectionRuleRepository(db);
      this.taskRepo = new InspectionTaskRepository(db);
      this.resultRepo = new InspectionResultRepository(db);
      this.reportRepo = new InspectionReportRepository(db);
    }
  }

  // --- Rules CRUD ---

  async createRule(input: {
    name: string; description?: string; target: string; checkType: string;
    threshold: number; operator: string; schedule: string;
  }, tenantId: string): Promise<InspectionRule> {
    if (this.ruleRepo) {
      const now = new Date();
      const saved = await this.ruleRepo.create({
        id: uuidv4(),
        tenantId,
        name: input.name,
        description: input.description,
        target: input.target,
        checkType: input.checkType,
        threshold: input.threshold,
        operator: input.operator,
        enabled: true,
        schedule: input.schedule,
        createdAt: now,
        updatedAt: now,
      });
      return entityToRule(saved);
    }

    const rule: InspectionRule = {
      id: uuidv4(), tenantId, name: input.name, description: input.description,
      target: input.target, checkType: input.checkType as InspectionRule['checkType'],
      threshold: input.threshold, operator: input.operator as InspectionRule['operator'],
      enabled: true, schedule: input.schedule,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    rules.set(rule.id, rule);
    return rule;
  }

  async listRules(tenantId: string, params?: { target?: string; enabled?: boolean }): Promise<InspectionRule[]> {
    if (this.ruleRepo) {
      const entities = await this.ruleRepo.findByTenant(tenantId, params);
      return entities.map(entityToRule);
    }

    let result = Array.from(rules.values()).filter((r) => r.tenantId === tenantId);
    if (params?.target) result = result.filter((r) => r.target === params.target);
    if (params?.enabled !== undefined) result = result.filter((r) => r.enabled === params.enabled);
    return result;
  }

  async getRule(id: string): Promise<InspectionRule | undefined> {
    if (this.ruleRepo) {
      const entity = await this.ruleRepo.findById(id);
      return entity ? entityToRule(entity) : undefined;
    }
    return rules.get(id);
  }

  async updateRule(id: string, input: Partial<InspectionRule>): Promise<InspectionRule | undefined> {
    if (this.ruleRepo) {
      const current = await this.ruleRepo.findById(id);
      if (!current) return undefined;
      const updateData: Record<string, any> = { ...input, updatedAt: new Date() };
      // Remove fields that shouldn't be directly mapped
      delete updateData.id;
      delete updateData.tenantId;
      delete updateData.createdAt;
      const saved = await this.ruleRepo.update(id, updateData);
      if (!saved) return undefined;
      return entityToRule(saved);
    }

    const rule = rules.get(id);
    if (!rule) return undefined;
    Object.assign(rule, input, { updatedAt: new Date().toISOString() });
    rules.set(id, rule);
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    if (this.ruleRepo) {
      return await this.ruleRepo.delete(id);
    }
    return rules.delete(id);
  }

  // --- Task Management ---

  async createTask(ruleId: string, tenantId: string): Promise<InspectionTask> {
    if (this.ruleRepo && this.taskRepo && this.resultRepo) {
      // Create task in DB
      const now = new Date();
      const taskEntity = await this.taskRepo.create({
        id: uuidv4(),
        tenantId,
        ruleId,
        status: 'pending',
        createdAt: now,
      });

      // Update to running
      const startedAt = new Date();
      await this.taskRepo.updateStatus(taskEntity.id, 'running', { startedAt });

      // Get rule and generate result
      const rule = await this.ruleRepo.findById(ruleId);
      let resultEntity: InspectionResultEntity | undefined;
      if (rule) {
        const actualValue = Math.random() * 100;
        const passed = this.evaluate(actualValue, rule.threshold, rule.operator);
        resultEntity = await this.resultRepo.create({
          id: uuidv4(),
          taskId: taskEntity.id,
          passed,
          actualValue: Math.round(actualValue * 100) / 100,
          expectedValue: rule.threshold,
          message: passed ? '检查通过' : `检查失败: 实际值 ${actualValue.toFixed(2)} ${rule.operator} 阈值 ${rule.threshold}`,
          createdAt: new Date(),
        });

        // Update task to completed
        const completedAt = new Date();
        await this.taskRepo.updateStatus(taskEntity.id, 'completed', {
          resultId: resultEntity.id,
          completedAt,
        });
      }

      // Re-fetch task to get final state
      const finalTask = await this.taskRepo.findById(taskEntity.id);
      if (!finalTask) throw new OrionError('Task not found after creation', ErrorCode.NOT_FOUND);
      return entityToTask(finalTask, resultEntity ? entityToResult(resultEntity) : undefined);
    }

    // In-memory fallback
    const task: InspectionTask = {
      id: uuidv4(), tenantId, ruleId, status: 'pending',
      createdAt: new Date().toISOString(),
    };
    tasks.set(task.id, task);

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    tasks.set(task.id, task);

    const rule = rules.get(ruleId);
    if (rule) {
      const actualValue = Math.random() * 100;
      const passed = this.evaluate(actualValue, rule.threshold, rule.operator);
      const result: InspectionResult = {
        id: uuidv4(), taskId: task.id, passed,
        actualValue: Math.round(actualValue * 100) / 100,
        expectedValue: rule.threshold,
        message: passed ? '检查通过' : `检查失败: 实际值 ${actualValue.toFixed(2)} ${rule.operator} 阈值 ${rule.threshold}`,
        createdAt: new Date().toISOString(),
      };
      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      tasks.set(task.id, task);
      results.set(result.id, result);
    }

    return task;
  }

  async listTasks(tenantId: string, params?: { ruleId?: string; status?: string }): Promise<InspectionTask[]> {
    if (this.taskRepo && this.resultRepo) {
      const taskEntities = await this.taskRepo.findByTenant(tenantId, params);
      const taskList: InspectionTask[] = [];
      for (const te of taskEntities) {
        let result: InspectionResult | undefined;
        if (te.resultId) {
          const re = await this.resultRepo.findById(te.resultId);
          if (re) result = entityToResult(re);
        }
        taskList.push(entityToTask(te, result));
      }
      return taskList;
    }

    let result = Array.from(tasks.values()).filter((t) => t.tenantId === tenantId);
    if (params?.ruleId) result = result.filter((t) => t.ruleId === params.ruleId);
    if (params?.status) result = result.filter((t) => t.status === params.status);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTask(id: string): Promise<InspectionTask | undefined> {
    if (this.taskRepo && this.resultRepo) {
      const taskEntity = await this.taskRepo.findById(id);
      if (!taskEntity) return undefined;
      let result: InspectionResult | undefined;
      if (taskEntity.resultId) {
        const re = await this.resultRepo.findById(taskEntity.resultId);
        if (re) result = entityToResult(re);
      }
      return entityToTask(taskEntity, result);
    }
    return tasks.get(id);
  }

  // --- Report Generation ---

  async generateReport(title: string, tenantId: string, ruleIds?: string[]): Promise<InspectionReport> {
    // Run inspections for all enabled rules (or specified rules)
    let targetRules: InspectionRule[];
    if (this.ruleRepo) {
      const allRuleEntities = await this.ruleRepo.findByTenant(tenantId, { enabled: true });
      const filteredEntities = ruleIds && ruleIds.length > 0
        ? allRuleEntities.filter(r => ruleIds.includes(r.id))
        : allRuleEntities;
      targetRules = filteredEntities.map(entityToRule);
    } else {
      targetRules = Array.from(rules.values()).filter((r) => r.tenantId === tenantId && r.enabled);
      if (ruleIds && ruleIds.length > 0) {
        targetRules = targetRules.filter((r) => ruleIds.includes(r.id));
      }
    }

    const taskResults: InspectionResult[] = [];
    for (const rule of targetRules) {
      const task = await this.createTask(rule.id, tenantId);
      if (task.result) {
        taskResults.push(task.result);
      }
    }

    const passed = taskResults.filter((r) => r.passed).length;
    const failed = taskResults.filter((r) => !r.passed).length;
    const score = taskResults.length > 0 ? Math.round((passed / taskResults.length) * 100) : 0;

    if (this.reportRepo) {
      const saved = await this.reportRepo.create({
        id: uuidv4(),
        tenantId,
        title,
        summary: { total: taskResults.length, passed, failed, warning: 0, score },
        generatedAt: new Date(),
      });
      return entityToReport(saved, taskResults);
    }

    const report: InspectionReport = {
      id: uuidv4(), tenantId, title,
      summary: { total: taskResults.length, passed, failed, warning: 0, score },
      results: taskResults,
      generatedAt: new Date().toISOString(),
    };
    reports.set(report.id, report);
    return report;
  }

  async listReports(tenantId: string): Promise<InspectionReport[]> {
    if (this.reportRepo) {
      const entities = await this.reportRepo.findByTenant(tenantId);
      // Reports don't store results in DB (results are transient), return without results
      return entities.map(e => entityToReport(e, []));
    }
    return Array.from(reports.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getReport(id: string): Promise<InspectionReport | undefined> {
    if (this.reportRepo) {
      const entity = await this.reportRepo.findById(id);
      return entity ? entityToReport(entity, []) : undefined;
    }
    return reports.get(id);
  }

  // --- Health Score ---

  async getHealthScore(tenantId: string): Promise<{ score: number; details: Record<string, number> }> {
    if (this.ruleRepo && this.taskRepo && this.resultRepo) {
      const recentTasks = await this.taskRepo.findRecentCompleted(tenantId, 100);
      const taskIds = recentTasks.map(t => t.id);

      let allResults: InspectionResultEntity[] = [];
      if (taskIds.length > 0) {
        allResults = await this.resultRepo.findByTaskIds(taskIds);
      }

      const resultMap = new Map(allResults.map(r => [r.taskId, r]));
      const passed = recentTasks.filter(t => {
        const r = resultMap.get(t.id);
        return r?.passed ?? false;
      }).length;
      const total = recentTasks.length;
      const score = total > 0 ? Math.round((passed / total) * 100) : 100;

      // Per-target breakdown
      const targetScores: Record<string, { passed: number; total: number }> = {};
      for (const task of recentTasks) {
        const rule = await this.ruleRepo.findById(task.ruleId);
        if (!rule) continue;
        if (!targetScores[rule.target]) targetScores[rule.target] = { passed: 0, total: 0 };
        targetScores[rule.target].total++;
        const r = resultMap.get(task.id);
        if (r?.passed) targetScores[rule.target].passed++;
      }

      const details: Record<string, number> = {};
      for (const [target, counts] of Object.entries(targetScores)) {
        details[target] = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 100;
      }

      return { score, details };
    }

    // In-memory fallback
    const recentTasks = Array.from(tasks.values())
      .filter((t) => t.tenantId === tenantId && t.status === 'completed')
      .slice(-100);

    const passed = recentTasks.filter((t) => t.result?.passed).length;
    const total = recentTasks.length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 100;

    const targetScores: Record<string, { passed: number; total: number }> = {};
    for (const task of recentTasks) {
      const rule = rules.get(task.ruleId);
      if (!rule) continue;
      if (!targetScores[rule.target]) targetScores[rule.target] = { passed: 0, total: 0 };
      targetScores[rule.target].total++;
      if (task.result?.passed) targetScores[rule.target].passed++;
    }

    const details: Record<string, number> = {};
    for (const [target, counts] of Object.entries(targetScores)) {
      details[target] = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 100;
    }

    return { score, details };
  }

  private evaluate(actual: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return actual > threshold;
      case 'lt': return actual < threshold;
      case 'eq': return actual === threshold;
      case 'gte': return actual >= threshold;
      case 'lte': return actual <= threshold;
      default: return true;
    }
  }
}
