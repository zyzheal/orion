/**
 * AI Change Intelligence API Service
 * Semantic blast radius, risk scoring, and change analysis
 */
import { api } from './client';

// ---- Types ----

export interface ChangeIntelligenceReport {
  id: string;
  prId: string;
  repoId: string;
  commitSha: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: number;
  affectedCapabilities: number;
  shapFactors?: Array<{
    factor: string;
    value: number;
    contribution: number;
  }>;
  gitlabCommentPosted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffectedService {
  id: string;
  reportId: string;
  serviceName: string;
  serviceTier?: string;
  impactType?: string;
  changedFiles?: string[];
  sloRisk?: string;
  recommendedReviewers?: string[];
}

export interface RiskFactor {
  id: string;
  reportId: string;
  factorName: string;
  factorValue: number;
  weight: number;
  contribution: number;
  description?: string;
}

export interface HistoricalMatch {
  id: string;
  reportId: string;
  historicalPr: string;
  similarity: number;
  incidentLinked: boolean;
  incidentId?: string;
}

export interface BlastRadiusNode {
  id: string;
  label: string;
  type: string;
  riskScore?: number;
}

export interface BlastRadiusEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface BlastRadiusData {
  nodes: BlastRadiusNode[];
  edges: BlastRadiusEdge[];
}

// ---- Params ----

export interface ChangeAnalyzeInput {
  prId: string;
  repoId: string;
  commitSha: string;
}

export interface ChangeReportListParams {
  prId?: string;
  repoId?: string;
  page?: number;
  pageSize?: number;
}

export interface BlastRadiusQueryInput {
  files: string[];
  repoId?: string;
}

export interface ChangeTrendsParams {
  repoId?: string;
  days?: number;
}

// ---- API Functions ----

export function analyzeChange(data: ChangeAnalyzeInput) {
  return api.post('/api/v1/change-intelligence/analyze', data);
}

export function getChangeReports(params?: ChangeReportListParams) {
  return api.get('/api/v1/change-intelligence/reports', { params });
}

export function getChangeReportDetail(id: string) {
  return api.get(`/api/v1/change-intelligence/reports/${id}`);
}

export function getBlastRadius(reportId: string) {
  return api.get(`/api/v1/change-intelligence/reports/${reportId}/blast-radius`);
}

export function queryBlastRadius(data: BlastRadiusQueryInput) {
  return api.post('/api/v1/change-intelligence/blast-radius/query', data);
}

export function getChangeTrends(params?: ChangeTrendsParams) {
  return api.get('/api/v1/change-intelligence/trends', { params });
}
