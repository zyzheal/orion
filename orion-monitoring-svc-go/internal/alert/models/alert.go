package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Alert severity levels.
const (
	SeverityCritical = "critical"
	SeverityHigh     = "high"
	SeverityMedium   = "medium"
	SeverityLow      = "low"
	SeverityInfo     = "info"
)

// Alert statuses.
const (
	StatusFiring      = "firing"
	StatusResolved    = "resolved"
	StatusSilenced    = "silenced"
	StatusSuppressed  = "suppressed"
	StatusAcknowledged = "acknowledged"
)

// Alert source types.
const (
	SourceTypeNode         = "node"
	SourceTypeDatabase     = "database"
	SourceTypeNetwork      = "network"
	SourceTypeApplication  = "application"
	SourceTypeService      = "service"
	SourceTypeInfrastructure = "infrastructure"
	SourceTypeCustom       = "custom"
)

// Alert represents an alert instance.
type Alert struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	TenantID        uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	Fingerprint     string          `json:"fingerprint" db:"fingerprint"`
	Name            string          `json:"name" db:"name"`
	Severity        string          `json:"severity" db:"severity"`
	Status          string          `json:"status" db:"status"`
	SourceType      string          `json:"source_type" db:"source_type"`
	SourceID        string          `json:"source_id" db:"source_id"`
	SourceName      string          `json:"source_name" db:"source_name"`
	Labels          json.RawMessage `json:"labels,omitempty" db:"labels"`
	Annotations     json.RawMessage `json:"annotations,omitempty" db:"annotations"`
	Value           float64         `json:"value" db:"value"`
	Threshold       float64         `json:"threshold" db:"threshold"`
	StartsAt        time.Time       `json:"starts_at" db:"starts_at"`
	EndsAt          *time.Time      `json:"ends_at,omitempty" db:"ends_at"`
	ResolvedAt      *time.Time      `json:"resolved_at,omitempty" db:"resolved_at"`
	SilencedAt      *time.Time      `json:"silenced_at,omitempty" db:"silenced_at"`
	SuppressedAt    *time.Time      `json:"suppressed_at,omitempty" db:"suppressed_at"`
	SuppressedReason *string        `json:"suppressed_reason,omitempty" db:"suppressed_reason"`
	RootCauseAlertID *uuid.UUID     `json:"root_cause_alert_id,omitempty" db:"root_cause_alert_id"`
	RelatedAlertIDs  []uuid.UUID    `json:"related_alert_ids" db:"related_alert_ids"`
	MaintenanceWindowID *uuid.UUID  `json:"maintenance_window_id,omitempty" db:"maintenance_window_id"`
	KnownIssueID    *uuid.UUID      `json:"known_issue_id,omitempty" db:"known_issue_id"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// CreateAlertRequest is the request body for creating an alert.
type CreateAlertRequest struct {
	Name         string            `json:"name" binding:"required"`
	Severity     string            `json:"severity" binding:"required,oneof=critical high medium low info"`
	SourceType   string            `json:"source_type" binding:"required"`
	SourceID     string            `json:"source_id" binding:"required"`
	SourceName   string            `json:"source_name"`
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	Value        float64           `json:"value"`
	Threshold    float64           `json:"threshold"`
	TenantID     uuid.UUID         `json:"tenant_id" binding:"required"`
}

// AlertQueryRequest filters alert queries.
type AlertQueryRequest struct {
	Status     string `form:"status"`
	Severity   string `form:"severity"`
	SourceID   string `form:"source_id"`
	Fingerprint string `form:"fingerprint"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
}

// AlertResponse wraps alert query results.
type AlertResponse struct {
	Total int64   `json:"total"`
	Data  []Alert `json:"data"`
}

// ==================== Alert Rules ====================

