/**
 * Orion Platform API Specification
 * 
 * OpenAPI 3.0 格式的 API 文档
 * 
 * 使用方式:
 * - 导入到 Swagger UI
 * - 导入到 Postman
 * - 生成客户端 SDK
 */

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Orion DevOps Platform API',
    description: `
## 概述
Orion 企业级 DevOps 中台 API，提供统一的配置管理、流水线、部署、告警等能力。

## 认证
所有 API 需要 Bearer Token 认证:
\`Authorization: Bearer <token>\`

## 速率限制
- 默认: 1000 请求/分钟
- 认证后: 5000 请求/分钟
    `,
    version: '1.0.0',
    contact: {
      name: 'Orion Team',
      email: 'orion@company.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: '本地开发环境',
    },
    {
      url: 'https://orion.company.com/api',
      description: '生产环境',
    },
  ],

  tags: [
    { name: 'Config', description: '配置管理' },
    { name: 'Pipeline', description: '流水线' },
    { name: 'Deploy', description: '部署' },
    { name: 'Alert', description: '告警' },
    { name: 'Ticketing', description: '工单' },
    { name: 'User', description: '用户管理' },
    { name: 'Auth', description: '认证' },
    { name: 'Monitoring', description: '监控' },
  ],

  paths: {
    // ==================== 配置管理 ====================
    '/config/domains': {
      get: {
        tags: ['Config'],
        summary: '获取所有配置域',
        description: '返回 71 个配置域的列表',
        parameters: [
          {
            name: 'category',
            in: 'query',
            description: '按分类筛选',
            schema: { type: 'string', enum: ['core', 'devops', 'ops', 'security', 'platform'] },
          },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    domains: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ConfigDomain' },
                    },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    
    '/config/{domain}': {
      get: {
        tags: ['Config'],
        summary: '获取指定域的配置',
        parameters: [
          { name: 'domain', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Config' },
              },
            },
          },
          '404': { description: '配置域不存在' },
        },
      },
      put: {
        tags: ['Config'],
        summary: '更新配置',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'domain', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: {
          '200': { description: '更新成功' },
          '401': { description: '未授权' },
        },
      },
    },
    
    '/config/search': {
      get: {
        tags: ['Config'],
        summary: '搜索配置',
        parameters: [
          { name: 'q', in: 'query', description: '搜索关键词', schema: { type: 'string' } },
          { name: 'domain', in: 'query', schema: { type: 'string' } },
          { name: 'sensitivity', in: 'query', schema: { type: 'string', enum: ['public', 'internal', 'confidential', 'secret'] } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    results: { type: 'array', items: { $ref: '#/components/schemas/ConfigItem' } },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== 流水线 ====================
    '/pipelines': {
      get: {
        tags: ['Pipeline'],
        summary: '获取流水线列表',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'paused', 'archived'] } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pipelines: { type: 'array', items: { $ref: '#/components/schemas/Pipeline' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    pageSize: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Pipeline'],
        summary: '创建流水线',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PipelineCreateInput' },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
          '401': { description: '未授权' },
        },
      },
    },
    
    '/pipelines/{id}/run': {
      post: {
        tags: ['Pipeline'],
        summary: '运行流水线',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { params: { type: 'object' } } },
            },
          },
        },
        responses: {
          '202': { description: '流水线已启动' },
        },
      },
    },

    // ==================== 部署 ====================
    '/deployments': {
      get: {
        tags: ['Deploy'],
        summary: '获取部署列表',
        parameters: [
          { name: 'application', in: 'query', schema: { type: 'string' } },
          { name: 'environment', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Deployment' },
                },
              },
            },
          },
        },
      },
    },
    
    '/deployments/{id}/rollback': {
      post: {
        tags: ['Deploy'],
        summary: '回滚部署',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: '回滚成功' },
        },
      },
    },

    // ==================== 告警 ====================
    '/alerts': {
      get: {
        tags: ['Alert'],
        summary: '获取告警列表',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['firing', 'resolved'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Alert' },
                },
              },
            },
          },
        },
      },
    },
    
    '/alerts/{id}/resolve': {
      post: {
        tags: ['Alert'],
        summary: '解决告警',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { resolution: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: '解决成功' },
        },
      },
    },

    // ==================== 工单 ====================
    '/tickets': {
      get: {
        tags: ['Ticketing'],
        summary: '获取工单列表',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'assignee', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Ticket' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Ticketing'],
        summary: '创建工单',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TicketCreateInput' },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
        },
      },
    },

    // ==================== 用户 ====================
    '/users': {
      get: {
        tags: ['User'],
        summary: '获取用户列表',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    
    '/users/{id}': {
      get: {
        tags: ['User'],
        summary: '获取用户详情',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: '成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        },
      },
    },

    // ==================== 认证 ====================
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: '用户登录',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '登录成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'integer' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { description: '用户名或密码错误' },
        },
      },
    },
    
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: '刷新 Token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '刷新成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    expiresIn: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ==================== 监控 ====================
    '/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: '获取指标数据',
        parameters: [
          { name: 'name', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'interval', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MetricData' },
                },
              },
            },
          },
        },
      },
    },
    
    '/health': {
      get: {
        tags: ['Monitoring'],
        summary: '健康检查',
        description: '返回系统健康状态',
        responses: {
          '200': {
            description: '系统健康',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                          latency: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Token 认证',
      },
    },
    
    schemas: {
      // 配置相关
      ConfigDomain: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '配置域名称' },
          description: { type: 'string', description: '描述' },
          configCount: { type: 'integer', description: '配置项数量' },
          sensitivity: { type: 'string', enum: ['public', 'internal', 'confidential', 'secret'] },
          color: { type: 'string', description: '前端显示颜色' },
        },
      },
      
      Config: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      
      ConfigItem: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'any' },
          type: { type: 'string' },
          defaultValue: { type: 'any' },
          sensitivity: { type: 'string' },
        },
      },
      
      // 流水线相关
      Pipeline: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused', 'archived'] },
          stages: { type: 'array' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      
      PipelineCreateInput: {
        type: 'object',
        required: ['name', 'stages'],
        properties: {
          name: { type: 'string' },
          stages: { type: 'array' },
          triggers: { type: 'object' },
        },
      },
      
      // 部署相关
      Deployment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          application: { type: 'string' },
          version: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'success', 'failed', 'rolled_back'] },
          strategy: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
        },
      },
      
      // 告警相关
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          source: { type: 'string' },
          status: { type: 'string', enum: ['firing', 'resolved'] },
          createdAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time' },
        },
      },
      
      // 工单相关
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          requester: { type: 'string' },
          assignee: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      
      TicketCreateInput: {
        type: 'object',
        required: ['title', 'type', 'priority'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string' },
          priority: { type: 'string' },
        },
      },
      
      // 用户相关
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
          tenantId: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      
      // 监控相关
      MetricData: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          value: { type: 'number' },
          tags: { type: 'object' },
        },
      },
    },
  },
};

export default openapiSpec;