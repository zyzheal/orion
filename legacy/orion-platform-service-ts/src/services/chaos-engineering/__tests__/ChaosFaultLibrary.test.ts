/**
 * ChaosFaultLibrary 单元测试
 */

import { FAULT_TYPES, getFaultTypes, getFaultConfigTemplate, validateFaultConfig } from '../ChaosFaultLibrary';

describe('ChaosFaultLibrary', () => {
  describe('FAULT_TYPES', () => {
    it('应该包含所有预期的故障类型', () => {
      const expectedTypes = [
        'cpu_spike',
        'memory_leak',
        'network_latency',
        'service_down',
        'disk_full',
        'dns_failure',
        'http_error',
      ];

      for (const type of expectedTypes) {
        expect(FAULT_TYPES).toHaveProperty(type);
      }
    });

    it('每个故障类型应该有 name, description, params, targets', () => {
      for (const [key, fault] of Object.entries(FAULT_TYPES)) {
        expect(fault).toHaveProperty('name');
        expect(fault).toHaveProperty('description');
        expect(fault).toHaveProperty('params');
        expect(fault).toHaveProperty('targets');
        expect(typeof fault.name).toBe('string');
        expect(typeof fault.description).toBe('string');
        expect(Array.isArray(fault.targets)).toBe(true);
      }
    });

    it('cpu_spike 应该有正确的配置', () => {
      const cpuSpike = FAULT_TYPES.cpu_spike;
      expect(cpuSpike.name).toBe('CPU Spike');
      expect(cpuSpike.params.cpuPercent).toBeDefined();
      expect(cpuSpike.params.cpuPercent.default).toBe(90);
      expect(cpuSpike.params.cpuPercent.min).toBe(50);
      expect(cpuSpike.params.cpuPercent.max).toBe(100);
      expect(cpuSpike.targets).toContain('service');
      expect(cpuSpike.targets).toContain('pod');
    });

    it('network_latency 应该有正确的配置', () => {
      const netLatency = FAULT_TYPES.network_latency;
      expect(netLatency.name).toBe('Network Latency');
      expect(netLatency.params.latencyMs.default).toBe(500);
      expect(netLatency.params.latencyMs.min).toBe(100);
      expect(netLatency.params.latencyMs.max).toBe(5000);
    });

    it('http_error 应该有正确的 errorCode enum', () => {
      const httpError = FAULT_TYPES.http_error;
      expect(httpError.params.errorCode.enum).toEqual([500, 502, 503, 504]);
    });
  });

  describe('getFaultTypes', () => {
    it('应该返回所有故障类型', () => {
      const types = getFaultTypes();
      expect(Object.keys(types).length).toBe(7);
      expect(types).toHaveProperty('cpu_spike');
      expect(types).toHaveProperty('memory_leak');
      expect(types).toHaveProperty('network_latency');
    });

    it('应该返回 FAULT_TYPES 的引用', () => {
      const types = getFaultTypes();
      expect(types).toBe(FAULT_TYPES);
    });
  });

  describe('getFaultConfigTemplate', () => {
    it('应该返回 cpu_spike 的配置模板', () => {
      const template = getFaultConfigTemplate('cpu_spike');

      expect(template.type).toBe('cpu_spike');
      expect(template.name).toBe('CPU Spike');
      expect(template.description).toBeDefined();
      expect(template.params.cpuPercent).toBe(90);
      expect(template.targets).toEqual(['service', 'pod', 'container']);
    });

    it('应该返回 memory_leak 的配置模板', () => {
      const template = getFaultConfigTemplate('memory_leak');

      expect(template.type).toBe('memory_leak');
      expect(template.params.leakRateMB).toBe(10);
    });

    it('应该返回 network_latency 的配置模板', () => {
      const template = getFaultConfigTemplate('network_latency');

      expect(template.type).toBe('network_latency');
      expect(template.params.latencyMs).toBe(500);
    });

    it('应该返回 service_down 的配置模板', () => {
      const template = getFaultConfigTemplate('service_down');

      expect(template.type).toBe('service_down');
      expect(template.params.instanceCount).toBe(1);
    });

    it('应该返回 disk_full 的配置模板', () => {
      const template = getFaultConfigTemplate('disk_full');

      expect(template.type).toBe('disk_full');
      expect(template.params.diskPercent).toBe(95);
    });

    it('应该返回 dns_failure 的配置模板', () => {
      const template = getFaultConfigTemplate('dns_failure');

      expect(template.type).toBe('dns_failure');
      expect(template.params.domains).toEqual([]);
    });

    it('应该返回 http_error 的配置模板', () => {
      const template = getFaultConfigTemplate('http_error');

      expect(template.type).toBe('http_error');
      expect(template.params.errorCode).toBe(500);
    });

    it('应该对未知故障类型抛出错误', () => {
      expect(() => getFaultConfigTemplate('unknown_type')).toThrow('Unknown fault type: unknown_type');
    });

    it('应该对空字符串抛出错误', () => {
      expect(() => getFaultConfigTemplate('')).toThrow('Unknown fault type: ');
    });
  });

  describe('validateFaultConfig', () => {
    it('应该验证有效的 cpu_spike 配置', () => {
      const errors = validateFaultConfig('cpu_spike', { cpuPercent: 80 });
      expect(errors).toEqual([]);
    });

    it('应该检测缺失的必需参数', () => {
      const errors = validateFaultConfig('cpu_spike', {});
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('Missing required parameter');
      expect(errors[0]).toContain('cpuPercent');
    });

    it('应该验证有效的 memory_leak 配置', () => {
      const errors = validateFaultConfig('memory_leak', { leakRateMB: 10 });
      expect(errors).toEqual([]);
    });

    it('应该检测 memory_leak 缺失参数', () => {
      const errors = validateFaultConfig('memory_leak', {});
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('leakRateMB');
    });

    it('应该验证有效的 network_latency 配置', () => {
      const errors = validateFaultConfig('network_latency', { latencyMs: 500 });
      expect(errors).toEqual([]);
    });

    it('应该验证有效的 service_down 配置', () => {
      const errors = validateFaultConfig('service_down', { instanceCount: 1 });
      expect(errors).toEqual([]);
    });

    it('应该验证有效的 disk_full 配置', () => {
      const errors = validateFaultConfig('disk_full', { diskPercent: 95 });
      expect(errors).toEqual([]);
    });

    it('应该验证有效的 dns_failure 配置', () => {
      const errors = validateFaultConfig('dns_failure', { domains: [] });
      expect(errors).toEqual([]);
    });

    it('应该验证有效的 http_error 配置', () => {
      const errors = validateFaultConfig('http_error', { errorCode: 500 });
      expect(errors).toEqual([]);
    });

    it('应该对未知故障类型返回错误', () => {
      const errors = validateFaultConfig('unknown_type', {});
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('Unknown fault type: unknown_type');
    });

    it('应该允许多余的参数（不报错）', () => {
      const errors = validateFaultConfig('cpu_spike', {
        cpuPercent: 80,
        extraParam: 'value',
      });
      expect(errors).toEqual([]);
    });
  });
});
