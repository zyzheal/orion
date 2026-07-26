export class CostOperationsController {
  constructor(
    private budgetGuard: any,
    private anomalyDetection: any,
    private optimization: any,
  ) {}

  async createBudgetGuard(request: any, reply: any) { return this.budgetGuard.createBudgetGuard(request, reply); }
  async getBudgetGuards(request: any, reply: any) { return this.budgetGuard.getBudgetGuards(request, reply); }
  async evaluateCost(request: any, reply: any) { return this.budgetGuard.evaluateCost(request, reply); }
  async detectAnomalies(request: any, reply: any) { return this.anomalyDetection.detectAnomalies(request, reply); }
  async getCostTrend(request: any, reply: any) { return this.anomalyDetection.getCostTrend(request, reply); }
  async forecastCost(request: any, reply: any) { return this.anomalyDetection.forecastCost(request, reply); }
  async getOptimizationSuggestions(request: any, reply: any) { return this.optimization.getOptimizationSuggestions(request, reply); }
}
