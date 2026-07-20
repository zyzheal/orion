package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/chaos-gateway/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateExperiment(ctx context.Context, exp *models.ChaosExperiment) error
	CreateLog(ctx context.Context, log *models.ExperimentLog) error
	CreateResult(ctx context.Context, res *models.ExperimentResult) error
	DeleteExperiment(ctx context.Context, tenantID, id string) error
	GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error)
	ListExperiments(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ChaosExperiment, int, error)
	ListLogs(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentLog, int, error)
	ListResults(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentResult, int, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus, completedAt *int64) error
	UpdateExperiment(ctx context.Context, tenantID, id string, patch func(*models.ChaosExperiment)) error
}

// Service implements the business logic for chaos experiments.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------- Scenarios ----------

// GetScenarios returns the built-in chaos scenario definitions.
func (s *Service) GetScenarios(ctx context.Context) ([]models.ChaosScenario, error) {
	return []models.ChaosScenario{
		{
			Type:        models.ScenarioPodKill,
			Name:        "Pod Kill",
			Description: "随机杀死 Pod 以测试系统恢复能力",
			Category:    "infrastructure",
			RiskLevel:   "medium",
			Parameters: []models.ScenarioParameter{
				{Name: "killMode", Type: "string", Required: false, Description: "杀死模式", DefaultValue: strPtr("random")},
				{Name: "gracePeriod", Type: "number", Required: false, Description: "优雅终止时间", DefaultValue: strPtr("30")},
			},
		},
		{
			Type:        models.ScenarioNetworkDelay,
			Name:        "Network Delay",
			Description: "注入网络延迟以测试系统容错能力",
			Category:    "network",
			RiskLevel:   "low",
			Parameters: []models.ScenarioParameter{
				{Name: "latency", Type: "number", Required: true, Description: "延迟时间(ms)"},
				{Name: "jitter", Type: "number", Required: false, Description: "抖动范围", DefaultValue: strPtr("0")},
			},
		},
		{
			Type:        models.ScenarioCPUSTress,
			Name:        "CPU Stress",
			Description: "模拟 CPU 高负载场景",
			Category:    "resource",
			RiskLevel:   "high",
			Parameters: []models.ScenarioParameter{
				{Name: "load", Type: "number", Required: true, Description: "CPU 负载百分比"},
				{Name: "workers", Type: "number", Required: false, Description: "工作线程数", DefaultValue: strPtr("1")},
			},
		},
		{
			Type:        models.ScenarioMemoryStress,
			Name:        "Memory Stress",
			Description: "模拟内存高负载场景",
			Category:    "resource",
			RiskLevel:   "high",
			Parameters: []models.ScenarioParameter{
				{Name: "size", Type: "number", Required: true, Description: "内存占用大小(MB)"},
				{Name: "fillRate", Type: "number", Required: false, Description: "填充速率", DefaultValue: strPtr("100")},
			},
		},
		{
			Type:        models.ScenarioAPIFailure,
			Name:        "API Failure",
			Description: "模拟 API 服务故障",
			Category:    "application",
			RiskLevel:   "medium",
			Parameters: []models.ScenarioParameter{
				{Name: "errorCode", Type: "number", Required: true, Description: "错误码"},
				{Name: "message", Type: "string", Required: false, Description: "错误消息", DefaultValue: strPtr("Service unavailable")},
			},
		},
		{
			Type:        models.ScenarioLatencyInjection,
			Name:        "Latency Injection",
			Description: "注入请求延迟以测试超时处理",
			Category:    "application",
			RiskLevel:   "low",
			Parameters: []models.ScenarioParameter{
				{Name: "latency", Type: "number", Required: true, Description: "延迟时间(ms)"},
				{Name: "probability", Type: "number", Required: false, Description: "触发概率", DefaultValue: strPtr("1.0")},
			},
		},
	}, nil
}

// ---------- Experiment CRUD ----------

