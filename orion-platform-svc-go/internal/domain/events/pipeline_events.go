package events

import (
	"encoding/json"
	"time"
)

// --- Pipeline Domain Events ---

// PipelineStartedEvent is raised when a pipeline execution is started.
type PipelineStartedEvent struct {
	BaseDomainEvent
	BuildID       string                 `json:"build_id"`
	Branch        string                 `json:"branch"`
	TriggerSource string                 `json:"trigger_source"`
	Params        map[string]interface{} `json:"params"`
}

// PipelineCompletedEvent is raised when a pipeline execution is completed.
type PipelineCompletedEvent struct {
	BaseDomainEvent
	Status          string                 `json:"status"`     // success, failed, cancelled
	TotalDurationMs int64                  `json:"total_duration_ms"`
	Artifacts       []map[string]interface{} `json:"artifacts"`
}

// PipelineCancelledEvent is raised when a pipeline execution is cancelled.
type PipelineCancelledEvent struct {
	BaseDomainEvent
	Reason       string `json:"reason"`
	CancelledBy  string `json:"cancelled_by"`
}

// --- Approval Domain Events ---

// ApprovalRequestedEvent is raised when an approval request is submitted.
type ApprovalRequestedEvent struct {
	BaseDomainEvent
	Title       string `json:"title"`
	Type        string `json:"type"`        // multi_level, emergency
	TotalLevels int    `json:"total_levels"`
	ReqByID     string `json:"req_by_id"`
}

// ApprovalLevelApprovedEvent is raised when a single level is approved.
type ApprovalLevelApprovedEvent struct {
	BaseDomainEvent
	Level        int    `json:"level"`
	ApproverID   string `json:"approver_id"`
	ApproverName string `json:"approver_name"`
	Comment      string `json:"comment"`
}

// ApprovalCompletedEvent is raised when the full approval chain is completed.
type ApprovalCompletedEvent struct {
	BaseDomainEvent
	FinalStatus     string `json:"final_status"`   // approved, rejected, withdrawn
	TotalDurationMs int64  `json:"total_duration_ms"`
}

// ApprovalDelegateEvent is raised when an approver delegates to another.
type ApprovalDelegateEvent struct {
	BaseDomainEvent
	OldApproverID  string `json:"old_approver_id"`
	NewApproverID  string `json:"new_approver_id"`
	Level          int    `json:"level"`
	Reason         string `json:"reason"`
}

// --- FeatureFlag Domain Events ---

// FeatureFlagToggledEvent is raised when a feature flag is toggled.
type FeatureFlagToggledEvent struct {
	BaseDomainEvent
	FlagKey    string `json:"flag_key"`
	OldEnabled bool   `json:"old_enabled"`
	NewEnabled bool   `json:"new_enabled"`
	ToggledBy  string `json:"toggled_by"`
}

// FeatureFlagCreatedEvent is raised when a feature flag is created.
type FeatureFlagCreatedEvent struct {
	BaseDomainEvent
	FlagKey string `json:"flag_key"`
	Enabled bool   `json:"enabled"`
	Description string `json:"description"`
	CreatedBy string `json:"created_by"`
}

// FeatureFlagDeletedEvent is raised when a feature flag is deleted.
type FeatureFlagDeletedEvent struct {
	BaseDomainEvent
	FlagKey   string `json:"flag_key"`
	DeletedBy string `json:"deleted_by"`
	Reason    string `json:"reason"`
}

// --- Utility ---

// MarshalDomainEvent marshals a domain event to JSON.
func MarshalDomainEvent(event DomainEvent) ([]byte, error) {
	return json.Marshal(event)
}

// UnmarshalDomainEvent unmarshals JSON to a domain event of the given type.
func UnmarshalDomainEvent(data []byte, target DomainEvent) error {
	return json.Unmarshal(data, target)
}
