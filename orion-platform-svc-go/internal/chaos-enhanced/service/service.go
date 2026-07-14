package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/chaos-enhanced/models"
	"orion/platform-svc-go/internal/chaos-enhanced/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Experiments ---

func (s *Service) CreateExperiment(ctx context.Context, req *models.CreateExperimentRequest, tenantID string) (*models.Experiment, error) {
	faultSpec := "{}"
	if req.FaultConfig != "" {
		faultSpec = req.FaultConfig
	} else {
		// Build a minimal fault spec from the fault type.
		spec := map[string]interface{}{"faultType": req.FaultType}
		data, err := json.Marshal(spec)
		if err != nil {
			return nil, errors.New("invalid fault configuration")
		}
		faultSpec = string(data)
	}
	e := &models.Experiment{
		TenantID:      tenantID,
		Name:          req.Name,
		Description:   req.Description,
		EnvironmentID: req.EnvironmentID,
		FaultSpec:     faultSpec,
		TargetID:      req.TargetID,
		CreatedBy:     req.CreatedBy,
	}
	if err := s.repo.CreateExperiment(ctx, e); err != nil {
		return nil, err
	}
	return s.repo.GetExperiment(ctx, e.ID, tenantID)
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string, status *string, environmentID *string) ([]models.Experiment, int, error) {
	experiments, err := s.repo.ListExperiments(ctx, tenantID, status, environmentID)
	if err != nil {
		return nil, 0, err
	}
	if experiments == nil {
		experiments = []models.Experiment{}
	}
	return experiments, len(experiments), nil
}

func (s *Service) GetExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	e, err := s.repo.GetExperiment(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrExperimentNotFound
		}
		return nil, err
	}
	return e, nil
}

func (s *Service) StartExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	updates := map[string]interface{}{"status": "running"}
	return s.repo.UpdateExperiment(ctx, id, tenantID, updates)
}

func (s *Service) StopExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	updates := map[string]interface{}{"status": "stopped"}
	return s.repo.UpdateExperiment(ctx, id, tenantID, updates)
}

func (s *Service) GetExperimentStatus(ctx context.Context, id string, tenantID string) (*ExperimentStatus, error) {
	e, err := s.GetExperiment(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &ExperimentStatus{
		ID:     e.ID,
		Status: e.Status,
	}, nil
}

func (s *Service) GetExperimentRecovery(ctx context.Context, id string, tenantID string) (*ExperimentRecovery, error) {
	e, err := s.GetExperiment(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	recovery := "not_available"
	if e.RecoveryInfo != nil {
		recovery = *e.RecoveryInfo
	}
	return &ExperimentRecovery{
		ExperimentID: id,
		Status:       e.Status,
		Recovery:     recovery,
	}, nil
}

func (s *Service) InjectFault(ctx context.Context, experimentID string, tenantID string, faultType string, faultConfig string) (*models.FaultInjection, error) {
	fi := &models.FaultInjection{
		ExperimentID: experimentID,
		TenantID:     tenantID,
		FaultType:    faultType,
		FaultConfig:  faultConfig,
	}
	if err := s.repo.CreateFaultInjection(ctx, fi); err != nil {
		return nil, err
	}
	return fi, nil
}

// --- Fault Library ---

// AvailableFaultTypes returns the list of supported fault types.
func (s *Service) AvailableFaultTypes() []string {
	return []string{
		"network_latency",
		"service_down",
		"cpu_stress",
		"memory_stress",
		"disk_full",
	}
}

// FaultConfigTemplate returns the config template for a given fault type.
func (s *Service) FaultConfigTemplate(faultType string) map[string]interface{} {
	templates := map[string]map[string]interface{}{
		"network_latency": {"latency_ms": 100, "jitter_ms": 10},
		"service_down":    {"graceful_shutdown": true},
		"cpu_stress":      {"stress_percent": 80},
		"memory_stress":   {"memory_mb": 512},
		"disk_full":       {"fill_percent": 90},
	}
	if t, ok := templates[faultType]; ok {
		return t
	}
	return map[string]interface{}{"error": "Unknown fault type"}
}

// --- Response helpers ---

type ExperimentStatus struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type ExperimentRecovery struct {
	ExperimentID string `json:"experimentId"`
	Status       string `json:"status"`
	Recovery     string `json:"recovery"`
}

// --- Errors ---

var (
	ErrExperimentNotFound = errors.New("chaos experiment not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrExperimentNotFound)
}
