package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/confirmation/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) RunInspection(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) GetResults(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "updated"})
	return err
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	stats := map[string]interface{}{
		"total":      len(records),
		"passed":     0,
		"failed":     0,
		"running":    0,
		"pending":    0,
	}
	for _, r := range records {
		switch r.Status {
		case "passed", "approved":
			stats["passed"] = stats["passed"].(int) + 1
		case "failed", "rejected":
			stats["failed"] = stats["failed"].(int) + 1
		case "running", "executing":
			stats["running"] = stats["running"].(int) + 1
		default:
			stats["pending"] = stats["pending"].(int) + 1
		}
	}
	return stats, nil
}

func (s *Service) RunPipeline(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) GetStatus(ctx context.Context, tenantID string) (string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unknown", err
	}
	if len(records) == 0 {
		return "idle", nil
	}
	return records[len(records)-1].Status, nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "paused"})
	return err
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "running"})
	return err
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return []string{}, nil
	}
	return []string{fmt.Sprintf("%s: %s", rec.ID, rec.Status)}, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.Name
	}
	return names, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return map[string]interface{}{}, nil
	}
	return map[string]interface{}{"node": rec.ID, "status": rec.Status, "name": rec.Name}, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"count": len(records)}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID string, cfg map[string]interface{}) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (string, error) {
	_, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unhealthy", err
	}
	return "healthy", nil
}

func (s *Service) Restart(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) Configure(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) GetPlugin(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) EnablePlugin(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "enabled"})
	return err
}

func (s *Service) DisablePlugin(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "disabled"})
	return err
}

func (s *Service) Train(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) Evaluate(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) Deploy(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) Rollback(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) GetMetrics(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"total": len(records)}, nil
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string, req models.CreateRequest) error {
	if req.Name == "" {
		req.Name = "model"
	}
	req.Status = "registered"
	_, err := s.repo.Create(ctx, tenantID, req)
	return err
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Trigger(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) ListTemplates2(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) GetBranchStatus(ctx context.Context, tenantID string) (string, error) {
	_, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unknown", err
	}
	return "valid", nil
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Approve(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "approved"})
	return err
}

func (s *Service) Reject(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "rejected"})
	return err
}

func (s *Service) Escalate(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "escalated"})
	return err
}

func (s *Service) GetByUser(ctx context.Context, tenantID, userId string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Forecast(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"total": len(records), "forecast": "pending"}, nil
}

func (s *Service) GetUtilization(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"total": len(records)}, nil
}

func (s *Service) ScaleResource(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.Update(ctx, tenantID, id, models.CreateRequest{Status: "scaling"})
	return err
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	return ids, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return []string{}, nil
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.ID + ":" + r.Name
	}
	return names, nil
}

func (s *Service) AddTag(ctx context.Context, tenantID, id, tag string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	return err
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id, tag string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	return err
}

func (s *Service) CheckCompatibility(ctx context.Context, tenantID, id string) (bool, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) ValidateBranch(ctx context.Context, tenantID string) (bool, error) {
	_, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) GetCoverage(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"total": len(records), "covered": len(records)}, nil
}

func (s *Service) EnforcePolicy(ctx context.Context, tenantID string) error {
	_, err := s.repo.List(ctx, tenantID)
	return err
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	return ids, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string, reqs []models.CreateRequest) ([]models.Record, error) {
	created := make([]models.Record, 0)
	for _, req := range reqs {
		if req.Name == "" {
			req.Name = "batch-item"
		}
		rec, err := s.repo.Create(ctx, tenantID, req)
		if err != nil {
			continue
		}
		created = append(created, *rec)
	}
	return created, nil
}

func (s *Service) Search(ctx context.Context, tenantID, q string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Regenerate(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	return err
}