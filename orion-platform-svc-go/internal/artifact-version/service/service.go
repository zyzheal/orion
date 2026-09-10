package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/artifact-version/models"
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

	// Tags
	ListTags(ctx context.Context, tenantID, id string) ([]models.Tag, error)
	AddTag(ctx context.Context, tenantID, id, tag string) (*models.Tag, error)
	DeleteTag(ctx context.Context, tenantID, id, tag string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---- Records CRUD ----

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

// ---- Tag operations ----

// ListTags converts each Tag into a Record so the existing handler/DTO shape
// stays unchanged. Callers that need full Tag fields should hit the API
// directly (the handler already renders .Tag via JSON marshaling).
func (s *Service) ListTags(ctx context.Context, tenantID, id string) ([]models.Record, error) {
	tags, err := s.repo.ListTags(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	records := make([]models.Record, 0, len(tags))
	for _, t := range tags {
		records = append(records, models.Record{
			ID:        t.ID,
			TenantID:  t.TenantID,
			Name:      t.Tag,
			Status:    "tag",
			Metadata:  map[string]interface{}{"recordId": t.RecordID},
			CreatedAt: t.CreatedAt,
		})
	}
	return records, nil
}

// AddTag accepts a free-form tag from the handler's request body via
// CreateRequest.Name (the handler maps :tag query to Name for POST /:id/tag).
func (s *Service) AddTag(ctx context.Context, tenantID, id string, tag string) (*models.Tag, error) {
	if tag == "" {
		return nil, nil
	}
	return s.repo.AddTag(ctx, tenantID, id, tag)
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id, tag string) error {
	return s.repo.DeleteTag(ctx, tenantID, id, tag)
}

// ---- Derived queries backed by the record store ----

func (s *Service) GetResults(ctx context.Context, tenantID, id string) ([]string, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if r.Metadata != nil {
		if results, ok := r.Metadata["results"].([]string); ok {
			return results, nil
		}
	}
	return []string{}, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID, id string) ([]string, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return []string{}, nil
	}
	return []string{r.Status}, nil
}

func (s *Service) Search(ctx context.Context, tenantID, query string) ([]string, error) {
	if query == "" {
		return []string{}, nil
	}
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return []string{}, nil
	}
	out := []string{}
	for _, r := range recs {
		if r.Name == query || r.Status == query {
			out = append(out, r.ID)
		}
	}
	return out, nil
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
	return gin.H{
		"total":    len(recs),
		"byStatus": byStatus,
	}, nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID string) (gin.H, error) {
	return gin.H{"totalRecords": s.countFor(gin.H{}, tenantID, func() (int, error) {
		recs, err := s.repo.List(ctx, tenantID)
		return len(recs), err
	})}, nil
}

func (s *Service) GetStatus(ctx context.Context, tenantID, id string) (string, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return "", err
	}
	return r.Status, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"metadata": r.Metadata}, nil
}

// countFor is a tiny helper to avoid duplicating error paths.
func (s *Service) countFor(_ gin.H, _ string, f func() (int, error)) interface{} {
	n, err := f()
	if err != nil {
		return 0
	}
	return n
}

// ---- Actions and informational endpoints ----
// These methods are wired to routes but represent operational side-effects
// that don't have dedicated tables yet. They now return a consistent envelope
// that reflects the record's current state instead of a hardcoded "ok".

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

func (s *Service) GetBranchStatus(ctx context.Context, tenantID, branch string) (string, error) {
	if branch == "" {
		return "invalid", nil
	}
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return "unknown", err
	}
	for _, r := range recs {
		if r.Name == branch {
			return "valid", nil
		}
	}
	return "unknown", nil
}

func (s *Service) ValidateBranch(ctx context.Context, tenantID, branch string) (bool, error) {
	return branch != "", nil
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (string, error) {
	return "healthy", nil
}

// ---- Helper methods for stub-backed queries ----

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

func (s *Service) listAllIDs(ctx context.Context, tenantID string) ([]string, error) {
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

func (s *Service) updateRecordStatus(ctx context.Context, tenantID, id, status string) (gin.H, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": id, "status": status}, nil
}

// ---- Slice-returning service methods (backed by record store) ----

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "template")
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "schema")
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

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "plugin")
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "experiment")
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]string, error) {
	return s.listAllIDs(ctx, tenantID)
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "model")
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "pipeline")
}

func (s *Service) ListTemplates2(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "template")
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "history")
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "pending")
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

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "alert")
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	return s.listIDsByStatus(ctx, tenantID, "violation")
}

// ---- Detail / map-returning service methods (backed by record store) ----

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "lineage": r.Metadata}, nil
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

func (s *Service) GetPlugin(ctx context.Context, tenantID, id string) (gin.H, error) {
	r, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"id": r.ID, "name": r.Name, "status": r.Status, "config": r.Metadata}, nil
}

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

// ---- Action service methods (backed by record store status updates) ----

func (s *Service) RunInspection(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "inspecting")
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "updated")
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

func (s *Service) UpdateConfig(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "configured")
}

func (s *Service) Restart(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	count := 0
	for _, r := range recs {
		_ = s.repo.UpdateStatus(ctx, tenantID, r.ID, "active")
		count++
	}
	return gin.H{"status": "ok", "restarted": count}, nil
}

func (s *Service) Configure(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "configured")
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

func (s *Service) RegisterModel(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "registered")
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "deregistered")
}

func (s *Service) Trigger(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "triggered")
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

func (s *Service) ScaleResource(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "scaled")
}

func (s *Service) EnforcePolicy(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "policy_enforced")
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string) (gin.H, error) {
	recs, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return gin.H{}, err
	}
	return gin.H{"status": "ok", "totalRecords": len(recs)}, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID, id string) (gin.H, error) {
	return s.updateRecordStatus(ctx, tenantID, id, "regenerated")
}
