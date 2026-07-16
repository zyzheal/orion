// orion-ai-svc/src/services/ScenarioRouter.ts

import type { AIScenario } from './types';
import type { LLMProvider } from './ProviderRegistry';

export interface ScenarioMapping {
  scenario: AIScenario;
  primaryProvider: string; // provider id
  fallbackProviders: string[]; // provider ids
  model?: string; // 覆盖默认模型
  maxTokens?: number;
  temperature?: number;
}

export class ScenarioRouter {
  private mappings: Map<AIScenario, ScenarioMapping> = new Map();

  constructor() {
    this.initDefaultMappings();
  }

  private initDefaultMappings(): void {
    // P0 场景 - 高可靠性
    this.register({
      scenario: 'aegis-risk-assessment',
      primaryProvider: 'anthropic-opus',
      fallbackProviders: ['anthropic-sonnet', 'openai-gpt4'],
      maxTokens: 8192,
    });
    this.register({
      scenario: 'auto-scheduling',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['openai-gpt4'],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'root-cause-diagnosis',
      primaryProvider: 'anthropic-opus',
      fallbackProviders: ['anthropic-sonnet'],
      maxTokens: 8192,
    });

    // P1 场景 - 标准可靠性
    this.register({
      scenario: 'code-review',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['openai-gpt4'],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'agent_reasoning',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['anthropic-opus'],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'chatops_intent',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['openai-gpt4'],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'test-selection',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'changelog-generation',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'incident-summary',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['anthropic-opus'],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'runbook-suggestion',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'metric-anomaly-detection',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'log-pattern-analysis',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'dependency-analysis',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'capacity-forecast',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'sla-prediction',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'knowledge-extraction',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: ['anthropic-opus'],
      maxTokens: 4096,
    });
    this.register({
      scenario: 'alert-correlation',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 2048,
    });
    this.register({
      scenario: 'automation-suggestion',
      primaryProvider: 'anthropic-sonnet',
      fallbackProviders: [],
      maxTokens: 4096,
    });
  }

  register(mapping: ScenarioMapping): void {
    this.mappings.set(mapping.scenario, mapping);
  }

  get(scenario: AIScenario): ScenarioMapping | undefined {
    return this.mappings.get(scenario);
  }

  getPrimaryProvider(scenario: AIScenario): string {
    const mapping = this.mappings.get(scenario);
    return mapping?.primaryProvider || 'anthropic-sonnet';
  }

  getFallbackProviders(scenario: AIScenario): string[] {
    const mapping = this.mappings.get(scenario);
    return mapping?.fallbackProviders || [];
  }

  getAllProvidersForScenario(scenario: AIScenario): string[] {
    const mapping = this.mappings.get(scenario);
    if (!mapping) return ['anthropic-sonnet'];
    return [mapping.primaryProvider, ...mapping.fallbackProviders];
  }
}

// 全局单例
export const scenarioRouter = new ScenarioRouter();