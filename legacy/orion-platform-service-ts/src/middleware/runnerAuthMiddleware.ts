/**
 * runnerAuthMiddleware — Runner API Token 认证中间件
 *
 * 所有 Runner Agent 的请求必须携带 `Authorization: Bearer <token>`。
 * Token 通过环境变量 `RUNNER_API_TOKEN` 配置。
 * 未配置时默认跳过认证（开发模式）。
 */

import { FastifyRequest, FastifyReply } from 'fastify';

const EXPECTED_TOKEN = process.env.RUNNER_API_TOKEN || '';
const IS_AUTH_ENABLED = EXPECTED_TOKEN !== '';

// Runner Agent 端点白名单（健康检查无需认证）
const PUBLIC_PATHS = ['/health', '/version'];

export async function runnerAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!IS_AUTH_ENABLED) return;
  if (PUBLIC_PATHS.includes(request.url)) return;

  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.code(401).send({ error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== EXPECTED_TOKEN) {
    reply.code(403).send({ error: 'Invalid Runner API token' });
  }
}
