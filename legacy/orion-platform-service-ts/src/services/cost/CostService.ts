/**
 * CostService - Business logic layer for Cost/FinOps operations
 */

import { CostRepository, CostRecord, Budget, CostAggregation } from './CostRepository';

export interface ListCostOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  service?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class CostServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'CostServiceError'; }
}

export class CostService {
  private repository: CostRepository;
  constructor(repository: CostRepository) { this.repository = repository; }

  async recordCost(tenantId: string, service: string, cost: number, options?: { date?: Date; resourceId?: string; region?: string; tags?: Record<string, string> }): Promise<CostRecord> {
    if (!tenantId) throw new CostServiceError('Tenant ID required', 'INVALID_INPUT');
    return this.repository.createCostRecord(tenantId, options?.date || new Date(), service, cost, options?.resourceId, options?.region, options?.tags);
  }

  async getCosts(options: ListCostOptions = {}): Promise<PaginatedResult<CostRecord>> {
    const { page = 1, limit = 20, tenantId, startDate, endDate, service } = options;
    const offset = (page - 1) * limit;
    const [costs, _] = await Promise.all([
      this.repository.findAll({ tenantId, startDate, endDate, service, limit, offset }),
      Promise.resolve(0)
    ]);
    return { data: costs, total: costs.length, page, limit, totalPages: Math.ceil(costs.length / limit) };
  }

  async getCostByService(tenantId: string, startDate: Date, endDate: Date): Promise<CostAggregation[]> {
    return this.repository.getCostByService(tenantId, startDate, endDate);
  }

  async getTotalCost(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    return this.repository.getTotalCost(tenantId, startDate, endDate);
  }

  async createBudget(tenantId: string, name: string, amount: number, period: string, alertThreshold: number): Promise<Budget> {
    if (!tenantId) throw new CostServiceError('Tenant ID required', 'INVALID_INPUT');
    return this.repository.createBudget(tenantId, name, amount, period, alertThreshold);
  }

  async listBudgets(tenantId?: string): Promise<Budget[]> {
    return this.repository.findAllBudgets(tenantId);
  }

  async getBudget(id: string): Promise<Budget> {
    const budget = await this.repository.findBudgetById(id);
    if (!budget) throw new CostServiceError(`Budget not found: ${id}`, 'NOT_FOUND');
    return budget;
  }

  async getBudgetAlerts(tenantId: string): Promise<Budget[]> {
    return this.repository.getBudgetAlerts(tenantId);
  }

  async updateBudgetSpend(id: string): Promise<Budget> {
    const budget = await this.repository.findBudgetById(id);
    if (!budget) throw new CostServiceError(`Budget not found: ${id}`, 'NOT_FOUND');
    
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const total = await this.repository.getTotalCost(budget.tenant_id, startDate, now);
    
    const updated = await this.repository.updateBudgetSpend(id, total);
    return updated!;
  }
}