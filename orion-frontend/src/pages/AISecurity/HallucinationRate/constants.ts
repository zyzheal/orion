import { api } from '@/api/client';
import type { HallucinationRecord } from './types';

export const FALLBACK_DATA: HallucinationRecord[] = [
  { id: '1', model: 'gpt-4o', prompt: 'Describe the capital of France...', response: 'Paris, with 2.1M people...', hallucinated: false, confidence: 0.98, detectedBy: 'self-consistency', category: 'factual', detectedAt: '2026-08-26T10:00:00Z' },
  { id: '2', model: 'claude-3.5', prompt: 'What is the population of Shanghai...', response: 'Approximately 25M...', hallucinated: true, confidence: 0.32, detectedBy: 'kb-lookup', category: 'numerical', detectedAt: '2026-08-26T10:05:00Z' },
  { id: '3', model: 'gpt-4o', prompt: 'Summarize Q3 earnings...', response: 'Revenue grew 12% YoY...', hallucinated: true, confidence: 0.45, detectedBy: 'kb-lookup', category: 'citation', detectedAt: '2026-08-26T10:10:00Z' },
];

export async function fetchHallucinationData(period: string): Promise<HallucinationRecord[]> {
  try {
    const resp = await api.get<HallucinationRecord[]>('/ai-security/hallucination', {
      params: { period },
    });
    if (Array.isArray(resp.data)) return resp.data;
  } catch {
    return FALLBACK_DATA;
  }
  return FALLBACK_DATA;
}

export const PERIOD_OPTIONS = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
];
