package models

import "time"

// SeverityLevel defines the severity tiers for ITSM SLA management.
type SeverityLevel string

const (
	SeverityP0 SeverityLevel = "P0" // Critical: immediate response required
	SeverityP1 SeverityLevel = "P1" // High: response within 1 hour
	SeverityP2 SeverityLevel = "P2" // Medium: response within 4 hours
	SeverityP3 SeverityLevel = "P3" // Low: response within 24 hours
)

// IsValid returns true if the severity is a recognized ITSM tier.
func (s SeverityLevel) IsValid() bool {
	switch s {
	case SeverityP0, SeverityP1, SeverityP2, SeverityP3:
		return true
	}
	return false
}

// SLAViolation records a single SLA breach event for a tracked entity.
type SLAViolation struct {
	ID           string        `json:"id" db:"id"`
	TenantID     string        `json:"tenant_id" db:"tenant_id"`
	TrackerID    string        `json:"tracker_id" db:"tracker_id"`
	Severity     SeverityLevel `json:"severity" db:"severity"`
	ViolationType string      `json:"violation_type" db:"violation_type"` // "response", "resolution"
	ViolatedAt   time.Time     `json:"violated_at" db:"violated_at"`
	Deadline     time.Time     `json:"deadline" db:"deadline"`
	ActualTime   time.Time     `json:"actual_time" db:"actual_time"`
	OverdueMs    int64         `json:"overdue_ms" db:"overdue_ms"`
	Details      string        `json:"details" db:"details"`
	Notified     bool          `json:"notified" db:"notified"`
	NotifiedAt   *time.Time    `json:"notified_at,omitempty" db:"notified_at"`
	CreatedAt    time.Time     `json:"created_at" db:"created_at"`
}

// SlaComplianceReport holds compliance metrics for a tenant over a period.
type SlaComplianceReport struct {
	ReportID        string        `json:"report_id"`
	TenantID        string        `json:"tenant_id"`
	StartDate       time.Time     `json:"start_date"`
	EndDate         time.Time     `json:"end_date"`
	Severity        SeverityLevel `json:"severity"`
	TotalEvents     int           `json:"total_events"`
	MetCount        int           `json:"met_count"`
	ViolationCount  int           `json:"violation_count"`
	CompliancePct   float64       `json:"compliance_pct"`
	ResponseBreach  int           `json:"response_breach"`
	ResolutionBreach int          `json:"resolution_breach"`
	GeneratedAt     time.Time     `json:"generated_at"`
}
