package models

import "time"

// TriggerConfigType defines the type of trigger configuration
type TriggerConfigType string

const (
	TriggerConfigWebhook  TriggerConfigType = "webhook"
	TriggerConfigSchedule TriggerConfigType = "schedule"
	TriggerConfigEvent    TriggerConfigType = "event"
	TriggerConfigSCM      TriggerConfigType = "scm"
)

// PipelineTrigger defines an automated trigger for a pipeline
type PipelineTrigger struct {
	ID           string            `db:"id" json:"id"`
	PipelineID   string            `db:"pipeline_id" json:"pipeline_id"`
	TenantID     string            `db:"tenant_id" json:"tenant_id"`
	Type         TriggerConfigType `db:"type" json:"type"`
	Name         string            `db:"name" json:"name"`
	Enabled      bool              `db:"enabled" json:"enabled"`
	Config       string            `db:"config" json:"config"` // JSON config
	Secret       string            `db:"secret" json:"-"`      // webhook secret
	PathFilter   string            `db:"path_filter" json:"path_filter,omitempty"`
	BranchFilter string            `db:"branch_filter" json:"branch_filter,omitempty"`
	LastTriggeredAt *time.Time     `db:"last_triggered_at" json:"last_triggered_at,omitempty"`
	TriggerCount int               `db:"trigger_count" json:"trigger_count"`
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
}

// WebhookTriggerConfig is the config for webhook triggers
type WebhookTriggerConfig struct {
	URL          string            `json:"url"`
	Secret       string            `json:"secret"`
	Events       []string          `json:"events"` // push, pull_request, tag, etc.
	Headers      map[string]string `json:"headers,omitempty"`
}

// ScheduleTriggerConfig is the config for schedule triggers
type ScheduleTriggerConfig struct {
	CronExpression string `json:"cron_expression"`
	Timezone       string `json:"timezone"`
	Enabled        bool   `json:"enabled"`
}

// EventTriggerConfig is the config for event-based triggers
type EventTriggerConfig struct {
	EventType  string            `json:"event_type"` // build.complete, deploy.success, etc.
	Source     string            `json:"source"`     // which service emits the event
	Filters    map[string]string `json:"filters,omitempty"`
}

// SCMTriggerConfig is the config for SCM (git) triggers
type SCMTriggerConfig struct {
	RepoID       string   `json:"repo_id"`
	Events       []string `json:"events"` // push, pull_request, tag
	BranchFilter string   `json:"branch_filter"`
	PathFilter   string   `json:"path_filter"`
}

// CreateTriggerRequest is input for creating a trigger
type CreateTriggerRequest struct {
	Type         TriggerConfigType `json:"type" binding:"required"`
	Name         string            `json:"name" binding:"required"`
	Config       string            `json:"config" binding:"required"`
	Enabled      *bool             `json:"enabled"`
	PathFilter   string            `json:"path_filter"`
	BranchFilter string            `json:"branch_filter"`
}

// SCMTriggerEvent represents an incoming SCM trigger event
type SCMTriggerEvent struct {
	TriggerID  string            `json:"trigger_id"`
	PipelineID string            `json:"pipeline_id"`
	Type       TriggerConfigType `json:"type"`
	Payload    string            `json:"payload"` // JSON payload
	Headers    map[string]string `json:"headers,omitempty"`
	Source     string            `json:"source"`
	Branch     string            `json:"branch,omitempty"`
	Commit     string            `json:"commit,omitempty"`
	Paths      []string          `json:"paths,omitempty"`
}
