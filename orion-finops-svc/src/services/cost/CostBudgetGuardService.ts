import { DatabasePool } from '../../utils/database';

export class CostBudgetGuardService {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async createBudgetGuard(request: any, reply: any) {
    void reply.code(201).send({ id: 'guard-1', status: 'active' });
  }
  async getBudgetGuards(_request: any, reply: any) {
    void reply.send({ items: [], total: 0 });
  }
  async evaluateCost(request: any, reply: any) {
    void reply.send({ status: 'ok', withinBudget: true });
  }
}
