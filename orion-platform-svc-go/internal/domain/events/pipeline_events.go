package events

import (
	"encoding/json"
)

// --- Pipeline Lifecycle Domain Events ---

// PipelineCreatedEvent is raised when a new pipeline is created.
type PipelineCreatedEvent struct {
	BaseDomainEvent
	PipelineName string `json:"pipeline_name"`
}

// PipelineActivatedEvent is raised when a pipeline is activated.
type PipelineActivatedEvent struct {
	BaseDomainEvent
	PipelineName string `json:"pipeline_name"`
}

// PipelineDeactivatedEvent is raised when a pipeline is deactivated.
type PipelineDeactivatedEvent struct {
	BaseDomainEvent
	PipelineName string `json:"pipeline_name"`
}

// PipelineUpdatedEvent is raised when a pipeline definition is updated.
type PipelineUpdatedEvent struct {
	BaseDomainEvent
	PipelineName string `json:"pipeline_name"`
}

// PipelineDeletedEvent is raised when a pipeline is deleted.
type PipelineDeletedEvent struct {
	BaseDomainEvent
	PipelineName string `json:"pipeline_name"`
}

// --- Pipeline Execution Domain Events ---

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
	Status          string                    `json:"status"`     // success, failed, cancelled
	TotalDurationMs int64                     `json:"total_duration_ms"`
	Artifacts       []map[string]interface{} `json:"artifacts"`
}

// PipelineCancelledEvent is raised when a pipeline execution is cancelled.
type PipelineCancelledEvent struct {
	BaseDomainEvent
	Reason      string `json:"reason"`
	CancelledBy string `json:"cancelled_by"`
}

// --- Approval Domain Events ---

// ApprovalCreatedEvent is raised when an approval request is created.
type ApprovalCreatedEvent struct {
	BaseDomainEvent
	ApprovalType string `json:"approval_type"`
	TotalLevels  int    `json:"total_levels"`
}

// ApprovalRequestedEvent is raised when an approval request is submitted.
type ApprovalRequestedEvent struct {
	BaseDomainEvent
	Title       string `json:"title"`
	Type        string `json:"type"`        // multi_level, emergency
	TotalLevels int    `json:"total_levels"`
	ReqByID     string `json:"req_by_id"`
}

// ApprovalLevelApprovedEvent is raised when a single approval level is approved.
type ApprovalLevelApprovedEvent struct {
	BaseDomainEvent
	Level      int    `json:"level"`
	LevelID    string `json:"level_id"`
	ApproverID string `json:"approver_id"`
}

// ApprovalLevelRejectedEvent is raised when a single approval level is rejected.
type ApprovalLevelRejectedEvent struct {
	BaseDomainEvent
	Level      int    `json:"level"`
	LevelID    string `json:"level_id"`
	ApproverID string `json:"approver_id"`
	Comment    string `json:"comment"`
}

// ApprovalCompletedEvent is raised when the full approval chain is completed.
type ApprovalCompletedEvent struct {
	BaseDomainEvent
	ApprovalType string `json:"approval_type"`
	TotalLevels  int    `json:"total_levels"`
}

// ApprovalCancelledEvent is raised when an approval request is cancelled.
type ApprovalCancelledEvent struct {
	BaseDomainEvent
	ApprovalType string `json:"approval_type"`
	Reason       string `json:"reason"`
}

// ApprovalWithdrawnEvent is raised when an approval request is withdrawn by the requester.
type ApprovalWithdrawnEvent struct {
	BaseDomainEvent
	ApprovalType string `json:"approval_type"`
	Reason       string `json:"reason"`
}

// ApprovalDelegateEvent is raised when an approver delegates to another.
type ApprovalDelegateEvent struct {
	BaseDomainEvent
	OldApproverID  string `json:"old_approver_id"`
	NewApproverID  string `json:"new_approver_id"`
	Level          int    `json:"level"`
	Reason         string `json:"reason"`
}

// ApprovalReassignedEvent is raised when an approver is reassigned.
type ApprovalReassignedEvent struct {
	BaseDomainEvent
	Level           int    `json:"level"`
	OldApproverID   string `json:"old_approver_id"`
	NewApproverID   string `json:"new_approver_id"`
	NewApproverName string `json:"new_approver_name"`
	Comment         string `json:"comment"`
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
	FlagKey       string `json:"flag_key"`
	Enabled       bool   `json:"enabled"`
	Description   string `json:"description"`
	CreatedBy     string `json:"created_by"`
}

// FeatureFlagDeletedEvent is raised when a feature flag is deleted.
type FeatureFlagDeletedEvent struct {
	BaseDomainEvent
	FlagKey   string `json:"flag_key"`
	DeletedBy string `json:"deleted_by"`
	Reason    string `json:"reason"`
}

// FeatureFlagRolloutUpdatedEvent is raised when the rollout configuration
// of a feature flag is changed.
type FeatureFlagRolloutUpdatedEvent struct {
	BaseDomainEvent
	FlagKey    string `json:"flag_key"`
	OldPercent int    `json:"old_percent"`
	NewPercent int    `json:"new_percent"`
	Strategy   string `json:"strategy"`
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
