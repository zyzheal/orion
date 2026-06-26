/**
 * Terminal Audit API Routes
 *
 * Routes under /api/v1/cmdb/terminal-audit
 * Handles terminal connect logs, file transfer logs, and audit stats.
 * Uses in-memory storage (Map) — audit data that doesn't need DB persistence yet.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

// ============================================================================
// Types
// ============================================================================

interface TerminalConnectLog {
  id: string;
  username: string;
  hostname: string;
  hostIp: string;
  connectTime: string;
  disconnectTime?: string;
  duration?: string;
  status: 'active' | 'closed' | 'terminated';
  clientIp: string;
}

interface TerminalFileLog {
  id: string;
  username: string;
  hostname: string;
  filePath: string;
  fileName: string;
  fileSize: string;
  operation: 'upload' | 'download';
  timestamp: string;
  status: 'success' | 'failed';
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const connectLogs = new Map<string, TerminalConnectLog>();
const fileLogs = new Map<string, TerminalFileLog>();

// Seed mock data for connect logs
const seedConnectLogs: TerminalConnectLog[] = [
  {
    id: 'conn-001',
    username: 'admin',
    hostname: 'prod-web-01',
    hostIp: '10.0.1.10',
    connectTime: '2026-05-19 14:30:00',
    status: 'active',
    clientIp: '192.168.1.100',
  },
  {
    id: 'conn-002',
    username: 'operator',
    hostname: 'prod-api-01',
    hostIp: '10.0.2.20',
    connectTime: '2026-05-19 13:15:00',
    disconnectTime: '2026-05-19 13:45:00',
    duration: '30m',
    status: 'closed',
    clientIp: '192.168.1.101',
  },
  {
    id: 'conn-003',
    username: 'admin',
    hostname: 'prod-web-02',
    hostIp: '10.0.1.11',
    connectTime: '2026-05-19 12:00:00',
    disconnectTime: '2026-05-19 12:10:00',
    duration: '10m',
    status: 'terminated',
    clientIp: '192.168.1.100',
  },
  {
    id: 'conn-004',
    username: 'developer',
    hostname: 'dev-web-01',
    hostIp: '10.0.3.10',
    connectTime: '2026-05-19 10:30:00',
    disconnectTime: '2026-05-19 11:30:00',
    duration: '1h',
    status: 'closed',
    clientIp: '192.168.1.102',
  },
  {
    id: 'conn-005',
    username: 'devops',
    hostname: 'staging-api-01',
    hostIp: '10.0.4.15',
    connectTime: '2026-06-24 09:00:00',
    status: 'active',
    clientIp: '192.168.1.105',
  },
  {
    id: 'conn-006',
    username: 'admin',
    hostname: 'prod-db-01',
    hostIp: '10.0.1.50',
    connectTime: '2026-06-24 08:15:00',
    disconnectTime: '2026-06-24 08:45:00',
    duration: '30m',
    status: 'closed',
    clientIp: '192.168.1.100',
  },
];

// Seed mock data for file transfer logs
const seedFileLogs: TerminalFileLog[] = [
  {
    id: 'file-001',
    username: 'admin',
    hostname: 'prod-web-01',
    filePath: '/tmp',
    fileName: 'config.yaml',
    fileSize: '2.4 KB',
    operation: 'upload',
    timestamp: '2026-05-19 14:35:00',
    status: 'success',
  },
  {
    id: 'file-002',
    username: 'operator',
    hostname: 'prod-api-01',
    filePath: '/var/log',
    fileName: 'app.log',
    fileSize: '15.2 MB',
    operation: 'download',
    timestamp: '2026-05-19 13:20:00',
    status: 'success',
  },
  {
    id: 'file-003',
    username: 'admin',
    hostname: 'prod-web-02',
    filePath: '/opt/app',
    fileName: 'deploy.sh',
    fileSize: '1.1 KB',
    operation: 'upload',
    timestamp: '2026-05-19 12:05:00',
    status: 'failed',
  },
  {
    id: 'file-004',
    username: 'developer',
    hostname: 'dev-web-01',
    filePath: '/home/dev',
    fileName: 'test-results.json',
    fileSize: '540 KB',
    operation: 'download',
    timestamp: '2026-05-19 11:00:00',
    status: 'success',
  },
  {
    id: 'file-005',
    username: 'devops',
    hostname: 'staging-api-01',
    filePath: '/etc/nginx',
    fileName: 'nginx.conf',
    fileSize: '3.8 KB',
    operation: 'upload',
    timestamp: '2026-06-24 09:10:00',
    status: 'success',
  },
  {
    id: 'file-006',
    username: 'admin',
    hostname: 'prod-db-01',
    filePath: '/var/backups',
    fileName: 'db-dump.sql.gz',
    fileSize: '256 MB',
    operation: 'download',
    timestamp: '2026-06-24 08:30:00',
    status: 'failed',
  },
];

// Populate maps with seed data
for (const log of seedConnectLogs) {
  connectLogs.set(log.id, log);
}
for (const log of seedFileLogs) {
  fileLogs.set(log.id, log);
}

// ============================================================================
// Route Handler
// ============================================================================

export default async function terminalAuditRoutes(
  app: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // ==================== Connect Logs ====================

  // List terminal connect logs (paginated, filterable by status)
  app.get('/connect-logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 10;
    const statusFilter = query.status as string | undefined;

    let items = Array.from(connectLogs.values());

    // Apply status filter
    if (statusFilter && ['active', 'closed', 'terminated'].includes(statusFilter)) {
      items = items.filter((log) => log.status === statusFilter);
    }

    // Sort by connectTime descending (newest first)
    items.sort((a, b) => b.connectTime.localeCompare(a.connectTime));

    const total = items.length;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);

    return reply.send({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  });

  // Get connect log detail
  app.get('/connect-logs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = connectLogs.get(params.id);

    if (!log) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Connect log ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: log });
  });

  // ==================== File Transfer Logs ====================

  // List file transfer logs (paginated, filterable by operation and status)
  app.get('/file-logs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 10;
    const operationFilter = query.operation as string | undefined;
    const statusFilter = query.status as string | undefined;

    let items = Array.from(fileLogs.values());

    // Apply operation filter
    if (operationFilter && ['upload', 'download'].includes(operationFilter)) {
      items = items.filter((log) => log.operation === operationFilter);
    }

    // Apply status filter
    if (statusFilter && ['success', 'failed'].includes(statusFilter)) {
      items = items.filter((log) => log.status === statusFilter);
    }

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const total = items.length;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);

    return reply.send({
      success: true,
      data,
      total,
      page,
      pageSize,
    });
  });

  // Get file transfer log detail
  app.get('/file-logs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const log = fileLogs.get(params.id);

    if (!log) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `File log ${params.id} not found`,
      });
    }

    return reply.send({ success: true, data: log });
  });

  // ==================== Stats ====================

  // Get audit stats
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const allConnectLogs = Array.from(connectLogs.values());
    const allFileLogs = Array.from(fileLogs.values());

    return reply.send({
      success: true,
      data: {
        totalConnectLogs: allConnectLogs.length,
        activeSessions: allConnectLogs.filter((l) => l.status === 'active').length,
        totalFileTransfers: allFileLogs.length,
      },
    });
  });
}
