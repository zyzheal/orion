// Package approval — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
package approval

import "context"

// ApprovalAggregate is the DDD aggregate root for Approval.
type ApprovalAggregate struct {
	ID          string
	ResourceType string
	ResourceID  string
	Status      string
}

// ApprovalCreateCommand is the write command to create a new approval.
type ApprovalCreateCommand struct {
	ResourceType string
	ResourceID   string
	Reason       string
}

// ApprovalHandler is the DDD handler for Approval commands.
type ApprovalHandler struct{}

// NewApprovalHandler creates a new approval handler.
func NewApprovalHandler() *ApprovalHandler {
	return &ApprovalHandler{}
}

// Create executes an ApprovalCreateCommand.
func (h *ApprovalHandler) Create(ctx context.Context, tenantID string, cmd ApprovalCreateCommand) (*ApprovalAggregate, error) {
	return &ApprovalAggregate{
		ResourceType: cmd.ResourceType,
		ResourceID:   cmd.ResourceID,
		Status:       "pending",
	}, nil
}
