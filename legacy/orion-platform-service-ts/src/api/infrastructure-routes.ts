/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/infrastructure/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Infrastructure API Routes
 *
 * 提供基础设施连接器管理、断线重连和沙箱网络隔离的 REST API。
 *
 * Prefix: /admin/infrastructure
 *
 * Endpoints:
 * - GET    /admin/infrastructure/connectors              - List all connectors
 * - GET    /admin/infrastructure/connectors/:id          - Get connector detail
 * - POST   /admin/infrastructure/connectors              - Register a new connector
 * - POST   /admin/infrastructure/connectors/:id/connect  - Connect to connector
 * - POST   /admin/infrastructure/connectors/:id/disconnect - Disconnect connector
 * - POST   /admin/infrastructure/connectors/:id/reconnect - Reconnect connector
 * - DELETE /admin/infrastructure/connectors/:id          - Unregister connector
 * - GET    /admin/infrastructure/connectors/:id/health   - Get connector health metrics
 * - GET    /admin/infrastructure/connectors/health/all   - Get all connectors health
 * - GET    /admin/infrastructure/sandbox                 - List all sandboxes
 * - GET    /admin/infrastructure/sandbox/:id             - Get sandbox detail
 * - POST   /admin/infrastructure/sandbox                 - Create sandbox network
 * - POST   /admin/infrastructure/sandbox/:id/isolate     - Isolate sandbox
 * - POST   /admin/infrastructure/sandbox/:id/release     - Release sandbox isolation
 * - POST   /admin/infrastructure/sandbox/:id/block-all   - Block all traffic
 * - POST   /admin/infrastructure/sandbox/:id/allow-traffic - Allow traffic between environments
 * - POST   /admin/infrastructure/sandbox/:id/deny-traffic - Deny traffic between environments
 * - POST   /admin/infrastructure/sandbox/:id/dns-isolation - Configure DNS isolation
 * - POST   /admin/infrastructure/sandbox/:id/egress     - Configure egress traffic control
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { InfrastructureService, ConnectorType, ConnectorStatus, ConnectorConfig, ReconnectPolicy, SandboxInfo, SandboxNetworkPolicy, NetworkPolicyRule } from '../services/infrastructure';
import { OrionError, ErrorCode, handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('InfrastructureRoutes');

// ============================================================================
// Types
// ============================================================================

interface RegisterConnectorBody {
  type: ConnectorType;
  name: string;
  endpoint?: string;
  credentials?: Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

interface UpdateConnectorBody {
  timeoutMs?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

interface CreateSandboxBody {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface AllowTrafficBody {
  fromEnv: string;
  toEnv: string;
  ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>;
}

interface DnsIsolationBody {
  allowedDomains: string[];
  customDnsServers?: string[];
  dnsTimeoutMs?: number;
}

interface EgressTrafficBody {
  rules: Array<{
    name: string;
    destination: string;
    ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>;
    allow: boolean;
  }>;
  defaultAction: 'allow' | 'deny';
}

interface InfrastructureRoutesOptions {
  infrastructureService?: InfrastructureService;
}

// ============================================================================
// Route Registration
// ============================================================================

export default async function infrastructureRoutes(
  app: FastifyInstance,
  options: InfrastructureRoutesOptions,
): Promise<void> {
  const infrastructureService = options.infrastructureService;

  if (!infrastructureService) {
    logger.warn('InfrastructureService not provided to routes');
    return;
  }

  // ==================== Connector Management ====================

  // GET /admin/infrastructure/connectors - List all connectors
  app.get(
    '/connectors',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const connectors = infrastructureService.listConnectors();
        return reply.send({ success: true, data: connectors, total: connectors.length });
      } catch (err) {
        logger.error({ error: err }, 'Failed to list connectors');
        return handleError(reply, err);
      }
    },
  );

  // GET /admin/infrastructure/connectors/:id - Get connector detail
  app.get(
    '/connectors/:id',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const connector = infrastructureService.getConnector(id);
        if (!connector) {
          return handleError(reply, new OrionError('Connector not found', ErrorCode.NOT_FOUND));
        }
        return reply.send({ success: true, data: connector });
      } catch (err) {
        logger.error({ error: err }, 'Failed to get connector');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/connectors - Register a new connector
  app.post(
    '/connectors',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as RegisterConnectorBody;
        const { type, name, endpoint, credentials, timeoutMs, maxRetries, metadata } = body;

        if (!type || !name) {
          return handleError(reply, new OrionError('type and name are required', ErrorCode.PARAM_REQUIRED));
        }

        const connector = infrastructureService.registerConnector(type, {
          name,
          endpoint,
          credentials,
          timeoutMs,
          maxRetries,
          metadata,
        });

        logger.info({ connectorId: connector.id, type, name }, 'Connector registered via API');
        return reply.send({ success: true, data: connector });
      } catch (err) {
        logger.error({ error: err }, 'Failed to register connector');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/connectors/:id/connect - Connect to connector
  app.post(
    '/connectors/:id/connect',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const connector = await infrastructureService.connect(id);
        logger.info({ connectorId: id }, 'Connector connected via API');
        return reply.send({ success: true, data: connector });
      } catch (err) {
        logger.error({ error: err }, 'Failed to connect connector');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/connectors/:id/disconnect - Disconnect connector
  app.post(
    '/connectors/:id/disconnect',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        await infrastructureService.disconnect(id);
        logger.info({ connectorId: id }, 'Connector disconnected via API');
        return reply.send({ success: true, message: 'Disconnected successfully' });
      } catch (err) {
        logger.error({ error: err }, 'Failed to disconnect connector');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/connectors/:id/reconnect - Reconnect connector
  app.post(
    '/connectors/:id/reconnect',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const connector = await infrastructureService.reconnect(id);
        logger.info({ connectorId: id }, 'Connector reconnected via API');
        return reply.send({ success: true, data: connector });
      } catch (err) {
        logger.error({ error: err }, 'Failed to reconnect connector');
        return handleError(reply, err);
      }
    },
  );

  // DELETE /admin/infrastructure/connectors/:id - Unregister connector
  app.delete(
    '/connectors/:id',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const deleted = infrastructureService.unregisterConnector(id);
        if (!deleted) {
          return handleError(reply, new OrionError('Connector not found', ErrorCode.NOT_FOUND));
        }
        logger.info({ connectorId: id }, 'Connector unregistered via API');
        return reply.send({ success: true, message: 'Connector unregistered' });
      } catch (err) {
        logger.error({ error: err }, 'Failed to unregister connector');
        return handleError(reply, err);
      }
    },
  );

  // GET /admin/infrastructure/connectors/:id/health - Get connector health metrics
  app.get(
    '/connectors/:id/health',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const metrics = infrastructureService.getHealthMetrics(id);
        if (!metrics) {
          return handleError(reply, new OrionError('Health metrics not found', ErrorCode.NOT_FOUND));
        }
        return reply.send({ success: true, data: metrics });
      } catch (err) {
        logger.error({ error: err }, 'Failed to get health metrics');
        return handleError(reply, err);
      }
    },
  );

  // GET /admin/infrastructure/connectors/health/all - Get all connectors health
  app.get(
    '/connectors/health/all',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const allMetrics = infrastructureService.listAllHealthMetrics();
        return reply.send({ success: true, data: allMetrics, total: allMetrics.length });
      } catch (err) {
        logger.error({ error: err }, 'Failed to list all health metrics');
        return handleError(reply, err);
      }
    },
  );

  // ==================== Sandbox Network Isolation ====================

  // GET /admin/infrastructure/sandbox - List all sandboxes
  app.get(
    '/sandbox',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sandboxes = infrastructureService.listSandboxes();
        return reply.send({ success: true, data: sandboxes, total: sandboxes.length });
      } catch (err) {
        logger.error({ error: err }, 'Failed to list sandboxes');
        return handleError(reply, err);
      }
    },
  );

  // GET /admin/infrastructure/sandbox/:id - Get sandbox detail
  app.get(
    '/sandbox/:id',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const sandbox = infrastructureService.getSandbox(id);
        if (!sandbox) {
          return handleError(reply, new OrionError('Sandbox not found', ErrorCode.NOT_FOUND));
        }
        return reply.send({ success: true, data: sandbox });
      } catch (err) {
        logger.error({ error: err }, 'Failed to get sandbox');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox - Create sandbox network
  app.post(
    '/sandbox',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as CreateSandboxBody;
        const { name, namespace, labels, annotations } = body;

        if (!name || !namespace) {
          return handleError(reply, new OrionError('name and namespace are required', ErrorCode.PARAM_REQUIRED));
        }

        const policy = infrastructureService.createSandboxNetworkPolicy({
          sandboxId: name,
          name: `isolation-policy-${name}`,
          namespace,
          labels: {
            app: name,
            isolation: 'enforced',
            ...labels,
          },
          annotations: {
            'orion.io/isolation': 'true',
            ...annotations,
          },
          ingressRules: [
            {
              name: 'deny-all-ingress',
              podSelector: {},
              allow: false,
            },
          ],
          egressRules: [
            {
              name: 'deny-all-egress',
              podSelector: {},
              allow: false,
            },
          ],
        });

        const sandbox: SandboxInfo = {
          id: name,
          name,
          namespace,
          isolationStatus: 'isolated' as any,
          networkPolicyId: policy.id,
          createdAt: new Date(),
        };

        logger.info({ sandboxId: name, namespace, policyId: policy.id }, 'Sandbox created via API');
        return reply.send({ success: true, data: sandbox });
      } catch (err) {
        logger.error({ error: err }, 'Failed to create sandbox');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/isolate - Isolate sandbox
  app.post(
    '/sandbox/:id/isolate',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const sandbox = await infrastructureService.isolateSandbox(id);
        logger.info({ sandboxId: id }, 'Sandbox isolated via API');
        return reply.send({ success: true, data: sandbox });
      } catch (err) {
        logger.error({ error: err }, 'Failed to isolate sandbox');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/release - Release sandbox isolation
  app.post(
    '/sandbox/:id/release',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const sandbox = await infrastructureService.releaseSandbox(id);
        logger.info({ sandboxId: id }, 'Sandbox released via API');
        return reply.send({ success: true, data: sandbox });
      } catch (err) {
        logger.error({ error: err }, 'Failed to release sandbox');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/block-all - Block all traffic
  app.post(
    '/sandbox/:id/block-all',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const sandbox = await infrastructureService.isolateSandbox(id);
        logger.info({ sandboxId: id }, 'All traffic blocked via API');
        return reply.send({ success: true, data: sandbox });
      } catch (err) {
        logger.error({ error: err }, 'Failed to block all traffic');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/allow-traffic - Allow traffic between environments
  app.post(
    '/sandbox/:id/allow-traffic',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as AllowTrafficBody;
        const { fromEnv, toEnv, ports } = body;

        if (!fromEnv || !toEnv || !ports) {
          return handleError(reply, new OrionError('fromEnv, toEnv, and ports are required', ErrorCode.PARAM_REQUIRED));
        }

        // Use the infrastructure service's internal method to find/create policy
        const policies = infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === fromEnv);
        let policy = policies[0];

        if (!policy) {
          policy = infrastructureService.createSandboxNetworkPolicy({
            sandboxId: fromEnv,
            name: `allow-${fromEnv}-to-${toEnv}`,
            namespace: fromEnv,
            labels: { app: fromEnv },
            annotations: { 'orion.io/traffic-allow': `to-${toEnv}` },
            ingressRules: [],
            egressRules: [],
          });
        }

        const allowRule: NetworkPolicyRule = {
          name: `allow-${fromEnv}-to-${toEnv}-${Date.now()}`,
          podSelector: {},
          namespaceSelector: { namespace: toEnv },
          ports,
          allow: true,
        };

        policy.egressRules.push(allowRule);
        policy.updatedAt = new Date();

        logger.info({ fromEnv, toEnv, ports, policyId: policy.id }, 'Traffic allowed via API');
        return reply.send({ success: true, data: policy });
      } catch (err) {
        logger.error({ error: err }, 'Failed to allow traffic');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/deny-traffic - Deny traffic between environments
  app.post(
    '/sandbox/:id/deny-traffic',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as { fromEnv: string; toEnv: string };

        if (!body.fromEnv || !body.toEnv) {
          return handleError(reply, new OrionError('fromEnv and toEnv are required', ErrorCode.PARAM_REQUIRED));
        }

        const policies = infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === body.fromEnv);
        const policy = policies[0];

        if (!policy) {
          return handleError(reply, new OrionError('No policy found for source environment', ErrorCode.NOT_FOUND));
        }

        policy.egressRules = policy.egressRules.filter(
          rule => !(rule.namespaceSelector?.namespace === body.toEnv && rule.allow)
        );
        policy.updatedAt = new Date();

        logger.info({ fromEnv: body.fromEnv, toEnv: body.toEnv }, 'Traffic denied via API');
        return reply.send({ success: true, data: policy });
      } catch (err) {
        logger.error({ error: err }, 'Failed to deny traffic');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/dns-isolation - Configure DNS isolation
  app.post(
    '/sandbox/:id/dns-isolation',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as DnsIsolationBody;

        if (!body.allowedDomains || !Array.isArray(body.allowedDomains)) {
          return handleError(reply, new OrionError('allowedDomains array is required', ErrorCode.PARAM_REQUIRED));
        }

        const policies = infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === id);
        let policy = policies[0];

        if (!policy) {
          const sandbox = infrastructureService.getSandbox(id) || {
            id,
            name: id,
            namespace: `sandbox-${id}`,
            isolationStatus: 'unknown' as any,
            createdAt: new Date(),
          };

          const dnsAnnotations: Record<string, string> = {
            'orion.io/isolation': 'true',
            'orion.io/dns-isolation': 'enforced',
            'orion.io/dns-allowed-domains': body.allowedDomains.join(','),
            'orion.io/dns-timeout': String(body.dnsTimeoutMs ?? 5000),
          };
          if (body.customDnsServers && body.customDnsServers.length > 0) {
            dnsAnnotations['orion.io/dns-servers'] = body.customDnsServers.join(',');
          }

          policy = infrastructureService.createSandboxNetworkPolicy({
            sandboxId: id,
            name: `dns-policy-${id}`,
            namespace: sandbox.namespace,
            labels: { app: id },
            annotations: dnsAnnotations,
            ingressRules: [
              { name: 'deny-all-ingress', podSelector: {}, allow: false },
            ],
            egressRules: [
              { name: 'deny-all-egress', podSelector: {}, allow: false },
            ],
          });
        } else {
          policy.annotations = {
            ...policy.annotations,
            'orion.io/dns-isolation': 'enforced',
            'orion.io/dns-allowed-domains': body.allowedDomains.join(','),
            'orion.io/dns-timeout': String(body.dnsTimeoutMs ?? 5000),
          };
          if (body.customDnsServers && body.customDnsServers.length > 0) {
            policy.annotations['orion.io/dns-servers'] = body.customDnsServers.join(',');
          }
          policy.updatedAt = new Date();
        }

        logger.info({ sandboxId: id, policyId: policy.id, allowedDomains: body.allowedDomains }, 'DNS isolation configured via API');
        return reply.send({ success: true, data: policy });
      } catch (err) {
        logger.error({ error: err }, 'Failed to configure DNS isolation');
        return handleError(reply, err);
      }
    },
  );

  // POST /admin/infrastructure/sandbox/:id/egress - Configure egress traffic control
  app.post(
    '/sandbox/:id/egress',
    {
      preHandler: [authenticateUser, requirePermission({ resource: 'infrastructure', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as EgressTrafficBody;
        const { rules, defaultAction } = body;

        if (!rules || !Array.isArray(rules) || !defaultAction) {
          return handleError(reply, new OrionError('rules array and defaultAction are required', ErrorCode.PARAM_REQUIRED));
        }

        const policies = infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === id);
        let policy = policies[0];

        if (!policy) {
          const sandbox = infrastructureService.getSandbox(id) || {
            id,
            name: id,
            namespace: `sandbox-${id}`,
            isolationStatus: 'unknown' as any,
            createdAt: new Date(),
          };

          policy = infrastructureService.createSandboxNetworkPolicy({
            sandboxId: id,
            name: `egress-policy-${id}`,
            namespace: sandbox.namespace,
            labels: { app: id },
            annotations: {
              'orion.io/isolation': 'true',
              'orion.io/egress-control': 'enforced',
              'orion.io/egress-default': defaultAction,
            },
            ingressRules: [
              { name: 'deny-all-ingress', podSelector: {}, allow: false },
            ],
            egressRules: rules.map(r => ({
              name: r.name,
              podSelector: {},
              namespaceSelector: r.destination ? { namespace: r.destination } : undefined,
              ports: r.ports,
              allow: r.allow,
            })),
          });
        } else {
          policy.egressRules = rules.map(r => ({
            name: r.name,
            podSelector: {},
            namespaceSelector: r.destination ? { namespace: r.destination } : undefined,
            ports: r.ports,
            allow: r.allow,
          }));
          policy.annotations = {
            ...policy.annotations,
            'orion.io/egress-control': 'enforced',
            'orion.io/egress-default': defaultAction,
          };
          policy.updatedAt = new Date();
        }

        logger.info({ sandboxId: id, policyId: policy.id, ruleCount: rules.length }, 'Egress traffic configured via API');
        return reply.send({ success: true, data: policy });
      } catch (err) {
        logger.error({ error: err }, 'Failed to configure egress traffic');
        return handleError(reply, err);
      }
    },
  );
}