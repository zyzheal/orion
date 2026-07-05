/**
 * Cost Calculator - 成本计算器
 *
 * 功能：
 * 1. 单次调用成本计算
 * 2. 批量成本计算
 * 3. 自定义模型定价
 * 4. 月度成本预估
 */

import { MODEL_PRICING } from './LLMTraceService';
import { ModelPricingRepository } from '../../repositories/ModelPricingRepository';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CostCalculator');

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  breakdownByModel: Record<string, number>;
}

export interface TraceCostInput {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export class CostCalculator {
  private currency: string = 'CNY';
  private pricingRepo: ModelPricingRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.pricingRepo = new ModelPricingRepository(db);
    }
  }

  /**
   * Calculate cost for a single LLM call
   */
  async calculate(modelId: string, inputTokens: number, outputTokens: number): Promise<CostBreakdown> {
    const pricing = await this.getPricing(modelId);

    const inputCost = inputTokens * pricing.input;
    const outputCost = outputTokens * pricing.output;
    const totalCost = inputCost + outputCost;

    logger.debug(`[CostCalculator] Cost for ${modelId}: input=${inputCost}, output=${outputCost}, total=${totalCost}`);

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: this.currency,
      breakdownByModel: { [modelId]: totalCost },
    };
  }

  /**
   * Calculate cost for multiple traces
   */
  async calculateBatch(traces: TraceCostInput[]): Promise<CostBreakdown> {
    let totalInputCost = 0;
    let totalOutputCost = 0;
    const breakdownByModel: Record<string, number> = {};

    for (const trace of traces) {
      const pricing = await this.getPricing(trace.modelId);
      const inputCost = trace.inputTokens * pricing.input;
      const outputCost = trace.outputTokens * pricing.output;
      const cost = inputCost + outputCost;

      totalInputCost += inputCost;
      totalOutputCost += outputCost;

      breakdownByModel[trace.modelId] = (breakdownByModel[trace.modelId] || 0) + cost;
    }

    const totalCost = totalInputCost + totalOutputCost;

    logger.debug(`[CostCalculator] Batch cost: ${traces.length} traces, total=${totalCost}`);

    return {
      inputCost: totalInputCost,
      outputCost: totalOutputCost,
      totalCost,
      currency: this.currency,
      breakdownByModel,
    };
  }

  /**
   * Set custom pricing for a model
   */
  async setCustomPricing(modelId: string, inputPrice: number, outputPrice: number): Promise<void> {
    if (!this.pricingRepo) {
      throw new OrionError('Database not configured for CostCalculator', ErrorCode.SERVICE_UNAVAILABLE);
    }
    await this.pricingRepo.upsertByModelId(modelId, { inputPrice, outputPrice });
    logger.info(`[CostCalculator] Set custom pricing for ${modelId}: input=${inputPrice}, output=${outputPrice}`);
  }

  /**
   * Get pricing for a model (custom or default)
   */
  async getPricing(modelId: string): Promise<{ input: number; output: number }> {
    // Check custom pricing in DB first
    if (this.pricingRepo) {
      const custom = await this.pricingRepo.findByModelId(modelId);
      if (custom) {
        return { input: custom.inputPrice, output: custom.outputPrice };
      }
    }
    return MODEL_PRICING[modelId] || MODEL_PRICING['gpt-4'];
  }

  /**
   * Estimate monthly cost based on daily token usage
   */
  async estimateMonthlyCost(dailyTokens: number, modelId: string): Promise<number> {
    const pricing = await this.getPricing(modelId);

    // Assume equal input/output split
    const avgInputTokens = dailyTokens / 2;
    const avgOutputTokens = dailyTokens / 2;

    const dailyCost = avgInputTokens * pricing.input + avgOutputTokens * pricing.output;
    const monthlyCost = dailyCost * 30;

    logger.debug(`[CostCalculator] Monthly estimate for ${modelId}: ${monthlyCost} (daily tokens: ${dailyTokens})`);

    return monthlyCost;
  }

  /**
   * Get all available model pricings
   */
  async getAvailableModels(): Promise<string[]> {
    const defaultModels = Object.keys(MODEL_PRICING);
    if (!this.pricingRepo) {
      return defaultModels;
    }
    const customPricings = await this.pricingRepo.findAll();
    const customModels = customPricings.entities.map(p => p.modelId);
    return [...new Set([...defaultModels, ...customModels])];
  }

  /**
   * Get all pricing information
   */
  async getAllPricing(): Promise<Record<string, { input: number; output: number }>> {
    const allPricing: Record<string, { input: number; output: number }> = { ...MODEL_PRICING };

    // Add custom pricing from DB
    if (this.pricingRepo) {
      const customPricings = await this.pricingRepo.findAll();
      for (const pricing of customPricings.entities) {
        allPricing[pricing.modelId] = { input: pricing.inputPrice, output: pricing.outputPrice };
      }
    }

    return allPricing;
  }

  /**
   * Calculate cost savings by using a cheaper model
   */
  async calculateSavings(
    currentModel: string,
    alternativeModel: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<{ currentCost: number; alternativeCost: number; savings: number; savingsPercent: number }> {
    const currentPricing = await this.getPricing(currentModel);
    const alternativePricing = await this.getPricing(alternativeModel);

    const currentCost = inputTokens * currentPricing.input + outputTokens * currentPricing.output;
    const alternativeCost = inputTokens * alternativePricing.input + outputTokens * alternativePricing.output;
    const savings = currentCost - alternativeCost;
    const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0;

    return {
      currentCost,
      alternativeCost,
      savings,
      savingsPercent,
    };
  }

  /**
   * Set currency for cost display
   */
  setCurrency(currency: string): void {
    this.currency = currency;
  }

  /**
   * Get current currency
   */
  getCurrency(): string {
    return this.currency;
  }
}