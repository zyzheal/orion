/**
 * SlaService Unit Tests
 */

import { SlaService, SlaServiceError } from '../SlaService';
import { SlaRepository, SLAPolicyEntity, TicketSLAEntity } from '../repositories/SlaRepository';
import { getCurrentTenantId, getCurrentUserId } from '../../../db/tenant-context-storage';

jest.mock('../../../db/tenant-context-storage', () => {
  const mockTenantId = jest.fn(() => '__system__');
  const mockUserId = jest.fn(() => '__system__');
  return {
    getCurrentTenantId: mockTenantId,
    getCurrentUserId: mockUserId,
    getCurrentTraceId: jest.fn(() => 'test-trace-123'),
  };
});

const MOCK_TENANT_ID = '__system__';
const MOCK_USER_ID = 'user-1';

// Mock SlaRepository
const mockSlaRepo = {
  createPolicy: jest.fn(),
  findPolicyById: jest.fn(),
  findAllPolicies: jest.fn(),
  updatePolicy: jest.fn(),
  deletePolicy: jest.fn(),
  createTicketSLA: jest.fn(),
  getTicketSLA: jest.fn(),
  getAllTicketSLAs: jest.fn(),
  updateTicketSLA: jest.fn(),
  getSLAViolations: jest.fn(),
  getSLAComplianceStats: jest.fn(),
  getTicketSLAStatus: jest.fn(),
} as unknown as SlaRepository;

