import { DatabasePool } from '../../utils/database';

export class CostOptimizationService {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async getOptimizationSuggestions(_request: any, reply: any) {
    void reply.send({ suggestions: [], totalSavings: 0 });
  }
}
