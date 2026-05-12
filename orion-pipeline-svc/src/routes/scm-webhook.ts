import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { SCMWebhookService } from '../services/SCMWebhookService';
import { PipelineEngine } from '../engine/PipelineEngine';

export async function scmWebhookRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { database: any; pipelineEngine?: PipelineEngine }
): Promise<void> {
  const scmService = new SCMWebhookService(opts.pipelineEngine || null);

  // Main webhook endpoint - accepts all SCM webhooks
  fastify.post('/webhooks/scm', async (request, reply) => {
    try {
      const payload = request.body as any;
      const headers = request.headers as Record<string, string | undefined>;

      // Detect provider from headers
      const githubSignature = headers['x-hub-signature-256'];
      const githubEvent = headers['x-github-event'];
      const gitlabToken = headers['x-gitlab-token'];
      const gitlabEvent = headers['x-gitlab-event'];

      let result: any;

      if (githubSignature || githubEvent) {
        // GitHub webhook
        const eventType = githubEvent || 'push';
        if (eventType === 'push') {
          result = await scmService.handleGitHubPush(payload, githubSignature);
        } else if (eventType === 'pull_request') {
          result = await scmService.handleGitHubPullRequest(payload, githubSignature);
        } else {
          return reply.code(400).send({ error: `Unsupported GitHub event: ${eventType}` });
        }
      } else if (gitlabToken || gitlabEvent) {
        // GitLab webhook
        const eventType = gitlabEvent || 'Push Hook';
        if (eventType === 'Push Hook' || eventType === 'push') {
          result = await scmService.handleGitLabPush(payload, gitlabToken);
        } else if (eventType === 'Merge Request Hook' || eventType === 'merge_request') {
          result = await scmService.handleGitLabMergeRequest(payload, gitlabToken);
        } else {
          return reply.code(400).send({ error: `Unsupported GitLab event: ${eventType}` });
        }
      } else {
        return reply.code(400).send({ error: 'Unable to determine SCM provider from headers' });
      }

      return reply.code(202).send({
        eventId: result.id,
        provider: result.provider,
        repository: result.repository,
        matchedPipelines: result.matchedPipelines,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'SCM webhook processing failed');
      if (error.message.includes('Invalid')) {
        return reply.code(401).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Internal server error processing webhook' });
    }
  });

  // Get recent webhook events (for debugging/admin)
  fastify.get('/webhooks/scm/events', async (request, reply) => {
    const limit = parseInt((request.query as any)?.limit || '20', 10);
    return reply.send({ events: scmService.getEvents(limit) });
  });

  fastify.get('/webhooks/scm/events/:eventId', async (request, reply) => {
    const event = scmService.getEventById((request.params as any).eventId);
    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }
    return reply.send({ event });
  });
}
