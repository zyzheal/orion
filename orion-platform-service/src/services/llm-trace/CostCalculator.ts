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
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
  private customPricing: Map<string, { input: number; output: number }> = new Map();

  constructor() {}

  /**
   * Calculate cost for a single LLM call
   */
  calculate(modelId: string, inputTokens: number, outputTokens: number): CostBreakdown {
    const pricing = this.getPricing(modelId);

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
  calculateBatch(traces: TraceCostInput[]): CostBreakdown {
    let totalInputCost = 0;
    let totalOutputCost = 0;
    const breakdownByModel: Record<string, number> = {};

    for (const trace of traces) {
      const pricing = this.getPricing(trace.modelId);
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
  setCustomPricing(modelId: string, inputPrice: number, outputPrice: number): void {
    this.customPricing.set(modelId, { input: inputPrice, output: outputPrice });
    logger.info(`[CostCalculator] Set custom pricing for ${modelId}: input=${inputPrice}, output=${outputPrice}`);
  }

  /**
   * Get pricing for a model (custom or default)
   */
  getPricing(modelId: string): { input: number; output: number } {
    const custom = this.customPricing.get(modelId);
    if (custom) {
      return custom;
    }
    return MODEL_PRICING[modelId] || MODEL_PRICING['gpt-4'];
  }

  /**
   * Estimate monthly cost based on daily token usage
   */
  estimateMonthlyCost(dailyTokens: number, modelId: string): number {
    const pricing = this.getPricing(modelId);

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
  getAvailableModels(): string[] {
    const customModels = Array.from(this.customPricing.keys());
    const defaultModels = Object.keys(MODEL_PRICING);
    return [...new Set([...defaultModels, ...customModels])];
  }

  /**
   * Get all pricing information
   */
  getAllPricing(): Record<string, { input: number; output: number }> {
    const allPricing: Record<string, { input: number; output: number }> = { ...MODEL_PRICING };

    // Add custom pricing
    for (const [modelId, pricing] of this.customPricing.entries()) {
      allPricing[modelId] = pricing;
    }

    return allPricing;
  }

  /**
   * Calculate cost savings by using a cheaper model
   */
  calculateSavings(
    currentModel: string,
    alternativeModel: string,
    inputTokens: number,
    outputTokens: number
  ): { currentCost: number; alternativeCost: number; savings: number; savingsPercent: number } {
    const currentPricing = this.getPricing(currentModel);
    const alternativePricing = this.getPricing(alternativeModel);

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