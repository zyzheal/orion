/**
 * AI Change Intelligence 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== ChangeIntelligenceReport ====================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ShapFactor {
  factor: string;
  value: number;
  contribution: number;
}

export interface ChangeIntelligenceReport {
  id: string;
  prId: string;
  repoId: string;
  commitSha: string;
  riskScore: number;  // 0.00 - 1.00
  riskLevel: RiskLevel;
  affectedServices: number;
  affectedCapabilities: number;
  shapFactors: ShapFactor[];
  gitlabCommentPosted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeIntelligenceAnalyzeInput {
  prId: string;
  repoId: string;
  commitSha: string;
}

export function computeRiskLevel(score: number): RiskLevel {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

export function createChangeIntelligenceReport(
  input: ChangeIntelligenceAnalyzeInput,
  riskScore: number,
  shapFactors: ShapFactor[],
  affectedServices: number = 0,
  affectedCapabilities: number = 0
): ChangeIntelligenceReport {
  const now = new Date();
  return {
    id: uuidv4(),
    prId: input.prId,
    repoId: input.repoId,
    commitSha: input.commitSha,
    riskScore: Math.min(1, Math.max(0, riskScore)),
    riskLevel: computeRiskLevel(riskScore),
    affectedServices,
    affectedCapabilities,
    shapFactors,
    gitlabCommentPosted: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== AffectedService ====================

export type ServiceTier = 'tier-0' | 'tier-1' | 'tier-2';
export type ImpactType = 'direct' | 'dependency' | 'indirect';
export type SloRisk = 'none' | 'low' | 'medium' | 'high';

export interface AffectedService {
  id: string;
  reportId: string;
  serviceName: string;
  serviceTier?: ServiceTier;
  impactType?: ImpactType;
  changedFiles: string[];
  sloRisk?: SloRisk;
  recommendedReviewers: string[];
}

export interface AffectedServiceCreateInput {
  reportId: string;
  serviceName: string;
  serviceTier?: ServiceTier;
  impactType?: ImpactType;
  changedFiles?: string[];
  sloRisk?: SloRisk;
  recommendedReviewers?: string[];
}

export function createAffectedService(input: AffectedServiceCreateInput): AffectedService {
  return {
    id: uuidv4(),
    reportId: input.reportId,
    serviceName: input.serviceName,
    serviceTier: input.serviceTier,
    impactType: input.impactType,
    changedFiles: input.changedFiles ?? [],
    sloRisk: input.sloRisk,
    recommendedReviewers: input.recommendedReviewers ?? [],
  };
}

// ==================== RiskFactor ====================

export interface RiskFactor {
  id: string;
  reportId: string;
  factorName: string;
  factorValue: number;
  weight: number;
  contribution: number;
  description?: string;
}

export interface RiskFactorCreateInput {
  reportId: string;
  factorName: string;
  factorValue: number;
  weight: number;
  contribution: number;
  description?: string;
}

export function createRiskFactor(input: RiskFactorCreateInput): RiskFactor {
  return {
    id: uuidv4(),
    reportId: input.reportId,
    factorName: input.factorName,
    factorValue: input.factorValue,
    weight: input.weight,
    contribution: input.contribution,
    description: input.description,
  };
}

// ==================== HistoricalMatch ====================

export interface HistoricalMatch {
  id: string;
  reportId: string;
  historicalPr?: string;
  similarity?: number;
  incidentLinked: boolean;
  incidentId?: string;
}

export interface HistoricalMatchCreateInput {
  reportId: string;
  historicalPr?: string;
  similarity?: number;
  incidentLinked?: boolean;
  incidentId?: string;
}

export function createHistoricalMatch(input: HistoricalMatchCreateInput): HistoricalMatch {
  return {
    id: uuidv4(),
    reportId: input.reportId,
    historicalPr: input.historicalPr,
    similarity: input.similarity,
    incidentLinked: input.incidentLinked ?? false,
    incidentId: input.incidentId,
  };
}
