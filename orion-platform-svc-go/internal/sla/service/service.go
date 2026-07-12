package service

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/sla/models"
	"orion/platform-svc-go/internal/sla/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- SLA Definitions ---

func (s *Service) CreateDefinition(ctx context.Context, tenantID string, req models.CreateDefinitionRequest) (*models.SLADefinition, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.TargetValue == 0 {
		return nil, fmt.Errorf("target_value is required")
	}

	def := &models.SLADefinition{
		TenantID: tenantID,
		Name: req.Name,
		Description: req.Description,
		Type: req.Type,
		TargetValue: req.TargetValue,
		TargetUnit: req.TargetUnit,
		Priority: req.Priority,
		Category: req.Category,
		EscalationRules: req.EscalationRules,
		Metadata: req.Metadata,
		CreatedBy: tenantID, // caller ID not available in repo; will be overridden
	}
	if req.BusinessHoursOnly != nil {
		def.BusinessHoursOnly = req.BusinessHoursOnly
	}
	if req.Status == "" {
		req.Status = "active"
		def.Status = req.Status
	}
	if err := s.repo.CreateDefinition(ctx, def); err != nil {
		return nil, err
	}
	return def, nil
}

func (s *Service) GetDefinition(ctx context.Context, tenantID, id string) (*models.SLADefinition, error) {
	d, err := s.repo.GetDefinitionByID(ctx, tenantID, id)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("definition %q not found: %w", id, repository.ErrNotFound)
		}
		return nil, err
	}
	return d, nil
}

func (s *Service) ListDefinitions(ctx context.Context, tenantID string, q models.DefinitionListQuery) (*models.DefinitionListResult, error) {
	items, total, err := s.repo.ListDefinitions(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.DefinitionListResult{
		Definitions: items,
		Total: total,
	}, nil
}

func (s *Service) UpdateDefinition(ctx context.Context, tenantID, id string, req models.UpdateDefinitionRequest) (*models.SLADefinition, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["definition_type"] = *req.Type
	}
	if req.TargetValue != nil {
		updates["target_value"] = *req.TargetValue
	}
	if req.TargetUnit != nil {
		updates["target_unit"] = *req.TargetUnit
	}
	if req.BusinessHoursOnly != nil {
		updates["business_hours_only"] = *req.BusinessHoursOnly
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.EscalationRules != nil {
		updates["escalation_rules"] = *req.EscalationRules
	}
	if req.Metadata != nil {
		updates["metadata"] = *req.Metadata
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return s.repo.GetDefinitionByID(ctx, tenantID, id)
	}
	if err := s.repo.UpdateDefinition(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetDefinitionByID(ctx, tenantID, id)
}

func (s *Service) DeleteDefinition(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteDefinition(ctx, tenantID, id)
}

// --- SLA Tracking ---

func (s *Service) StartTracking(ctx context.Context, tenantID string, req models.StartTrackingRequest) (*models.SLATracking, error) {
	// Verify the SLA definition exists
	_, err := s.repo.GetDefinitionByID(ctx, tenantID, req.DefinitionID)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("sla definition %q not found: %w", req.DefinitionID, repository.ErrNotFound)
		}
		return nil, err
	}

	tracking := &models.SLATracking{
		TenantID: tenantID,
		DefinitionID: req.DefinitionID,
		EntityType: req.EntityType,
		EntityID: req.EntityID,
		TargetTime: req.TargetTime,
		Notes: req.Notes,
	}
	if err := s.repo.CreateTracking(ctx, tracking); err != nil {
		return nil, err
	}
	return tracking, nil
}

func (s *Service) GetTracking(ctx context.Context, tenantID, id string) (*models.SLATracking, error) {
	t, err := s.repo.GetTrackingByID(ctx, tenantID, id)
	if err != nil {
		if repository.IsNotFound(err) {
			return nil, fmt.Errorf("tracking %q not found: %w", id, repository.ErrNotFound)
		}
		return nil, err
	}
	return t, nil
}

