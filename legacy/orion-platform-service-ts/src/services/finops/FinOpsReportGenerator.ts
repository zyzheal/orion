/**
 * FinOpsReportGenerator - 报告生成
 *
 * 职责：生成 FinOps 报告、获取报告历史、成本分析
 */
import { FinOpsRepository } from './FinOpsRepository';
import { FinOpsReport, ResourceCost } from './FinOpsRepository';
import { CostPeriod } from './types';
import { createLogger } from '../../utils/logger';

export class FinOpsReportGenerator {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-report-generator');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  async generateReport(tenantId: string, period: string): Promise<FinOpsReport> {
    const breakdown = { compute: 1000, storage: 500, network: 200 };
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return this.repository.createReport(tenantId, period, total, breakdown);
  }

  async getReportHistory(tenantId: string, limit?: number): Promise<FinOpsReport[]> {
    return this.repository.getReports(tenantId, limit);
  }

  async analyzeCosts(tenantId: string, startDate: Date, endDate: Date): Promise<ResourceCost[]> {
    return this.repository.getResourceCosts(tenantId, startDate, endDate);
  }
}
