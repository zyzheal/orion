package eventbus

import "time"

// EventType defines the type of event published on the bus.
type EventType string

const (
	// Alert events
	EventAlertTriggered EventType = "alert.triggered"
	EventAlertResolved  EventType = "alert.resolved"

	// Pipeline events
	EventPipelineStarted   EventType = "pipeline.started"
	EventPipelineCompleted EventType = "pipeline.completed"
	EventPipelineFailed    EventType = "pipeline.failed"

	// Incident events
	EventIncidentCreated EventType = "incident.created"
	EventIncidentUpdated EventType = "incident.updated"

	// Change management events
	EventChangeApproved EventType = "change.approved"
	EventChangeRejected EventType = "change.rejected"

	// CMDB events
	EventCIRDUpdated EventType = "cmdb.updated"

	// Approval events
	EventApprovalSubmitted EventType = "approval.submitted"
	EventApprovalApproved  EventType = "approval.approved"

	// Deployment events
	EventDeploymentStarted EventType = "deployment.started"
	EventDeploymentFailed  EventType = "deployment.failed"

	// ChatOps events
	EventChatOpsMessage EventType = "chatops.message"
)

// StandardEvent is the canonical event envelope used across all Orion modules.
type StandardEvent struct {
	ID            string            `json:"id"`
	Type          EventType         `json:"type"`
	Source        string            `json:"source"`
	TenantID      string            `json:"tenantId"`
	Timestamp     time.Time         `json:"timestamp"`
	Payload       map[string]any    `json:"payload"`
	Metadata      map[string]string `json:"metadata"`
	Version       string            `json:"version"`
	CorrelationID string            `json:"correlationId"`
}

// NewStandardEvent creates a StandardEvent with sensible defaults.
func NewStandardEvent(eventType EventType, source string, tenantID string, payload map[string]any) StandardEvent {
	return StandardEvent{
		Type:      eventType,
		Source:    source,
		TenantID:  tenantID,
		Timestamp: time.Now().UTC(),
		Payload:   payload,
		Metadata:  make(map[string]string),
		Version:   "1.0.0",
	}
}
