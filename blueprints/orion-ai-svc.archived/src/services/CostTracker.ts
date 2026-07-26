// orion-ai-svc/src/services/CostTracker.ts

import { getPool } from '../utils/database';

export interface CostRecord {
  id: string;
  timestamp: Date;
  scenario: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number; // USD
  outputCost: number; // USD
  totalCost: number; // USD
  latency: number; // ms
  userId?: string;
  traceId?: string;
}

// Provider 定价 (USD per 1M tokens)
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic-sonnet': { input: 3.0, output: 15.0 }, // claude-3-5-sonnet
  'anthropic-opus': { input: 15.0, output: 75.0 }, // claude-3-opus
  'openai-gpt4': { input: 30.0, output: 60.0 }, // gpt-4
  'openai-gpt35': { input: 0.5, output: 1.5 }, // gpt-3.5-turbo
  'azure-gpt4': { input: 25.0, output: 50.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
};

export class CostTracker {
  calculateCost(model: string, inputTokens: number, outputTokens: number): CostRecord {
    const pricing = PROVIDER_PRICING[model] || { input: 3.0, output: 15.0 };
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      scenario: '',
      provider: '',
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      latency: 0,
    };
  }

  async record(record: CostRecord): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO llm_costs (id, timestamp, scenario, provider, model, input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost, latency, user_id, trace_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        record.id,
        record.timestamp,
        record.scenario,
        record.provider,
        record.model,
        record.inputTokens,
        record.outputTokens,
        record.totalTokens,
        record.inputCost,
        record.outputCost,
        record.totalCost,
        record.latency,
        record.userId || null,
        record.traceId || null,
      ]
    );
  }

  async getDailyCost(date: Date = new Date()): Promise<number> {
    const pool = getPool();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const result = await pool.query(
        'SELECT COALESCE(SUM(total_cost), 0) as cost FROM llm_costs WHERE timestamp >= $1 AND timestamp <= $2',
        [startOfDay, endOfDay]
      );
      return parseFloat(result.rows[0]?.cost || '0');
    } catch {
      return 0;
    }
  }

  async getMonthlyCost(year: number, month: number): Promise<number> {
    const pool = getPool();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    try {
      const result = await pool.query(
        'SELECT COALESCE(SUM(total_cost), 0) as cost FROM llm_costs WHERE timestamp >= $1 AND timestamp <= $2',
        [startOfMonth, endOfMonth]
      );
      return parseFloat(result.rows[0]?.cost || '0');
    } catch {
      return 0;
    }
  }

  async getCostByScenario(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT scenario, SUM(total_cost) as cost FROM llm_costs WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY scenario',
        [startDate, endDate]
      );
      const costs: Record<string, number> = {};
      for (const row of result.rows) {
        costs[row.scenario] = parseFloat(row.cost);
      }
      return costs;
    } catch {
      return {};
    }
  }

  async getCostByProvider(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT provider, SUM(total_cost) as cost FROM llm_costs WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY provider',
        [startDate, endDate]
      );
      const costs: Record<string, number> = {};
      for (const row of result.rows) {
        costs[row.provider] = parseFloat(row.cost);
      }
      return costs;
    } catch {
      return {};
    }
  }
}

// 全局单例
export const costTracker = new CostTracker();