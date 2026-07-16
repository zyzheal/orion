import { DatabasePool } from '../database';
/**
 * DecisionExplanationService - Business logic for AI Decision Explanation
 *
 * Implements decision explanation capabilities including:
 * - SHAP value explanations for model decisions
 * - Rule engine match path tracking
 * - Confidence calculation and justification
 * - Decision feedback collection
 *
 * Phase 2 P0 Service
 */

// ==================== Types ====================

export interface ShapFactor {
  feature: string;
  value: number | string;
  contribution: number;
  direction: 'positive' | 'negative';
}

export interface RulePathStep {
  ruleId: string;
  ruleName: string;
  condition: string;
  matched: boolean;
}

export interface DecisionExplanation {
  decision_id: string;
  scenario: string;
  model_id: string | null;
  model_version: string;
  confidence: number;
  explanation: {
    summary: string;
    topFactors: ShapFactor[];
    ruleMatchPath?: RulePathStep[];
    alternativeOutcomes?: string[];
  };
  evaluated_at: Date;
}

export interface DecisionFeedback {
  id: string;
  tenant_id: string;
  decision_id: string;
  scenario: string;
  model_id: string | null;
  rating: 'correct' | 'incorrect' | 'partially';
  comment: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface SubmitFeedbackInput {
  tenant_id: string;
  decision_id: string;
  rating: 'correct' | 'incorrect' | 'partially';
  comment?: string;
  created_by?: string;
}

export interface DecisionQualityStats {
  scenario: string;
  total_decisions: number;
  correct_count: number;
  incorrect_count: number;
  partially_count: number;
  accuracy: number;
  avg_confidence: number;
}

export interface QualityTrend {
  date: string;
  accuracy: number;
  count: number;
}

export class DecisionExplanationServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DecisionExplanationServiceError';
  }
}

// ==================== Repository ====================

export class DecisionExplanationRepository {

  constructor(private pool: DatabasePool) {}

  async findExplanation(
    decisionId: string,
    tenantId?: string
  ): Promise<DecisionExplanation | null> {
    const whereClause = tenantId
      ? 'WHERE decision_id = $1 AND tenant_id = $2'
      : 'WHERE decision_id = $1';
    const params = tenantId ? [decisionId, tenantId] : [decisionId];

    const result = await this.pool.query(
      `SELECT * FROM ai_decision_explanations ${whereClause} LIMIT 1`,
      params
    );

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0];
    const explanationData = row.explanation || {};
    const featureImportance = row.feature_importance || [];

