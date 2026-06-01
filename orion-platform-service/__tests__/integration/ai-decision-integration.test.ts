/**
 * AI Decision Integration Tests
 *
 * AI decision making + explanation generation flow
 */

import {
  DecisionExplanationService,
  DecisionExplanationServiceError,
  DecisionExplanation,
  RulePathStep,
} from '@/services/decision-explanation/DecisionExplanationService';

// ============================================================
// Mock Database
// ============================================================

class MockDecisionDb {
  private feedback: any[] = [];
  private decisions: any[] = [];
  private idCounter = 0;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    // ================== Decision Feedback ==================
    if (text.includes('SELECT') && text.includes('ai_decision_feedback')) {
      if (text.includes('WHERE decision_id = $1') && !text.includes('COUNT') && !text.includes('GROUP')) {
        const feedbacks = this.feedback.filter(f => f.decision_id === params?.[0]);
        return { rows: feedbacks.sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0)), rowCount: feedbacks.length };
      }

      if (text.includes('GROUP BY') && text.includes('scenario')) {
        if (text.includes('DATE(created_at)')) {
          // Quality trend query
          const scenario = params?.[0];
          const filtered = this.feedback.filter(f => f.scenario === scenario);
          const grouped: Record<string, { correct: number; total: number }> = {};
          for (const f of filtered) {
            const date = f.created_at?.toISOString().split('T')[0] || 'unknown';
            if (!grouped[date]) grouped[date] = { correct: 0, total: 0 };
            grouped[date].total++;
            if (f.rating === 'correct') grouped[date].correct++;
          }
          const rows = Object.entries(grouped).map(([date, data]) => ({
            date,
            correct_count: String(data.correct),
            total_count: String(data.total),
          }));
          return { rows, rowCount: rows.length };
        }

        // Quality stats query
        const scenario = params?.[0];
        const filtered = this.feedback.filter(f => f.scenario === scenario);
        const correct = filtered.filter(f => f.rating === 'correct').length;
        const incorrect = filtered.filter(f => f.rating === 'incorrect').length;
        const partially = filtered.filter(f => f.rating === 'partially').length;
        return {
          rows: [{
            scenario,
            total_decisions: String(filtered.length),
            correct_count: String(correct),
            incorrect_count: String(incorrect),
            partially_count: String(partially),
          }],
          rowCount: filtered.length > 0 ? 1 : 0,
        };
      }

      // General select - return all feedback
      let rows = [...this.feedback];
      if (params?.[0]) rows = rows.filter(f => f.decision_id === params[0]);
      return { rows, rowCount: rows.length };
    }

    if (text.includes('INSERT INTO ai_decision_feedback')) {
      const id = `feedback-${++this.idCounter}`;
      // SQL: VALUES ($1, $2, 'risk-assessment', NULL, $3, $4, $5)
      // params: [tenant_id, decision_id, rating, comment, created_by]
      const fb = {
        id,
        tenant_id: params[0],
        decision_id: params[1],
        scenario: 'risk-assessment', // Hardcoded in SQL
        model_id: null,
        rating: params[2],
        comment: params[3],
        created_by: params[4],
        created_at: new Date(),
      };
      this.feedback.push(fb);
      return { rows: [fb], rowCount: 1 };
    }

    // ================== AI Decisions (placeholder) ==================
    if (text.includes('SELECT') && text.includes('ai_decisions')) {
      if (text.includes('WHERE id =')) {
        const decision = this.decisions.find(d => d.id === params?.[0]);
        return { rows: decision ? [decision] : [], rowCount: decision ? 1 : 0 };
      }
      return { rows: this.decisions, rowCount: this.decisions.length };
    }

    if (text.includes('INSERT INTO ai_decisions')) {
      const id = `decision-${++this.idCounter}`;
      const decision = {
        id,
        scenario: params?.[0] || 'unknown',
        model_id: params?.[1] || null,
        created_at: new Date(),
      };
      this.decisions.push(decision);
      return { rows: [decision], rowCount: 1 };
    }

    // ================== Resilience scores (for query compatibility) ==================
    if (text.includes('resilience_scores_enhanced')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe('AI Decision Integration - Explanation + Feedback', () => {
  let mockDb: MockDecisionDb;
  let service: DecisionExplanationService;

  beforeEach(async () => {
    mockDb = new MockDecisionDb();
    service = new DecisionExplanationService(mockDb as any);
  });

  describe('E2E: Decision Explanation Generation', () => {
    it('should generate explanation with SHAP values', async () => {
      const explanation = await service.generateExplanation(
        'decision-001',
        'risk-assessment',
        'model-v2',
        { commit_size: 150, test_coverage: 0.75, days_since_last_failure: 30 },
        { confidence: 0.85, risk_level: 'medium' },
        {
          commit_size: 0.25,
          test_coverage: -0.15,
          days_since_last_failure: -0.10,
          team_velocity: 0.05,
        }
      );

      expect(explanation.decision_id).toBe('decision-001');
      expect(explanation.scenario).toBe('risk-assessment');
      expect(explanation.model_id).toBe('model-v2');
      expect(explanation.confidence).toBe(0.85);
      expect(explanation.explanation.topFactors).toHaveLength(3); // top 3
      expect(explanation.explanation.topFactors[0].feature).toBe('commit_size'); // highest SHAP
      expect(explanation.explanation.summary).toBeDefined();
      expect(explanation.explanation.summary).toContain('risk-assessment');
    });

    it('should generate explanation without SHAP values', async () => {
      const explanation = await service.generateExplanation(
        'decision-002',
        'deploy-gate',
        null,
        { pipeline_success_rate: 0.95 },
        { confidence: 0.90, decision: 'approve' }
      );

      expect(explanation.decision_id).toBe('decision-002');
      expect(explanation.confidence).toBe(0.90);
      expect(explanation.explanation.topFactors).toHaveLength(0); // No SHAP
      expect(explanation.explanation.summary).toContain('deploy-gate');
    });

    it('should use default confidence when not provided in output', async () => {
      const explanation = await service.generateExplanation(
        'decision-003',
        'cost-optimization',
        'model-v1',
        { cost: 100 },
        { decision: 'reduce' }
      );

      expect(explanation.confidence).toBe(0.5); // Default when no confidence or SHAP
    });

    it('should calculate confidence from SHAP values', async () => {
      const explanation = await service.generateExplanation(
        'decision-004',
        'security-scan',
        'model-v3',
        { vuln_count: 5, severity: 8 },
        { decision: 'block' },
        {
          vuln_count: 0.4,
          severity: 0.35,
          exploitability: 0.25,
        }
      );

      // Total SHAP magnitude = 0.4 + 0.35 + 0.25 = 1.0
      // Normalized = min(1, 1.0 / 2) = 0.5
      expect(explanation.confidence).toBe(0.5);
    });

    it('should include rule match path when provided', async () => {
      const rulePath: RulePathStep[] = [
        { ruleId: 'rule-1', ruleName: 'High Risk Threshold', condition: 'vuln_count > 3', matched: true },
        { ruleId: 'rule-2', ruleName: 'Critical CVE', condition: 'has_critical_cve = true', matched: true },
      ];

      const explanation = await service.generateExplanation(
        'decision-005',
        'security-scan',
        null,
        { vuln_count: 5, has_critical_cve: true },
        { decision: 'block' },
        undefined,
        rulePath,
      );

      expect(explanation.explanation.ruleMatchPath).toBeDefined();
      expect(explanation.explanation.ruleMatchPath).toHaveLength(2);
      expect(explanation.explanation.ruleMatchPath![0].ruleName).toBe('High Risk Threshold');
    });

    it('should sort top factors by absolute contribution', async () => {
      const explanation = await service.generateExplanation(
        'decision-006',
        'test',
        null,
        { a: 1, b: 2, c: 3, d: 4 },
        {},
        { a: 0.05, b: -0.3, c: 0.15, d: 0.2 },
      );

      const factors = explanation.explanation.topFactors;
      expect(factors[0].feature).toBe('b'); // |-0.3| = 0.3 (highest)
      expect(factors[1].feature).toBe('d'); // |0.2| = 0.2
      expect(factors[2].feature).toBe('c'); // |0.15| = 0.15
    });
  });

  describe('E2E: Decision Explanation Retrieval', () => {
    it('should get explanation for a decision with feedback', async () => {
      // Insert feedback first (the service looks up by decision_id in feedback table)
      await mockDb.query(
        `INSERT INTO ai_decision_feedback (tenant_id, decision_id, scenario, model_id, rating, comment, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['tenant-1', 'decision-existing', 'risk-assessment', null, 'correct', 'Good decision', 'user-1']
      );

      const explanation = await service.getExplanation('decision-existing');

      expect(explanation.decision_id).toBe('decision-existing');
      expect(explanation.scenario).toBe('risk-assessment');
      expect(explanation.confidence).toBe(0.85); // Placeholder from repository
    });

    it('should throw when explanation not found', async () => {
      await expect(service.getExplanation('non-existent'))
        .rejects
        .toThrow(DecisionExplanationServiceError);

      await expect(service.getExplanation('non-existent'))
        .rejects
        .toThrow('Decision explanation not found');
    });
  });

  describe('E2E: Decision Feedback', () => {
    it('should submit feedback for a decision', async () => {
      const feedback = await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-100',
        rating: 'correct',
        comment: 'The risk assessment was accurate',
        created_by: 'reviewer-1',
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.decision_id).toBe('decision-100');
      expect(feedback.rating).toBe('correct');
      expect(feedback.comment).toBe('The risk assessment was accurate');
    });

    it('should reject invalid rating', async () => {
      await expect(service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-100',
        rating: 'invalid' as any,
        created_by: 'user',
      })).rejects.toThrow('Invalid rating value');
    });

    it('should accept all valid ratings', async () => {
      const ratings: Array<'correct' | 'incorrect' | 'partially'> = ['correct', 'incorrect', 'partially'];

      for (const rating of ratings) {
        const feedback = await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-${rating}`,
          rating,
          created_by: 'user',
        });
        expect(feedback.rating).toBe(rating);
      }
    });

    it('should get feedback history for a decision', async () => {
      await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-history',
        rating: 'correct',
        created_by: 'reviewer-1',
      });
      await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-history',
        rating: 'partially',
        comment: 'Mostly correct',
        created_by: 'reviewer-2',
      });

      const history = await service.getFeedbackHistory('decision-history');
      expect(history.length).toBeGreaterThanOrEqual(2);
      // Ordered by created_at DESC
      expect(history[0].created_at).toBeDefined();
    });
  });

  describe('E2E: Decision Quality Statistics', () => {
    it('should return quality stats for a scenario', async () => {
      // Insert varied feedback
      for (let i = 0; i < 5; i++) {
        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-${i}`,
          rating: 'correct',
          created_by: 'reviewer',
        });
      }
      for (let i = 0; i < 2; i++) {
        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-inc-${i}`,
          rating: 'incorrect',
          created_by: 'reviewer',
        });
      }
      await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-partial',
        rating: 'partially',
        created_by: 'reviewer',
      });

      const stats = await service.getQualityStats('risk-assessment', 30);

      expect(stats.scenario).toBe('risk-assessment');
      expect(stats.total_decisions).toBe(8);
      expect(stats.correct_count).toBe(5);
      expect(stats.incorrect_count).toBe(2);
      expect(stats.partially_count).toBe(1);
      expect(stats.accuracy).toBe(5 / 8); // 0.625
    });

    it('should return zero stats when no data', async () => {
      const stats = await service.getQualityStats('nonexistent-scenario', 30);

      expect(stats.total_decisions).toBe(0);
      expect(stats.accuracy).toBe(0);
    });

    it('should return quality trend data', async () => {
      // Insert feedback with different dates
      await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-trend-1',
        rating: 'correct',
        created_by: 'reviewer',
      });
      await service.submitFeedback({
        tenant_id: 'tenant-1',
        decision_id: 'decision-trend-2',
        rating: 'incorrect',
        created_by: 'reviewer',
      });

      const trend = await service.getQualityTrend('risk-assessment', 30);

      expect(Array.isArray(trend.data)).toBe(true);
      expect(trend.data.length).toBeGreaterThanOrEqual(0);
    });

    it('should check for low accuracy', async () => {
      // Insert mostly incorrect feedback
      for (let i = 0; i < 8; i++) {
        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-bad-${i}`,
          rating: 'incorrect',
          created_by: 'reviewer',
        });
      }
      for (let i = 0; i < 2; i++) {
        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-good-${i}`,
          rating: 'correct',
          created_by: 'reviewer',
        });
      }

      const check = await service.checkLowAccuracy('risk-assessment');

      expect(check.threshold).toBe(0.7);
      // 2/10 = 0.2 accuracy, which is < 0.7 and >= 10 decisions
      expect(check.isLow).toBe(true);
      expect(check.accuracy).toBe(0.2);
    });

    it('should return not low when accuracy is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: `decision-good-${i}`,
          rating: 'correct',
          created_by: 'reviewer',
        });
      }

      const check = await service.checkLowAccuracy('risk-assessment');

      expect(check.isLow).toBe(false);
      expect(check.accuracy).toBe(1.0);
    });

    it('should get all low accuracy scenarios', async () => {
      const result = await service.getLowAccuracyScenarios();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('E2E: Summary Generation', () => {
    it('should generate summary with top factors', async () => {
      const explanation = await service.generateExplanation(
        'decision-summary',
        'pipeline-approval',
        null,
        { commit_size: 200, test_coverage: 0.5 },
        { risk_level: 'high' },
        { commit_size: 0.3, test_coverage: -0.2 },
      );

      expect(explanation.explanation.summary).toContain('pipeline-approval');
      expect(explanation.explanation.summary).toContain('high risk level');
    });

    it('should generate default summary when no factors', async () => {
      const explanation = await service.generateExplanation(
        'decision-default',
        'simple-check',
        null,
        {},
        {},
      );

      expect(explanation.explanation.summary).toContain('simple-check');
      expect(explanation.explanation.summary).toContain('default rules');
    });
  });
});
