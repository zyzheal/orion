-- Migration 300: Create tables for Developer Portal API Playground
-- Tables: devportal_playground_requests, devportal_playground_responses

CREATE TABLE IF NOT EXISTS devportal_playground_requests (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  url TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  query_params JSONB DEFAULT '{}',
  body TEXT DEFAULT '',
  body_type VARCHAR(20) DEFAULT 'none',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playground_requests_tenant_user ON devportal_playground_requests(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_playground_requests_created ON devportal_playground_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS devportal_playground_responses (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  status_code INTEGER NOT NULL,
  status_text VARCHAR(64) NOT NULL,
  headers JSONB DEFAULT '{}',
  body TEXT DEFAULT '',
  latency_ms INTEGER DEFAULT 0,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playground_responses_request ON devportal_playground_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_playground_responses_timestamp ON devportal_playground_responses(timestamp DESC);