// AlertRule represents a custom alert rule.
type AlertRule struct {
	ID                    uuid.UUID       `json:"id" db:"id"`
	TenantID              uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	Name                  string          `json:"name" db:"name"`
	Description           *string         `json:"description,omitempty" db:"description"`
	RuleType              string          `json:"rule_type" db:"rule_type"` // threshold, trend, composite
	Condition             json.RawMessage `json:"condition" db:"condition"`
	Severity              string          `json:"severity" db:"severity"`
	Enabled               bool            `json:"enabled" db:"enabled"`
	NotificationChannels  json.RawMessage `json:"notification_channels,omitempty" db:"notification_channels"`
	EvaluationIntervalSec int             `json:"evaluation_interval_sec" db:"evaluation_interval_sec"`
	CooldownSec           int             `json:"cooldown_sec" db:"cooldown_sec"`
	LastEvaluatedAt       *time.Time      `json:"last_evaluated_at,omitempty" db:"last_evaluated_at"`
	LastTriggeredAt       *time.Time      `json:"last_triggered_at,omitempty" db:"last_triggered_at"`
	CreatedBy             *string         `json:"created_by,omitempty" db:"created_by"`
	CreatedAt             time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at" db:"updated_at"`
}

// CreateRuleRequest is the request body for creating an alert rule.
type CreateRuleRequest struct {
	Name                string            `json:"name" binding:"required"`
	Description         *string           `json:"description"`
	RuleType            string            `json:"rule_type" binding:"required,oneof=threshold trend composite"`
	Condition           map[string]any    `json:"condition" binding:"required"`
	Severity            string            `json:"severity" binding:"required"`
	NotificationChannels []map[string]any `json:"notification_channels"`
	EvaluationIntervalSec *int            `json:"evaluation_interval_sec"`
	CooldownSec         *int              `json:"cooldown_sec"`
}

// UpdateRuleRequest is the request body for updating an alert rule.
type UpdateRuleRequest struct {
	Name                *string            `json:"name"`
	Description         *string            `json:"description"`
	Condition           map[string]any     `json:"condition"`
	Severity            string             `json:"severity"`
	Enabled             *bool              `json:"enabled"`
	NotificationChannels []map[string]any  `json:"notification_channels"`
	EvaluationIntervalSec *int             `json:"evaluation_interval_sec"`
	CooldownSec         *int               `json:"cooldown_sec"`
}

// AlertRuleResponse wraps alert rule query results.
type AlertRuleResponse struct {
	Total int64       `json:"total"`
	Data  []AlertRule `json:"data"`
}

// ==================== Alert Silences ====================

// SilenceType is the kind of silence rule.
const (
	SilenceTypeManual     = "manual"
	SilenceTypeMaintenance = "maintenance"
	SilenceTypeKnownIssue  = "known_issue"
)

// SilenceMatcher defines how a silence matches alerts.
type SilenceMatcher struct {
	Name  string `json:"name"`
	Type  string `json:"type"` // equal, regex
	Value string `json:"value"`
}

// AlertSilence represents a silence rule.
type AlertSilence struct {
	ID          uuid.UUID       `json:"id" db:"id"`
	TenantID    uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	Name        string          `json:"name" db:"name"`
	Description *string         `json:"description,omitempty" db:"description"`
	SilenceType string          `json:"silence_type" db:"silence_type"`
	Matchers    json.RawMessage `json:"matchers" db:"matchers"`
	StartsAt    time.Time       `json:"starts_at" db:"starts_at"`
	EndsAt      time.Time       `json:"ends_at" db:"ends_at"`
	CreatedBy   *string         `json:"created_by,omitempty" db:"created_by"`
	Enabled     bool            `json:"enabled" db:"enabled"`
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

// CreateSilenceRequest is the request body for creating a silence.
type CreateSilenceRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description *string           `json:"description"`
	SilenceType *string           `json:"silence_type"`
	Matchers    []SilenceMatcher  `json:"matchers" binding:"required"`
	StartsAt    *time.Time        `json:"starts_at"`
	EndsAt      time.Time         `json:"ends_at" binding:"required"`
}

