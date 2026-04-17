/**
 * IaC Plan Service - Plan generation tracking, AI review, policy check
 */

import { EventBusService } from '../event-bus-service';
import {
  IaCPlan,
  IaCPlanCreateInput,
  IaCPlanStatus,
  createIaCPlan,
} from '../../models/IacWorkspace';
import { WorkspaceService } from './WorkspaceService';

export interface IaCPlanListFilter {
  workspaceId?: string;
  status?: IaCPlanStatus;
  page?: number;
  perPage?: number;
}

export class PlanService {
  private plans: Map<string, IaCPlan> = new Map();
  private workspaceService: WorkspaceService;
  private eventBus?: EventBusService;

  constructor(options: { workspaceService: WorkspaceService; eventBus?: EventBusService }) {
    this.workspaceService = options.workspaceService;
    this.eventBus = options.eventBus;
  }

  // ==================== Plan CRUD ====================

  async create(input: IaCPlanCreateInput): Promise<IaCPlan> {
    const plan = createIaCPlan(input);
    this.plans.set(plan.id, plan);

    // Simulate plan generation
    plan.status = 'running';
    this.plans.set(plan.id, plan);

    // Simulate completion with mock resource changes
    plan.status = 'completed';
    plan.resourceChanges = {
      add: 3,
      change: 1,
      destroy: 0,
      details: [
        { action: 'add', type: 'aws_instance', name: 'web_server' },
        { action: 'add', type: 'aws_security_group', name: 'web_sg' },
        { action: 'add', type: 'aws_s3_bucket', name: 'assets' },
        { action: 'change', type: 'aws_instance', name: 'api_server' },
      ],
    };
    plan.costEstimate = {
      monthlyCost: 127.5,
      previousCost: 85.0,
      delta: 42.5,
      currency: 'USD',
    };
    this.plans.set(plan.id, plan);

    await this.eventBus?.publish('iac.plan.created', {
      planId: plan.id,
      workspaceId: plan.workspaceId,
      status: plan.status,
    });
    return plan;
  }

  async getById(id: string): Promise<IaCPlan | undefined> {
    return this.plans.get(id);
  }

  async list(filter: IaCPlanListFilter = {}): Promise<{ plans: IaCPlan[]; total: number }> {
    let items = Array.from(this.plans.values());

    if (filter.workspaceId) {
      items = items.filter(p => p.workspaceId === filter.workspaceId);
    }
    if (filter.status) {
      items = items.filter(p => p.status === filter.status);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    items = items.slice(start, start + perPage);

    return { plans: items, total };
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.plans.delete(id);
    return deleted;
  }

  // ==================== Apply ====================

  async apply(planId: string): Promise<IaCPlan | undefined> {
    const plan = this.plans.get(planId);
    if (!plan) return undefined;
    if (plan.status !== 'completed') {
      throw new Error(`Plan must be in 'completed' status to apply, current: ${plan.status}`);
    }

    plan.status = 'applied';
    this.plans.set(planId, plan);

    // Update workspace state version on successful apply
    const stateVersions = await this.workspaceService.getStateHistory(plan.workspaceId);
    const nextVersion = stateVersions.length > 0 ? stateVersions[0].version + 1 : 1;

    await this.workspaceService.addStateVersion({
      workspaceId: plan.workspaceId,
      version: nextVersion,
      commitSha: plan.commitSha,
      author: 'plan-apply',
      size: JSON.stringify(plan.resourceChanges).length,
    });

    await this.eventBus?.publish('iac.plan.applied', {
      planId,
      workspaceId: plan.workspaceId,
    });
    return plan;
  }

  // ==================== AI Review ====================

  async aiReview(planId: string): Promise<IaCPlan | undefined> {
    const plan = this.plans.get(planId);
    if (!plan) return undefined;

    // Simulate AI review of the plan
    plan.aiReview = {
      score: 0.85,
      riskLevel: 'low',
      suggestions: [
        'Consider adding lifecycle rules for the S3 bucket',
        'Enable encryption for the security group',
      ],
      securityIssues: [],
      costOptimization: 'Consider using spot instances for the web_server to reduce cost by ~60%',
      reviewedAt: new Date().toISOString(),
    };
    this.plans.set(planId, plan);

    await this.eventBus?.publish('iac.plan.reviewed', {
      planId,
      score: plan.aiReview.score,
      riskLevel: plan.aiReview.riskLevel,
    });
    return plan;
  }

  // ==================== Policy Check ====================

  async policyCheck(planId: string, policy: string = 'default'): Promise<{ passed: boolean; violations: string[]; plan: IaCPlan }> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Simulate policy check
    const violations: string[] = [];

    // Check for common policy violations
    const changes = plan.resourceChanges as Record<string, unknown>;
    if ((changes.destroy as number) > 5) {
      violations.push('Excessive resource destruction (>5) violates safety policy');
    }

    const costEstimate = plan.costEstimate as Record<string, unknown>;
    if ((costEstimate.monthlyCost as number) > 1000) {
      violations.push('Monthly cost estimate exceeds $1000 budget threshold');
    }

    const passed = violations.length === 0;

    return { passed, violations, plan };
  }
}
