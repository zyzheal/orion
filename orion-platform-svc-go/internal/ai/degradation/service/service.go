package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"time"

	"orion/platform-svc-go/internal/ai/degradation/models"
	"orion/platform-svc-go/internal/ai/degradation/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountActiveConfigs(ctx context.Context, tenantID string) (int, error)
	CountTotalConfigs(ctx context.Context, tenantID string) (int, error)
	CreateConfig(ctx context.Context, config *models.DegradationConfig) error
	CreateHistory(ctx context.Context, history *models.DegradationHistory) error
	DeleteConfig(ctx context.Context, tenantID, configID string) error
	GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	GetHistoryList(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error)
	GetServiceSummary(ctx context.Context, tenantID string) ([]repository.ServiceSummary, error)
	ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error)
	UpdateConfig(ctx context.Context, tenantID, configID string,
		name *string, description *string, triggers *string, actions *string,
		recovery *string, metadata *string) (*models.DegradationConfig, error)
	UpdateConfigRecovered(ctx context.Context, tenantID, configID string) error
	UpdateConfigStatus(ctx context.Context, tenantID, configID string, enabled bool, status models.DegradationStatus) (*models.DegradationConfig, error)
	UpdateConfigTriggered(ctx context.Context, tenantID, configID string, triggeredAt int64) error
	UpdateHistoryRecovered(ctx context.Context, tenantID, historyID string, recoveredAt int64) error
}

// DegradationService exposes the methods the handler expects.
type DegradationService struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *DegradationService {
	return &DegradationService{repo: repo}
}

func (s *DegradationService) CreateConfig(ctx context.Context, tenantID string, req models.CreateDegradationConfigRequest) (*models.DegradationConfig, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	triggers, _ := json.Marshal(req.Triggers)
	actions, _ := json.Marshal(req.Actions)
	var recovery *models.RecoveryConfig
	if req.Recovery == nil {
		recovery = &models.RecoveryConfig{
			AutoRecover:         true,
			RecoveryTimeout:     60000,
			HealthCheckInterval: 10000,
			MinHealthyDuration:  30000,
		}
	} else {
		recovery = req.Recovery
	}
	rcJSON, _ := json.Marshal(recovery)
	metadata, _ := json.Marshal(req.Metadata)

	config := &models.DegradationConfig{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ServiceName: req.ServiceName,
		Strategy:    req.Strategy,
		Triggers:    string(triggers),
		Actions:     string(actions),
		Recovery:    string(rcJSON),
		Metadata:    string(metadata),
		Enabled:     enabled,
	}
	if err := s.repo.CreateConfig(ctx, config); err != nil {
		return nil, err
	}
	return config, nil
}

func (s *DegradationService) GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	return s.repo.GetConfig(ctx, tenantID, configID)
}

func (s *DegradationService) ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error) {
	return s.repo.ListConfigs(ctx, tenantID, q)
}

func (s *DegradationService) UpdateConfig(ctx context.Context, tenantID, configID string, req models.UpdateDegradationConfigRequest) (*models.DegradationConfig, error) {
	var triggers, actions, recovery, metadata *string
	if req.Triggers != nil {
		b, _ := json.Marshal(*req.Triggers)
		s := string(b)
		triggers = &s
	}
	if req.Actions != nil {
		b, _ := json.Marshal(*req.Actions)
		s := string(b)
		actions = &s
	}
	if req.Recovery != nil {
		b, _ := json.Marshal(*req.Recovery)
		s := string(b)
		recovery = &s
	}
	if req.Metadata != nil {
		b, _ := json.Marshal(*req.Metadata)
		s := string(b)
		metadata = &s
	}
	return s.repo.UpdateConfig(ctx, tenantID, configID, req.Name, req.Description, triggers, actions, recovery, metadata)
}

func (s *DegradationService) DeleteConfig(ctx context.Context, tenantID, configID string) error {
	return s.repo.DeleteConfig(ctx, tenantID, configID)
}

func (s *DegradationService) EnableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	return s.repo.UpdateConfigStatus(ctx, tenantID, configID, true, models.StatusActive)
}

func (s *DegradationService) DisableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	return s.repo.UpdateConfigStatus(ctx, tenantID, configID, false, models.StatusInactive)
}

func (s *DegradationService) TriggerDegradation(ctx context.Context, tenantID, configID string, req models.TriggerDegradationRequest) (*models.DegradationHistory, error) {
	now := time.Now().UTC().Unix()
	if err := s.repo.UpdateConfigTriggered(ctx, tenantID, configID, now); err != nil {
		return nil, err
	}
	history := &models.DegradationHistory{
		ConfigID:     configID,
		TenantID:     tenantID,
		TriggeredAt:  now,
		TriggerType:  models.ConditionManual,
		TriggerValue: 1.0,
		Status:       models.HistoryStatusTriggered,
	}
	duration := int64(0)
	if req.Duration != nil {
		duration = *req.Duration
	}
	history.Duration = duration
	if err := s.repo.CreateHistory(ctx, history); err != nil {
		return nil, err
	}
	return history, nil
}

func (s *DegradationService) RecoverService(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	now := time.Now().UTC().Unix()
	// Mark latest triggered history as recovered
	if err := s.repo.UpdateHistoryRecovered(ctx, tenantID, "", now); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateConfigRecovered(ctx, tenantID, configID); err != nil {
		return nil, err
	}
	return s.repo.GetConfig(ctx, tenantID, configID)
}

func (s *DegradationService) GetHistory(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error) {
	return s.repo.GetHistoryList(ctx, tenantID, configID, q)
}

func (s *DegradationService) GetGlobalStatus(ctx context.Context, tenantID string) (*models.GlobalDegradationStatus, error) {
	activeCount, _ := s.repo.CountActiveConfigs(ctx, tenantID)
	totalCount, _ := s.repo.CountTotalConfigs(ctx, tenantID)
	summaries, _ := s.repo.GetServiceSummary(ctx, tenantID)

	var services []models.ServiceStatusEntry
	for _, s := range summaries {
		status := models.ServiceHealthy
		if s.ActiveDegradations > 0 {
			status = models.ServiceDegraded
		}
		services = append(services, models.ServiceStatusEntry{
			Name:               s.ServiceName,
			Status:             status,
			ActiveDegradations: s.ActiveDegradations,
			LastIncident:       s.LastIncident,
		})
	}

	health := "healthy"
	if activeCount > 0 {
		health = "warning"
	}

	return &models.GlobalDegradationStatus{
		Services:       services,
		ActiveConfigs:  activeCount,
		TotalConfigs:   totalCount,
		RecentTriggers: activeCount,
		SystemHealth:   health,
	}, nil
}
