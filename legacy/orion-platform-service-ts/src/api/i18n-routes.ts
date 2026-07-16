/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/i18n/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * i18n API Routes
 *
 * 国际化翻译管理
 * Prefix: /api/v1/i18n
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { I18nService } from '../services/i18n/I18nService';
import { DatabasePool } from '../services/database';

interface I18nRoutesOptions {
  database?: DatabasePool;
}

export default async function i18nRoutes(
  app: FastifyInstance,
  options: I18nRoutesOptions = {},
): Promise<void> {
  if (!options.database) return;
  const service = new I18nService(options.database);

  // ==================== Locale Management ====================

  app.post(
    '/locales',
    { preHandler: [authenticateUser, requirePermission({ resource: 'i18n', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { localeCode: string; localeName: string; isDefault?: boolean };
      if (!body.localeCode || !body.localeName) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'localeCode and localeName are required');
      }
      try {
        const locale = await service.createLocale(body);
        return created(reply, request, locale);
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Failed to create locale');
      }
    },
  );

  app.get(
    '/locales',
    { preHandler: [authenticateUser] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const locales = await service.listLocales();
      return success(reply, request, { locales, total: locales.length });
    },
  );

  // ==================== Translation Management ====================

  app.post(
    '/translations',
    { preHandler: [authenticateUser, requirePermission({ resource: 'i18n', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { localeCode: string; namespace: string; key: string; value: string };
      if (!body.localeCode || !body.namespace || !body.key || !body.value) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'localeCode, namespace, key, and value are required');
      }
      try {
        const translation = await service.setTranslation(body.localeCode, body.namespace, body.key, body.value);
        return created(reply, request, translation);
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Failed to set translation');
      }
    },
  );

  app.post(
    '/translations/bulk',
    { preHandler: [authenticateUser, requirePermission({ resource: 'i18n', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { localeCode: string; namespace: string; translations: Record<string, string> };
      if (!body.localeCode || !body.namespace || !body.translations) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'localeCode, namespace, and translations are required');
      }
      try {
        const count = await service.setBulkTranslations(body.localeCode, body.namespace, body.translations);
        return success(reply, request, { count });
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Failed to set translations');
      }
    },
  );

  app.get(
    '/translations/:localeCode',
    { preHandler: [authenticateUser] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { localeCode } = request.params as { localeCode: string };
      const query = request.query as { namespace?: string };

      try {
        if (query.namespace) {
          const translations = await service.getTranslations(localeCode, query.namespace);
          return success(reply, request, { localeCode, namespace: query.namespace, translations });
        }
        const allTranslations = await service.getAllTranslations(localeCode);
        return success(reply, request, { localeCode, translations: allTranslations });
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Failed to get translations');
      }
    },
  );

  app.delete(
    '/translations/:localeCode/:namespace/:key',
    { preHandler: [authenticateUser, requirePermission({ resource: 'i18n', action: 'write' })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { localeCode, namespace, key } = request.params as { localeCode: string; namespace: string; key: string };
      try {
        const deleted = await service.deleteTranslation(localeCode, namespace, key);
        if (!deleted) return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, 'Translation not found');
        return success(reply, request, { deleted: true });
      } catch (error) {
        return internalError(reply, request, error instanceof Error ? error.message : 'Failed to delete translation');
      }
    },
  );
}