    return {
      decision_id: row.decision_id,
      scenario: row.decision_type,
      model_id: null,
      model_version: 'unknown',
      confidence: parseFloat(row.confidence_score) || 0,
      explanation: {
        summary: explanationData.summary || '',
        topFactors: featureImportance.map((f: ShapFactor) => ({
          feature: f.feature,
          value: f.value,
          contribution: f.contribution,
          direction: f.direction,
        })),
        ruleMatchPath: explanationData.ruleMatchPath,
        alternativeOutcomes: explanationData.alternativeOutcomes,
      },
      evaluated_at: new Date(row.created_at),
    };
  }

  async saveExplanation(
    decisionId: string,
    tenantId: string,
    decisionType: string,
    explanation: Record<string, unknown>,
    featureImportance: ShapFactor[],
    confidenceScore: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_decision_explanations
        (decision_id, tenant_id, decision_type, explanation, feature_importance, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [decisionId, tenantId, decisionType, explanation, featureImportance, confidenceScore]
    );
  }

  async submitFeedback(input: SubmitFeedbackInput): Promise<DecisionFeedback> {
    const result = await this.pool.query(
      `INSERT INTO ai_decision_feedback 
        (tenant_id, decision_id, scenario, model_id, rating, comment, created_by)
       VALUES ($1, $2, 'risk-assessment', NULL, $3, $4, $5)
       RETURNING *`,
      [input.tenant_id, input.decision_id, input.rating, input.comment || null, input.created_by || null]
    );
    return result.rows[0];
  }

  async getQualityStats(scenario: string, days: number): Promise<DecisionQualityStats> {
    const result = await this.pool.query(
      `SELECT
        f.scenario,
        COUNT(*) as total_decisions,
        COUNT(*) FILTER (WHERE f.rating = 'correct') as correct_count,
        COUNT(*) FILTER (WHERE f.rating = 'incorrect') as incorrect_count,
        COUNT(*) FILTER (WHERE f.rating = 'partially') as partially_count,
        COALESCE(AVG(e.confidence_score), 0) as avg_confidence
       FROM ai_decision_feedback f
       LEFT JOIN ai_decision_explanations e ON f.decision_id = e.decision_id::text
       WHERE f.scenario = $1 AND f.created_at >= now() - ($2 || ' days')::interval
       GROUP BY f.scenario`,
      [scenario, days]
    );

    if (!result.rows[0]) {
      return {
        scenario,
        total_decisions: 0,
        correct_count: 0,
        incorrect_count: 0,
        partially_count: 0,
        accuracy: 0,
        avg_confidence: 0,
      };
    }

    const row = result.rows[0];
    const total = parseInt(row.total_decisions);
    const correct = parseInt(row.correct_count);

    return {
      scenario,
      total_decisions: total,
      correct_count: correct,
      incorrect_count: parseInt(row.incorrect_count),
      partially_count: parseInt(row.partially_count),
      accuracy: total > 0 ? correct / total : 0,
      avg_confidence: parseFloat(row.avg_confidence) || 0,
    };
  }

  async getQualityTrend(scenario: string, days: number): Promise<QualityTrend[]> {
    const result = await this.pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE rating = 'correct') as correct_count,
        COUNT(*) as total_count
       FROM ai_decision_feedback
       WHERE scenario = $1 AND created_at >= now() - ($2 || ' days')::interval
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [scenario, days]
    );

    return result.rows.map(row => ({
      date: row.date,
      accuracy: parseInt(row.total_count) > 0 ? parseInt(row.correct_count) / parseInt(row.total_count) : 0,
      count: parseInt(row.total_count),
    }));
  }

  async listFeedback(decisionId: string): Promise<DecisionFeedback[]> {
    const result = await this.pool.query(
      `SELECT * FROM ai_decision_feedback WHERE decision_id = $1 ORDER BY created_at DESC`,
      [decisionId]
    );
    return result.rows;
  }
}

// ==================== Service ====================

