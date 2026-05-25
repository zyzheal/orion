/**
 * Intelligent Inspection Service (Phase 4 - Intelligent Inspection)
 * Automated system health checks, inspection rules, reports
 */

import { v4 as uuidv4 } from 'uuid';

export interface InspectionRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  target: string; // host/service/database/network
  checkType: 'cpu' | 'memory' | 'disk' | 'network' | 'service' | 'custom';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
  schedule: string; // cron expression
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

const rules = new Map<string, InspectionRule>();
const tasks = new Map<string, InspectionTask>();
const results = new Map<string, InspectionResult>();
const reports = new Map<string, InspectionReport>();

export class InspectionService {
  // Rules CRUD
  async createRule(input: {
    name: string; description?: string; target: string; checkType: string;
    threshold: number; operator: string; schedule: string;
  }, tenantId: string): Promise<InspectionRule> {
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
    let result = Array.from(rules.values()).filter((r) => r.tenantId === tenantId);
    if (params?.target) result = result.filter((r) => r.target === params.target);
    if (params?.enabled !== undefined) result = result.filter((r) => r.enabled === params.enabled);
    return result;
  }

  async getRule(id: string): Promise<InspectionRule | undefined> {
    return rules.get(id);
  }

  async updateRule(id: string, input: Partial<InspectionRule>): Promise<InspectionRule | undefined> {
    const rule = rules.get(id);
    if (!rule) return undefined;
    Object.assign(rule, input, { updatedAt: new Date().toISOString() });
    rules.set(id, rule);
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    return rules.delete(id);
  }

  // Task Management
  async createTask(ruleId: string, tenantId: string): Promise<InspectionTask> {
    const task: InspectionTask = {
      id: uuidv4(), tenantId, ruleId, status: 'pending',
      createdAt: new Date().toISOString(),
    };
    tasks.set(task.id, task);

    // Simulate execution
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    tasks.set(task.id, task);

    // Simulate result generation
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
    let result = Array.from(tasks.values()).filter((t) => t.tenantId === tenantId);
    if (params?.ruleId) result = result.filter((t) => t.ruleId === params.ruleId);
    if (params?.status) result = result.filter((t) => t.status === params.status);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTask(id: string): Promise<InspectionTask | undefined> {
    return tasks.get(id);
  }

  // Report Generation
  async generateReport(title: string, tenantId: string, ruleIds?: string[]): Promise<InspectionReport> {
    // Run inspections for all enabled rules (or specified rules)
    let targetRules = Array.from(rules.values()).filter((r) => r.tenantId === tenantId && r.enabled);
    if (ruleIds && ruleIds.length > 0) {
      targetRules = targetRules.filter((r) => ruleIds.includes(r.id));
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
    return Array.from(reports.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getReport(id: string): Promise<InspectionReport | undefined> {
    return reports.get(id);
  }

  // Health Score
  async getHealthScore(tenantId: string): Promise<{ score: number; details: Record<string, number> }> {
    const recentTasks = Array.from(tasks.values())
      .filter((t) => t.tenantId === tenantId && t.status === 'completed')
      .slice(-100);

    const passed = recentTasks.filter((t) => t.result?.passed).length;
    const total = recentTasks.length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 100;

    // Per-target breakdown
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
