/**
 * DiagnosticService Tests
 *
 * Covers:
 * - createSession: delegation to repository
 * - completeSession: delegation to repository
 * - getSession: found/not-found
 * - getHistory: delegation with limit
 * - getRules: delegation with category filter
 * - DiagnosticServiceError: error class
 */

import { DiagnosticService, DiagnosticServiceError } from '../DiagnosticService';

describe('DiagnosticService', () => {
  let service: DiagnosticService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      createSession: jest.fn(),
      completeSession: jest.fn(),
      getSession: jest.fn(),
      getSessions: jest.fn(),
      findRules: jest.fn(),
    };
    service = new DiagnosticService(mockRepo);
  });

  describe('createSession', () => {
    it('should delegate to repository', async () => {
      const session = { id: 's1', tenantId: 't1' } as any;
      await service.createSession(session);
      expect(mockRepo.createSession).toHaveBeenCalledWith(session);
    });
  });

  describe('completeSession', () => {
    it('should delegate to repository', async () => {
      await service.completeSession('s1', null, 0.8, []);
      expect(mockRepo.completeSession).toHaveBeenCalledWith('s1', null, 0.8, []);
    });
  });

  describe('getSession', () => {
    it('should return session when found', async () => {
      mockRepo.getSession.mockResolvedValue({ id: 's1' });
      expect(await service.getSession('s1')).toEqual({ id: 's1' });
    });

    it('should throw when not found', async () => {
      mockRepo.getSession.mockResolvedValue(null);
      await expect(service.getSession('missing')).rejects.toThrow('Session not found');
    });
  });

  describe('getHistory', () => {
    it('should return session history', async () => {
      mockRepo.getSessions.mockResolvedValue([{ id: 's1' }]);
      expect(await service.getHistory('t1', 10)).toEqual([{ id: 's1' }]);
      expect(mockRepo.getSessions).toHaveBeenCalledWith('t1', 10);
    });
  });

  describe('getRules', () => {
    it('should return rules', async () => {
      mockRepo.findRules.mockResolvedValue([{ id: 'r1' }]);
      expect(await service.getRules('network')).toEqual([{ id: 'r1' }]);
    });
  });

  describe('DiagnosticServiceError', () => {
    it('should have correct name and code', () => {
      const error = new DiagnosticServiceError('msg', 'CODE');
      expect(error.name).toBe('DiagnosticServiceError');
      expect(error.code).toBe('CODE');
    });
  });
});
