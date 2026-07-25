package event

import (
	"fmt"
	"time"
)

// EventType identifies the kind of alert lifecycle event.
type EventType string

const (
	EventTypeAlert       EventType = "alert"
	EventTypeAcknowledged EventType = "acknowledged"
	EventTypeResolved    EventType = "resolved"
	EventTypeEscalated   EventType = "escalated"
	EventTypeSuppressed  EventType = "suppressed"
)

// ValidEventType returns true if the given string is a recognized event type.
func ValidEventType(t EventType) bool {
	switch t {
	case EventTypeAlert, EventTypeAcknowledged, EventTypeResolved,
		EventTypeEscalated, EventTypeSuppressed:
		return true
	}
	return false
}

// BaseEvent is the common envelope shared by all alert lifecycle events.
type BaseEvent struct {
	EventID   string    `json:"eventId"`
	EventType EventType `json:"eventType"`
	TenantID  string    `json:"tenantId"`
	AlertID   string    `json:"alertId"`
	GroupID   string    `json:"groupId,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"`     // adapter or system that generated the event
	Actor     string    `json:"actor,omitempty"`   // user or system that triggered this lifecycle transition
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// AlertEvent represents a newly fired alert entering the pipeline.
type AlertEvent struct {
	BaseEvent `json:",inline"`

	Name        string            `json:"name"`
	Severity    string            `json:"severity"`     // critical, warning, info
	Status      string            `json:"status"`       // firing, resolved, suppressed
	Fingerprint string            `json:"fingerprint"`
	SourceType  string            `json:"sourceType"`
	SourceID    string            `json:"sourceId"`
	SourceName  string            `json:"sourceName"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Value       float64           `json:"value"`
	Threshold   float64           `json:"threshold"`
	Metric      string            `json:"metric"`
}

// AcknowledgedEvent records that a human has acknowledged an alert.
type AcknowledgedEvent struct {
	BaseEvent `json:",inline"`

	AckedBy   string    `json:"ackedBy"`
	AckedAt   time.Time `json:"ackedAt"`
	Notes     string    `json:"notes,omitempty"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"` // auto-resolve after expiry
}

// ResolvedEvent records that an alert has been resolved.
type ResolvedEvent struct {
	BaseEvent `json:",inline"`

	ResolvedBy  string    `json:"resolvedBy"`
	ResolvedAt  time.Time `json:"resolvedAt"`
	Resolution  string    `json:"resolution"`     // manual, auto, expired
	RunbookRef  string    `json:"runbookRef,omitempty"`
}

// EscalatedEvent records that an alert was escalated to a higher severity or team.
type EscalatedEvent struct {
	BaseEvent `json:",inline"`

	PreviousSeverity string    `json:"previousSeverity"`
	NewSeverity      string    `json:"newSeverity"`
	PreviousTarget   string    `json:"previousTarget,omitempty"`
	NewTarget        string    `json:"newTarget"`
	EscalatedAt      time.Time `json:"escalatedAt"`
	EscalatedBy      string    `json:"escalatedBy"`
	Reason           string    `json:"reason"`
}

// SuppressedEvent records that an alert was suppressed (maintenance window, known issue, silence).
type SuppressedEvent struct {
	BaseEvent `json:",inline"`

	SuppressedBy  string    `json:"suppressedBy"`
	SuppressedAt  time.Time `json:"suppressedAt"`
	SuppressionType string  `json:"suppressionType"` // maintenance-window, known-issue, silence
	Reason        string    `json:"reason"`
	ExpiresAt     *time.Time `json:"expiresAt,omitempty"`
}

// Validate ensures required fields are present for each event type.
func (e *AlertEvent) Validate() error {
	if e.BaseEvent.TenantID == "" {
		return fmt.Errorf("alert event: tenantId is required")
	}
	if e.BaseEvent.AlertID == "" {
		return fmt.Errorf("alert event: alertId is required")
	}
	if e.Name == "" {
		return fmt.Errorf("alert event: name is required")
	}
	if !ValidEventType(e.BaseEvent.EventType) {
		e.BaseEvent.EventType = EventTypeAlert
	}
	if e.Labels == nil {
		e.Labels = make(map[string]string)
	}
	if e.Annotations == nil {
		e.Annotations = make(map[string]string)
	}
	return nil
}

func (e *AcknowledgedEvent) Validate() error {
	if e.BaseEvent.TenantID == "" {
		return fmt.Errorf("acknowledged event: tenantId is required")
	}
	if e.BaseEvent.AlertID == "" {
		return fmt.Errorf("acknowledged event: alertId is required")
	}
	if e.AckedBy == "" {
		return fmt.Errorf("acknowledged event: ackedBy is required")
	}
	if e.BaseEvent.EventType == "" {
		e.BaseEvent.EventType = EventTypeAcknowledged
	}
	return nil
}

func (e *ResolvedEvent) Validate() error {
	if e.BaseEvent.TenantID == "" {
		return fmt.Errorf("resolved event: tenantId is required")
	}
	if e.BaseEvent.AlertID == "" {
		return fmt.Errorf("resolved event: alertId is required")
	}
	if e.ResolvedBy == "" {
		return fmt.Errorf("resolved event: resolvedBy is required")
	}
	if e.BaseEvent.EventType == "" {
		e.BaseEvent.EventType = EventTypeResolved
	}
	return nil
}

func (e *EscalatedEvent) Validate() error {
	if e.BaseEvent.TenantID == "" {
		return fmt.Errorf("escalated event: tenantId is required")
	}
	if e.BaseEvent.AlertID == "" {
		return fmt.Errorf("escalated event: alertId is required")
	}
	if e.NewTarget == "" {
		return fmt.Errorf("escalated event: newTarget is required")
	}
	if e.BaseEvent.EventType == "" {
		e.BaseEvent.EventType = EventTypeEscalated
	}
	return nil
}

func (e *SuppressedEvent) Validate() error {
	if e.BaseEvent.TenantID == "" {
		return fmt.Errorf("suppressed event: tenantId is required")
	}
	if e.BaseEvent.AlertID == "" {
		return fmt.Errorf("suppressed event: alertId is required")
	}
	if e.SuppressionType == "" {
		e.SuppressionType = "manual"
	}
	if e.BaseEvent.EventType == "" {
		e.BaseEvent.EventType = EventTypeSuppressed
	}
	return nil
}

// CorrelationKey returns a tenant-scoped key used for event deduplication and
// timeline correlation.
func (b *BaseEvent) CorrelationKey() string {
	return fmt.Sprintf("%s/%s/%s", b.TenantID, b.GroupID, b.AlertID)
}
