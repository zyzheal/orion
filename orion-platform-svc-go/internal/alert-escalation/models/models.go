package models

import "time"

// --- Escalation Policy ---

type EscalationPolicy struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Severity    string    `db:"severity" json:"severity"`
	Status      string    `db:"status" json:"status"`
	Rules       string    `db:"rules" json:"-"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`

	RulesList []EscalationRule `json:"rules"`
}

type EscalationRule struct {
	Level        int    `json:"level"`
	DelayMinutes int    `json:"delayMinutes"`
	Target       string `json:"target"`
	Channel      string `json:"channel"`
	Message      string `json:"message"`
	NotifyOnFail bool   `json:"notifyOnFail"`
}

// --- Escalation Trigger ---

type EscalationTrigger struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	PolicyID    string     `db:"policy_id" json:"policyId"`
	AlertID     string     `db:"alert_id" json:"alertId"`
	Level       int        `db:"level" json:"level"`
	Target      string     `db:"target" json:"target"`
	Channel     string     `db:"channel" json:"channel"`
	Message     string     `db:"message" json:"message"`
	TriggeredAt time.Time  `db:"triggered_at" json:"triggeredAt"`
	Status      string     `db:"status" json:"status"`
	ResolvedAt  *time.Time `db:"resolved_at" json:"resolvedAt"`
}

// --- Alert Closure ---

type AlertClosure struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	AlertID        string     `db:"alert_id" json:"alertId"`
	Status         string     `db:"status" json:"status"`
	AcknowledgedBy string     `db:"acknowledged_by" json:"acknowledgedBy"`
	AcknowledgedAt *time.Time `db:"acknowledged_at" json:"acknowledgedAt"`
	ResolvedBy     string     `db:"resolved_by" json:"resolvedBy"`
	ResolvedAt     *time.Time `db:"resolved_at" json:"resolvedAt"`
	ResolutionNote string     `db:"resolution_note" json:"resolutionNote"`
	MTTRSeconds    int64      `db:"mttr_seconds" json:"mttrSeconds"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// --- Alert Metrics ---

type AlertMetrics struct {
	ID                     string    `db:"id" json:"id"`
	TenantID               string    `db:"tenant_id" json:"tenantId"`
	MetricDate             time.Time `db:"metric_date" json:"metricDate"`
	TotalAlerts            int       `db:"total_alerts" json:"totalAlerts"`
	AcknowledgedCount      int       `db:"acknowledged_count" json:"acknowledgedCount"`
	ResolvedCount          int       `db:"resolved_count" json:"resolvedCount"`
	EscalatedCount         int       `db:"escalated_count" json:"escalatedCount"`
	AvgResponseSeconds     int64     `db:"avg_response_seconds" json:"avgResponseSeconds"`
	AvgResolutionSeconds   int64     `db:"avg_resolution_seconds" json:"avgResolutionSeconds"`
	P95ResponseSeconds     int64     `db:"p95_response_seconds" json:"p95ResponseSeconds"`
	P95ResolutionSeconds   int64     `db:"p95_resolution_seconds" json:"p95ResolutionSeconds"`
	SLABreachCount         int       `db:"sla_breach_count" json:"slaBreachCount"`
	AutoRemediationSuccess int       `db:"auto_remediation_success" json:"autoRemediationSuccess"`
	AutoRemediationFailed  int       `db:"auto_remediation_failed" json:"autoRemediationFailed"`
	CreatedAt              time.Time `db:"created_at" json:"createdAt"`
}

// --- Request/Response types ---

type CreatePolicyRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	Severity    string           `json:"severity"`
	Rules       []EscalationRule `json:"rules" binding:"required"`
}

type UpdatePolicyRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	Severity    *string          `json:"severity"`
	Status      *string          `json:"status"`
	Rules       []EscalationRule `json:"rules"`
}

type AcknowledgeRequest struct {
	AlertID  string `json:"alertId" binding:"required"`
	Operator string `json:"operator" binding:"required"`
}

type ResolveRequest struct {
	AlertID        string `json:"alertId" binding:"required"`
	Operator       string `json:"operator" binding:"required"`
	ResolutionNote string `json:"resolutionNote"`
}

type GetMetricsFilter struct {
	From string `form:"from"`
	To   string `form:"to"`
}

type PolicyStats struct {
	PolicyID         string     `json:"policyId"`
	TotalTriggers    int        `json:"totalTriggers"`
	PendingTriggers  int        `json:"pendingTriggers"`
	ResolvedTriggers int        `json:"resolvedTriggers"`
	LastTriggered    *time.Time `json:"lastTriggered"`
}
