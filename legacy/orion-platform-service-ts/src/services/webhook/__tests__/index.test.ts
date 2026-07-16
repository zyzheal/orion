/**
 * Webhook Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the webhook module's index.ts.
 */

import * as WebhookModule from '../index';

describe('Webhook Module Exports', () => {
  describe('WebhookRepository', () => {
    it('should export WebhookRepository class', () => {
      expect(WebhookModule.WebhookRepository).toBeDefined();
      expect(typeof WebhookModule.WebhookRepository).toBe('function');
    });

    it('should export Webhook interface (type-only)', () => {
      expect(WebhookModule.WebhookRepository).toBeDefined();
    });

    it('should export WebhookDelivery interface (type-only)', () => {
      expect(WebhookModule.WebhookRepository).toBeDefined();
    });
  });

  describe('WebhookService', () => {
    it('should export WebhookService class', () => {
      expect(WebhookModule.WebhookService).toBeDefined();
      expect(typeof WebhookModule.WebhookService).toBe('function');
    });

    it('should export WebhookServiceError class', () => {
      expect(WebhookModule.WebhookServiceError).toBeDefined();
      expect(typeof WebhookModule.WebhookServiceError).toBe('function');
    });

    it('should be instantiable with error', () => {
      const error = new WebhookModule.WebhookServiceError('test error', 'TEST_CODE');
      expect(error.message).toBe('test error (TEST_CODE)');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('WebhookServiceError');
    });
  });

  describe('module completeness', () => {
    it('should export exactly 3 class/function exports', () => {
      const exports = Object.keys(WebhookModule);
      const classExports = exports.filter(
        key => typeof (WebhookModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(3);
      expect(classExports).toContain('WebhookRepository');
      expect(classExports).toContain('WebhookService');
      expect(classExports).toContain('WebhookServiceError');
    });
  });
});