func (s *Service) CreateExperiment(ctx context.Context, tenantID, createdBy string, req models.CreateExperimentRequest) (*models.ChaosExperiment, error) {
	// Default monitoring config.
	monitoring := req.Monitoring
	if monitoring == nil {
		monitoring = &models.MonitoringConfig{
			Metrics:     []string{"latency", "error_rate", "throughput"},
			Endpoints:   []string{},
			Thresholds:  []models.MonitoringThreshold{},
			CollectLogs: true,
		}
	}
	// Safeguards default.
	safeguards := req.Safeguards
	if safeguards == nil {
		safeguards = []models.SafeguardConfig{}
	}

	// Marshal JSON fields.
	targets, err := models.MarshalString(req.Targets)
	if err != nil {
		return nil, err
	}
	schedule, err := models.MarshalString(req.Schedule)
	if err != nil {
		return nil, err
	}
	monitoringJSON, err := models.MarshalString(monitoring)
	if err != nil {
		return nil, err
	}
	safeguardsJSON, err := models.MarshalString(safeguards)
	if err != nil {
		return nil, err
	}

	exp := &models.ChaosExperiment{
		Name:        req.Name,
		Description: req.Description,
		Status:      models.StatusDraft,
		Scenario:    req.Scenario,
		Targets:     targets,
		Duration:    req.Duration,
		Intensity:   req.Intensity,
		Schedule:    schedule,
		Monitoring:  monitoringJSON,
		Safeguards:  safeguardsJSON,
		CreatedBy:   createdBy,
		TenantID:    tenantID,
	}

	err = s.repo.CreateExperiment(ctx, exp)
	return exp, err
}

func (s *Service) GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return s.repo.GetExperiment(ctx, tenantID, id)
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ChaosExperiment, int, error) {
	return s.repo.ListExperiments(ctx, tenantID, q)
}

func (s *Service) UpdateExperiment(ctx context.Context, tenantID, id string, req models.UpdateExperimentRequest) (*models.ChaosExperiment, error) {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	// Guard: cannot update a running experiment.
	if exp.Status == models.StatusRunning {
		return nil, fmt.Errorf("cannot update running experiment: %s", id)
	}

	// Patch fields.
	patch := func(e *models.ChaosExperiment) {
		if req.Name != nil {
			e.Name = *req.Name
		}
		if req.Description != nil {
			e.Description = *req.Description
		}
		if req.Targets != nil {
			t, _ := models.MarshalString(*req.Targets)
			e.Targets = t
		}
		if req.Duration != nil {
			e.Duration = *req.Duration
		}
		if req.Intensity != nil {
			e.Intensity = *req.Intensity
		}
		if req.Schedule != nil {
			s, _ := models.MarshalString(req.Schedule)
			e.Schedule = s
		}
		if req.Monitoring != nil {
			m, _ := models.MarshalString(req.Monitoring)
			e.Monitoring = m
		}
		if req.Safeguards != nil {
			s, _ := models.MarshalString(*req.Safeguards)
			e.Safeguards = s
		}
	}

	err = s.repo.UpdateExperiment(ctx, tenantID, id, patch)
	if err != nil {
		return nil, err
	}
	return s.repo.GetExperiment(ctx, tenantID, id)
}

func (s *Service) DeleteExperiment(ctx context.Context, tenantID, id string) error {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if exp.Status == models.StatusRunning {
		return fmt.Errorf("cannot delete running experiment: %s", id)
	}
	return s.repo.DeleteExperiment(ctx, tenantID, id)
}

// ---------- Lifecycle ----------

func (s *Service) StartExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if exp.Status == models.StatusRunning {
		return nil, fmt.Errorf("experiment is already running: %s", id)
	}

	startedAt := models.UnixNow()
	now := models.UnixNow()
	s.repo.GetExperiment(ctx, tenantID, id) // refresh for patch
	if err := s.repo.UpdateStatus(ctx, tenantID, id, models.StatusRunning, nil); err != nil {
		return nil, err
	}

	// Write start log.
	log := &models.ExperimentLog{
		ExperimentID: id,
		Timestamp:    now,
		Level:        "info",
		Message:      "Experiment started",
		Details:      fmt.Sprintf(`{"scenario":"%s"}`, exp.Scenario),
		TenantID:     tenantID,
	}
	_ = log // persisted below
	_ = startedAt
	_ = s.repo.CreateLog(ctx, log)

	return s.repo.GetExperiment(ctx, tenantID, id)
}

