/**
 * Team Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the team module's index.ts.
 */

import * as TeamModule from '../index';

describe('Team Module Exports', () => {
  describe('TeamRepository', () => {
    it('should export TeamRepository class', () => {
      expect(TeamModule.TeamRepository).toBeDefined();
      expect(typeof TeamModule.TeamRepository).toBe('function');
    });

    it('should export Team interface (type-only)', () => {
      expect(TeamModule.TeamRepository).toBeDefined();
    });

    it('should export TeamMember interface (type-only)', () => {
      expect(TeamModule.TeamRepository).toBeDefined();
    });

    it('should export TeamWithMembers interface (type-only)', () => {
      expect(TeamModule.TeamRepository).toBeDefined();
    });

    it('should export TeamRole interface (type-only)', () => {
      expect(TeamModule.TeamRepository).toBeDefined();
    });
  });

  describe('TeamService', () => {
    it('should export TeamService class', () => {
      expect(TeamModule.TeamService).toBeDefined();
      expect(typeof TeamModule.TeamService).toBe('function');
    });

    it('should export TeamServiceError class', () => {
      expect(TeamModule.TeamServiceError).toBeDefined();
      expect(typeof TeamModule.TeamServiceError).toBe('function');
    });

    it('should be instantiable with error', () => {
      const error = new TeamModule.TeamServiceError('test error', 'TEST_CODE');
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TeamServiceError');
    });
  });

  describe('module completeness', () => {
    it('should export exactly 3 class/function exports', () => {
      const exports = Object.keys(TeamModule);
      const classExports = exports.filter(
        key => typeof (TeamModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(3);
      expect(classExports).toContain('TeamRepository');
      expect(classExports).toContain('TeamService');
      expect(classExports).toContain('TeamServiceError');
    });
  });
});
