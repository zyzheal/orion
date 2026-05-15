-- Migration: 001_init.sql
-- Approval Service Database Schema
-- Created: 2026-05-15
-- Description: Initialize approval and confirmation tables for multi-level approval workflow

-- ==================== Core Approval Tables ====================

-- Approval requests table
CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    definition_id VARCHAR(255),
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    title TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(255),
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 1,
    required_approvals INTEGER NOT NULL DEFAULT 1,
    result JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Approval steps table (multi-level approvals)
CREATE TABLE IF NOT EXISTS approval_steps (
    id VARCHAR(255) PRIMARY KEY,
    approval_id VARCHAR(255) NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    approver_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    comment TEXT,
    acted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Approval templates table
CREATE TABLE IF NOT EXISTS approval_templates (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(255) NOT NULL,
    levels JSONB NOT NULL,
    mode VARCHAR(50) NOT NULL DEFAULT 'serial',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Approval audit log table
CREATE TABLE IF NOT EXISTS approval_audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    approval_id VARCHAR(255) REFERENCES approvals(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255),
    actor_email VARCHAR(255),
    target_id VARCHAR(255),
    target_type VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================== Confirmation Tables ====================

-- Confirmation requests table
CREATE TABLE IF NOT EXISTS confirmations (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requester_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by VARCHAR(255),
    confirmation_token VARCHAR(255) UNIQUE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Confirmation approvers table
CREATE TABLE IF NOT EXISTS confirmation_approvers (
    id VARCHAR(255) PRIMARY KEY,
    confirmation_id VARCHAR(255) NOT NULL REFERENCES confirmations(id) ON DELETE CASCADE,
    approver_id VARCHAR(255) NOT NULL,
    approver_email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    comment TEXT,
    acted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Confirmation audit logs table
CREATE TABLE IF NOT EXISTS confirmation_audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    confirmation_id VARCHAR(255) REFERENCES confirmations(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255),
    actor_email VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Confirmation settings table
CREATE TABLE IF NOT EXISTS confirmation_settings (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    user_id VARCHAR(255) NOT NULL,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    slack_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    auto_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_interval_hours INTEGER NOT NULL DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- ==================== Indexes ====================

-- Approval indexes
CREATE INDEX IF NOT EXISTS idx_approvals_tenant_id ON approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_resource ON approvals(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approval_id ON approval_steps(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id ON approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_templates_tenant ON approval_templates(tenant_id, is_default);
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_approval_id ON approval_audit_logs(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_logs_created_at ON approval_audit_logs(created_at DESC);

-- Confirmation indexes
CREATE INDEX IF NOT EXISTS idx_confirmations_tenant_id ON confirmations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_status ON confirmations(status);
CREATE INDEX IF NOT EXISTS idx_confirmations_resource ON confirmations(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_created_at ON confirmations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confirmation_approvers_confirmation_id ON confirmation_approvers(confirmation_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_approvers_approver_id ON confirmation_approvers(approver_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_audit_logs_confirmation_id ON confirmation_audit_logs(confirmation_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_audit_logs_created_at ON confirmation_audit_logs(created_at DESC);

-- ==================== Comments ====================

COMMENT ON TABLE approvals IS 'Approval requests for multi-level approval workflow';
COMMENT ON TABLE approval_steps IS 'Individual approval steps for each approver';
COMMENT ON TABLE approval_templates IS 'Pre-defined approval workflow templates';
COMMENT ON TABLE approval_audit_logs IS 'Audit trail for approval actions';
COMMENT ON TABLE confirmations IS 'Manual confirmation requests';
COMMENT ON TABLE confirmation_approvers IS 'Approvers for confirmation requests';
COMMENT ON TABLE confirmation_audit_logs IS 'Audit trail for confirmation actions';
COMMENT ON TABLE confirmation_settings IS 'User notification preferences for confirmations';