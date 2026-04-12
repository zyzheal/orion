/**
 * 认证路由
 *
 * 实现用户认证相关接口：
 * - POST /api/v1/auth/login - 用户登录
 * - POST /api/v1/auth/refresh - 刷新 Token
 * - POST /api/v1/auth/logout - 用户登出
 * - GET /api/v1/auth/me - 获取当前用户信息
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TokenService, TokenPayload, TokenRefreshOptions } from '../services/token.service';
import { rbacService } from '../services/rbac.service';
import { getConfig } from '../config';

// 请求体类型
interface LoginBody {
  username?: string;
  email?: string;
  password: string;
  rememberMe?: boolean;
}

interface RefreshBody {
  refreshToken: string;
}

interface LogoutBody {
  refreshToken?: string;
  all?: boolean;
}

// 模拟用户数据库（实际项目中应从数据库获取）
interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  status: 'active' | 'inactive' | 'locked';
  createdAt: Date;
  lastLoginAt?: Date;
}

// 模拟用户数据（用于测试）
const mockUsers: Map<string, User> = new Map([
  [
    'admin',
    {
      id: '1',
      username: 'admin',
      email: 'admin@orion.com',
      passwordHash: 'admin123', // 实际应使用 bcrypt 等加密
      roles: ['admin'],
      permissions: [],
      status: 'active',
      createdAt: new Date(),
    },
  ],
  [
    'developer',
    {
      id: '2',
      username: 'developer',
      email: 'dev@orion.com',
      passwordHash: 'dev123',
      roles: ['developer'],
      permissions: [],
      status: 'active',
      createdAt: new Date(),
    },
  ],
  [
    'tester',
    {
      id: '3',
      username: 'tester',
      email: 'tester@orion.com',
      passwordHash: 'test123',
      roles: ['tester'],
      permissions: [],
      status: 'active',
      createdAt: new Date(),
    },
  ],
]);

export class AuthRoutes {
  private tokenService: TokenService;

  constructor(
    private app: FastifyInstance,
    tokenService: TokenService
  ) {
    this.tokenService = tokenService;
    this.registerRoutes();
  }

  /**
   * 注册所有认证路由
   */
  private registerRoutes(): void {
    this.registerLoginRoute();
    this.registerRefreshRoute();
    this.registerLogoutRoute();
    this.registerMeRoute();
    this.registerRegisterRoute();
  }

  /**
   * 提取设备指纹
   */
  private extractDeviceFingerprint(request: FastifyRequest): string {
    const userAgent = request.headers['user-agent'] || '';
    const ip =
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      (request.socket?.remoteAddress as string) ||
      '';

    return this.tokenService.generateDeviceFingerprint(
      userAgent as string,
      ip as string
    );
  }

  /**
   * POST /api/v1/auth/login - 用户登录
   */
  private registerLoginRoute(): void {
    this.app.post(
      '/api/v1/auth/login',
      {
        schema: {
          body: {
            type: 'object',
            required: ['password'],
            properties: {
              username: { type: 'string' },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 6 },
              rememberMe: { type: 'boolean', default: false },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'number' },
                    refreshTokenExpiresIn: { type: 'number' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        roles: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
            400: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
            401: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
        try {
          const { username, email, password } = request.body;

          // 1. 查找用户
          const identifier = username || email;
          if (!identifier) {
            return reply.code(400).send({
              error: 'INVALID_INPUT',
              message: 'Username or email is required',
            });
          }

          const user = mockUsers.get(identifier);
          if (!user) {
            return reply.code(401).send({
              error: 'INVALID_CREDENTIALS',
              message: 'Invalid username/email or password',
            });
          }

          // 2. 验证密码（实际项目应使用 bcrypt.compare）
          // 这里简化处理，直接比较
          const passwordValid = password === user.passwordHash;
          if (!passwordValid) {
            return reply.code(401).send({
              error: 'INVALID_CREDENTIALS',
              message: 'Invalid username/email or password',
            });
          }

          // 3. 检查用户状态
          if (user.status !== 'active') {
            return reply.code(401).send({
              error: 'ACCOUNT_DISABLED',
              message: 'Account is disabled or locked',
            });
          }

          // 4. 生成设备指纹
          const deviceId = this.extractDeviceFingerprint(request);

          // 5. 获取用户权限
          const permissions = rbacService.getUserPermissions(user.id);

          // 6. 提取设备信息
          const userAgent = request.headers['user-agent'] || '';
          const ip =
            request.headers['x-forwarded-for'] ||
            request.headers['x-real-ip'] ||
            (request.socket?.remoteAddress as string) ||
            '';

          const deviceOptions: TokenRefreshOptions = {
            userAgent: userAgent as string,
            ip: ip as string,
            deviceId,
          };

          // 7. 生成 Token 对
          const tokenPair = await this.tokenService.generateTokenPair({
            userId: user.id,
            email: user.email,
            roles: user.roles,
            permissions: permissions.map((p) => p.id),
          }, deviceOptions);

          // 8. 更新最后登录时间
          user.lastLoginAt = new Date();

          this.app.log.info(`User login: ${user.username} from ${request.ip}`);

          return reply.code(200).send({
            success: true,
            data: {
              accessToken: tokenPair.accessToken,
              refreshToken: tokenPair.refreshToken,
              expiresIn: tokenPair.expiresIn,
              refreshTokenExpiresIn: tokenPair.refreshTokenExpiresIn,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                roles: user.roles,
              },
            },
          });
        } catch (error) {
          this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Login failed');
          return reply.code(500).send({
            error: 'INTERNAL_ERROR',
            message: 'Login failed, please try again',
          });
        }
      }
    );
  }

  /**
   * POST /api/v1/auth/refresh - 刷新 Token
   */
  private registerRefreshRoute(): void {
    this.app.post(
      '/api/v1/auth/refresh',
      {
        schema: {
          body: {
            type: 'object',
            required: ['refreshToken'],
            properties: {
              refreshToken: { type: 'string' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'number' },
                    refreshTokenExpiresIn: { type: 'number' },
                  },
                },
              },
            },
            400: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
            401: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
        try {
          const { refreshToken } = request.body;

          if (!refreshToken) {
            return reply.code(400).send({
              error: 'INVALID_INPUT',
              message: 'Refresh token is required',
            });
          }

          // 提取设备指纹
          const userAgent = request.headers['user-agent'] || '';
          const ip =
            request.headers['x-forwarded-for'] ||
            request.headers['x-real-ip'] ||
            (request.socket?.remoteAddress as string) ||
            '';

          const deviceOptions: TokenRefreshOptions = {
            userAgent: userAgent as string,
            ip: ip as string,
          };

          // 使用 Token 服务刷新
          const tokenPair = await this.tokenService.refreshTokens(refreshToken, deviceOptions);

          if (!tokenPair) {
            return reply.code(401).send({
              error: 'INVALID_TOKEN',
              message: 'Refresh token is invalid or expired',
            });
          }

          return reply.code(200).send({
            success: true,
            data: tokenPair,
          });
        } catch (error) {
          this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Token refresh failed');
          return reply.code(500).send({
            error: 'INTERNAL_ERROR',
            message: 'Token refresh failed',
          });
        }
      }
    );
  }

  /**
   * POST /api/v1/auth/logout - 用户登出
   */
  private registerLogoutRoute(): void {
    this.app.post(
      '/api/v1/auth/logout',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              refreshToken: { type: 'string' },
              all: { type: 'boolean', default: false },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest<{ Body: LogoutBody }>, reply: FastifyReply) => {
        try {
          const { refreshToken, all } = request.body;

          // 从请求中获取用户信息
          const authContext = request.authContext;
          const userId = authContext?.user?.sub;

          if (all && userId) {
            // 撤销所有 Token
            await this.tokenService.revokeAllUserTokens(userId);
            this.app.log.info(`User ${userId} logged out from all devices`);
          } else if (refreshToken) {
            // 撤销单个 Token
            await this.tokenService.revokeToken(refreshToken);
            this.app.log.info(`User ${userId} logged out`);
          }

          return reply.code(200).send({
            success: true,
            message: 'Logout successful',
          });
        } catch (error) {
          this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Logout failed');
          return reply.code(500).send({
            error: 'INTERNAL_ERROR',
            message: 'Logout failed',
          });
        }
      }
    );
  }

  /**
   * GET /api/v1/auth/me - 获取当前用户信息
   */
  private registerMeRoute(): void {
    this.app.get(
      '/api/v1/auth/me',
      {
        preHandler: [async (request: FastifyRequest, reply: FastifyReply) => {
          const authContext = request.authContext;
          if (!authContext?.authenticated) {
            return reply.code(401).send({
              error: 'UNAUTHORIZED',
              message: 'Authentication required',
            });
          }
        }],
        schema: {
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' },
                    roles: { type: 'array', items: { type: 'string' } },
                    permissions: { type: 'array', items: { type: 'string' } },
                    deviceId: { type: 'string' },
                  },
                },
              },
            },
            401: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const authContext = request.authContext;
        const payload = authContext?.user as TokenPayload;

        // 从模拟数据库获取用户
        const user = Array.from(mockUsers.values()).find((u) => u.id === payload?.sub);

        if (!user) {
          return reply.code(404).send({
            error: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        // 获取用户权限
        const permissions = rbacService.getUserPermissions(user.id);

        return reply.code(200).send({
          success: true,
          data: {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            permissions: permissions.map((p) => p.id),
            deviceId: payload?.deviceId,
          },
        });
      }
    );
  }

  /**
   * POST /api/v1/auth/register - 用户注册（可选）
   */
  private registerRegisterRoute(): void {
    this.app.post(
      '/api/v1/auth/register',
      {
        schema: {
          body: {
            type: 'object',
            required: ['username', 'email', 'password'],
            properties: {
              username: { type: 'string', minLength: 3 },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 6 },
            },
          },
          response: {
            201: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
            400: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (
        request: FastifyRequest<{
          Body: { username: string; email: string; password: string };
        }>,
        reply: FastifyReply
      ) => {
        try {
          const { username, email, password } = request.body;

          // 检查用户是否已存在
          if (mockUsers.has(username) || Array.from(mockUsers.values()).some((u) => u.email === email)) {
            return reply.code(400).send({
              error: 'USER_EXISTS',
              message: 'Username or email already exists',
            });
          }

          // 创建新用户
          const newUser: User = {
            id: String(mockUsers.size + 1),
            username,
            email,
            passwordHash: password, // 实际应使用 bcrypt 加密
            roles: ['guest'], // 默认角色
            permissions: [],
            status: 'active',
            createdAt: new Date(),
          };

          mockUsers.set(username, newUser);

          this.app.log.info(`User registered: ${username}`);

          return reply.code(201).send({
            success: true,
            message: 'Registration successful',
          });
        } catch (error) {
          this.app.log.error({ err: error instanceof Error ? error.message : String(error) }, 'Registration failed');
          return reply.code(500).send({
            error: 'INTERNAL_ERROR',
            message: 'Registration failed',
          });
        }
      }
    );
  }
}
