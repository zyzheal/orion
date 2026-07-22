package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/deploy-enhanced/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CheckWindowActive(ctx context.Context, tenantID string, environmentID string) (bool, error)
	CreateEmergencyDeploy(ctx context.Context, ed *models.EmergencyDeploy) error
	CreateProgressiveDeploy(ctx context.Context, pd *models.ProgressiveDeploy) error
	CreateWindow(ctx context.Context, w *models.DeployWindow) error
	DeleteWindow(ctx context.Context, id string, tenantID string) (bool, error)
	GetEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error)
	GetProgressiveDeploy(ctx context.Context, id string, tenantID string) (*models.ProgressiveDeploy, error)
	GetWindowByID(ctx context.Context, id string, tenantID string) (*models.DeployWindow, error)
	ListEmergencyDeploys(ctx context.Context, tenantID string, status *string) ([]models.EmergencyDeploy, error)
	ListWindows(ctx context.Context, tenantID string, environmentID *string, status *string) ([]models.DeployWindow, error)
	UpdateEmergencyDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.EmergencyDeploy, error)
	UpdateProgressiveDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ProgressiveDeploy, error)
	UpdateWindow(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.DeployWindow, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Deploy Windows ---

func (s *Service) ListWindows(ctx context.Context, tenantID string, environmentID *string, status *string) ([]models.DeployWindow, int, error) {
	windows, err := s.repo.ListWindows(ctx, tenantID, environmentID, status)
	if err != nil {
		return nil, 0, err
	}
	if windows == nil {
		windows = []models.DeployWindow{}
	}
	return windows, len(windows), nil
}

func (s *Service) GetWindow(ctx context.Context, id string, tenantID string) (*models.DeployWindow, error) {
	w, err := s.repo.GetWindowByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrWindowNotFound
		}
		return nil, err
	}
	return w, nil
}

func (s *Service) CreateWindow(ctx context.Context, req *models.CreateDeployWindowRequest, tenantID string) (*models.DeployWindow, error) {
	dur := 60
	if req.DurationMinutes != nil {
		dur = *req.DurationMinutes
	}
	timezone := "Asia/Shanghai"
	if req.Timezone != nil {
		timezone = *req.Timezone
	}
	w := &models.DeployWindow{
		TenantID:        tenantID,
		Name:            req.Name,
		EnvironmentID:   &req.EnvironmentID,
		CronExpression:  &req.CronExpression,
		DurationMinutes: dur,
		Timezone:        timezone,
	}
	if err := s.repo.CreateWindow(ctx, w); err != nil {
		return nil, err
	}
	return s.repo.GetWindowByID(ctx, w.ID, tenantID)
}

func (s *Service) UpdateWindow(ctx context.Context, id string, req *models.UpdateDeployWindowRequest, tenantID string) (*models.DeployWindow, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.CronExpression != nil {
		updates["cron_expression"] = *req.CronExpression
	}
	if req.DurationMinutes != nil {
		updates["duration_minutes"] = *req.DurationMinutes
	}
	if req.Timezone != nil {
		updates["timezone"] = *req.Timezone
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return s.repo.UpdateWindow(ctx, id, tenantID, updates)
}

func (s *Service) DeleteWindow(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteWindow(ctx, id, tenantID)
}

func (s *Service) CheckWindow(ctx context.Context, id string, tenantID string) (*models.WindowCheckResult, error) {
	w, err := s.GetWindow(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	environmentID := "default"
	if w.EnvironmentID != nil {
		environmentID = *w.EnvironmentID
	}
	active, err := s.repo.CheckWindowActive(ctx, tenantID, environmentID)
	if err != nil {
		return nil, err
	}
	return &models.WindowCheckResult{
		IsActive: active,
		Window:   w,
		Reason: func() string {
			if active {
				return "current time is within the deploy window"
			} else {
				return "current time is outside the deploy window"
			}
		}(),
	}, nil
}

// --- Progressive Deploys ---

func (s *Service) CreateProgressiveDeploy(ctx context.Context, deploymentID string, req *models.CreateProgressiveDeployRequest, tenantID string) (*models.ProgressiveDeploy, error) {
	if len(req.Stages) == 0 {
		return nil, errors.New("stages array is required and must have at least one stage")
	}
	stagesJSON, err := json.Marshal(req.Stages)
	if err != nil {
		return nil, err
	}
	pd := &models.ProgressiveDeploy{
		TenantID:        tenantID,
		DeploymentID:    deploymentID,
		Strategy:        "gradual",
		Stages:          string(stagesJSON),
		RollbackEnabled: true,
	}
	if err := s.repo.CreateProgressiveDeploy(ctx, pd); err != nil {
		return nil, err
	}
	return s.repo.GetProgressiveDeploy(ctx, pd.ID, tenantID)
}

func (s *Service) GetProgress(ctx context.Context, id string, tenantID string) (*models.ProgressiveDeploy, error) {
	pd, err := s.repo.GetProgressiveDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrProgressiveNotFound
		}
		return nil, err
	}
	return pd, nil
}

