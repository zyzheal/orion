package events

import (
	"encoding/json"
    "fmt"

    "orion/platform-svc-go/internal/sla-engine/models"
)

// ViolationAlert is the domain event published when an SLA violation is detected.
type ViolationAlert struct {
	Type        string            `json:"type"`
	TenantID    string            `json:"tenant_id"`
	TrackerID   string            `json:"tracker_id"`
	TargetID    string            `json:"target_id"`
	TargetType  string            `json:"target_type"`
	Severity    models.SeverityLevel `json:"severity"`
	ViolationType string          `json:"violation_type"`
	Message     string            `json:"message"`
	OverdueMs   int64             `json:"overdue_ms"`
}

// NewViolationAlert creates a new alert event for the given violation.
func NewViolationAlert(v *models.SLAViolation, targetID, targetType string) *ViolationAlert {
	var msg string
	switch v.ViolationType {
	case "response":
		msg = fmt.Sprintf("SLA response deadline exceeded for %s %s: %dms overdue",
			targetType, targetID, v.OverdueMs)
	case "resolution":
		msg = fmt.Sprintf("SLA resolution deadline exceeded for %s %s: %dms overdue",
			targetType, targetID, v.OverdueMs)
	default:
		msg = fmt.Sprintf("SLA violation for %s %s: %s",
			targetType, targetID, v.ViolationType)
	}
	return &ViolationAlert{
		Type:          "sla.violation",
		TenantID:      v.TenantID,
		TrackerID:     v.TrackerID,
		TargetID:      targetID,
		TargetType:    targetType,
		Severity:      v.Severity,
		ViolationType: v.ViolationType,
		Message:       msg,
		OverdueMs:     v.OverdueMs,
	}
}

// MarshalJSON returns the alert as JSON bytes for publishing to event buses.
func (a *ViolationAlert) MarshalJSON() ([]byte, error) {
	return json.Marshal(a)
}
