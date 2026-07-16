-- Terminal Audit Logs Tables
-- Migration 396

-- Connect logs: terminal SSH/connection session records
CREATE TABLE IF NOT EXISTS terminal_connect_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL,
  hostname TEXT NOT NULL,
  host_ip TEXT NOT NULL,
  connect_time TIMESTAMPTZ NOT NULL,
  disconnect_time TIMESTAMPTZ,
  duration TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'terminated')),
  client_ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminal_connect_logs_tenant ON terminal_connect_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_terminal_connect_logs_status ON terminal_connect_logs(status);
CREATE INDEX IF NOT EXISTS idx_terminal_connect_logs_connect_time ON terminal_connect_logs(connect_time DESC);

-- File transfer logs: upload/download audit records
CREATE TABLE IF NOT EXISTS terminal_file_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL,
  hostname TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upload', 'download')),
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminal_file_logs_tenant ON terminal_file_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_terminal_file_logs_operation ON terminal_file_logs(operation);
CREATE INDEX IF NOT EXISTS idx_terminal_file_logs_status ON terminal_file_logs(status);
CREATE INDEX IF NOT EXISTS idx_terminal_file_logs_timestamp ON terminal_file_logs(timestamp DESC);
