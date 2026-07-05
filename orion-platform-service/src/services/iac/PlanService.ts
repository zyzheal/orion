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
import { IaCPlanRepository, IaCPlanEntity } from '../../repositories/IaCPlanRepository';
import { OrionError, ErrorCode } from '../../errors';

export interface IaCPlanListFilter {
  workspaceId?: string;
  status?: IaCPlanStatus;
  page?: number;
  perPage?: number;
}

export class PlanService {
  private planRepository?: IaCPlanRepository;
  private workspaceService: WorkspaceService;
  private eventBus?: EventBusService;

  constructor(options: { workspaceService: WorkspaceService; eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.workspaceService = options.workspaceService;
    this.eventBus = options.eventBus;
    if (options.db) {
      this.planRepository = new IaCPlanRepository(options.db);
    }
  }

  // ==================== Plan CRUD ====================

  async create(input: IaCPlanCreateInput): Promise<IaCPlan> {
    const plan = createIaCPlan(input);

    // Simulate plan generation
    plan.status = 'running';

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

    if (this.planRepository) {
      await this.planRepository.create({
        id: plan.id,
        name: `plan-${plan.workspaceId.slice(0, 8)}-${Date.now()}`,
        workspace_id: plan.workspaceId,
        terraformVersion: '1.5.0',
        planContent: plan.resourceChanges ?? {},
        resourcesToAdd: plan.resourceChanges?.add ?? 0,
        resourcesToChange: plan.resourceChanges?.change ?? 0,
        resourcesToDestroy: plan.resourceChanges?.destroy ?? 0,
        applied: false,
      });
    }

    await this.eventBus?.publish('iac.plan.created', {
      planId: plan.id,
      workspaceId: plan.workspaceId,
      status: plan.status,
    });
    return plan;
  }

  async getById(id: string): Promise<IaCPlanEntity | undefined> {
    if (this.planRepository) {
      return await this.planRepository.findById(id) ?? undefined;
    }
    return undefined;
  }

  async list(filter: IaCPlanListFilter = {}): Promise<{ plans: IaCPlanEntity[]; total: number }> {
    if (this.planRepository) {
      const result = await this.planRepository.findAll();
      let entities = result.entities;

      if (filter.status === 'applied') {
        entities = entities.filter(p => p.applied);
      } else if (filter.status === 'completed') {
        entities = entities.filter(p => !p.applied);
      }

      const total = entities.length;
      const page = filter.page ?? 1;
      const perPage = filter.perPage ?? 20;
      const start = (page - 1) * perPage;
      entities = entities.slice(start, start + perPage);

      return { plans: entities, total };
    }
    return { plans: [], total: 0 };
  }

  async listByWorkspace(workspaceId: string): Promise<IaCPlanEntity[]> {
    if (this.planRepository) {
      const result = await this.planRepository.findAll();
      return result.entities.filter(p => p.workspaceId === workspaceId);
    }
    return [];
  }

  async delete(id: string): Promise<boolean> {
    if (this.planRepository) {
      return await this.planRepository.delete(id);
    }
    return false;
  }

  // ==================== Apply ====================

  async apply(planId: string): Promise<IaCPlanEntity | undefined> {
    if (!this.planRepository) return undefined;

    const entity = await this.planRepository.findById(planId);
    if (!entity) return undefined;
    if (entity.applied) {
      throw new OrionError(`Plan already applied`, 'OPERATION_FAILED')
    }

    await this.planRepository.markApplied(planId, 'system');

    await this.eventBus?.publish('iac.plan.applied', {
      planId,
    });
    return await this.planRepository.findById(planId) ?? undefined;
  }
}
