package aggregates

import (
	"time"
	"orion/platform-svc-go/internal/domain/events"
)

// ApprovalAggregate represents the Approval aggregate root.
type ApprovalAggregate struct {
	BaseAggregate
	ApprovalType string            `json:"approvalType"`
	Status       string            `json:"status"` // PENDING/APPROVED/REJECTED/CANCELLED
	TotalLevels  int               `json:"totalLevels"`
	CurrentLevel int               `json:"currentLevel"`
	Approvals    []ApprovalLevel  `json:"approvals"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

// ApprovalLevel represents a single approval level in the chain.
type ApprovalLevel struct {
	LevelID      string     `json:"levelId"`
	Order        int        `json:"order"`
	Status       string     `json:"status"` // PENDING/APPROVED/REJECTED
	ApproverID   string     `json:"approverId"`
	ApprovedAt   *time.Time `json:"approvedAt"`
	RejectedAt   *time.Time `json:"rejectedAt"`
	Comment      string     `json:"comment"`
}

// CreateApproval creates a ApprovalCreatedEvent.
func (a *ApprovalAggregate) CreateApproval() events.DomainEvent {
	a.Status = "PENDING"
	a.CreatedAt = time.Now().UTC()
	return &events.ApprovalCreatedEvent{
		ApprovalType: a.ApprovalType,
		TotalLevels:  a.TotalLevels,
	}
}

// ApproveLevel creates an ApprovalLevelApprovedEvent.
func (a *ApprovalAggregate) ApproveLevel(levelID, approverID, comment string) events.DomainEvent {
	level := a.findLevel(levelID)
	if level == nil || level.Status != "PENDING" {
		return nil
	}
	now := time.Now().UTC()
	level.Status = "APPROVED"
	level.ApproverID = approverID
	level.ApprovedAt = &now
	level.Comment = comment
	a.CurrentLevel = level.Order
	a.UpdatedAt = now

	// Check if all levels approved
	allApproved := true
	for _, l := range a.Approvals {
		if l.Status != "APPROVED" {
			allApproved = false
			break
		}
	}
	if allApproved {
		a.Status = "APPROVED"
		return &events.ApprovalCompletedEvent{
			ApprovalType: a.ApprovalType,
			TotalLevels:  a.TotalLevels,
		}
	}
	return &events.ApprovalLevelApprovedEvent{
		LevelID:   levelID,
		ApproverID: approverID,
		Level:     level.Order,
	}
}

// RejectLevel creates an ApprovalLevelRejectedEvent.
func (a *ApprovalAggregate) RejectLevel(levelID, approverID, comment string) events.DomainEvent {
	level := a.findLevel(levelID)
	if level == nil || level.Status != "PENDING" {
		return nil
	}
	now := time.Now().UTC()
	level.Status = "REJECTED"
	level.ApproverID = approverID
	level.RejectedAt = &now
	level.Comment = comment
	a.Status = "REJECTED"
	a.UpdatedAt = now
	return &events.ApprovalLevelRejectedEvent{
		LevelID:    levelID,
		ApproverID: approverID,
		Level:      level.Order,
		Comment:    comment,
	}
}

// Apply applies a domain event to the Approval aggregate state.
func (a *ApprovalAggregate) Apply(e events.DomainEvent) {
	switch ev := e.(type) {
	case *events.ApprovalCreatedEvent:
		a.Status = "PENDING"
	case *events.ApprovalLevelApprovedEvent:
		// Update level status
	case *events.ApprovalLevelRejectedEvent:
		// Update level status
	case *events.ApprovalCompletedEvent:
		a.Status = "APPROVED"
	case *events.ApprovalCancelledEvent:
		a.Status = "CANCELLED"
	}
}

func (a *ApprovalAggregate) findLevel(levelID string) *ApprovalLevel {
	for i := range a.Approvals {
		if a.Approvals[i].LevelID == levelID {
			return &a.Approvals[i]
		}
	}
	return nil
}
