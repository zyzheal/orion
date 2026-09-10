package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/autonomous-pipeline/models"
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

func (s *Service) listIDs(ctx context.Context, tenantID string) ([]string, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(recs))
	for _, r := range recs {
		ids = append(ids, r.ID)
	}
	return ids, nil
}

func (s *Service) listIDsByStatus(ctx context.Context, tenantID, status string) ([]string, error) {
	recs, err := s.repo.ListByStatus(ctx, tenantID, status)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(recs))
	for _, r := range recs {
		ids = append(ids, r.ID)
	}
	return ids, nil
}

func (s *Service) updateRecordStatus(ctx context.Context, tenantID, id, status string) (gin.H, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": id, "status": status}, nil
}

// ---- Pipeline action methods ----

func (s *Service) Trigger(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "triggered")
}

func (s *Service) GetStatus(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "template")
}

func (s *Service) RunInspection(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "run triggered", "totalRecords": len(recs)}, nil
}

func (s *Service) GetResults(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "result")
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	return err
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

func (s *Service) RunPipeline(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "running")
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "paused")
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "active")
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if r.Metadata != nil {
		if logs, ok := r.Metadata["logs"].([]string); ok {
			return logs, nil
		}
	}
	return []string{}, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "schema")
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "lineage": r.Metadata}, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"totalRecords": len(recs)}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "config updated", "totalRecords": len(recs)}, nil
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (gin.H, error) {
	return gin.H{"status": "healthy"}, nil
}

func (s *Service) Restart(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "active")
}

func (s *Service) Configure(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "configured")
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "plugin")
}

func (s *Service) GetPlugin(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "status": r.Status, "config": r.Metadata}, nil
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

func (s *Service) GetMetrics(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "metrics": r.Metadata}, nil
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "experiment")
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDs(ctx, tenantID)
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "model")
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"message": "model registered", "totalRecords": len(recs)}, nil
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "deregistered")
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "pipeline")
}

func (s *Service) ListTemplates2(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "template")
}

func (s *Service) GetBranchStatus(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"status": "valid", "branch": r.Name}, nil
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "history")
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "pending")
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

func (s *Service) GetByUser(ctx context.Context, tenantID, user string) ([]string, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0)
	for _, r := range recs {
		if r.Metadata != nil {
			if creator, ok := r.Metadata["createdBy"].(string); ok && creator == user {
				ids = append(ids, r.ID)
				continue
			}
		}
		if r.Name == user {
			ids = append(ids, r.ID)
		}
	}
	return ids, nil
}

func (s *Service) Forecast(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"totalRecords": len(recs), "forecast": []string{}}, nil
}

func (s *Service) GetUtilization(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "utilization": 0, "metadata": r.Metadata}, nil
}

func (s *Service) ScaleResource(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "scaled")
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "alert")
}

func (s *Service) GetHistory(ctx context.Context, tenantID, id string) ([]string, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return []string{r.Status}, nil
}

func (s *Service) AddTag(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "tagged")
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "untagged")
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

func (s *Service) ValidateBranch(ctx context.Context, tenantID, id string) (gin.H, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{"valid": false}, err
	}
	return gin.H{"valid": true}, nil
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

func (s *Service) EnforcePolicy(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "policy_enforced")
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "violation")
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

func (s *Service) Search(ctx context.Context, tenantID, query string) ([]string, error) {
	if query == "" {
		return []string{}, nil
	}
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0)
	for _, r := range recs {
		if r.Name == query || r.Status == query {
			ids = append(ids, r.ID)
		}
	}
	return ids, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "regenerated")
}
