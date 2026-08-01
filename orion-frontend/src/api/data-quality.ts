/**
 * Data Quality API Service
 * Data quality rules, checks, and monitoring
 */
import { api } from './client';

export interface QualityRule {
  id: string;
  name: string;
  table_name: string;
  column_name?: string;
  rule_type: 'not_null' | 'unique' | 'range' | 'regex' | 'custom' | 'freshness' | 'volume';
  config: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  last_check_at: string | null;
  last_status: 'pass' | 'fail' | 'error' | null;
  pass_rate: number;
  created_at: string;
  updated_at: string;
}

export interface QualityCheck {
  id: string;
  rule_id: string;
  rule_name: string;
  status: 'pass' | 'fail' | 'error';
  actual_value: string;
  expected_value: string;
  checked_at: string;
  details?: string;
}

export interface CreateQualityRuleInput {
  name: string;
  table_name: string;
  column_name?: string;
  rule_type: string;
  config?: Record<string, unknown>;
  severity?: string;
}

export function listQualityRules() {
  return api.get<{ data: QualityRule[] }>('/api/data-quality/rules');
}

export function createQualityRule(data: CreateQualityRuleInput) {
  return api.post<{ data: QualityRule }>('/api/data-quality/rules', data);
}

export function updateQualityRule(id: string, data: Partial<QualityRule>) {
  return api.put<{ data: QualityRule }>(`/api/data-quality/rules/${id}`, data);
}

export function deleteQualityRule(id: string) {
  return api.delete(`/api/data-quality/rules/${id}`);
}

export function runQualityCheck(ruleId: string) {
  return api.post<{ data: QualityCheck }>(`/api/data-quality/rules/${ruleId}/run`);
}

export function listQualityChecks(ruleId?: string) {
  return api.get<{ data: QualityCheck[] }>('/api/data-quality/checks', { params: ruleId ? { ruleId } : {} });
}
