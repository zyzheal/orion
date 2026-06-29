/**
 * Code Repo API Routes
 *
 * Routes under /api/v1/code-repo
 * Wraps CodeRepoController with Fastify routes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CodeRepoController } from './controllers/code-repo/CodeRepoController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'code-repo-routes' });

export default async function codeRepoRoutes(
  app: FastifyInstance,
  options?: Record<string, unknown>
): Promise<void> {
  const ctrl = new CodeRepoController();

  // Adapters
  app.get('/code-repo/adapters', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const res = await ctrl.listAdapters(req, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  // Repos
  app.get('/code-repo/:adapterId/repos', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId } = req.params as { adapterId: string };
      const res = await ctrl.listRepositories({ ...req, params: { adapterId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  // Branches CRUD
  app.get('/code-repo/:adapterId/repos/:repoId/branches', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listBranches({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/branches', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.createBranch({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.delete('/code-repo/:adapterId/repos/:repoId/branches/:branchName', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, branchName } = req.params as { adapterId: string; repoId: string; branchName: string };
      const res = await ctrl.deleteBranch({ ...req, params: { adapterId, repoId, branchName } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  // PRs CRUD
  app.get('/code-repo/:adapterId/repos/:repoId/pulls', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.listPullRequests({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId } = req.params as { adapterId: string; repoId: string };
      const res = await ctrl.createPullRequest({ ...req, params: { adapterId, repoId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/merge', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.mergePullRequest({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/close', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.closePullRequest({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  // Reviews
  app.post('/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews', { onRequest: [authenticateUser, requirePermission({ resource: 'code_repo', action: 'write' })] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.addReview({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.get('/code-repo/:adapterId/repos/:repoId/pulls/:prId/reviews', { onRequest: [authenticateUser] }, async (req, reply) => {
    try {
      const { adapterId, repoId, prId } = req.params as { adapterId: string; repoId: string; prId: string };
      const res = await ctrl.listReviews({ ...req, params: { adapterId, repoId, prId } }, reply);
      return reply.send(res);
    } catch (e) {
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Failed' });
    }
  });

  // Code Ownership
  app.get('/code-repo/code-owners', { onRequest: [authenticateUser] }, async (req, reply) => {
    return reply.send({ success: true, data: { owners: [] } });
  });

  // Webhooks
  app.get('/code-repo/webhooks/logs', { onRequest: [authenticateUser] }, async (req, reply) => {
    return reply.send({ success: true, data: { logs: [] } });
  });
}
