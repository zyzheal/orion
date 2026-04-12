/**
 * JSON Schema 定义用于 Pipeline 验证
 */

import { FastifyRequest } from 'fastify';

export const pipelineSchema = {
  type: 'object',
  required: ['apiVersion', 'kind', 'metadata', 'spec'],
  properties: {
    apiVersion: {
      type: 'string',
      pattern: '^orion\\.io/v\\d+$',
    },
    kind: {
      type: 'string',
      enum: ['Pipeline'],
    },
    metadata: {
      type: 'object',
      required: ['name', 'version'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
        },
        version: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
          pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$',
        },
        description: {
          type: 'string',
          maxLength: 1000,
        },
      },
    },
    spec: {
      type: 'object',
      required: ['stages'],
      properties: {
        triggers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['git', 'api', 'event', 'schedule'],
              },
              events: {
                type: 'array',
                items: { type: 'string' },
              },
              branches: {
                type: 'array',
                items: { type: 'string' },
              },
              schedule: {
                type: 'string',
              },
            },
          },
        },
        stages: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'runsOn', 'steps'],
            properties: {
              name: {
                type: 'string',
                minLength: 1,
                maxLength: 255,
                pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
              },
              runsOn: {
                type: 'string',
                enum: ['linux', 'windows', 'macos'],
              },
              steps: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['name', 'uses'],
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 255,
                    },
                    uses: {
                      type: 'string',
                      pattern: '^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+(@v\\d+)?$',
                    },
                    with: {
                      type: 'object',
                    },
                  },
                },
              },
              dependsOn: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              if: {
                type: 'string',
                maxLength: 500,
              },
              timeout: {
                type: 'integer',
                minimum: 1,
                maximum: 86400,
              },
              retries: {
                type: 'integer',
                minimum: 0,
                maximum: 10,
              },
            },
          },
        },
      },
    },
  },
};

/**
 * 验证并获取 tenantId
 */
export function validateTenantId(request: FastifyRequest): bigint {
  const tenantId = request.headers['x-orion-tenant-id'] as string;
  if (!tenantId) {
    throw new Error('Missing required header: x-orion-tenant-id');
  }
  try {
    return BigInt(tenantId);
  } catch {
    throw new Error('Invalid tenantId format, must be a valid bigint string');
  }
}

/**
 * 验证并获取 userId
 */
export function validateUserId(request: FastifyRequest): string {
  const userId = request.headers['x-orion-user-id'] as string;
  if (!userId) {
    throw new Error('Missing required header: x-orion-user-id');
  }
  return userId;
}