export class DecisionExplanationService {
  private repository: DecisionExplanationRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new DecisionExplanationRepository(this.pool);
  }

  /**
   * Get explanation for a decision
   */
  async getExplanation(decisionId: string, tenantId?: string): Promise<DecisionExplanation> {
    const explanation = await this.repository.findExplanation(decisionId, tenantId);
    if (!explanation) {
      throw new DecisionExplanationServiceError(
        `Decision explanation not found: ${decisionId}`,
        'EXPLANATION_NOT_FOUND'
      );
    }
    return explanation;
  }

  /**
   * Generate explanation for a new decision (called by AI service) and persist to database
   */
  async generateExplanation(
    decisionId: string,
    scenario: string,
    modelId: string | null,
    inputFeatures: Record<string, number | string>,
    output: Record<string, unknown>,
    shapValues?: Record<string, number>,
    ruleMatchPath?: RulePathStep[],
    tenantId?: string
  ): Promise<DecisionExplanation> {
    // Calculate confidence from output or SHAP values
    const confidence = (output.confidence as number) || this.calculateConfidence(shapValues);

    // Build top factors from SHAP values
    const topFactors: ShapFactor[] = [];
    if (shapValues) {
      const sortedShap = Object.entries(shapValues)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3);

      for (const [feature, contribution] of sortedShap) {
        topFactors.push({
          feature,
          value: inputFeatures[feature] ?? 'N/A',
          contribution,
          direction: contribution > 0 ? 'positive' : 'negative',
        });
      }
    }

    // Generate summary
    const summary = this.generateSummary(scenario, topFactors, output);

    const explanation: DecisionExplanation = {
      decision_id: decisionId,
      scenario,
      model_id: modelId,
      model_version: 'v2.1.0',
      confidence,
      explanation: {
        summary,
        topFactors,
        ruleMatchPath,
      },
      evaluated_at: new Date(),
    };

    // Persist to database if tenantId is provided
    if (tenantId) {
      const explanationData = {
        summary,
        ruleMatchPath,
        alternativeOutcomes: output.alternative_outcomes as string[] | undefined,
      };
      await this.repository.saveExplanation(
        decisionId,
        tenantId,
        scenario,
        explanationData,
        topFactors,
        confidence
      );
    }

    return explanation;
  }

  /**
   * Submit feedback for a decision
   */
  async submitFeedback(input: SubmitFeedbackInput): Promise<DecisionFeedback> {
    // Validate rating
    if (!['correct', 'incorrect', 'partially'].includes(input.rating)) {
      throw new DecisionExplanationServiceError(
        'Invalid rating value',
        'INVALID_RATING'
      );
    }

    return this.repository.submitFeedback(input);
  }

  /**
   * Get decision quality statistics
   */
  async getQualityStats(
    scenario: string,
    days: number = 7,
    modelId?: string
  ): Promise<DecisionQualityStats> {
    return this.repository.getQualityStats(scenario, days);
  }

  /**
   * Get decision quality trend
   */
  async getQualityTrend(
    scenario: string,
    days: number = 30
  ): Promise<{ data: QualityTrend[] }> {
    const trend = await this.repository.getQualityTrend(scenario, days);
    return { data: trend };
  }

  /**
   * Get feedback history for a decision
   */
  async getFeedbackHistory(decisionId: string): Promise<DecisionFeedback[]> {
    return this.repository.listFeedback(decisionId);
  }

  /**
   * Calculate confidence from SHAP values
   */
  private calculateConfidence(shapValues?: Record<string, number>): number {
    if (!shapValues || Object.keys(shapValues).length === 0) {
      return 0.5;
    }

    // Simple confidence calculation based on SHAP magnitude
    const totalMagnitude = Object.values(shapValues)
      .reduce((sum, val) => sum + Math.abs(val), 0);

    // Normalize to 0-1 range (assuming max magnitude ~2)
    return Math.min(1, totalMagnitude / 2);
  }

  /**
   * Generate natural language summary
   */
  private generateSummary(
    scenario: string,
    factors: ShapFactor[],
    output: Record<string, unknown>
  ): string {
    if (factors.length === 0) {
      return `Decision made for ${scenario} scenario based on default rules.`;
    }

    const topFactor = factors[0];
    const factorDesc = `${topFactor.feature} (${topFactor.value}) contributed ${Math.abs(topFactor.contribution).toFixed(2)} to the decision`;

    const outputDesc = output.risk_level ? 
      `Result: ${output.risk_level} risk level` :
      `Result: ${JSON.stringify(output).slice(0, 50)}`;

    return `${scenario} decision: ${factorDesc}. ${outputDesc}`;
  }

  /**
   * Check if scenario has low accuracy and needs alert
   */
  async checkLowAccuracy(scenario: string): Promise<{
    isLow: boolean;
    accuracy: number;
    threshold: number;
  }> {
    const stats = await this.getQualityStats(scenario, 30);
    const threshold = 0.7; // 70% accuracy threshold

    return {
      isLow: stats.accuracy < threshold && stats.total_decisions >= 10,
      accuracy: stats.accuracy,
      threshold,
    };
  }

  /**
   * Get all scenarios with low accuracy
   */
  async getLowAccuracyScenarios(): Promise<Array<{
    scenario: string;
    accuracy: number;
    total_decisions: number;
  }>> {
    const result = await this.pool.query(
      `SELECT 
        scenario,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rating = 'correct') as correct
       FROM ai_decision_feedback
       WHERE created_at >= now() - '30 days'::interval
       GROUP BY scenario
       HAVING COUNT(*) >= 10`
    );

    const threshold = 0.7;
    return result.rows
      .map(row => ({
        scenario: row.scenario,
        accuracy: parseInt(row.correct) / parseInt(row.total),
        total_decisions: parseInt(row.total),
      }))
      .filter(s => s.accuracy < threshold);
  }
}