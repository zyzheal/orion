/**
 * AI Code Review API Routes
 *
 * Routes under /api/v1/ai/review
 *
 * Provides diff analysis, review management, and review comment endpoints
 * via the AIReviewService, DiffAnalyzer, and ReviewIntegrationService.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { AIReviewService } from '../services/ai-review/AIReviewService';
import { DiffAnalyzer } from '../services/ai-review/DiffAnalyzer';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('ai-review-routes');

export interface AIReviewRoutesOptions {
  reviewService?: AIReviewService;
  diffAnalyzer?: DiffAnalyzer;
}

export default async function aiReviewRoutes(
  app: FastifyInstance,
  options: AIReviewRoutesOptions
): Promise<void> {
  const reviewService = options.reviewService || new AIReviewService();
  const diffAnalyzer = options.diffAnalyzer || new DiffAnalyzer();

  // ==================== Analyze ====================

  /**
   * POST /api/v1/ai/review/analyze
   * Analyze a diff and generate review comments
   */
  app.post(
    '/analyze',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-review', action: 'execute' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          diff: string;
          prId?: string;
          repoId?: string;
          repoType?: 'gitlab' | 'gerrit' | 'github';
          postToPR?: boolean;
        };

        if (!body.diff) {
          return handleError(reply, new ValidationError('BAD_REQUEST'))
        }

        if (body.repoId && body.prId) {
          // Full review workflow (with PR integration)
          const result = await reviewService.reviewPR({
            diff: body.diff,
            prId: body.prId,
            repoId: body.repoId,
            repoType: body.repoType || 'gitlab',
          });
          return reply.status(201).send({ data: result });
        }

        // Diff-only analysis (no PR integration)
        const result = reviewService.reviewDiff(body.diff, body.prId);
        return reply.status(201).send({ data: result });
      } catch (error: any) {
        logger.error({ error }, 'AI review analysis failed');
        return handleError(reply, new OrionError('REVIEW_ANALYSIS_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== Reviews List ====================

  /**
   * GET /api/v1/ai/review/reviews
   * List review history with pagination
   */
  app.get(
    '/reviews',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-review', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          repoId?: string;
          prId?: string;
          status?: string;
          page?: string;
          perPage?: string;
        };

        const result = reviewService.getReviewHistory({
          repoId: query.repoId,
          prId: query.prId,
          status: query.status as any,
          page: query.page ? parseInt(query.page, 10) : 1,
          perPage: query.perPage ? parseInt(query.perPage, 10) : 20,
        });

        return reply.send({
          data: result.results,
          meta: {
            total: result.total,
            page: result.page,
            perPage: result.perPage,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list reviews');
        return handleError(reply, new OrionError('REVIEWS_LIST_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  /**
   * GET /api/v1/ai/review/reviews/:id
   * Get review detail by ID
   */
  app.get(
    '/reviews/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-review', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const review = reviewService.getReviewDetail(id);

        if (!review) {
          return handleError(reply, new NotFoundError('NOT_FOUND'))
        }

        return reply.send({ data: review });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get review detail');
        return handleError(reply, new OrionError('REVIEW_DETAIL_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== Comments ====================

  /**
   * GET /api/v1/ai/review/comments
   * List review comments for a specific review
   */
  app.get(
    '/comments',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-review', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { reviewId?: string };
        if (!query.reviewId) {
          return handleError(reply, new ValidationError('BAD_REQUEST'))
        }

        const review = reviewService.getReviewDetail(query.reviewId);
        if (!review) {
          return handleError(reply, new NotFoundError('NOT_FOUND'))
        }

        return reply.send({
          data: review.comments,
          meta: { total: review.comments.length },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list review comments');
        return handleError(reply, new OrionError('COMMENTS_LIST_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  /**
   * POST /api/v1/ai/review/comments
   * Create a manual review comment on a diff
   */
  app.post(
    '/comments',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-review', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          diff: string;
          filePath?: string;
          patterns?: Array<{ name: string; regex: string; fileExtensions?: string[] }>;
        };

        if (!body.diff) {
          return handleError(reply, new ValidationError('BAD_REQUEST'))
        }

        // Parse diff and extract changed files/lines
        const diffResult = diffAnalyzer.parseDiff(body.diff);
        const changedFiles = diffAnalyzer.getChangedFiles(body.diff);

        let patternMatches: Array<{
          filePath: string;
          lineNumber: number;
          content: string;
          patternName: string;
        }> = [];

        if (body.patterns && body.patterns.length > 0) {
          const compiledPatterns = body.patterns.map((p) => ({
            name: p.name,
            regex: new RegExp(p.regex),
            fileExtensions: p.fileExtensions,
          }));
          patternMatches = diffAnalyzer.extractPatterns(body.diff, compiledPatterns);
        }

        return reply.status(201).send({
          data: {
            diffStats: {
              filesChanged: diffResult.files.length,
              totalAdditions: diffResult.totalAdditions,
              totalDeletions: diffResult.totalDeletions,
            },
            changedFiles,
            patternMatches,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to create review comment');
        return handleError(reply, new OrionError('COMMENT_CREATE_FAILED', ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}
