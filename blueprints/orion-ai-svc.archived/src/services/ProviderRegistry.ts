// orion-ai-svc/src/services/ProviderRegistry.ts

export type ProviderType = 'openai' | 'anthropic' | 'azure' | 'google' | 'local';

export interface LLMProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  priority: number; // 优先级，数字越小越高
  config?: Record<string, unknown>;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    this.providerHealth.set(provider.id, {
      providerId: provider.id,
      status: 'healthy',
      latency: 0,
      errorRate: 0,
      lastCheck: new Date(),
    });
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  list(): LLMProvider[] {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  listByPriority(): LLMProvider[] {
    return this.list().sort((a, b) => a.priority - b.priority);
  }

  getHealthy(): LLMProvider[] {
    return this.listByPriority().filter(p => {
      const health = this.providerHealth.get(p.id);
      return health?.status !== 'unavailable';
    });
  }

  updateHealth(providerId: string, health: Partial<ProviderHealth>): void {
    const existing = this.providerHealth.get(providerId);
    if (existing) {
      this.providerHealth.set(providerId, { ...existing, ...health });
    }
  }

  disable(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.enabled = false;
    }
  }

  enable(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.enabled = true;
    }
  }
}

// 全局单例
export const providerRegistry = new ProviderRegistry();

// 初始化默认 Provider
providerRegistry.register({
  id: 'anthropic-sonnet',
  name: 'Anthropic Sonnet',
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
  priority: 1,
});

providerRegistry.register({
  id: 'anthropic-opus',
  name: 'Anthropic Opus',
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
  priority: 2,
});

providerRegistry.register({
  id: 'openai-gpt4',
  name: 'OpenAI GPT-4',
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4',
  maxTokens: 4096,
  temperature: 0.7,
  enabled: true,
  priority: 3,
});