func (s *Service) ListTracking(ctx context.Context, tenantID string, q models.TrackingListQuery) (*models.TrackingListResult, error) {
	items, total, err := s.repo.ListTracking(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.TrackingListResult{
		Trackings: items,
		Total: total,
	}, nil
}

func (s *Service) MarkMet(ctx context.Context, tenantID, trackingID string) (*models.SLATracking, error) {
	t, err := s.GetTracking(ctx, tenantID, trackingID)
	if err != nil {
		return nil, err
	}
	if t.Status != "tracking" {
		return nil, fmt.Errorf("tracking must be in 'tracking' status to mark as met: current=%q", t.Status)
	}
	if err := s.repo.MarkMet(ctx, tenantID, trackingID); err != nil {
		return nil, err
	}
	return s.GetTracking(ctx, tenantID, trackingID)
}

func (s *Service) MarkBreached(ctx context.Context, tenantID, trackingID, details string) (*models.SLATracking, error) {
	t, err := s.GetTracking(ctx, tenantID, trackingID)
	if err != nil {
		return nil, err
	}
	if t.Status != "tracking" {
		return nil, fmt.Errorf("tracking must be in 'tracking' status to mark as breached: current=%q", t.Status)
	}
	if err := s.repo.MarkBreached(ctx, tenantID, trackingID, details); err != nil {
		return nil, err
	}
	// Create a breach event
	event := &models.SLABreachEvent{
		TenantID: tenantID,
		TrackingID: trackingID,
		BreachDetails: details,
	}
	_ = s.repo.CreateBreachEvent(ctx, event)
	return s.GetTracking(ctx, tenantID, trackingID)
}

func (s *Service) PauseTracking(ctx context.Context, tenantID, trackingID, reason string) (*models.SLATracking, error) {
	t, err := s.GetTracking(ctx, tenantID, trackingID)
	if err != nil {
		return nil, err
	}
	if t.Status != "tracking" {
		return nil, fmt.Errorf("tracking must be in 'tracking' status to pause: current=%q", t.Status)
	}
	if err := s.repo.PauseTracking(ctx, tenantID, trackingID, reason); err != nil {
		return nil, err
	}
	return s.GetTracking(ctx, tenantID, trackingID)
}

func (s *Service) ResumeTracking(ctx context.Context, tenantID, trackingID string) (*models.SLATracking, error) {
	t, err := s.GetTracking(ctx, tenantID, trackingID)
	if err != nil {
		return nil, err
	}
	if t.Status != "paused" {
		return nil, fmt.Errorf("tracking must be in 'paused' status to resume: current=%q", t.Status)
	}
	if err := s.repo.ResumeTracking(ctx, tenantID, trackingID); err != nil {
		return nil, err
	}
	return s.GetTracking(ctx, tenantID, trackingID)
}

// --- Breach Events ---

func (s *Service) GetBreachEvents(ctx context.Context, trackingID string) ([]models.SLABreachEvent, error) {
	events, err := s.repo.GetBreachEventsByTracking(ctx, trackingID)
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (s *Service) ListBreachEvents(ctx context.Context, tenantID string, limit, offset int) (*models.BreachListResult, error) {
	events, total, err := s.repo.ListBreachEvents(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return &models.BreachListResult{
		Events: events,
		Total: total,
	}, nil
}

// --- Breach Detection ---

func (s *Service) DetectBreaches(ctx context.Context, tenantID string) (*models.DetectionResult, error) {
	updated, created, err := s.repo.DetectBreaches(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.DetectionResult{
		Detected: updated,
		Updated: created,
	}, nil
}

// --- Statistics ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.StatsResult, error) {
	stats, err := s.repo.GetStats(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// --- Helpers ---

func IsNotFound(err error) bool {
	return strings.Contains(err.Error(), "not found")
}

func ErrNotFoundSlaEntity(id string) error {
	return fmt.Errorf("sla entity %q not found: %w", id, repository.ErrNotFound)
}

func (s *Service) UpdateTracking(ctx context.Context, tenantID, id string, req models.UpdateTrackingRequest) (*models.SLATracking, error) {
	// Verify the tracking exists
	_, err := s.GetTracking(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.DefinitionID != nil {
		updates["sla_definition_id"] = *req.DefinitionID
	}
	if req.EntityType != nil {
		updates["entity_type"] = *req.EntityType
	}
	if req.EntityID != nil {
		updates["entity_id"] = *req.EntityID
	}
	if req.TargetTime != nil {
		updates["target_time"] = *req.TargetTime
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.PauseReason != nil {
		updates["pause_reason"] = *req.PauseReason
	}
	if len(updates) == 0 {
		return s.GetTracking(ctx, tenantID, id)
	}
	if err := s.repo.UpdateTracking(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.GetTracking(ctx, tenantID, id)
}
