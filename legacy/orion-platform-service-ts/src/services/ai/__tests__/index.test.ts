/**
 * AI 模块 barrel export 测试
 *
 * 验证 index.ts 正确导出所有公共类型和类
 */

import * as AIModule from '../index';

describe('AI Module barrel export', () => {
  // ==================== Class exports ====================

  describe('class exports', () => {
    it('should export AIGateway', () => {
      expect(AIModule.AIGateway).toBeDefined();
      expect(typeof AIModule.AIGateway).toBe('function');
    });

    it('should export AIDegradationRouter', () => {
      expect(AIModule.AIDegradationRouter).toBeDefined();
      expect(typeof AIModule.AIDegradationRouter).toBe('function');
    });

    it('should export RuleEngine', () => {
      expect(AIModule.RuleEngine).toBeDefined();
      expect(typeof AIModule.RuleEngine).toBe('function');
    });

    it('should export VectorStore', () => {
      expect(AIModule.VectorStore).toBeDefined();
      expect(typeof AIModule.VectorStore).toBe('function');
    });

    it('should export PromptSecurity', () => {
      expect(AIModule.PromptSecurity).toBeDefined();
      expect(typeof AIModule.PromptSecurity).toBe('function');
    });

    it('should export PromptInjectionDetector', () => {
      expect(AIModule.PromptInjectionDetector).toBeDefined();
      expect(typeof AIModule.PromptInjectionDetector).toBe('function');
    });

    it('should export PromptSanitizer', () => {
      expect(AIModule.PromptSanitizer).toBeDefined();
      expect(typeof AIModule.PromptSanitizer).toBe('function');
    });

    it('should export ProviderCircuitBreaker', () => {
      expect(AIModule.ProviderCircuitBreaker).toBeDefined();
      expect(typeof AIModule.ProviderCircuitBreaker).toBe('function');
    });

    it('should export CircuitBreakerManager', () => {
      expect(AIModule.CircuitBreakerManager).toBeDefined();
      expect(typeof AIModule.CircuitBreakerManager).toBe('function');
    });

    it('should export DecisionExplanationService', () => {
      expect(AIModule.DecisionExplanationService).toBeDefined();
      expect(typeof AIModule.DecisionExplanationService).toBe('function');
    });

    it('should export ModelVersionService', () => {
      expect(AIModule.ModelVersionService).toBeDefined();
      expect(typeof AIModule.ModelVersionService).toBe('function');
    });

    it('should export MLInferenceService', () => {
      expect(AIModule.MLInferenceService).toBeDefined();
      expect(typeof AIModule.MLInferenceService).toBe('function');
    });

    it('should export CostOptimizerService', () => {
      expect(AIModule.CostOptimizerService).toBeDefined();
      expect(typeof AIModule.CostOptimizerService).toBe('function');
    });

    it('should export AIDiagnosisService', () => {
      expect(AIModule.AIDiagnosisService).toBeDefined();
      expect(typeof AIModule.AIDiagnosisService).toBe('function');
    });
  });

  // ==================== AIGatewayPromptSecurityConfig alias ====================

  describe('AIGatewayPromptSecurityConfig', () => {
    it('should export AIGatewayPromptSecurityConfig as alias', () => {
      // AIGatewayPromptSecurityConfig is a re-export of PromptSecurityConfig from AIGateway
      // It may be a type/interface, so we check it exists as a named export
      expect('AIGatewayPromptSecurityConfig' in AIModule).toBe(true);
    });
  });

  // ==================== Instantiation smoke tests ====================

  describe('instantiation smoke tests', () => {
    it('should be able to instantiate CostOptimizerService', () => {
      const service = new AIModule.CostOptimizerService();
      expect(service).toBeDefined();
    });

    it('should be able to instantiate RuleEngine', () => {
      const engine = new AIModule.RuleEngine();
      expect(engine).toBeDefined();
    });

    it('should be able to instantiate PromptInjectionDetector', () => {
      const detector = new AIModule.PromptInjectionDetector();
      expect(detector).toBeDefined();
    });

    it('should be able to instantiate PromptSanitizer', () => {
      const sanitizer = new AIModule.PromptSanitizer();
      expect(sanitizer).toBeDefined();
    });

    it('should be able to instantiate CircuitBreakerManager', () => {
      const manager = new AIModule.CircuitBreakerManager();
      expect(manager).toBeDefined();
    });

    it('should be able to instantiate MLInferenceService', () => {
      const service = new AIModule.MLInferenceService();
      expect(service).toBeDefined();
    });
  });
});
