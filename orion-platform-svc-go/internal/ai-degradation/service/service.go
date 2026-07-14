package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-degradation/models"
	"orion/platform-svc-go/internal/ai-degradation/repository"
)

var (
	ErrConfigNotFound = errors.New("config not found")
	ErrConfigDisabled = errors.New("config disabled")
	ErrInvalidRequest = errors.New("invalid request")
)

type DegradationService struct {
	repo *repository.Repository
}

func NewDegradationService(repo *repository.Repository) *DegradationService {
	return &DegradationService{repo: repo}
}

// CreateConfig creates a new degradation configuration.
func (s *DegradationService) CreateConfig(ctx context.Context, tenantID string, req models.CreateDegradationConfigRequest) (*models.DegradationConfig, error) {
	triggersJSON, err := jsonSlice(req.Triggers)
	if err != nil {
		return nil, fmt.Errorf("marshal triggers: %w", err)
	}
	actionsJSON, err := jsonSlice(req.Actions)
	if err != nil {
		return nil, fmt.Errorf("marshal actions: %w", err)
	}
	recoveryJSON, err := jsonSlice(req.Recovery)
	if err != nil {
		return nil, fmt.Errorf("marshal recovery: %w", err)
	}
	metadataJSON, err := jsonSlice(req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	config := &models.DegradationConfig{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ServiceName: req.ServiceName,
		Strategy:    req.Strategy,
		Triggers:    triggersJSON,
		Actions:     actionsJSON,
		Recovery:    recoveryJSON,
		Metadata:    metadataJSON,
		Enabled:     enabled,
	}

	if err := s.repo.CreateConfig(ctx, config); err != nil {
		return nil, err
	}
	return config, nil
}

// GetConfig retrieves a degradation configuration by ID.
func (s *DegradationService) GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	config, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("config not found: %w", ErrConfigNotFound)
		}
		return nil, err
	}
	return config, nil
}

// ListConfigs lists degradation configurations with filtering and pagination.
func (s *DegradationService) ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error) {
	return s.repo.ListConfigs(ctx, tenantID, q)
}

// UpdateConfig updates a degradation configuration.
func (s *DegradationService) UpdateConfig(ctx context.Context, tenantID, configID string, req models.UpdateDegradationConfigRequest) (*models.DegradationConfig, error) {
	var triggersJSON *string
	var actionsJSON *string
	var recoveryJSON *string
	var metadataJSON *string

	if req.Triggers != nil {
		b, err := jsonSlice(*req.Triggers)
		if err != nil {
			return nil, fmt.Errorf("marshal triggers: %w", err)
		}
		triggersJSON = &b
	}
	if req.Actions != nil {
		b, err := jsonSlice(*req.Actions)
		if err != nil {
			return nil, fmt.Errorf("marshal actions: %w", err)
		}
		actionsJSON = &b
	}
	if req.Recovery != nil {
		b, err := jsonSlice(req.Recovery)
		if err != nil {
			return nil, fmt.Errorf("marshal recovery: %w", err)
		}
		recoveryJSON = &b
	}
	if req.Metadata != nil {
		b, err := jsonSlice(*req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("marshal metadata: %w", err)
		}
		metadataJSON = &b
	}

	config, err := s.repo.UpdateConfig(ctx, tenantID, configID,
		req.Name, req.Description, triggersJSON, actionsJSON, recoveryJSON, metadataJSON)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// DeleteConfig deletes a degradation configuration and its history.
func (s *DegradationService) DeleteConfig(ctx context.Context, tenantID, configID string) error {
	return s.repo.DeleteConfig(ctx, tenantID, configID)
}

// EnableConfig enables a degradation configuration.
func (s *DegradationService) EnableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	_, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}
	return s.repo.UpdateConfigStatus(ctx, tenantID, configID, true, models.StatusActive)
}

