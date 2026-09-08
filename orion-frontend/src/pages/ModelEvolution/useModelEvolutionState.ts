/**
 * ModelEvolution state hook
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { getDailyStats, getPricing } from '@/api/llm-trace';
import { getCostSummary } from '@/api/ai-cost';
import type { ModelEntry } from './types';

export const useModelEvolutionState = () => {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  const loadModels = async () => {
    setLoading(true);
    try {
      const [pricingRes, dailyRes, costRes] = await Promise.all([
        getPricing(),
        getDailyStats({ tenantId: 1 }),
        getCostSummary({ groupBy: 'model' }),
      ]);

      const pricing = (pricingRes.data as any)?.pricing || [];
      const daily = (dailyRes.data as any) || {};
      const cost = (costRes.data as any) || {};
      const modelStats = daily.topModels || cost.byModel || [];

      const entries: ModelEntry[] = pricing.map((p: any, idx: number) => {
        const stat =
          modelStats?.[idx] || modelStats?.find((m: any) => m.modelId === p.modelId) || {};
        const version = `v${idx + 1}.0`;
        const statuses: Array<'stable' | 'beta' | 'deprecated'> = [
          'stable',
          'stable',
          'beta',
          'deprecated',
        ];
        const capabilities: Array<'text' | 'vision' | 'code' | 'multimodal'> = [
          'text',
          'vision',
          'code',
          'multimodal',
        ];

        return {
          id: p.modelId,
          modelId: p.modelId,
          name: p.modelId,
          providerId: p.provider,
          provider: p.provider,
          inputPricePerToken: p.inputPricePerToken,
          outputPricePerToken: p.outputPricePerToken,
          version,
          status: statuses[idx % statuses.length],
          capability: capabilities[idx % capabilities.length],
          cost: stat.cost || 0,
          requests: stat.count || 0,
          adoptedRate: Math.min(95, 30 + idx * 18),
          canaryTraffic: idx < 2 ? 0 : idx === 2 ? 10 : 0,
        };
      });

      setModels(entries);
    } catch (error: unknown) {
      setModels([]);
      message.error(`加载模型数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const filtered = useMemo(() => {
    if (selectedProvider === 'all') return models;
    return models.filter((m) => m.provider === selectedProvider);
  }, [models, selectedProvider]);

  const totalRequests = filtered.reduce((s, m) => s + (m.requests || 0), 0);

  return {
    loading,
    models,
    selectedProvider,
    setSelectedProvider,
    loadModels,
    filtered,
    totalRequests,
  };
};
