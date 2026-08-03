package repository

import (
	"context"

	"orion/platform-svc-go/internal/self-healing/models"

	"github.com/google/uuid"
)

// HealingActionRepository defines the data-access contract for healing-action
// operations used by the service layer.  The concrete *SelfHealingRepository
// implements every method, so this interface can be used as a compile-time
// assertion.
type HealingActionRepository interface {
	CreateHealingAction(ctx context.Context, tenantID uuid.UUID, req *models.CreateHealingActionRequest) (*models.HealingAction, error)
	QueryHealingActions(ctx context.Context, tenantID uuid.UUID, limit, offset int) (models.HealingActionResponse, error)
	GetHealingAction(ctx context.Context, tenantID, id uuid.UUID) (*models.HealingAction, error)
	UpdateHealingAction(ctx context.Context, tenantID, id uuid.UUID, name, description, command *string, isEnabled *bool) (*models.HealingAction, error)
	DeleteHealingAction(ctx context.Context, tenantID, id uuid.UUID) error
	ExecuteHealingAction(ctx context.Context, tenantID, actionID uuid.UUID, triggerID *uuid.UUID, triggeredBy string) (*models.HealingHistory, error)
	UpdateHealingHistory(ctx context.Context, id uuid.UUID, status, result string, attempt int) error
	QueryHealingHistory(ctx context.Context, tenantID uuid.UUID, actionID uuid.UUID, status string, limit, offset int) (models.HealingHistoryResponse, error)
}

// Compile-time assertion that *SelfHealingRepository satisfies the interface.
var _ HealingActionRepository = (*SelfHealingRepository)(nil)
