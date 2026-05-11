/**
 * Application configuration with environment variable defaults
 */

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  redisUrl: string;
  sandbox: SandboxConfig;
  heartbeat: HeartbeatConfig;
  scaling: ScalingConfig;
  rateLimit: number;
}

export interface SandboxConfig {
  image: string;
  timeout: number;
  memoryLimit: string;
  cpuLimit: string;
  networkMode: string;
  readonlyRoot: boolean;
  dropCaps: boolean;
}

export interface HeartbeatConfig {
  interval: number;
  deadThreshold: number;
  staleThreshold: number;
}

export interface ScalingConfig {
  maxRunners: number;
  cooldown: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = Number.parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === 'true' || val === '1';
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: envInt('PORT', 3100),
    host: process.env.HOST || '0.0.0.0',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    sandbox: {
      image: process.env.SANDBOX_IMAGE || 'alpine:3.20',
      timeout: envInt('SANDBOX_TIMEOUT', 300),
      memoryLimit: process.env.SANDBOX_MEMORY_LIMIT || '512m',
      cpuLimit: process.env.SANDBOX_CPU_LIMIT || '1.0',
      networkMode: process.env.SANDBOX_NETWORK || 'none',
      readonlyRoot: envBool('SANDBOX_READONLY_ROOT', true),
      dropCaps: envBool('SANDBOX_DROP_CAPS', true),
    },

    heartbeat: {
      interval: envInt('HEARTBEAT_INTERVAL', 15),
      deadThreshold: envInt('HEARTBEAT_DEAD_THRESHOLD', 60),
      staleThreshold: envInt('HEARTBEAT_STALE_THRESHOLD', 30),
    },

    scaling: {
      maxRunners: envInt('MAX_RUNNERS', 10),
      cooldown: envInt('SCALING_COOLDOWN', 60),
      scaleUpThreshold: envInt('SCALE_UP_THRESHOLD', 80),
      scaleDownThreshold: envInt('SCALE_DOWN_THRESHOLD', 20),
    },

    rateLimit: envInt('RATE_LIMIT', 100),
  };
}
