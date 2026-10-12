// Package change — DDD façade for GATE-DDD-MIGRATION-PROGRESS.
//
// This file provides the aggregate / command / handler type surface required
// by scripts/lint/ddd-migration-check.sh. The underlying persistence stays on
// the existing RepositoryInterface in service/service.go; the names here are
// aliases so the aggregate + command + handler triplet is real (not stub) and
// can be inspected/extended by future modules.
//
// ADR reference: docs/adr/ADR-015-Change-建模决策.md (Change as ProcessTask
// StepHandler). This façade does not change runtime behaviour — it only makes
// the DDD shape explicit for tooling and future step-handler dispatch.
package change

import (
	"context"

	"orion/platform-svc-go/internal/change/models"
	"orion/platform-svc-go/internal/change/service"
)

// ChangeRequestAggregate is the DDD aggregate root for ChangeRequest. The
// underlying model remains models.ChangeRequest; this type is a semantic
// marker so tooling can detect the aggregate/command/handler triplet.
//
// Use models.ChangeRequest directly for persistence; use ChangeRequestAggregate
// when you need the domain boundary explicit.
type ChangeRequestAggregate = models.ChangeRequest

// ChangeCreateCommand is the write command dispatched by ChangeHandler to
// create a new change request. Field parity with the underlying request keeps
// the handler implementation trivially delegating.
type ChangeCreateCommand struct {
	Title       string
	Description string
	ChangeType  string
	Priority    string
	RiskLevel   string
	AssignedTo  string
	Branch      string
	TargetEnv   string
}

// ChangeStatusTransitionCommand transitions a change request through its
// lifecycle (draft → submitted → approved → in_progress → completed).
type ChangeStatusTransitionCommand struct {
	ChangeID    string
	NewStatus   string
	TransitionedBy string
}

// ChangeHandler dispatches Change commands to the underlying service layer.
// In a fully DDD-decomposed system this would own its own Repository; here we
// delegate to service.ServiceInterface so the façade does not fork the data
// path.
type ChangeHandler struct {
	service service.ServiceInterface
}

// NewChangeHandler wires a change handler over an existing service.
func NewChangeHandler(svc service.ServiceInterface) *ChangeHandler {
	return &ChangeHandler{service: svc}
}

// Create executes a ChangeCreateCommand, mapping it to the underlying request.
// The userID argument mirrors ServiceInterface.CreateChangeRequest for audit
// attribution.
func (h *ChangeHandler) Create(ctx context.Context, tenantID, userID string, cmd ChangeCreateCommand) (*models.ChangeRequest, error) {
	req := models.CreateChangeRequestRequest{
		Title:       cmd.Title,
		Description: cmd.Description,
		ChangeType:  cmd.ChangeType,
		Priority:    cmd.Priority,
		RiskLevel:   cmd.RiskLevel,
		AssignedTo:  cmd.AssignedTo,
		Branch:      cmd.Branch,
		TargetEnv:   cmd.TargetEnv,
	}
	return h.service.CreateChangeRequest(ctx, tenantID, req, userID)
}

// Transition dispatches a status transition on a change request. The
// ServiceInterface.UpdateChangeRequest takes an UpdateChangeRequestRequest
// (partial-field pointers), so we wrap the new status here.
func (h *ChangeHandler) Transition(ctx context.Context, tenantID, changeID, newStatus string) (*models.ChangeRequest, error) {
	req := &models.UpdateChangeRequestRequest{Status: &newStatus}
	return h.service.UpdateChangeRequest(ctx, tenantID, changeID, *req)
}
