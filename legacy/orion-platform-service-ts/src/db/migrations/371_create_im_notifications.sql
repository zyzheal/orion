-- Migration 371: Create im_notifications table for PostgreSQL persistence
-- Tracks IM notification delivery records for pipeline status notifications

CREATE TABLE IF NOT EXISTS im_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID,
  run_id UUID,
  channel VARCHAR(50) NOT NULL,
  recipient VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_im_notif_tenant ON im_notifications(tenant_id);
CREATE INDEX idx_im_notif_channel ON im_notifications(channel);
CREATE INDEX idx_im_notif_status ON im_notifications(status);
CREATE INDEX idx_im_notif_created ON im_notifications(created_at DESC);
