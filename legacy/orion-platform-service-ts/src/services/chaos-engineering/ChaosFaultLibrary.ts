import { OrionError } from '../../errors';
/**
 * ChaosFaultLibrary - 故障类型库
 */

export const FAULT_TYPES = {
  cpu_spike: {
    name: 'CPU Spike',
    description: 'Simulate CPU usage spike to target service',
    params: { cpuPercent: { type: 'number', default: 90, min: 50, max: 100 } },
    targets: ['service', 'pod', 'container'],
  },
  memory_leak: {
    name: 'Memory Leak',
    description: 'Simulate gradual memory consumption increase',
    params: { leakRateMB: { type: 'number', default: 10, min: 1, max: 100 } },
    targets: ['service', 'pod'],
  },
  network_latency: {
    name: 'Network Latency',
    description: 'Inject network latency between services',
    params: { latencyMs: { type: 'number', default: 500, min: 100, max: 5000 } },
    targets: ['service', 'endpoint'],
  },
  service_down: {
    name: 'Service Down',
    description: 'Terminate target service instance',
    params: { instanceCount: { type: 'number', default: 1, min: 1, max: 3 } },
    targets: ['service', 'pod'],
  },
  disk_full: {
    name: 'Disk Full',
    description: 'Simulate disk space exhaustion',
    params: { diskPercent: { type: 'number', default: 95, min: 80, max: 100 } },
    targets: ['node', 'container'],
  },
  dns_failure: {
    name: 'DNS Failure',
    description: 'Simulate DNS resolution failure',
    params: { domains: { type: 'array', default: [] } },
    targets: ['service', 'pod'],
  },
  http_error: {
    name: 'HTTP Error',
    description: 'Inject HTTP error responses (5xx)',
    params: { errorCode: { type: 'number', default: 500, enum: [500, 502, 503, 504] } },
    targets: ['service', 'endpoint'],
  },
};

export function getFaultTypes(): Record<string, any> {
  return FAULT_TYPES;
}

export function getFaultConfigTemplate(faultType: string): any {
  const fault = FAULT_TYPES[faultType as keyof typeof FAULT_TYPES];
  if (!fault) {
    throw new OrionError(`Unknown fault type: ${faultType}`, 'NOT_FOUND')
  }
  return {
    type: faultType,
    name: fault.name,
    description: fault.description,
    params: Object.entries(fault.params).reduce((acc, [key, value]) => {
      acc[key] = (value as any).default;
      return acc;
    }, {} as Record<string, any>),
    targets: fault.targets,
  };
}

export function validateFaultConfig(faultType: string, config: any): string[] {
  const fault = FAULT_TYPES[faultType as keyof typeof FAULT_TYPES];
  if (!fault) {
    return [`Unknown fault type: ${faultType}`];
  }
  const errors: string[] = [];
  for (const [key, schema] of Object.entries(fault.params)) {
    if (!(key in config)) {
      errors.push(`Missing required parameter: ${key}`);
    }
  }
  return errors;
}