func (s *Service) AdvanceStage(ctx context.Context, id string, stageID string, validationResult *string, tenantID string) (*models.ProgressiveDeploy, error) {
	pd, err := s.repo.GetProgressiveDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrProgressiveNotFound
		}
		return nil, err
	}
	if stageID != "" {
		// Validate that stageID matches a valid stage in the progressive deploy.
		var stages []models.Stage
		if err := json.Unmarshal([]byte(pd.Stages), &stages); err != nil {
			return nil, errors.New("failed to parse stages")
		}
		for i, st := range stages {
			if st.Name == stageID {
				if i != pd.CurrentStage {
					return nil, errors.New("stage mismatch: cannot advance a non-current stage")
				}
				break
			}
		}
	}
	updates := map[string]interface{}{
		"current_stage": pd.CurrentStage + 1,
	}
	if validationResult != nil {
		updates["status"] = "advanced"
	}
	return s.repo.UpdateProgressiveDeploy(ctx, id, tenantID, updates)
}

func (s *Service) RollbackStage(ctx context.Context, id string, stageID string, reason string, tenantID string) (*models.ProgressiveDeploy, error) {
	pd, err := s.repo.GetProgressiveDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrProgressiveNotFound
		}
		return nil, err
	}
	if !pd.RollbackEnabled {
		return nil, errors.New("rollback is not enabled for this progressive deploy")
	}
	updates := map[string]interface{}{
		"status":          "rolled_back",
		"rollback_stage":  stageID,
		"rollback_reason": reason,
	}
	return s.repo.UpdateProgressiveDeploy(ctx, id, tenantID, updates)
}

// --- Emergency Deploys ---

func (s *Service) RequestEmergencyDeploy(ctx context.Context, req *models.CreateEmergencyDeployRequest, tenantID string) (*models.EmergencyDeploy, error) {
	ed := &models.EmergencyDeploy{
		TenantID:     tenantID,
		DeploymentID: req.DeploymentID,
		Reason:       req.Reason,
		RequestedBy:  req.RequestedBy,
		Status:       "pending",
	}
	if err := s.repo.CreateEmergencyDeploy(ctx, ed); err != nil {
		return nil, err
	}
	return s.repo.GetEmergencyDeploy(ctx, ed.ID, tenantID)
}

func (s *Service) ListEmergencies(ctx context.Context, tenantID string, status *string) ([]models.EmergencyDeploy, int, error) {
	emergencies, err := s.repo.ListEmergencyDeploys(ctx, tenantID, status)
	if err != nil {
		return nil, 0, err
	}
	if emergencies == nil {
		emergencies = []models.EmergencyDeploy{}
	}
	return emergencies, len(emergencies), nil
}

func (s *Service) ApproveEmergencyDeploy(ctx context.Context, id string, approvedBy string, tenantID string) (*models.EmergencyDeploy, error) {
	ed, err := s.GetEmergencyDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrEmergencyNotFound
		}
		return nil, err
	}
	if ed.Status != "pending" {
		return nil, ErrEmergencyInvalidStatus
	}
	updates := map[string]interface{}{
		"status":      "approved",
		"approved_by": approvedBy,
	}
	return s.repo.UpdateEmergencyDeploy(ctx, id, tenantID, updates)
}

func (s *Service) CompleteEmergencyDeploy(ctx context.Context, id string, postMortem *string, tenantID string) (*models.EmergencyDeploy, error) {
	ed, err := s.GetEmergencyDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrEmergencyNotFound
		}
		return nil, err
	}
	if ed.Status != "approved" {
		return nil, ErrEmergencyInvalidStatus
	}
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":      "completed",
		"executed_at": now,
	}
	if postMortem != nil {
		updates["post_mortem"] = *postMortem
	}
	return s.repo.UpdateEmergencyDeploy(ctx, id, tenantID, updates)
}

func (s *Service) RejectEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error) {
	ed, err := s.GetEmergencyDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrEmergencyNotFound
		}
		return nil, err
	}
	if ed.Status != "pending" {
		return nil, ErrEmergencyInvalidStatus
	}
	updates := map[string]interface{}{
		"status": "rejected",
	}
	return s.repo.UpdateEmergencyDeploy(ctx, id, tenantID, updates)
}

func (s *Service) GetEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error) {
	ed, err := s.repo.GetEmergencyDeploy(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrEmergencyNotFound
		}
		return nil, err
	}
	return ed, nil
}

// --- Errors ---

var (
	ErrWindowNotFound         = errors.New("deploy window not found")
	ErrProgressiveNotFound    = errors.New("progressive deploy not found")
	ErrEmergencyNotFound      = errors.New("emergency deploy not found")
	ErrEmergencyInvalidStatus = errors.New("invalid status for emergency deploy")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrWindowNotFound) || errors.Is(err, ErrProgressiveNotFound) || errors.Is(err, ErrEmergencyNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
