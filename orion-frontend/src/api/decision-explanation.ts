/**
 * DecisionExplanation API Service
 * Auto-generated from backend decision-explanation-routes.ts
 * Prefix: /api/v1/decisions
 */
import { api } from './client';

export interface DecisionExplanation {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const getDecisionExplanation = async (id: string): Promise<DecisionExplanation> => {
  const response = await api.get<DecisionExplanation>('/api/v1/decisions/decisions/' + id + '/explain');
  return response.data;
};

export const createDecisionExplanationDecisionsFeedback = async (id: string, data?: Partial<DecisionExplanation>): Promise<DecisionExplanation> => {
  const response = await api.post<DecisionExplanation>('/api/v1/decisions/decisions/' + id + '/feedback', data);
  return response.data;
};

export const getDecisionExplanationDecisionsQualityTrend = async (scenario: string): Promise<DecisionExplanation> => {
  const response = await api.get<DecisionExplanation>('/api/v1/decisions/decisions/quality/' + scenario + '/trend');
  return response.data;
};
