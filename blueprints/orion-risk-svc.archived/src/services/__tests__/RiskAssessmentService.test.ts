/**
 * RiskAssessmentService 单元测试
 *
 * 测试风险评估核心逻辑，包括:
 * - 风险评分计算
 * - 风险因素评估
 * - 风险等级判定
 * - 趋势分析
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock types matching the service
interface RiskFactor {
  name: string;
  category: string;
  score: number;
  weight: number;
  description: string;
}

interface RiskAssessmentResult {
  entityType: string;
  entityId: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  assessedAt: Date;
}

// Pure logic functions extracted from RiskAssessmentService for testing
function calculateOverallScore(factors: RiskFactor[]): number {
  if (factors.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const factor of factors) {
    totalWeight += factor.weight;
    weightedSum += factor.score * factor.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}

function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function generateRecommendations(factors: RiskFactor[]): string[] {
  const recommendations: string[] = [];
  const highRiskFactors = factors.filter(f => f.score >= 70);
  const mediumRiskFactors = factors.filter(f => f.score >= 40 && f.score < 70);

  for (const factor of highRiskFactors) {
    recommendations.push(`[CRITICAL] Address ${factor.name}: ${factor.description}`);
  }
  for (const factor of mediumRiskFactors) {
    recommendations.push(`[WARNING] Monitor ${factor.name}: ${factor.description}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('No significant risk factors identified');
  }

  return recommendations;
}

describe('RiskAssessmentService - Pure Logic', () => {
  describe('calculateOverallScore', () => {
    it('returns 0 for empty factors', () => {
      expect(calculateOverallScore([])).toBe(0);
    });

    it('calculates weighted average correctly', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 80, weight: 3, description: '' },
        { name: 'performance', category: 'performance', score: 40, weight: 2, description: '' },
      ];
      // (80*3 + 40*2) / (3+2) = (240+80)/5 = 320/5 = 64
      expect(calculateOverallScore(factors)).toBe(64);
    });

    it('handles single factor', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 75, weight: 1, description: '' },
      ];
      expect(calculateOverallScore(factors)).toBe(75);
    });

    it('handles zero total weight', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 80, weight: 0, description: '' },
      ];
      expect(calculateOverallScore(factors)).toBe(0);
    });

    it('rounds to 2 decimal places', () => {
      const factors: RiskFactor[] = [
        { name: 'a', category: 'x', score: 33, weight: 3, description: '' },
        { name: 'b', category: 'y', score: 67, weight: 7, description: '' },
      ];
      // (33*3 + 67*7) / 10 = (99+469)/10 = 568/10 = 56.8
      expect(calculateOverallScore(factors)).toBe(56.8);
    });
  });

  describe('determineRiskLevel', () => {
    it('classifies critical (>=80)', () => {
      expect(determineRiskLevel(80)).toBe('critical');
      expect(determineRiskLevel(95)).toBe('critical');
      expect(determineRiskLevel(100)).toBe('critical');
    });

    it('classifies high (60-79)', () => {
      expect(determineRiskLevel(60)).toBe('high');
      expect(determineRiskLevel(75)).toBe('high');
      expect(determineRiskLevel(79)).toBe('high');
    });

    it('classifies medium (30-59)', () => {
      expect(determineRiskLevel(30)).toBe('medium');
      expect(determineRiskLevel(45)).toBe('medium');
      expect(determineRiskLevel(59)).toBe('medium');
    });

    it('classifies low (<30)', () => {
      expect(determineRiskLevel(0)).toBe('low');
      expect(determineRiskLevel(15)).toBe('low');
      expect(determineRiskLevel(29)).toBe('low');
    });
  });

  describe('generateRecommendations', () => {
    it('generates CRITICAL recommendations for high-score factors', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 85, weight: 3, description: 'High vulnerability count' },
      ];
      const recs = generateRecommendations(factors);
      expect(recs).toHaveLength(1);
      expect(recs[0]).toContain('[CRITICAL]');
      expect(recs[0]).toContain('security');
    });

    it('generates WARNING recommendations for medium-score factors', () => {
      const factors: RiskFactor[] = [
        { name: 'performance', category: 'performance', score: 50, weight: 2, description: 'Slow response times' },
      ];
      const recs = generateRecommendations(factors);
      expect(recs).toHaveLength(1);
      expect(recs[0]).toContain('[WARNING]');
    });

    it('returns default message for low-risk factors', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 10, weight: 1, description: '' },
      ];
      const recs = generateRecommendations(factors);
      expect(recs).toHaveLength(1);
      expect(recs[0]).toContain('No significant risk factors');
    });

    it('handles mixed risk levels', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 90, weight: 3, description: 'Critical vulns' },
        { name: 'performance', category: 'performance', score: 50, weight: 2, description: 'Slow' },
        { name: 'cost', category: 'financial', score: 10, weight: 1, description: '' },
      ];
      const recs = generateRecommendations(factors);
      expect(recs).toHaveLength(2);
      expect(recs[0]).toContain('[CRITICAL]');
      expect(recs[1]).toContain('[WARNING]');
    });
  });

  describe('Integration: score + level + recommendations', () => {
    it('full assessment flow for critical risk', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 90, weight: 3, description: 'Multiple CVEs' },
        { name: 'availability', category: 'availability', score: 70, weight: 2, description: 'Single point of failure' },
      ];
      const score = calculateOverallScore(factors);
      const level = determineRiskLevel(score);
      const recs = generateRecommendations(factors);

      expect(score).toBe(82); // (90*3 + 70*2) / 5 = 410/5 = 82
      expect(level).toBe('critical');
      expect(recs).toHaveLength(2);
    });

    it('full assessment flow for low risk', () => {
      const factors: RiskFactor[] = [
        { name: 'security', category: 'security', score: 15, weight: 3, description: '' },
        { name: 'performance', category: 'performance', score: 20, weight: 2, description: '' },
      ];
      const score = calculateOverallScore(factors);
      const level = determineRiskLevel(score);
      const recs = generateRecommendations(factors);

      expect(score).toBe(17); // (15*3 + 20*2) / 5 = 85/5 = 17
      expect(level).toBe('low');
      expect(recs[0]).toContain('No significant risk factors');
    });
  });
});
