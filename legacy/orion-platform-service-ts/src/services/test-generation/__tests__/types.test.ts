/**
 * Test Generation Types Tests
 *
 * 覆盖: DEFAULT_TEST_GENERATION_STRATEGY 常量和 TEST_FRAMEWORK_MAP 映射
 */

import { DEFAULT_TEST_GENERATION_STRATEGY, TEST_FRAMEWORK_MAP } from '../types';

describe('DEFAULT_TEST_GENERATION_STRATEGY', () => {
  it('should be defined', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY).toBeDefined();
  });

  it('should enable unit tests by default', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.unitTests).toBe(true);
  });

  it('should disable integration tests by default', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.integrationTests).toBe(false);
  });

  it('should enable edge case tests by default', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.edgeCaseTests).toBe(true);
  });

  it('should set coverage target to 80', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.coverageTarget).toBe(80);
  });

  it('should enable mocking by default', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.includeMocking).toBe(true);
  });

  it('should enable assertions by default', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.includeAssertions).toBe(true);
  });

  it('should use gpt-4 model', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.model).toBe('gpt-4');
  });

  it('should set temperature to 0.3', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.temperature).toBe(0.3);
  });

  it('should set max tokens to 4000', () => {
    expect(DEFAULT_TEST_GENERATION_STRATEGY.maxTokens).toBe(4000);
  });
});

describe('TEST_FRAMEWORK_MAP', () => {
  it('should be defined', () => {
    expect(TEST_FRAMEWORK_MAP).toBeDefined();
  });

  it('should map TypeScript to jest, vitest, mocha', () => {
    expect(TEST_FRAMEWORK_MAP.typescript).toEqual(['jest', 'vitest', 'mocha']);
  });

  it('should map JavaScript to jest, mocha, jasmine', () => {
    expect(TEST_FRAMEWORK_MAP.javascript).toEqual(['jest', 'mocha', 'jasmine']);
  });

  it('should map Python to pytest, unittest', () => {
    expect(TEST_FRAMEWORK_MAP.python).toEqual(['pytest', 'unittest']);
  });

  it('should map Go to go-testing', () => {
    expect(TEST_FRAMEWORK_MAP.go).toEqual(['go-testing']);
  });

  it('should map Java to junit5, junit4', () => {
    expect(TEST_FRAMEWORK_MAP.java).toEqual(['junit5', 'junit4']);
  });

  it('should have entries for all supported languages', () => {
    const languages = Object.keys(TEST_FRAMEWORK_MAP);
    expect(languages).toContain('typescript');
    expect(languages).toContain('javascript');
    expect(languages).toContain('python');
    expect(languages).toContain('go');
    expect(languages).toContain('java');
    expect(languages).toHaveLength(5);
  });

  it('should have at least one framework per language', () => {
    for (const [lang, frameworks] of Object.entries(TEST_FRAMEWORK_MAP)) {
      expect(frameworks.length).toBeGreaterThanOrEqual(1);
    }
  });
});
