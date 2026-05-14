import type { ServiceInfo, RegisterServiceInput, UpdateServiceInput } from '../types/core.js';
import { getPool } from '../utils/database.js';
import { publishPlatformEvent } from '../utils/eventBus.js';

export async function registerService(input: RegisterServiceInput): Promise<ServiceInfo> {
  const pool = getPool();
  const id = crypto.randomUUID();
  const now = new Date();

  const service: ServiceInfo = {
    id,
    serviceName: input.serviceName,
    serviceUrl: input.serviceUrl,
    version: input.version || null,
    status: 'active',
    healthUrl: input.healthUrl || null,
    metadata: input.metadata || {},
    lastHeartbeat: null,
    registeredAt: now,
    updatedAt: now,
  };

  await pool.query(
    `INSERT INTO service_registry (id, service_name, service_url, version, status, health_url, metadata, registered_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (service_name) DO UPDATE SET
       service_url = EXCLUDED.service_url,
       version = EXCLUDED.version,
       status = EXCLUDED.status,
       health_url = EXCLUDED.health_url,
       metadata = EXCLUDED.metadata,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [service.id, service.serviceName, service.serviceUrl, service.version, service.status, service.healthUrl, JSON.stringify(service.metadata), service.registeredAt, service.updatedAt],
  );

  await publishPlatformEvent('SERVICE_REGISTERED', { id, name: service.serviceName, url: service.serviceUrl });

  return service;
}

export async function deregisterService(serviceName: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query('DELETE FROM service_registry WHERE service_name = $1', [serviceName]);

  if (result.rowCount && result.rowCount > 0) {
    await publishPlatformEvent('SERVICE_DEREGISTERED', { name: serviceName });
    return true;
  }
  return false;
}

export async function getService(serviceName: string): Promise<ServiceInfo | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM service_registry WHERE service_name = $1', [serviceName]);
  return rowToService(result.rows[0]) || null;
}

export async function listServices(status?: string): Promise<ServiceInfo[]> {
  const pool = getPool();

  const query = status
    ? 'SELECT * FROM service_registry WHERE status = $1 ORDER BY service_name'
    : 'SELECT * FROM service_registry ORDER BY service_name';

  const result = await pool.query(query, status ? [status] : []);
  return result.rows.map(rowToService).filter((s): s is ServiceInfo => s !== null);
}

export async function updateServiceHeartbeat(serviceName: string): Promise<boolean> {
  const pool = getPool();
  const now = new Date();
  const result = await pool.query(
    'UPDATE service_registry SET last_heartbeat = $1, status = $2 WHERE service_name = $3 RETURNING *',
    [now, 'active', serviceName],
  );

  if (result.rows[0]) {
    await publishPlatformEvent('SERVICE_HEARTBEAT', { name: serviceName, timestamp: now });
  }

  return !!result.rows[0];
}

export async function discoverService(serviceName: string): Promise<{ serviceUrl: string; status: string } | null> {
  const service = await getService(serviceName);
  if (!service || service.status !== 'active') return null;
  return { serviceUrl: service.serviceUrl, status: service.status };
}

function rowToService(row: Record<string, unknown> | undefined): ServiceInfo | null {
  if (!row) return null;
  return {
    id: row.id as string,
    serviceName: row.service_name as string,
    serviceUrl: row.service_url as string,
    version: (row.version as string) || null,
    status: row.status as ServiceInfo['status'],
    healthUrl: (row.health_url as string) || null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    lastHeartbeat: (row.last_heartbeat as Date) || null,
    registeredAt: row.registered_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
