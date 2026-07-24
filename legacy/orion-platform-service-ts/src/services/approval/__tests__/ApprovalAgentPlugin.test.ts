/**
 * Tests for ApprovalAgentPlugin - utility functions and interfaces
 */
import {
  createDefaultAgentConfig,
  isValidApprovalDecision,
  determineAutoAction,
  ApprovalDecision,
  ApprovalAgentConfig,
} from '../ApprovalAgentPlugin';

describe('ApprovalAgentPlugin', () => {
  describe('createDefaultAgentConfig', () => {
    it('should return default config with threshold values', () => {
      const config = createDefaultAgentConfig();
      expect(config.threshold).toBeDefined();
      expect(config.threshold!.autoApproveConfidence).toBe(0.8);
      expect(config.threshold!.autoRejectConfidence).toBe(0.95);
      expect(config.threshold!.autoRejectRiskScore).toBe(90);
    });

    it('should set default onLowConfidence to escalate-to-next', () => {
      const config = createDefaultAgentConfig();
      expect(config.onLowConfidence).toBe('escalate-to-next');
    });

    it('should set default onAgentFailure to fallback-to-rules', () => {
      const config = createDefaultAgentConfig();
      expect(config.onAgentFailure).toBe('fallback-to-rules');
    });

    it('should set default timeoutSeconds to 10', () => {
      const config = createDefaultAgentConfig();
      expect(config.timeoutSeconds).toBe(10);
    });

    it('should set default aiServiceUrl', () => {
      const config = createDefaultAgentConfig();
      expect(config.aiServiceUrl).toBeDefined();
      expect(typeof config.aiServiceUrl).toBe('string');
    });
  });

  describe('isValidApprovalDecision', () => {
    it('should return true for valid approve decision', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.9,
        reason: 'Low risk operation',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });

    it('should return true for valid reject decision', () => {
      const decision: ApprovalDecision = {
        action: 'reject',
        confidence: 0.95,
        reason: 'High risk operation',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });

    it('should return true for valid escalate decision', () => {
      const decision: ApprovalDecision = {
        action: 'escalate',
        confidence: 0.5,
        reason: 'Needs human review',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });

    it('should return true for valid delegate decision', () => {
      const decision: ApprovalDecision = {
        action: 'delegate',
        confidence: 0.7,
        reason: 'Delegating to expert',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });

    it('should return false for invalid action', () => {
      const decision = {
        action: 'invalid',
        confidence: 0.9,
        reason: 'test',
      } as any;
      expect(isValidApprovalDecision(decision)).toBe(false);
    });

    it('should return false for confidence below 0', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: -0.1,
        reason: 'test',
      };
      expect(isValidApprovalDecision(decision)).toBe(false);
    });

    it('should return false for confidence above 1', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 1.1,
        reason: 'test',
      };
      expect(isValidApprovalDecision(decision)).toBe(false);
    });

    it('should return false for non-string reason', () => {
      const decision = {
        action: 'approve',
        confidence: 0.9,
        reason: 123,
      } as any;
      expect(isValidApprovalDecision(decision)).toBe(false);
    });

    it('should return false for non-number confidence', () => {
      const decision = {
        action: 'approve',
        confidence: 'high',
        reason: 'test',
      } as any;
      expect(isValidApprovalDecision(decision)).toBe(false);
    });

    it('should accept confidence of 0', () => {
      const decision: ApprovalDecision = {
        action: 'escalate',
        confidence: 0,
        reason: 'No confidence',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });

    it('should accept confidence of 1', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 1,
        reason: 'Full confidence',
      };
      expect(isValidApprovalDecision(decision)).toBe(true);
    });
  });

  describe('determineAutoAction', () => {
    const defaultConfig: ApprovalAgentConfig = {
      threshold: {
        autoApproveConfidence: 0.8,
        autoRejectConfidence: 0.95,
        autoRejectRiskScore: 90,
      },
    };

    it('should approve when confidence >= threshold and risk < threshold', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.85,
        reason: 'Low risk',
        riskScore: 50,
      };
      expect(determineAutoAction(decision, defaultConfig)).toBe('approve');
    });

    it('should approve when confidence is high and risk score is 0', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.9,
        reason: 'Very low risk',
        riskScore: 0,
      };
      expect(determineAutoAction(decision, defaultConfig)).toBe('approve');
    });

    it('should reject when confidence >= reject threshold and risk >= threshold', () => {
      const decision: ApprovalDecision = {
        action: 'reject',
        confidence: 0.96,
        reason: 'High risk',
        riskScore: 95,
      };
      expect(determineAutoAction(decision, defaultConfig)).toBe('reject');
    });

    it('should escalate when confidence < approve threshold', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.7,
        reason: 'Medium confidence',
        riskScore: 30,
      };
      expect(determineAutoAction(decision, defaultConfig)).toBe('escalate');
    });

    it('should return original action when confidence >= approve threshold but risk >= reject threshold', () => {
      const decision: ApprovalDecision = {
        action: 'escalate',
        confidence: 0.85,
        reason: 'High risk but confident',
        riskScore: 95,
      };
      // confidence >= autoApproveConfidence (0.8) but riskScore >= autoRejectRiskScore (90)
      // So it doesn't match approve condition, doesn't match reject (confidence < 0.95)
      // Falls to confidence < autoApproveConfidence check which is false
      // Returns original action
      expect(determineAutoAction(decision, defaultConfig)).toBe('escalate');
    });

    it('should use default config when threshold is not provided', () => {
      const config: ApprovalAgentConfig = {};
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.85,
        reason: 'test',
        riskScore: 50,
      };
      expect(determineAutoAction(decision, config)).toBe('approve');
    });

    it('should handle missing riskScore (defaults to 0)', () => {
      const decision: ApprovalDecision = {
        action: 'approve',
        confidence: 0.9,
        reason: 'No risk score',
      };
      expect(determineAutoAction(decision, defaultConfig)).toBe('approve');
    });
  });
});
