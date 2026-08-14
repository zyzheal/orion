package service

import (
	"context"
	"orion/platform-svc-go/internal/multi-modal-trigger/models"
)

type ServiceInterface interface {
	ExecuteTrigger(ctx context.Context, tenantID, id string, req *models.TriggerExecuteRequest) (*models.TriggerExecution, error)
	EvaluateTrigger(ctx context.Context, tenantID, id string, req *models.TriggerEvaluateRequest) (*models.TriggerEvaluation, error)
	ProcessWebhook(ctx context.Context, tenantID string, req *models.WebhookProcessRequest) (*models.WebhookProcessResult, error)
	Create(ctx context.Context, tenantID string, req models.CreateMultiModalTriggerRequest) (*models.MultiModalTrigger, error)
	Get(ctx context.Context, tenantID, id string) (*models.MultiModalTrigger, error)
	List(ctx context.Context, tenantID string) ([]models.MultiModalTrigger, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateMultiModalTriggerRequest) (*models.MultiModalTrigger, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var _ ServiceInterface = (*Service)(nil)

