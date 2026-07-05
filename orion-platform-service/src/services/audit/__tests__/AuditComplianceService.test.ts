/**
 * AuditComplianceService 单元测试
 *
 * 覆盖 SOC2 / ISO27001 合规检查核心逻辑。
 */

import { AuditComplianceService, ComplianceCheckResult, AuditComplianceReport, AuditCoverageStats } from '../AuditComplianceService';
import { AuditRepository, AuditLog, CreateAuditLogInput } from '../AuditRepository';
import { AuditService } from '../AuditService';
import { AuditRetentionService } from '../AuditRetentionService';

// Mock AuditRepository
const mockRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  getLatestHash: jest.fn(),
  verifyChain: jest.fn(),
  getActions: jest.fn(),
  getResourceTypes: jest.fn(),
} as unknown as AuditRepository;

// Mock AuditService
const mockAuditService = {
  verifyChain: jest.fn(),
} as unknown as AuditService;

// Mock AuditRetentionService
const mockRetentionService = {
  getPolicy: jest.fn(),
  listPolicies: jest.fn(),
} as unknown as AuditRetentionService;

describe('AuditComplianceService', () => {
  let service: AuditComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    // 使用 Partial 构造，避免要求完整 DatabasePool
    service = new AuditComplianceService({} as any);
    // 注入 mock
    (service as any).auditRepository = mockRepository;
    (service as any).auditService = mockAuditService;
    (service as any).retentionService = mockRetentionService;
  });

  describe('checkLogicalAccessAudit', () => {
    it('应该返回 PASS 当审计日志完整', async () => {
      const now = new Date();
      const mockLogs: AuditLog[] = [
        {
          id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline',
          resource_id: '1', request_method: 'POST', request_path: '/pipelines', request_body: null,
          response_code: 201, response_body: null, ip_address: '1.2.3.4', user_agent: 'test',
          prev_hash: null, hash: 'hash1', created_at: now,
        },
        {
          id: '2', tenant_id: 't1', user_id: 'u2', action: 'UPDATE', resource_type: 'pipeline',
          resource_id: '1', request_method: 'PUT', request_path: '/pipelines/1', request_body: null,
          response_code: 200, response_body: null, ip_address: '1.2.3.4', user_agent: 'test',
          prev_hash: 'hash1', hash: 'hash2', created_at: now,
        },
      ];
      (mockRepository.findAll as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.checkLogicalAccessAudit('t1');

      expect(result.framework).toBe('SOC2');
      expect(result.controlId).toBe('CC6.1');
      expect(result.status).toBe('PASS');
      expect(result.severity).toBe('medium');
    });

    it('应该返回 WARNING 当缺少 user_id', async () => {
      const now = new Date();
      const mockLogs: AuditLog[] = [
        {
          id: '1', tenant_id: 't1', user_id: null, action: 'CREATE', resource_type: 'pipeline',
          resource_id: '1', request_method: 'POST', request_path: '/pipelines', request_body: null,
          response_code: 201, response_body: null, ip_address: '1.2.3.4', user_agent: 'test',
          prev_hash: null, hash: 'hash1', created_at: now,
        },
      ];
      (mockRepository.findAll as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.checkLogicalAccessAudit('t1');

      expect(result.status).toBe('WARNING');
      expect(result.severity).toBe('medium');
      expect(result.remediation).toBeDefined();
    });
  });

  describe('checkSystemOperationsMonitoring', () => {
    it('应该返回 PASS 当所有期望操作都被记录', async () => {
      const mockLogs: AuditLog[] = [
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: new Date() },
        { id: '2', tenant_id: 't1', user_id: 'u1', action: 'UPDATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h2', created_at: new Date() },
        { id: '3', tenant_id: 't1', user_id: 'u1', action: 'DELETE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h3', created_at: new Date() },
        { id: '4', tenant_id: 't1', user_id: 'u1', action: 'LOGIN', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h4', created_at: new Date() },
        { id: '5', tenant_id: 't1', user_id: 'u1', action: 'LOGOUT', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h5', created_at: new Date() },
        { id: '6', tenant_id: 't1', user_id: 'u1', action: 'PERMISSION_CHANGE', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h6', created_at: new Date() },
      ];
      (mockRepository.findAll as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.checkSystemOperationsMonitoring('t1');

      expect(result.framework).toBe('SOC2');
      expect(result.controlId).toBe('CC7.2');
      expect(result.status).toBe('PASS');
    });

    it('应该返回 WARNING 当缺少关键操作类型', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: new Date() },
      ]);

      const result = await service.checkSystemOperationsMonitoring('t1');

      expect(result.status).toBe('WARNING');
      expect(result.remediation).toBeDefined();
    });
  });

  describe('checkAnomalyDetection', () => {
    it('应该返回 PASS 当链完整', async () => {
      (mockAuditService.verifyChain as jest.Mock).mockResolvedValue({ valid: true, totalVerified: 100 });

      const result = await service.checkAnomalyDetection('t1');

      expect(result.framework).toBe('SOC2');
      expect(result.controlId).toBe('CC7.3');
      expect(result.status).toBe('PASS');
      expect(result.severity).toBe('low');
    });

    it('应该返回 FAIL 当链断裂', async () => {
      (mockAuditService.verifyChain as jest.Mock).mockResolvedValue({ valid: false, brokenAt: new Date(), totalVerified: 50 });

      const result = await service.checkAnomalyDetection('t1');

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('critical');
      expect(result.remediation).toBeDefined();
    });
  });

  describe('checkSecurityLogging', () => {
    it('应该返回 PASS 当存在安全日志', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'LOGIN', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: new Date() },
      ]);

      const result = await service.checkSecurityLogging('t1');

      expect(result.framework).toBe('ISO27001');
      expect(result.controlId).toBe('A.9.4.2');
      expect(result.status).toBe('PASS');
    });

    it('应该返回 WARNING 当缺少安全日志', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: new Date() },
      ]);

      const result = await service.checkSecurityLogging('t1');

      expect(result.status).toBe('WARNING');
    });
  });

  describe('checkEventLogging', () => {
    it('应该返回 PASS 当有最近 30 天的事件日志', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: now },
      ]);

      const result = await service.checkEventLogging('t1');

      expect(result.framework).toBe('ISO27001');
      expect(result.controlId).toBe('A.12.4.1');
      expect(result.status).toBe('PASS');
    });

    it('应该返回 FAIL 当无事件日志', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.checkEventLogging('t1');

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('critical');
    });
  });

  describe('getAuditCoverageStats', () => {
    it('应该返回覆盖率统计', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: 'POST', request_path: '/pipelines', request_body: null, response_code: 201, response_body: null, ip_address: '1.2.3.4', user_agent: 'test', prev_hash: null, hash: 'h1', created_at: now },
        { id: '2', tenant_id: 't1', user_id: null, action: 'UPDATE', resource_type: 'pipeline', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h2', created_at: now },
      ]);

      const stats = await service.getAuditCoverageStats('t1');

      expect(stats.totalActions).toBe(2);
      expect(stats.totalResources).toBe(1);
      expect(stats.actionsWithMissingUserId).toBe(1);
      expect(stats.actionsWithMissingIp).toBe(1);
      expect(stats.actionsWithMissingUserAgent).toBe(1);
      expect(stats.actionsWithMissingResult).toBe(1);
    });

    it('空数据时应返回 0 覆盖率', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);

      const stats = await service.getAuditCoverageStats('t1');

      expect(stats.totalActions).toBe(0);
      expect(stats.coveragePercent).toBe(0);
    });
  });

  describe('generateSOC2Report', () => {
    it('应该生成 SOC2 合规报告', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'CREATE', resource_type: 'pipeline', resource_id: null, request_method: 'POST', request_path: '/pipelines', request_body: null, response_code: 201, response_body: null, ip_address: '1.2.3.4', user_agent: 'test', prev_hash: null, hash: 'h1', created_at: now },
      ]);
      (mockAuditService.verifyChain as jest.Mock).mockResolvedValue({ valid: true, totalVerified: 1 });

      const report = await service.generateSOC2Report('t1');

      expect(report.framework).toBe('SOC2');
      expect(report.tenantId).toBe('t1');
      expect(report.checks.length).toBeGreaterThanOrEqual(3);
      expect(report.summary.totalChecks).toBe(report.checks.length);
      expect(typeof report.overallScore).toBe('number');
    });
  });

  describe('generateISO27001Report', () => {
    it('应该生成 ISO27001 合规报告', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'LOGIN', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: now },
      ]);

      const report = await service.generateISO27001Report('t1');

      expect(report.framework).toBe('ISO27001');
      expect(report.tenantId).toBe('t1');
      expect(report.checks.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('generateCombinedReport', () => {
    it('应该生成综合合规报告', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'LOGIN', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: now },
      ]);
      (mockAuditService.verifyChain as jest.Mock).mockResolvedValue({ valid: true, totalVerified: 1 });

      const report = await service.generateCombinedReport('t1');

      expect(report.framework).toBe('COMBINED');
      expect(report.checks.length).toBeGreaterThanOrEqual(5);
      expect(report.summary.passedChecks).toBeGreaterThanOrEqual(0);
      expect(report.summary.totalChecks).toBe(report.checks.length);
    });
  });

  describe('buildReport', () => {
    it('应该正确计算 overallScore', async () => {
      const now = new Date();
      (mockRepository.findAll as jest.Mock).mockResolvedValue([
        { id: '1', tenant_id: 't1', user_id: 'u1', action: 'LOGIN', resource_type: 'auth', resource_id: null, request_method: null, request_path: null, request_body: null, response_code: null, response_body: null, ip_address: null, user_agent: null, prev_hash: null, hash: 'h1', created_at: now },
      ]);
      (mockAuditService.verifyChain as jest.Mock).mockResolvedValue({ valid: true, totalVerified: 1 });

      const report = await service.generateSOC2Report('t1');

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });
  });
});