// UpdateSilenceRequest is the request body for updating a silence.
type UpdateSilenceRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	SilenceType *string          `json:"silence_type"`
	Matchers    []SilenceMatcher `json:"matchers"`
	StartsAt    *time.Time       `json:"starts_at"`
	EndsAt      *time.Time       `json:"ends_at"`
	Enabled     *bool            `json:"enabled"`
}

// AlertSilenceResponse wraps silence query results.
type AlertSilenceResponse struct {
	Total int64          `json:"total"`
	Data  []AlertSilence `json:"data"`
}

// ==================== Alert Correlation ====================

// AlertCorrelationGroup represents a group of correlated alerts.
type AlertCorrelationGroup struct {
	ID                uuid.UUID       `json:"id" db:"id"`
	TenantID          uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	RootAlertID       *uuid.UUID      `json:"root_alert_id" db:"root_alert_id"`
	CorrelatedAlertIDs []uuid.UUID    `json:"correlated_alert_ids" db:"correlated_alert_ids"`
	CommonLabels      json.RawMessage `json:"common_labels" db:"common_labels"`
	Category          string          `json:"category" db:"category"`
	Severity          string          `json:"severity" db:"severity"`
	FirstFiredAt      time.Time       `json:"first_fired_at" db:"first_fired_at"`
	LastFiredAt       time.Time       `json:"last_fired_at" db:"last_fired_at"`
	TotalCount        int             `json:"total_count" db:"total_count"`
	UniqueServices    json.RawMessage `json:"unique_services" db:"unique_services"`
	RecommendedAction *string         `json:"recommended_action,omitempty" db:"recommended_action"`
	CreatedAt         time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at" db:"updated_at"`
}

// CorrelationOptions controls correlation behavior.
type CorrelationOptions struct {
	TimeWindowMs        int64   `json:"time_window_ms"`
	SimilarityThreshold float64 `json:"similarity_threshold"`
	MaxGroupSize        int     `json:"max_group_size"`
	EnableRootCause     bool    `json:"enable_root_cause"`
}

// CorrelationGroupResponse wraps correlation group results.
type CorrelationGroupResponse struct {
	Total int64                   `json:"total"`
	Data  []AlertCorrelationGroup `json:"data"`
}

// ==================== Alert Deduplication ====================

// DeduplicationConfig holds deduplication parameters.
type DeduplicationConfig struct {
	DeduplicationWindowMs int64 `json:"deduplication_window_ms"`
	MaxGroupSize          int   `json:"max_group_size"`
	AggregationIntervalMs int64 `json:"aggregation_interval_ms"`
}

// AlertFingerprint represents a deduplicated fingerprint.
type AlertFingerprint struct {
	Fingerprint string `json:"fingerprint"`
	LabelsHash  string `json:"labels_hash"`
	NameHash    string `json:"name_hash"`
	SourceHash  string `json:"source_hash"`
}

// DeduplicationRecord stores dedup state in the database.
type DeduplicationRecord struct {
	ID              uuid.UUID `json:"id" db:"id"`
	TenantID        uuid.UUID `json:"tenant_id" db:"tenant_id"`
	Fingerprint     string    `json:"fingerprint" db:"fingerprint"`
	AlertID         uuid.UUID `json:"alert_id" db:"alert_id"`
	FirstSeen       time.Time `json:"first_seen" db:"first_seen"`
	LastSeen        time.Time `json:"last_seen" db:"last_seen"`
	OccurrenceCount int       `json:"occurrence_count" db:"occurrence_count"`
	Suppressed      bool      `json:"suppressed" db:"suppressed"`
}

// DeduplicationStats is the summary returned for deduplication.
type DeduplicationStats struct {
	TotalGroups     int                  `json:"total_groups"`
	TotalAlerts     int64                `json:"total_alerts"`
	SuppressedAlerts int                 `json:"suppressed_alerts"`
	TopFingerprints []FingerprintCount   `json:"top_fingerprints"`
}

