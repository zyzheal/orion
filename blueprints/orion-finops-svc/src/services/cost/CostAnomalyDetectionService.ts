import { DatabasePool } from '../../utils/database';

export class CostAnomalyDetectionService {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async detectAnomalies(_request: any, reply: any) {
    void reply.send({ anomalies: [], period: 'current' });
  }
  async getCostTrend(_request: any, reply: any) {
    void reply.send({ trend: [], direction: 'stable' });
  }
  async forecastCost(_request: any, reply: any) {
    void reply.send({ forecast: 0, confidence: 0.5 });
  }
}
