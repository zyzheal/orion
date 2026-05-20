-- Permission Audit Logs & Notifications Tables
-- Creates tables required for permission audit logging and notification management

-- Permission audit logs table (used by PermissionAuditRepository)
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    tenant_id       VARCHAR(255),
    resource_type   VARCHAR(255) NOT NULL,
    resource_id     VARCHAR(255),
    action          VARCHAR(255) NOT NULL,
    decision        VARCHAR(20) NOT NULL CHECK (decision IN ('allow', 'deny')),
    decision_source VARCHAR(50) NOT NULL CHECK (decision_source IN ('rbac', 'abac', 'relationship', 'super_admin_bypass', 'all', 'capability')),
    reason          TEXT,
    evaluated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_audit_logs(user_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_tenant ON permission_audit_logs(tenant_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_decision ON permission_audit_logs(decision, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_resource ON permission_audit_logs(resource_type, resource_id);

-- Notifications table (used by NotificationRepository)
-- Note: Table may already exist from earlier migrations, add missing columns

DO $$
BEGIN
    -- Add is_read column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add level column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'level') THEN
        ALTER TABLE notifications ADD COLUMN level VARCHAR(20) DEFAULT 'info';
    END IF;

    -- Add metadata column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE notifications ADD COLUMN metadata JSONB;
    END IF;

    -- Add updated_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'updated_at') THEN
        ALTER TABLE notifications ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
