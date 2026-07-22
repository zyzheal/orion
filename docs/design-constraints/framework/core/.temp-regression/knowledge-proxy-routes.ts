/**
 * Knowledge Proxy Route
 *
 * Proxies /api/v1/knowledge/* requests to PandaWiki Go backend (localhost:8090).
 * The knowledge sub-app rewrites its API URLs to include the /api/v1/knowledge prefix,
 * e.g., /api/v1/knowledge_base/list → /api/v1/knowledge/api/v1/knowledge_base/list.
 * This route strips the /api/v1/knowledge prefix and forwards to PandaWiki.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const PANDAWIKI_API = process.env.PANDAWIKI_API_TARGET || 'http://localhost:8090';

export default async function knowledgeProxyRoutes(app: FastifyInstance) {
  // Catch-all for /api/v1/knowledge/* → PandaWiki
  app.all('/*', async (request: FastifyRequest, reply: FastifyReply) => {
    // Reconstruct the target URL, stripping the /api/v1/knowledge prefix
    // e.g., /api/v1/knowledge/api/v1/knowledge_base/list → /api/v1/knowledge_base/list
    let targetPath = request.url;
    const prefix = '/api/v1/knowledge';
    if (targetPath.startsWith(prefix)) {
      targetPath = targetPath.slice(prefix.length);
    }

    const targetUrl = `${PANDAWIKI_API}${targetPath}`;

    try {
      // Forward headers
      const headers: Record<string, string> = {};
      if (request.headers.authorization) {
        headers.authorization = request.headers.authorization;
      }
      if (request.headers['content-type']) {
        headers['content-type'] = request.headers['content-type'];
      }
      headers['x-forwarded-host'] = request.headers.host || '';

      // Handle SSE routes separately (streaming)
      if (targetPath.includes('/stream') || request.headers.accept?.includes('text/event-stream')) {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            ...headers,
            accept: 'text/event-stream',
          },
          body: request.method !== 'GET' && request.method !== 'HEAD'
            ? request.body ? JSON.stringify(request.body) : undefined
            : undefined,
        });

        reply.raw.writeHead(response.status, {
          'Content-Type': response.headers.get('content-type') || 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        if (response.body) {
          const reader = response.body.getReader();
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
        }
        reply.raw.end();
        return;
      }

      // Regular requests
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body ? JSON.stringify(request.body) : undefined
          : undefined,
      });

      const data = await response.json().catch(() => response.text());
      reply.code(response.status).send(data);
    } catch (error: any) {
      console.error(`[knowledge-proxy] Failed to proxy ${targetPath}:`, error.message);
      reply.code(502).send({
        success: false,
        message: `Knowledge backend unreachable: ${error.message}`,
      });
    }
  });
}
