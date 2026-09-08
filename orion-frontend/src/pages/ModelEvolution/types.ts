/**
 * ModelEvolution types
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
export interface ModelEntry {
  id: string;
  modelId: string;
  name: string;
  providerId: string;
  provider: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  version: string;
  status: 'stable' | 'beta' | 'deprecated';
  capability: 'text' | 'vision' | 'code' | 'multimodal';
  cost: number;
  requests: number;
  adoptedRate: number;
  canaryTraffic: number;
}
