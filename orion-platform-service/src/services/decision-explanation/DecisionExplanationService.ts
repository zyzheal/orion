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

  async findExplanation(decisionId: string): Promise<DecisionExplanation | null> {
    const result = await this.pool.query(
      `SELECT * FROM ai_decision_feedback WHERE decision_id = $1`,
      [decisionId]
    );

    // For now, return placeholder - actual implementation would query ai_decisions table
    if (!result.rows[0]) {
      return null;
    }

    return {
      decision_id: decisionId,
      scenario: result.rows[0].scenario,
      model_id: result.rows[0].model_id,
      model_version: 'v2.1.0', // Would get from model
      confidence: 0.85,
      explanation: {
        summary: 'Decision based on risk assessment factors',
        topFactors: [
          { feature: 'commit_size', value: 150, contribution: 0.25, direction: 'positive' },
          { feature: 'test_coverage', value: 0.75, contribution: -0.15, direction: 'negative' },
          { feature: 'days_since_last_failure', value: 30, contribution: -0.10, direction: 'negative' },
        ],
      },
      evaluated_at: result.rows[0].created_at,
    };
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
        scenario,
        COUNT(*) as total_decisions,
        COUNT(*) FILTER (WHERE rating = 'correct') as correct_count,
        COUNT(*) FILTER (WHERE rating = 'incorrect') as incorrect_count,
        COUNT(*) FILTER (WHERE rating = 'partially') as partially_count
       FROM ai_decision_feedback
       WHERE scenario = $1 AND created_at >= now() - ($2 || ' days')::interval
       GROUP BY scenario`,
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
      avg_confidence: 0.85, // Placeholder
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
  async getExplanation(decisionId: string): Promise<DecisionExplanation> {
    const explanation = await this.repository.findExplanation(decisionId);
    if (!explanation) {
      throw new DecisionExplanationServiceError(
        `Decision explanation not found: ${decisionId}`,
        'EXPLANATION_NOT_FOUND'
      );
    }
    return explanation;
  }

  /**
   * Generate explanation for a new decision (called by AI service)
   */
  async generateExplanation(
    decisionId: string,
    scenario: string,
    modelId: string | null,
    inputFeatures: Record<string, number | string>,
    output: Record<string, unknown>,
    shapValues?: Record<string, number>,
    ruleMatchPath?: RulePathStep[]
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

    return {
      decision_id: decisionId,
      scenario,
      model_id: modelId,
      model_version: 'v2.1.0', // Would get from model lookup
      confidence,
      explanation: {
        summary,
        topFactors,
        ruleMatchPath,
      },
      evaluated_at: new Date(),
    };
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