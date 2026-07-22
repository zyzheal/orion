import { Pool, type PoolConfig } from "pg";
import { config } from "../config";

const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL pool error:", err);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function testConnection(): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT NOW()");
    return true;
  } finally {
    client.release();
  }
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  author VARCHAR(255) NOT NULL,
  repository_url TEXT,
  documentation_url TEXT,
  icon_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'archived')),
  total_installs INTEGER DEFAULT 0,
  average_rating NUMERIC(3, 2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  manifest JSONB DEFAULT '{}',
  download_url TEXT,
  checksum VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, version)
);

CREATE TABLE IF NOT EXISTS skill_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version VARCHAR(50),
  installed_by VARCHAR(255),
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_author ON skills(author);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_skills_is_public ON skills(is_public);
CREATE INDEX IF NOT EXISTS idx_skills_is_verified ON skills(is_verified);
CREATE INDEX IF NOT EXISTS idx_skills_tags ON skills USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_skills_name_search ON skills USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skill_versions_skill_id ON skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_installs_skill_id ON skill_installs(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_ratings_skill_id ON skill_ratings(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_ratings_user_id ON skill_ratings(user_id);
`;

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  console.log("Running database migrations...");
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await pool.query(CREATE_TABLES_SQL);
  console.log("Database migrations completed successfully.");
}

export async function runSeeds(): Promise<void> {
  const pool = getPool();
  console.log("Running database seeds...");

  const { rowCount } = await pool.query("SELECT 1 FROM skills LIMIT 1");
  if ((rowCount ?? 0) > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  await pool.query(`
    INSERT INTO skills (id, name, description, category, author, tags, is_public, is_verified) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'code-review', 'Automated code review with AI-powered suggestions', 'development', 'orion-team', ARRAY['code-review', 'quality', 'ai'], true, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'test-generator', 'Generates unit and integration tests from source code', 'testing', 'orion-team', ARRAY['testing', 'generator'], true, true),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'deploy-helper', 'Streamlined deployment workflow manager', 'deployment', 'orion-team', ARRAY['deploy', 'ci-cd'], true, false)
  `);

  await pool.query(`
    INSERT INTO skill_versions (skill_id, version, changelog) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '1.0.0', 'Initial release'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '1.1.0', 'Added TypeScript support'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', '1.0.0', 'Initial release'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', '1.0.0', 'Initial release')
  `);

  console.log("Database seeds completed successfully.");
}

if (process.argv.includes("migrate")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

if (process.argv.includes("seed")) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
