/**
 * RiskScoringEngine 单元测试
 */

import {
  RiskScoringEngine,
  DEFAULT_WEIGHTS,
  RISK_LEVEL_THRESHOLDS,
  RiskScoringWeights,
} from '../RiskScoringEngine';
import { DeploymentRisk } from '../types';

describe('RiskScoringEngine', () => {
  let engine: RiskScoringEngine;

  beforeEach(() => {
    engine = new RiskScoringEngine();
  });

  // ==================== evaluateRiskLevel ====================

  describe('evaluateRiskLevel', () => {
    it('should return Low for score <= 25', () => {
      expect(engine.evaluateRiskLevel(0)).toBe('Low');
      expect(engine.evaluateRiskLevel(25)).toBe('Low');
    });

    it('should return Medium for score 26-50', () => {
      expect(engine.evaluateRiskLevel(26)).toBe('Medium');
      expect(engine.evaluateRiskLevel(50)).toBe('Medium');
    });

    it('should return High for score 51-75', () => {
      expect(engine.evaluateRiskLevel(51)).toBe('High');
      expect(engine.evaluateRiskLevel(75)).toBe('High');
    });

    it('should return Critical for score 76-100', () => {
      expect(engine.evaluateRiskLevel(76)).toBe('Critical');
      expect(engine.evaluateRiskLevel(100)).toBe('Critical');
    });
  });

  // ==================== calculateRiskScore ====================

  describe('calculateRiskScore', () => {
    it('should return low risk for minimal change', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: {
          filesChanged: 3,
          linesChanged: 50,
        },
        timeRisk: {
          isWeekend: false,
          isAfterHours: false,
          isHoliday: false,
          isFriday: false,
        },
        dependencyRisk: {
          totalDependencies: 2,
          unhealthyDependencies: 0,
          criticalDependencies: [],
        },
        historicalRisk: {
          recentFailureRate: 0.02,
          recentIncidents: 0,
          averageMTTR: 300000, // 5 minutes
        },
      };

      const score = engine.calculateRiskScore(deploymentRisk);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      const level = engine.evaluateRiskLevel(score);
      expect(level).toBe('Low');
    });

    it('should return high risk for large change with failures', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a', 'service-b', 'service-c', 'service-d', 'service-e', 'service-f'],
        changeSize: {
          filesChanged: 80,
          linesChanged: 8000,
        },
        timeRisk: {
          isWeekend: true,
          isAfterHours: true,
          isHoliday: false,
          isFriday: false,
        },
        dependencyRisk: {
          totalDependencies: 15,
          unhealthyDependencies: 2,
          criticalDependencies: ['db-primary', 'cache-cluster'],
        },
        historicalRisk: {
          recentFailureRate: 0.35,
          recentIncidents: 4,
          averageMTTR: 7200000, // 2 hours
        },
      };

      const score = engine.calculateRiskScore(deploymentRisk);
      const level = engine.evaluateRiskLevel(score);
      expect(level).toBe('High');
    });

    it('should return critical risk for extremely risky deployment', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: Array.from({ length: 12 }, (_, i) => `service-${i}`),
        changeSize: {
          filesChanged: 150,
          linesChanged: 15000,
        },
        timeRisk: {
          isWeekend: true,
          isAfterHours: true,
          isHoliday: true,
          isFriday: false,
        },
        dependencyRisk: {
          totalDependencies: 25,
          unhealthyDependencies: 5,
          criticalDependencies: ['db-primary', 'db-replica', 'cache-cluster', 'message-queue'],
        },
        historicalRisk: {
          recentFailureRate: 0.60,
          recentIncidents: 6,
          averageMTTR: 14400000, // 4 hours
        },
      };

      const score = engine.calculateRiskScore(deploymentRisk);
      const level = engine.evaluateRiskLevel(score);
      expect(level).toBe('Critical');
    });

    it('should handle empty change scope gracefully', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: [],
        changeSize: {
          filesChanged: 0,
          linesChanged: 0,
        },
        timeRisk: {
          isWeekend: false,
          isAfterHours: false,
          isHoliday: false,
          isFriday: false,
        },
        dependencyRisk: {
          totalDependencies: 0,
          unhealthyDependencies: 0,
          criticalDependencies: [],
        },
        historicalRisk: {
          recentFailureRate: 0,
          recentIncidents: 0,
          averageMTTR: 0,
        },
      };

      const score = engine.calculateRiskScore(deploymentRisk);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ==================== getRiskFactors ====================

  describe('getRiskFactors', () => {
    it('should return 10 risk factors', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 10, linesChanged: 200 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 600000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      expect(factors.length).toBe(10);
    });

    it('should include all three categories', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 10, linesChanged: 200 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 600000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const categories = factors.map((f) => f.category);

      expect(categories).toContain('technical');
      expect(categories).toContain('historical');
      expect(categories).toContain('organizational');
    });

    it('should have weights that sum to 1.0', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 10, linesChanged: 200 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 600000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);

      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('should have scores between 0 and 100', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a', 'service-b'],
        changeSize: { filesChanged: 25, linesChanged: 1500 },
        timeRisk: { isWeekend: false, isAfterHours: true, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 8, unhealthyDependencies: 1, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.15, recentIncidents: 2, averageMTTR: 3600000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      factors.forEach((f) => {
        expect(f.score).toBeGreaterThanOrEqual(0);
        expect(f.score).toBeLessThanOrEqual(100);
      });
    });
  });

  // ==================== generateRecommendations ====================

  describe('generateRecommendations', () => {
    it('should generate recommendations for high risk factors', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: Array.from({ length: 12 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 120, linesChanged: 12000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 22, unhealthyDependencies: 3, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.40, recentIncidents: 5, averageMTTR: 9000000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const riskLevel = engine.evaluateRiskLevel(engine.calculateRiskScore(deploymentRisk));
      const recommendations = engine.generateRecommendations(factors, riskLevel);

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should include block type for Critical risk level', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: Array.from({ length: 15 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 200, linesChanged: 20000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: true, isFriday: false },
        dependencyRisk: { totalDependencies: 30, unhealthyDependencies: 5, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.70, recentIncidents: 8, averageMTTR: 18000000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const riskLevel = engine.evaluateRiskLevel(engine.calculateRiskScore(deploymentRisk));
      const recommendations = engine.generateRecommendations(factors, riskLevel);

      expect(riskLevel).toBe('Critical');
      const blockRecs = recommendations.filter((r) => r.type === 'block');
      expect(blockRecs.length).toBeGreaterThan(0);
    });

    it('should include warn type for High risk level', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a', 'service-b', 'service-c', 'service-d', 'service-e', 'service-f'],
        changeSize: { filesChanged: 60, linesChanged: 6000 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: true },
        dependencyRisk: { totalDependencies: 12, unhealthyDependencies: 1, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.25, recentIncidents: 3, averageMTTR: 5400000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const riskLevel = engine.evaluateRiskLevel(engine.calculateRiskScore(deploymentRisk));
      const recommendations = engine.generateRecommendations(factors, riskLevel);

      expect(riskLevel).toBe('High');
      const warnRecs = recommendations.filter((r) => r.type === 'warn');
      expect(warnRecs.length).toBeGreaterThan(0);
    });

    it('should return fewer recommendations for low risk', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 2, linesChanged: 30 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const riskLevel = engine.evaluateRiskLevel(engine.calculateRiskScore(deploymentRisk));
      const recommendations = engine.generateRecommendations(factors, riskLevel);

      expect(riskLevel).toBe('Low');
      // Low risk should have very few or no recommendations
      expect(recommendations.length).toBeLessThan(5);
    });

    it('should sort recommendations by priority', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: Array.from({ length: 12 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 120, linesChanged: 12000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 22, unhealthyDependencies: 3, criticalDependencies: ['db'] },
        historicalRisk: { recentFailureRate: 0.40, recentIncidents: 5, averageMTTR: 9000000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const riskLevel = engine.evaluateRiskLevel(engine.calculateRiskScore(deploymentRisk));
      const recommendations = engine.generateRecommendations(factors, riskLevel);

      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < recommendations.length; i++) {
        expect(priorityOrder[recommendations[i].priority]).toBeGreaterThanOrEqual(
          priorityOrder[recommendations[i - 1].priority]
        );
      }
    });
  });

  // ==================== Weight Configuration ====================

  describe('weight configuration', () => {
    it('should use default weights', () => {
      const weights = engine.getWeights();
      expect(weights).toEqual(DEFAULT_WEIGHTS);
    });

    it('should allow custom weights', () => {
      const customWeights: Partial<RiskScoringWeights> = {
        technical: {
          changeSize: 0.30,
          changeComplexity: 0.20,
          dependencyCount: 0.10,
          testCoverage: 0.05,
        },
      };
      const customEngine = new RiskScoringEngine(customWeights);
      const weights = customEngine.getWeights();

      expect(weights.technical.changeSize).toBe(0.30);
      expect(weights.technical.changeComplexity).toBe(0.20);
      // Unspecified weights should use defaults
      expect(weights.historical.failureRate).toBe(DEFAULT_WEIGHTS.historical.failureRate);
    });

    it('should allow updating weights at runtime', () => {
      engine.updateWeights({
        historical: {
          failureRate: 0.30,
          recentIncidents: 0.25,
          mttr: 0.10,
        },
      });

      const weights = engine.getWeights();
      expect(weights.historical.failureRate).toBe(0.30);
      expect(weights.historical.recentIncidents).toBe(0.25);
    });
  });

  // ==================== Time Risk Evaluation ====================

  describe('time risk evaluation', () => {
    it('should give high score for holiday deployments', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: true, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const timeFactor = factors.find((f) => f.name === 'timeOfDay');
      expect(timeFactor).toBeDefined();
      expect(timeFactor!.score).toBe(80);
    });

    it('should give high score for weekend deployments', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: true, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const timeFactor = factors.find((f) => f.name === 'timeOfDay');
      expect(timeFactor).toBeDefined();
      expect(timeFactor!.score).toBe(60);
    });

    it('should give moderate score for Friday after-hours', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: true, isHoliday: false, isFriday: true },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const timeFactor = factors.find((f) => f.name === 'timeOfDay');
      expect(timeFactor).toBeDefined();
      expect(timeFactor!.score).toBe(55);
    });

    it('should give low score for normal working hours', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const timeFactor = factors.find((f) => f.name === 'timeOfDay');
      expect(timeFactor).toBeDefined();
      expect(timeFactor!.score).toBe(10);
    });
  });

  // ==================== Historical Risk Evaluation ====================

  describe('historical risk evaluation', () => {
    it('should give high score for high failure rate', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.80, recentIncidents: 0, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const failureFactor = factors.find((f) => f.name === 'failureRate');
      expect(failureFactor).toBeDefined();
      expect(failureFactor!.score).toBe(80);
    });

    it('should give high score for many recent incidents', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 6, averageMTTR: 120000 },
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const incidentFactor = factors.find((f) => f.name === 'recentIncidents');
      expect(incidentFactor).toBeDefined();
      expect(incidentFactor!.score).toBe(90);
    });

    it('should give high score for long MTTR', () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 36000000 }, // 10 hours
      };

      const factors = engine.getRiskFactors(deploymentRisk);
      const mttrFactor = factors.find((f) => f.name === 'mttr');
      expect(mttrFactor).toBeDefined();
      expect(mttrFactor!.score).toBe(85);
    });
  });

  // ==================== Dependency Risk Evaluation ====================

  describe('dependency risk evaluation', () => {
    it('should increase score for unhealthy dependencies', () => {
      const lowRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const highRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 3, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const lowScore = engine.calculateRiskScore(lowRisk);
      const highScore = engine.calculateRiskScore(highRisk);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should increase score for many dependencies', () => {
      const fewDeps: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 3, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const manyDeps: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 25, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const fewScore = engine.calculateRiskScore(fewDeps);
      const manyScore = engine.calculateRiskScore(manyDeps);

      expect(manyScore).toBeGreaterThan(fewScore);
    });
  });
});