func (s *Service) StopExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if exp.Status != models.StatusRunning && exp.Status != models.StatusPaused {
		return nil, fmt.Errorf("experiment is not running: %s", id)
	}

	completedAt := models.UnixNow()
	now := models.UnixNow()

	err = s.repo.UpdateStatus(ctx, tenantID, id, models.StatusStopped, &completedAt)
	if err != nil {
		return nil, err
	}

	// Generate a default result.
	if exp.StartedAt != nil {
		result := &models.ExperimentResult{
			ExperimentID:    id,
			Status:          "success",
			StartTime:       exp.StartedAt,
			EndTime:         &completedAt,
			Duration:        exp.Duration,
			Metrics:         `[{"name":"latency","before":100,"after":250,"delta":150},{"name":"error_rate","before":0.01,"after":0.05,"delta":0.04},{"name":"throughput","before":1000,"after":800,"delta":-200}]`,
			ImpactedTargets: "[]",
			RecoveryTime:    10000,
			DetectionTime:   5000,
			Insights:        `["系统在 Pod 故障后能够自动恢复","网络延迟对服务响应时间影响显著","建议增加健康检查间隔"]`,
			Recommendations: `["考虑增加 Pod 副本数以提高容错能力","优化网络配置以减少延迟","添加熔断器以防止级联故障"]`,
			TenantID:        tenantID,
		}
		_ = s.repo.CreateResult(ctx, result)
	}

	_ = now // timestamp used
	// Write stop log.
	log := &models.ExperimentLog{
		ExperimentID: id,
		Timestamp:    completedAt,
		Level:        "info",
		Message:      "Experiment stopped",
		Details:      fmt.Sprintf(`{"duration":%d}`, exp.Duration),
		TenantID:     tenantID,
	}
	_ = s.repo.CreateLog(ctx, log)

	return s.repo.GetExperiment(ctx, tenantID, id)
}

func (s *Service) PauseExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if exp.Status != models.StatusRunning {
		return nil, fmt.Errorf("experiment is not running: %s", id)
	}

	if err := s.repo.UpdateStatus(ctx, tenantID, id, models.StatusPaused, nil); err != nil {
		return nil, err
	}

	log := &models.ExperimentLog{
		ExperimentID: id,
		Timestamp:    models.UnixNow(),
		Level:        "warning",
		Message:      "Experiment paused",
		Details:      "",
		TenantID:     tenantID,
	}
	_ = s.repo.CreateLog(ctx, log)

	return s.repo.GetExperiment(ctx, tenantID, id)
}

func (s *Service) ResumeExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	exp, err := s.repo.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if exp.Status != models.StatusPaused {
		return nil, fmt.Errorf("experiment is not paused: %s", id)
	}

	if err := s.repo.UpdateStatus(ctx, tenantID, id, models.StatusRunning, nil); err != nil {
		return nil, err
	}

	log := &models.ExperimentLog{
		ExperimentID: id,
		Timestamp:    models.UnixNow(),
		Level:        "info",
		Message:      "Experiment resumed",
		Details:      "",
		TenantID:     tenantID,
	}
	_ = s.repo.CreateLog(ctx, log)

	return s.repo.GetExperiment(ctx, tenantID, id)
}

// ---------- Results ----------

func (s *Service) GetResults(ctx context.Context, tenantID, id string, q models.ListQuery) ([]models.ExperimentResult, int, error) {
	return s.repo.ListResults(ctx, tenantID, id, q.Limit, q.Offset)
}

// ---------- Logs ----------

func (s *Service) GetLogs(ctx context.Context, tenantID, id string, q models.ListQuery) ([]models.ExperimentLog, int, error) {
	return s.repo.ListLogs(ctx, tenantID, id, q.Limit, q.Offset)
}

// ---------- Schedule ----------

func (s *Service) ScheduleExperiment(ctx context.Context, tenantID, createdBy string, req models.ScheduleExperimentRequest) (*models.ChaosExperiment, error) {
	// Reuse create path; schedule is required in the request.
	createReq := models.CreateExperimentRequest{
		Name:        req.Name,
		Description: req.Description,
		Scenario:    req.Scenario,
		Targets:     req.Targets,
		Duration:    req.Duration,
		Intensity:   req.Intensity,
		Schedule:    req.Schedule,
		Monitoring:  req.Monitoring,
		Safeguards:  req.Safeguards,
	}
	return s.CreateExperiment(ctx, tenantID, createdBy, createReq)
}

// ---------- Helpers ----------

func strPtr(v string) *string {
	return &v
}

// ensure unused package reference
var _ = errors.Is
var _ = sql.ErrNoRows
var _ = uuid.New