describe('SlaService', () => {
  let service: SlaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentTenantId as jest.Mock).mockReturnValue(MOCK_TENANT_ID);
    (getCurrentUserId as jest.Mock).mockReturnValue(MOCK_USER_ID);
    service = new SlaService(mockSlaRepo);
  });

  // ==================== SlaServiceError ====================

  describe('SlaServiceError', () => {
    it('should set message and code', () => {
      const error = new SlaServiceError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('SlaServiceError');
    });

    it('should be an instance of Error', () => {
      const error = new SlaServiceError('msg', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ==================== createSlaPolicy ====================

  describe('createSlaPolicy', () => {
    it('should create an SLA policy with default tenant and user', async () => {
      const mockPolicy = {
        id: 'SLA-POL-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Critical SLA',
        priority: 'critical',
        targetResponseTimeMs: 3600000,
        targetResolutionTimeMs: 14400000,
        enabled: true,
      } as SLAPolicyEntity;

      (mockSlaRepo.createPolicy as jest.Mock).mockResolvedValue(mockPolicy);

      const result = await service.createSlaPolicy({
        name: 'Critical SLA',
        priority: 'critical',
        targetResponseTimeMs: 3600000,
        targetResolutionTimeMs: 14400000,
      });

      expect(mockSlaRepo.createPolicy).toHaveBeenCalledWith({
        name: 'Critical SLA',
        priority: 'critical',
        targetResponseTimeMs: 3600000,
        targetResolutionTimeMs: 14400000,
        tenantId: '__system__',
        createdBy: undefined,
      });
      expect(result).toEqual(mockPolicy);
    });
  });

  // ==================== getSlaPolicy ====================

  describe('getSlaPolicy', () => {
    it('should return an SLA policy by ID', async () => {
      const mockPolicy = {
        id: 'SLA-POL-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Critical SLA',
        priority: 'critical',
        targetResponseTimeMs: 3600000,
        targetResolutionTimeMs: 14400000,
        enabled: true,
      } as SLAPolicyEntity;

      (mockSlaRepo.findPolicyById as jest.Mock).mockResolvedValue(mockPolicy);

      const result = await service.getSlaPolicy(MOCK_TENANT_ID, 'SLA-POL-1');
      expect(result).toEqual(mockPolicy);
    });

    it('should return null if policy not found', async () => {
      (mockSlaRepo.findPolicyById as jest.Mock).mockResolvedValue(null);
      const result = await service.getSlaPolicy(MOCK_TENANT_ID, 'non-existent');
      expect(result).toBeNull();
    });
  });

  // ==================== listSlaPolicies ====================

  describe('listSlaPolicies', () => {
    it('should list SLA policies for a tenant', async () => {
      const mockPolicies = [
        {
          id: 'SLA-POL-1',
          tenantId: MOCK_TENANT_ID,
          name: 'Critical SLA',
          priority: 'critical',
          targetResponseTimeMs: 3600000,
          targetResolutionTimeMs: 14400000,
          enabled: true,
        } as SLAPolicyEntity,
      ];

      (mockSlaRepo.findAllPolicies as jest.Mock).mockResolvedValue(mockPolicies);

      const result = await service.listSlaPolicies(MOCK_TENANT_ID);
      expect(result).toEqual(mockPolicies);
      expect(mockSlaRepo.findAllPolicies).toHaveBeenCalledWith(MOCK_TENANT_ID, undefined);
    });

    it('should pass options to repository', async () => {
      const mockPolicies: SLAPolicyEntity[] = [];
      (mockSlaRepo.findAllPolicies as jest.Mock).mockResolvedValue(mockPolicies);

      await service.listSlaPolicies(MOCK_TENANT_ID, { enabled: true, priority: 'high' });
      expect(mockSlaRepo.findAllPolicies).toHaveBeenCalledWith(MOCK_TENANT_ID, { enabled: true, priority: 'high' });
    });
  });

  // ==================== updateSlaPolicy ====================

  describe('updateSlaPolicy', () => {
    it('should update an SLA policy', async () => {
      const updatedPolicy = {
        id: 'SLA-POL-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Updated SLA',
        priority: 'high',
        targetResponseTimeMs: 7200000,
        targetResolutionTimeMs: 28800000,
        enabled: true,
      } as SLAPolicyEntity;

      (mockSlaRepo.updatePolicy as jest.Mock).mockResolvedValue(updatedPolicy);

      const result = await service.updateSlaPolicy(MOCK_TENANT_ID, 'SLA-POL-1', {
        name: 'Updated SLA',
        priority: 'high',
      });

      expect(result).toEqual(updatedPolicy);
    });

    it('should throw NOT_FOUND if policy does not exist', async () => {
      (mockSlaRepo.updatePolicy as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateSlaPolicy(MOCK_TENANT_ID, 'non-existent', { name: 'New Name' })
      ).rejects.toThrow(SlaServiceError);
    });
  });

  // ==================== deleteSlaPolicy ====================

  describe('deleteSlaPolicy', () => {
    it('should delete an SLA policy', async () => {
      (mockSlaRepo.deletePolicy as jest.Mock).mockResolvedValue(true);

      await expect(service.deleteSlaPolicy(MOCK_TENANT_ID, 'SLA-POL-1')).resolves.toBeUndefined();
      expect(mockSlaRepo.deletePolicy).toHaveBeenCalledWith('SLA-POL-1', MOCK_TENANT_ID);
    });

    it('should throw NOT_FOUND if policy does not exist', async () => {
      (mockSlaRepo.deletePolicy as jest.Mock).mockResolvedValue(false);

      await expect(
        service.deleteSlaPolicy(MOCK_TENANT_ID, 'non-existent')
      ).rejects.toThrow(SlaServiceError);
    });
  });

  // ==================== trackSla ====================

  describe('trackSla', () => {
    it('should create SLA tracking for a ticket', async () => {
      const mockSLA = {
        id: 'TKT-SLA-1',
        ticketId: 'ticket-1',
        slaTargetId: 'SLA-POL-1',
        targetResolutionTimeMs: 14400000,
        breached: false,
        responseBreached: false,
      } as TicketSLAEntity;

      (mockSlaRepo.getTicketSLA as jest.Mock).mockResolvedValue(null);
      (mockSlaRepo.createTicketSLA as jest.Mock).mockResolvedValue(mockSLA);

      const result = await service.trackSla(MOCK_TENANT_ID, 'ticket-1', 'critical', 14400000);
      expect(result).toEqual(mockSLA);
      expect(mockSlaRepo.createTicketSLA).toHaveBeenCalledWith('ticket-1', 'critical', 14400000, MOCK_TENANT_ID);
    });

    it('should return existing SLA if already tracked', async () => {
      const mockSLA = {
        id: 'TKT-SLA-1',
        ticketId: 'ticket-1',
        slaTargetId: 'SLA-POL-1',
        targetResolutionTimeMs: 14400000,
        breached: false,
        responseBreached: false,
      } as TicketSLAEntity;

      (mockSlaRepo.getTicketSLA as jest.Mock).mockResolvedValue(mockSLA);

      const result = await service.trackSla(MOCK_TENANT_ID, 'ticket-1', 'critical', 14400000);
      expect(result).toEqual(mockSLA);
      expect(mockSlaRepo.createTicketSLA).not.toHaveBeenCalled();
    });
  });

  // ==================== getSlaStatus ====================

  describe('getSlaStatus', () => {
    it('should return SLA status for a ticket', async () => {
      const mockStatus = {
        ticketId: 'ticket-1',
        status: 'normal' as const,
        targetResolutionTimeMs: 14400000,
        targetResponseTimeMs: 3600000,
        elapsedTimeMs: 3600000,
        remainingTimeMs: 10800000,
        percentUsed: 25,
        responseBreached: false,
        resolutionBreached: false,
        warningThreshold: 0.8,
      };

      (mockSlaRepo.getTicketSLAStatus as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.getSlaStatus(MOCK_TENANT_ID, 'ticket-1');
      expect(result).toEqual(mockStatus);
    });

    it('should return null if no SLA found', async () => {
      (mockSlaRepo.getTicketSLAStatus as jest.Mock).mockResolvedValue(null);
      const result = await service.getSlaStatus(MOCK_TENANT_ID, 'ticket-1');
      expect(result).toBeNull();
    });
  });

  // ==================== getBreachedSLAs ====================

  describe('getBreachedSLAs', () => {
    it('should return breached SLAs within timeframe', async () => {
      const mockViolations = [
        {
          id: 'SLA-1',
          ticketId: 'ticket-1',
          breached: true,
          responseBreached: true,
          ticketTitle: 'Critical Issue',
        },
      ];

      (mockSlaRepo.getSLAViolations as jest.Mock).mockResolvedValue(mockViolations);

      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = new Date();
      const result = await service.getBreachedSLAs(MOCK_TENANT_ID, { start, end });

      expect(result).toEqual(mockViolations);
      expect(mockSlaRepo.getSLAViolations).toHaveBeenCalledWith(MOCK_TENANT_ID, start, end);
    });
  });

  // ==================== getSlaCompliance ====================

  describe('getSlaCompliance', () => {
    it('should return compliance report for a policy', async () => {
      const mockPolicy = {
        id: 'SLA-POL-1',
        tenantId: MOCK_TENANT_ID,
        name: 'Critical SLA',
        priority: 'critical',
        targetResponseTimeMs: 3600000,
        targetResolutionTimeMs: 14400000,
        enabled: true,
      } as SLAPolicyEntity;

      (mockSlaRepo.findPolicyById as jest.Mock).mockResolvedValue(mockPolicy);
      (mockSlaRepo.getSLAComplianceStats as jest.Mock).mockResolvedValue({
        total: 100,
        compliant: 85,
        breached: 15,
        rate: 85,
      });

      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = new Date();
      const result = await service.getSlaCompliance(MOCK_TENANT_ID, 'SLA-POL-1', { start, end });

      expect(result.complianceRate).toBe(85);
      expect(result.totalTickets).toBe(100);
      expect(result.breachedTickets).toBe(15);
    });

    it('should throw NOT_FOUND if policy does not exist', async () => {
      (mockSlaRepo.findPolicyById as jest.Mock).mockResolvedValue(null);

      const start = new Date();
      const end = new Date();
      await expect(
        service.getSlaCompliance(MOCK_TENANT_ID, 'non-existent', { start, end })
      ).rejects.toThrow(SlaServiceError);
    });
  });

  // ==================== recordResolution ====================

  describe('recordResolution', () => {
    it('should record resolution time', async () => {
      (mockSlaRepo.updateTicketSLA as jest.Mock).mockResolvedValue(undefined);

      const resolvedAt = new Date();
      await service.recordResolution(MOCK_TENANT_ID, 'ticket-1', resolvedAt);

      expect(mockSlaRepo.updateTicketSLA).toHaveBeenCalledWith('ticket-1', { resolvedAt }, MOCK_TENANT_ID);
    });
  });

  // ==================== recordFirstResponse ====================

  describe('recordFirstResponse', () => {
    it('should record first response time', async () => {
      (mockSlaRepo.updateTicketSLA as jest.Mock).mockResolvedValue(undefined);

      const firstResponseAt = new Date();
      await service.recordFirstResponse(MOCK_TENANT_ID, 'ticket-1', firstResponseAt);

      expect(mockSlaRepo.updateTicketSLA).toHaveBeenCalledWith('ticket-1', { firstResponseAt }, MOCK_TENANT_ID);
    });
  });
});
