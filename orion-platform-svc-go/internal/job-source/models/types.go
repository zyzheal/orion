// Package models defines domain types for the Job Source system.
//
// Job Source is the ingestion layer: it receives external triggers
// (API calls, webhooks, cron schedules, events, manual dispatch)
// and translates them into JobSourceEvent records that downstream
// processors (job-actions, job-processor) consume.
package models

import "time"

// ---------------------------------------------------------------------------
// Source type constants — authoritative list of supported ingestion types
// ---------------------------------------------------------------------------

const (
	TypeManual      = "manual"
	TypeSchedule    = "schedule"
	TypeWebhook     = "webhook"
	TypeAPI         = "api"
	TypeEventTrigger = "event_trigger"
	TypeCron        = "cron"
	TypeAlertCallback = "alert_callback"
	TypePipelineStep = "pipeline_step"
	TypeApprovalStep = "approval_step"
	TypeChatCommand  = "chat_command"
)

// AllSourceTypes lists every supported source type.
var AllSourceTypes = []string{
	TypeManual, TypeSchedule, TypeWebhook, TypeAPI,
	TypeEventTrigger, TypeCron, TypeAlertCallback,
	TypePipelineStep, TypeApprovalStep, TypeChatCommand,
}

// ---------------------------------------------------------------------------
// Source status constants
// ---------------------------------------------------------------------------

const (
	SourceStatusActive   = "active"
	SourceStatusDisabled = "disabled"
	SourceStatusError    = "error"
)

// ValidSourceStatuses is the set of valid source statuses.
var ValidSourceStatuses = map[string]bool{
	SourceStatusActive:   true,
	SourceStatusDisabled: true,
	SourceStatusError:    true,
}

// ---------------------------------------------------------------------------
// Event status constants
// ---------------------------------------------------------------------------

const (
	EventStatusReceived   = "received"
	EventStatusProcessed  = "processed"
	EventStatusFailed     = "failed"
	EventStatusDispatched = "dispatched"
)

// ---------------------------------------------------------------------------
// SourceConfig — parsed config for a job source
// ---------------------------------------------------------------------------

// SourceConfig holds type-safe parsed configuration for a source.
// The raw JSON is stored in JobSource.Config; this struct is used at
// runtime after deserialization by adapters.
type SourceConfig struct {
	Raw            map[string]string `json:"raw"`
	EventBusTopic  string            `json:"event_bus_topic,omitempty"`
	CronExpr       string            `json:"cron_expr,omitempty"`
	WebhookPath    string            `json:"webhook_path,omitempty"`
	WebhookSecret  string            `json:"webhook_secret,omitempty"`
	TimeoutSeconds int               `json:"timeout_seconds"`
	RetryCount     int               `json:"retry_count"`
	Filters        map[string]string `json:"filters"`
}

// DefaultSourceConfig returns a config with sensible defaults.
func DefaultSourceConfig() SourceConfig {
	return SourceConfig{
		Raw:            make(map[string]string),
		TimeoutSeconds: 30,
		RetryCount:     0,
		Filters:        make(map[string]string),
	}
}

// ---------------------------------------------------------------------------
// JobSourceChain — composition of multiple sources
// ---------------------------------------------------------------------------

// JobSourceChain represents a composed pipeline: an upstream source
// feeds events into downstream sources, forming a DAG of triggers.
type JobSourceChain struct {
	ID         string     `json:"id" db:"id"`
	TenantID   string     `json:"tenant_id" db:"tenant_id"`
	Name       string     `json:"name" db:"name"`
	Status     string     `json:"status" db:"status"` // "active", "paused", "error"
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`
}

// JobSourceChainLink links one source to another in a chain.
type JobSourceChainLink struct {
	ID          string `json:"id" db:"id"`
	ChainID     string `json:"chain_id" db:"chain_id"`
	UpstreamID  string `json:"upstream_id" db:"upstream_id"` // source that produces events
	DownstreamID string `json:"downstream_id" db:"downstream_id"` // source that consumes them
	Filter      string `json:"filter" db:"filter"`            // JSON filter applied between
	Order       int    `json:"order" db:"order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response DTOs for chains
// ---------------------------------------------------------------------------

// CreateChainRequest creates a new source chain.
type CreateChainRequest struct {
	Name    string `json:"name" binding:"required"`
	Upstream string `json:"upstream_id" binding:"required"`
	Downstream string `json:"downstream_id" binding:"required"`
	Filter  string `json:"filter"` // JSON filter string
}

// ChainListResponse returns paginated chains.
type ChainListResponse struct {
	Total int             `json:"total"`
	Data  []JobSourceChain `json:"data"`
}

// ---------------------------------------------------------------------------
// ValidateSourceType returns true if the type is known.
// ---------------------------------------------------------------------------

func ValidateSourceType(t string) bool {
	for _, v := range AllSourceTypes {
		if v == t {
			return true
		}
	}
	return false
}
