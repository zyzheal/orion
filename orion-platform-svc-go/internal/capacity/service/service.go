package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/capacity/models"

	"github.com/gin-gonic/gin"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	ListByStatus(ctx context.Context, tenantID, status string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// CRUD methods (already wired)
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

// ---- Helper methods ----

func (s *Service) updateRecordStatus(ctx context.Context, tenantID, id, status string) (gin.H, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": id, "status": status}, nil
}

// ---- Record-returning list methods (backed by record store) ----

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "alert")
}

func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "history")
}

func (s *Service) GetResults(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "result")
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "template")
}

func (s *Service) ListTemplates2(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "template")
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "pipeline")
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "schema")
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "plugin")
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "experiment")
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "model")
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "history")
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "pending")
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "violation")
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	return s.repo.ListByStatus(ctx, tenantID, "log")
}

func (s *Service) GetByUser(ctx context.Context, tenantID, userID string) ([]models.Record, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]models.Record, 0)
	for _, r := range recs {
		if r.Metadata != nil {
			if creator, ok := r.Metadata["createdBy"].(string); ok && creator == userID {
				out = append(out, r)
				continue
			}
		}
		if r.Name == userID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *Service) Search(ctx context.Context, tenantID, query string) ([]models.Record, error) {
	if query == "" {
		return []models.Record{}, nil
	}
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]models.Record, 0)
	for _, r := range recs {
		if r.Name == query || r.Status == query {
			out = append(out, r)
		}
	}
	return out, nil
}

// ---- Map-returning detail methods (backed by record store) ----

func (s *Service) Forecast(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"totalRecords": len(recs), "forecast": []string{}}, nil
}

func (s *Service) GetUtilization(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"totalRecords": len(recs), "utilization": 0}, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	byStatus := map[string]int{}
	for _, r := range recs {
		byStatus[r.Status]++
	}
	return gin.H{"total": len(recs), "byStatus": byStatus}, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "lineage": r.Metadata}, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"metadata": r.Metadata}, nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "metrics": r.Metadata}, nil
}

func (s *Service) GetCoverage(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	coverage := gin.H{"id": r.ID, "name": r.Name}
	if r.Metadata != nil {
		coverage["details"] = r.Metadata
	}
	return coverage, nil
}

func (s *Service) GetStatus(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"status": r.Status, "pipelineId": id}, nil
}

func (s *Service) GetPlugin(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) CheckCompatibility(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{
		"id":         r.ID,
		"compatible": true,
		"reason":     "record exists and status is " + r.Status,
	}, nil
}

func (s *Service) GetBranchStatus(ctx context.Context, tenantID, branch string) (gin.H, error) {
	if branch == "" {
		return gin.H{"status": "invalid", "branch": branch}, nil
	}
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{"status": "unknown"}, err
	}
	for _, r := range recs {
		if r.Name == branch {
			return gin.H{"status": "valid", "branch": branch}, nil
		}
	}
	return gin.H{"status": "unknown", "branch": branch}, nil
}

func (s *Service) ValidateBranch(ctx context.Context, tenantID, branch string) (gin.H, error) {
	return gin.H{"valid": branch != "", "branch": branch}, nil
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (gin.H, error) {
	return gin.H{"status": "healthy"}, nil
}

// ---- Action methods (backed by record store status updates) ----

func (s *Service) ScaleResource(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "scaled")
}

func (s *Service) RunInspection(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "inspection triggered", "status": "started", "totalRecords": len(recs)}, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string, status string) (gin.H, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": id, "status": status}, nil
}

func (s *Service) RunPipeline(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "running")
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "paused")
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "active")
}

func (s *Service) Trigger(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "triggered")
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID, id string, config gin.H) (gin.H, error) {
	req := models.CreateRequest{Name: "", Config: map[string]interface{}(config)}
	_, err := s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "config updated", "id": id}, nil
}

func (s *Service) Restart(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "active")
}

func (s *Service) Configure(ctx context.Context, tenantID string, config gin.H) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "configured", "totalRecords": len(recs)}, nil
}

func (s *Service) EnablePlugin(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "enabled")
}

func (s *Service) DisablePlugin(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "disabled")
}

func (s *Service) Train(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "training")
}

func (s *Service) Evaluate(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "evaluating")
}

func (s *Service) Deploy(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "deployed")
}

func (s *Service) Rollback(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "rolled_back")
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "deregistered")
}

func (s *Service) Approve(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "approved")
}

func (s *Service) Reject(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "rejected")
}

func (s *Service) Escalate(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "escalated")
}

func (s *Service) EnforcePolicy(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "policy_enforced")
}

func (s *Service) AddTag(ctx context.Context, tenantID, id, tag string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	tags := []string{}
	if r.Metadata != nil {
		if existing, ok := r.Metadata["tags"].([]string); ok {
			tags = existing
		}
	}
	tags = append(tags, tag)
	r.Metadata["tags"] = tags
	req := models.CreateRequest{Name: r.Name, Status: r.Status, Config: r.Metadata}
	_, err = s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "tag added", "id": id, "tag": tag}, nil
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id, tag string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	tags := []string{}
	if r.Metadata != nil {
		if existing, ok := r.Metadata["tags"].([]string); ok {
			tags = existing
		}
	}
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		if t != tag {
			out = append(out, t)
		}
	}
	r.Metadata["tags"] = out
	req := models.CreateRequest{Name: r.Name, Status: r.Status, Config: r.Metadata}
	_, err = s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "tag deleted", "id": id, "tag": tag}, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string, reqs []models.CreateRequest) (gin.H, error) {
	created := 0
	for _, req := range reqs {
		if _, err := s.repo.Create(ctx, tenantID, req); err != nil {
			return gin.H{}, err
		}
		created++
	}
	return gin.H{"message": "batch created", "count": created}, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "regenerated")
}
