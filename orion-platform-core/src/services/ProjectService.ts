import type { CreateProjectInput, Project, UpdateProjectInput } from '../types/core.js';

let _pool: import('pg').Pool | null = null;

function getPool(): import('pg').Pool {
  if (!_pool) {
    const { Pool: PgPool } = require('pg');
    _pool = new PgPool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool!;
}

export async function createProject(tenantId: string, input: CreateProjectInput): Promise<Project> {
  const id = crypto.randomUUID();
  const now = new Date();

  const project: Project = {
    id,
    tenantId,
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // Persist to PostgreSQL
  const pool = getPool();
  await pool.query(
    `INSERT INTO projects (id, tenant_id, name, slug, description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [project.id, project.tenantId, project.name, project.slug, project.description, project.status, project.createdAt, project.updatedAt]
  );

  return project;
}

export async function listProjects(tenantId: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ projects: Project[]; total: number }> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT COUNT(*) FROM projects WHERE tenant_id = $1',
    [tenantId]
  );
  const total = Number(result.rows[0]?.count || 0);

  return { projects: [], total };
}

export async function getProject(id: string): Promise<Project | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getProjectBySlug(tenantId: string, slug: string): Promise<Project | null> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM projects WHERE tenant_id = $1 AND slug = $2',
    [tenantId, slug]
  );
  return result.rows[0] || null;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
  const pool = getPool();
  const project = await getProject(id);
  if (!project) return null;

  await pool.query(
    `UPDATE projects SET name = COALESCE($2, name), slug = COALESCE($3, slug),
     description = COALESCE($4, description), status = COALESCE($5, status), updated_at = NOW()
     WHERE id = $1`,
    [id, input.name ?? null, input.slug || (input.name ? input.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : null), input.description ?? null, input.status ?? null]
  );
  return getProject(id);
}

export async function deleteProject(id: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("UPDATE projects SET status = 'deleted', updated_at = NOW() WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