// DisableConfig disables a degradation configuration.
func (s *DegradationService) DisableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	_, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}
	return s.repo.UpdateConfigStatus(ctx, tenantID, configID, false, models.StatusInactive)
}

// TriggerDegradation manually triggers degradation for a config.
func (s *DegradationService) TriggerDegradation(ctx context.Context, tenantID, configID string, req models.TriggerDegradationRequest) (*models.DegradationHistory, error) {
	config, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}
	if !config.Enabled {
		return nil, fmt.Errorf("degradation config is disabled: %w", ErrConfigDisabled)
	}

	// Update config to triggered
	triggeredAt := now()
	if err := s.repo.UpdateConfigTriggered(ctx, tenantID, configID, triggeredAt); err != nil {
		return nil, err
	}

	// Create history record
	duration := int64(config.RecoveryConfigStruct().RecoveryTimeout)
	if req.Duration != nil {
		duration = *req.Duration
	}
	actionsJSON, _ := jsonSlice(config.ActionNames())

	history := &models.DegradationHistory{
		ConfigID:         configID,
		TriggeredAt:      triggeredAt,
		TriggerType:      models.ConditionManual,
		TriggerValue:     1.0,
		TriggerThreshold: 0.0,
		Duration:         duration,
		Status:           models.HistoryStatusTriggered,
		Actions:          actionsJSON,
		TenantID:         tenantID,
	}
	if err := s.repo.CreateHistory(ctx, history); err != nil {
		return nil, err
	}
	return history, nil
}

// RecoverService recovers a degraded service.
func (s *DegradationService) RecoverService(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	_, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}

	// Update config to inactive
	if err := s.repo.UpdateConfigRecovered(ctx, tenantID, configID); err != nil {
		return nil, err
	}

	// Mark latest history as recovered
	history, err := s.repo.GetLatestTriggeredHistory(ctx, tenantID, configID)
	if err == nil && history != nil {
		recoveredAt := now()
		_ = s.repo.UpdateHistoryRecovered(ctx, tenantID, history.ID, recoveredAt)
	}

	return s.repo.GetConfig(ctx, tenantID, configID)
}

// GetHistory retrieves degradation history for a config.
func (s *DegradationService) GetHistory(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error) {
	// Verify config exists
	_, err := s.repo.GetConfig(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}
	return s.repo.GetHistoryList(ctx, tenantID, configID, q)
}

// GetGlobalStatus returns the global degradation status.
func (s *DegradationService) GetGlobalStatus(ctx context.Context, tenantID string) (*models.GlobalDegradationStatus, error) {
	summaries, err := s.repo.GetServiceSummary(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	activeConfigs, err := s.repo.CountActiveConfigs(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	totalConfigs, err := s.repo.CountTotalConfigs(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	recentTriggers, err := s.repo.SumTriggerCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	services := make([]models.ServiceStatusEntry, len(summaries))
	for i, s := range summaries {
		status := models.ServiceHealthy
		if s.ActiveDegradations > 0 {
			status = models.ServiceDegraded
		}
		services[i] = models.ServiceStatusEntry{
			Name:               s.ServiceName,
			Status:             status,
			ActiveDegradations: s.ActiveDegradations,
			LastIncident:       s.LastIncident,
		}
	}

	systemHealth := "healthy"
	degradedCount := 0
	for _, svc := range services {
		if svc.Status == models.ServiceDegraded {
			degradedCount++
		}
	}
	if degradedCount > 0 {
		if degradedCount > len(services)/2 {
			systemHealth = "critical"
		} else {
			systemHealth = "warning"
		}
	}

	return &models.GlobalDegradationStatus{
		Services:       services,
		ActiveConfigs:  activeConfigs,
		TotalConfigs:   totalConfigs,
		RecentTriggers: recentTriggers,
		SystemHealth:   systemHealth,
	}, nil
}

// --- Helpers ---

func now() int64 {
	return time.Now().UTC().Unix()
}

func jsonSlice(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
