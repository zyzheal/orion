-- Migration 181: Tenant Invitation System
-- Adds tenant_invites table for multi-tenant user invitation system

-- Create tenant_invites table
CREATE TABLE IF NOT EXISTS tenant_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  role            VARCHAR(50) DEFAULT 'member',
  invite_code     VARCHAR(64) NOT NULL UNIQUE,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  accepted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  message         TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  accepted_at     TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX idx_tenant_invites_tenant ON tenant_invites(tenant_id);
CREATE INDEX idx_tenant_invites_email ON tenant_invites(email);
CREATE INDEX idx_tenant_invites_code ON tenant_invites(invite_code);
CREATE INDEX idx_tenant_invites_status ON tenant_invites(status);
CREATE INDEX idx_tenant_invites_expires ON tenant_invites(expires_at) WHERE status = 'pending';

-- Unique constraint: one pending invite per email per tenant
CREATE UNIQUE INDEX idx_tenant_invites_pending_email_tenant
  ON tenant_invites(tenant_id, LOWER(email))
  WHERE status = 'pending';

-- Comment for documentation
COMMENT ON TABLE tenant_invites IS 'Stores tenant invitation records for user onboarding';
COMMENT ON COLUMN tenant_invites.role IS 'Role assigned to user upon accepting invitation (member, admin, owner)';
COMMENT ON COLUMN tenant_invites.status IS 'Invitation lifecycle: pending -> accepted/expired/cancelled';
COMMENT ON COLUMN tenant_invites.invite_code IS 'Unique code shared with invitee to accept invitation';

-- Rollback:
-- DROP TABLE IF EXISTS tenant_invites;