// FingerprintCount pairs a fingerprint with its count.
type FingerprintCount struct {
	Fingerprint string `json:"fingerprint"`
	Count       int64  `json:"count"`
}

// AlertGroup holds a deduplicated group.
type AlertGroup struct {
	Fingerprint     string    `json:"fingerprint"`
	Alerts          []Alert   `json:"alerts"`
	Count           int       `json:"count"`
	FirstOccurrence time.Time `json:"first_occurrence"`
	LastOccurrence  time.Time `json:"last_occurrence"`
	Suppressed      bool      `json:"suppressed"`
	SuppressionReason *string `json:"suppression_reason,omitempty"`
}

// ==================== Alert Notifications ====================

// NotificationChannelType describes the delivery channel.
const (
	ChannelTypeEmail    = "email"
	ChannelTypeWebhook  = "webhook"
	ChannelTypeSlack    = "slack"
	ChannelTypeDingtalk = "dingtalk"
	ChannelTypeFeishu   = "feishu"
)

// NotificationChannel defines a delivery target.
type NotificationChannel struct {
	Type    string `json:"type"`
	Target  string `json:"target"`
	Template string `json:"template,omitempty"`
}

// AlertNotification records a notification dispatch.
type AlertNotification struct {
	ID        uuid.UUID       `json:"id" db:"id"`
	TenantID  uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	AlertID   uuid.UUID       `json:"alert_id" db:"alert_id"`
	Channel   string          `json:"channel" db:"channel"`
	Status    string          `json:"status" db:"status"` // sent, failed, pending
	Payload   json.RawMessage `json:"payload" db:"payload"`
	Error     *string         `json:"error,omitempty" db:"error"`
	SentAt    time.Time       `json:"sent_at" db:"sent_at"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
}

// SendNotificationRequest is the request to dispatch a notification.
type SendNotificationRequest struct {
	AlertID   uuid.UUID        `json:"alert_id" binding:"required"`
	Channels  []NotificationChannel `json:"channels"`
	Template  *NotificationTemplate `json:"template,omitempty"`
}

// NotificationTemplate is a message template for rendering.
type NotificationTemplate struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ChannelType   string `json:"channel_type"`
	SubjectTemplate *string `json:"subject_template"`
	BodyTemplate  string `json:"body_template"`
}

// NotificationResponse wraps notification results.
type NotificationResponse struct {
	Total  int64              `json:"total"`
	Data   []AlertNotification `json:"data"`
}

// ==================== Suppression ====================

// SuppressionRuleType describes the reason for suppression.
const (
	SuppressionRuleMaintenanceWindow = "maintenance_window"
	SuppressionRuleNodeFailure       = "node_failure"
	SuppressionRuleDatabaseFailure   = "database_failure"
	SuppressionRuleNetworkFailure    = "network_failure"
	SuppressionRuleRootCause         = "root_cause"
	SuppressionRuleDuplication       = "duplication"
	SuppressionRuleKnownIssue        = "known_issue"
)

// SuppressionResult holds the outcome of a suppression check.
type SuppressionResult struct {
	Suppressed         bool       `json:"suppressed"`
	RuleType           string     `json:"rule_type,omitempty"`
	Reason             string     `json:"reason,omitempty"`
	RelatedAlertID     *uuid.UUID `json:"related_alert_id,omitempty"`
	MaintenanceWindowID *uuid.UUID `json:"maintenance_window_id,omitempty"`
	KnownIssueID       *uuid.UUID `json:"known_issue_id,omitempty"`
	SilencedUntil      *time.Time `json:"silenced_until,omitempty"`
}

// ==================== Root Cause Analysis ====================

// RCA status values.
const (
	RCAStatusCompleted = "completed"
	RCAStatusPartial   = "partial"
	RCAStatusFailed    = "failed"
)

// RootCause represents an identified root cause.
type RootCause struct {
	Service     string  `json:"service" db:"service"`
	AlertID     uuid.UUID `json:"alert_id" db:"alert_id"`
	AlertName   string  `json:"alert_name" db:"alert_name"`
	Confidence  float64 `json:"confidence" db:"confidence"`
	Explanation string  `json:"explanation" db:"explanation"`
	Category    string  `json:"category" db:"category"`
}

// RcaAffectedService summarizes an affected service.
type RcaAffectedService struct {
	Name       string `json:"name"`
	AlertCount int    `json:"alert_count"`
	Severity   string `json:"severity"`
}

// CorrelatedAlert describes an alert in a correlation.
type CorrelatedAlert struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Service           string `json:"service"`
	Severity          string `json:"severity"`
	CorrelationReason string `json:"correlation_reason"`
}

// RCAAlert is the input alert for RCA analysis.
type RCAAlert struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Service  string    `json:"service"`
	Severity string    `json:"severity"`
	FiredAt  time.Time `json:"fired_at"`
	Message  string    `json:"message"`
}

// RCAResult stores a root cause analysis run.
type RCAResult struct {
	AnalysisID      string                `json:"analysis_id" db:"id"`
	TenantID        uuid.UUID             `json:"tenant_id" db:"tenant_id"`
	Status          string                `json:"status" db:"status"`
	AffectedServices []RcaAffectedService `json:"affected_services" db:"affected_services"`
	CorrelatedAlerts []CorrelatedAlert    `json:"correlated_alerts" db:"correlated_alerts"`
	RootCause       *RootCause            `json:"root_cause" db:"root_cause"`
	TopRootCauses   []RootCause           `json:"top_root_causes" db:"top_root_causes"`
	TopologyPath    []string              `json:"topology_path" db:"topology_path"`
	TimeWindowStart time.Time             `json:"time_window_start" db:"time_window_start"`
	TimeWindowEnd   time.Time             `json:"time_window_end" db:"time_window_end"`
	AlertCount      int                   `json:"alert_count" db:"alert_count"`
	GroupCount      int                   `json:"group_count" db:"group_count"`
	CompletedAt     time.Time             `json:"completed_at" db:"completed_at"`
}

// RCAAnalysisRequest is the request body for running RCA.
type RCAAnalysisRequest struct {
	AffectedServices []string   `json:"affected_services"`
	Alerts           []RCAAlert `json:"alerts"`
	TimeWindow       RCAWindow  `json:"time_window"`
}

// RCAWindow defines the analysis time window.
type RCAWindow struct {
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

// RCAStats holds correlation statistics.
type RCAStats struct {
	TotalAlerts      int            `json:"total_alerts"`
	ActiveGroups     int            `json:"active_groups"`
	AlertsPerGroup   float64        `json:"alerts_per_group"`
	ByCategory       map[string]int `json:"by_category"`
	BySeverity       map[string]int `json:"by_severity"`
	DeduplicationRate int           `json:"deduplication_rate"`
}

// ==================== Additional types ====================

// AlertStats holds summary statistics for a tenant's alerts.
type AlertStats struct {
	Total    int `json:"total"`
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Firing   int `json:"firing"`
	Resolved int `json:"resolved"`
	Silenced int `json:"silenced"`
}

// MarshalLabels converts a map to json.RawMessage.
func MarshalLabels(labels map[string]string) json.RawMessage {
	if labels == nil {
		return nil
	}
	b, _ := json.Marshal(labels)
	return b
}

// MarshalAnnotations converts a map to json.RawMessage.
func MarshalAnnotations(annotations map[string]string) json.RawMessage {
	if annotations == nil {
		return nil
	}
	b, _ := json.Marshal(annotations)
	return b
}

// MarshalMatchers converts a slice of SilenceMatcher to json.RawMessage.
func MarshalMatchers(matchers []SilenceMatcher) json.RawMessage {
	if matchers == nil {
		return nil
	}
	b, _ := json.Marshal(matchers)
	return b
}
