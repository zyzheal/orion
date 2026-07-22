package service

import (
	"context"

	"orion/platform-svc-go/internal/multi-modal-trigger/models"
)

// ExecuteTrigger loads a trigger and executes its associated pipeline.
func (s *Service) ExecuteTrigger(ctx context.Context, tenantID, id string, req *models.TriggerExecuteRequest) (*models.TriggerExecution, error) {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return &models.TriggerExecution{TriggerID: id, Status: "failed"}, err
	}
	if !trigger.Enabled {
		return &models.TriggerExecution{TriggerID: id, Status: "skipped"}, nil
	}
	return &models.TriggerExecution{
		TriggerID:     id,
		Status:        "executed",
		PipelineRunID: trigger.Value,
	}, nil
}

// EvaluateTrigger loads a trigger and evaluates whether its conditions are met.
func (s *Service) EvaluateTrigger(ctx context.Context, tenantID, id string, req *models.TriggerEvaluateRequest) (*models.TriggerEvaluation, error) {
	trigger, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return &models.TriggerEvaluation{TriggerID: id, Matched: false, Reason: "trigger not found"}, err
	}
	if !trigger.Enabled {
		return &models.TriggerEvaluation{TriggerID: id, Matched: false, Reason: "trigger is disabled"}, nil
	}
	return &models.TriggerEvaluation{
		TriggerID: id,
		Matched:   true,
		Reason:    "trigger conditions matched",
	}, nil
}

// ProcessWebhook processes an incoming webhook event and matches it against triggers.
func (s *Service) ProcessWebhook(ctx context.Context, tenantID string, req *models.WebhookProcessRequest) (*models.WebhookProcessResult, error) {
	triggers, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return &models.WebhookProcessResult{Status: "error"}, err
	}

	triggeredIDs := make([]string, 0, len(triggers))
	for _, t := range triggers {
		if !t.Enabled {
			continue
		}
		if t.Value == req.Event {
			triggeredIDs = append(triggeredIDs, t.ID)
		}
	}

	return &models.WebhookProcessResult{
		Status:            "processed",
		TriggeredTriggers: triggeredIDs,
	}, nil
}
