package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"orion/platform-svc-go/internal/cmdb/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	BatchCreateCIs(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error)
	BatchDeleteCIs(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error)
	BatchQueryCIs(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error)
	BatchUpdateCIs(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error)
	CreateCI(ctx context.Context, ci *models.CI) error
	CreateRelation(ctx context.Context, rel *models.CIRelation) error
	CreateVersion(ctx context.Context, ciID string, version int, snapshot *string, createdBy string, tenantID string) error
	DeleteCI(ctx context.Context, id string) (bool, error)
	DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error)
	ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) ([]models.CI, error)
	GetCIByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error)
	GetCIByID(ctx context.Context, id string) (*models.CI, error)
	GetCIRelations(ctx context.Context, ciID string) ([]models.CIRelation, error)
	GetCIVersions(ctx context.Context, ciID string) ([]models.CIVersion, error)
	GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error)
	GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error)
	GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error)
	GetTopologyEdges(ctx context.Context, tenantID string, limit int) ([]models.TopologyEdge, error)
	GetTopologyNodes(ctx context.Context, ciType *string, tenantID string, limit int) ([]models.TopologyNode, error)
	GetVersionSnapshot(ctx context.Context, ciID string, version int) (*string, error)
	ListCIs(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error)
	UpdateCI(ctx context.Context, id string, updates map[string]interface{}) (*models.CI, error)
	SearchCIs(ctx context.Context, tenantID, query, domain string, limit, offset int) ([]models.CI, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- CI CRUD ---

func (s *Service) Create(ctx context.Context, req *models.CreateCIRequest) (*models.CI, error) {
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "system"
	}
	ci := &models.CI{
		CIID:        req.CIID,
		Name:        req.Name,
		CIType:      req.CIType,
		Status:      "active",
		Description: req.Description,
		TenantID:    tenantID,
		CreatedBy:   createdBy,
	}
	if req.Status != "" {
		ci.Status = req.Status
	}
	if err := s.repo.CreateCI(ctx, ci); err != nil {
		return nil, err
	}
	return s.repo.GetCIByID(ctx, ci.ID)
}

func (s *Service) Get(ctx context.Context, id string) (*models.CI, error) {
	return s.repo.GetCIByID(ctx, id)
}

func (s *Service) GetByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) {
	return s.repo.GetCIByCiId(ctx, ciID, tenantID)
}

func (s *Service) Update(ctx context.Context, id string, req *models.UpdateCIRequest) (*models.CI, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.CIType != nil {
		updates["ci_type"] = *req.CIType
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Environment != nil {
		updates["environment"] = *req.Environment
	}
	if req.Tags != nil {
		updates["tags"] = *req.Tags
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	ci, err := s.repo.UpdateCI(ctx, id, updates)
	if err != nil {
		return nil, err
	}
	return ci, nil
}

func (s *Service) Delete(ctx context.Context, id string) (bool, error) {
	return s.repo.DeleteCI(ctx, id)
}

func (s *Service) List(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	return s.repo.ListCIs(ctx, ciType, status, tenantID, page, limit)
}

// --- Batch operations ---

func (s *Service) BatchCreate(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error) {
	if createdBy == "" {
		createdBy = "system"
	}
	return s.repo.BatchCreateCIs(ctx, items, tenantID, createdBy)
}

func (s *Service) BatchUpdate(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error) {
	return s.repo.BatchUpdateCIs(ctx, items, tenantID)
}

func (s *Service) BatchDelete(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error) {
	return s.repo.BatchDeleteCIs(ctx, ids, tenantID)
}

func (s *Service) BatchQuery(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error) {
	return s.repo.BatchQueryCIs(ctx, q, tenantID)
}

// --- Export / Import ---

func (s *Service) ExportCI(ctx context.Context, id string, tenantID string) (*models.CI, error) {
	ci, err := s.repo.GetCIByCiId(ctx, id, &tenantID)
	if err != nil {
		// If lookup by ciId fails, try as internal ID
		ci, err = s.repo.GetCIByID(ctx, id)
		if err != nil {
			return nil, err
		}
	}
	return ci, nil
}

func (s *Service) ImportCIs(ctx context.Context, cis []any, tenantID string, skipDuplicates bool, createdBy string) (*models.ExportResult, error) {
	if createdBy == "" {
		createdBy = "system"
	}
	var results []any
	for _, raw := range cis {
		var item models.BatchCreateItem
		data, err := json.Marshal(raw)
		if err != nil {
			continue
		}
		if err := json.Unmarshal(data, &item); err != nil {
			continue
		}
		if skipDuplicates {
			existing, _ := s.repo.GetCIByCiId(ctx, item.CIID, &tenantID)
			if existing != nil && existing.ID != "" {
				continue
			}
		}
		ci := &models.CI{
			CIID:        item.CIID,
			Name:        item.Name,
			CIType:      item.CIType,
			Status:      item.Status,
			Description: item.Description,
			TenantID:    tenantID,
			CreatedBy:   createdBy,
			Environment: item.Environment,
			Tags:        item.Tags,
		}
		if ci.Status == "" {
			ci.Status = "active"
		}
		if err := s.repo.CreateCI(ctx, ci); err != nil {
			if skipDuplicates {
				continue
			}
			results = append(results, map[string]any{"error": err.Error()})
			continue
		}
		results = append(results, ci)
	}
	return &models.ExportResult{Count: len(results), CIs: results}, nil
}

func (s *Service) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) (*models.ExportResult, error) {
	items, err := s.repo.ExportCIs(ctx, ciType, status, environment, search, tenantID, includeArchived)
	if err != nil {
		return nil, err
	}
	var cis []any
	for _, item := range items {
		cis = append(cis, item)
	}
	return &models.ExportResult{Count: len(cis), CIs: cis}, nil
}

// --- Relations ---

func (s *Service) GetRelations(ctx context.Context, ciID string) ([]models.CIRelation, error) {
	return s.repo.GetCIRelations(ctx, ciID)
}

func (s *Service) CreateRelation(ctx context.Context, req *models.CreateRelationRequest) (*models.CIRelation, error) {
	user := "system"
	if req.User != nil {
		user = *req.User
	}
	tenantID := "00000000-0000-0000-0000-000000000000"
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	rel := &models.CIRelation{
		FromCID:      req.FromCID,
		ToCIID:       req.ToCIID,
		RelationType: req.RelationType,
		Description:  req.Description,
		TenantID:     &tenantID,
		CreatedBy:    user,
	}
	if err := s.repo.CreateRelation(ctx, rel); err != nil {
		return nil, err
	}
	return rel, nil
}

func (s *Service) DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error) {
	return s.repo.DeleteRelation(ctx, relationID, tenantID)
}

// --- Versions ---

func (s *Service) GetVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	return s.repo.GetCIVersions(ctx, ciID)
}

func (s *Service) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) {
	return s.repo.GetCurrentVersion(ctx, ciID)
}

func (s *Service) RestoreToVersion(ctx context.Context, ciID string, version int, user string, tenantID string) (*models.CI, error) {
	if user == "" {
		user = "system"
	}
	_, err := s.repo.GetVersionSnapshot(ctx, ciID, version)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}
	// Save current state as a new version before restore
	current, err := s.repo.GetCurrentVersion(ctx, ciID)
	if err != nil {
		return nil, err
	}
	nextVersion := 1
	if current != nil {
		nextVersion = current.Version + 1
	}
	// Get current CI for snapshot
	ci, err := s.repo.GetCIByCiId(ctx, ciID, &tenantID)
	if err != nil {
		ci, err = s.repo.GetCIByID(ctx, ciID)
		if err != nil {
			return nil, err
		}
	}
	snapshotData, _ := json.Marshal(ci)
	snapshotStr := string(snapshotData)
	if err := s.repo.CreateVersion(ctx, ciID, nextVersion, &snapshotStr, user, tenantID); err != nil {
		return nil, err
	}
	return s.repo.GetCIByCiId(ctx, ciID, &tenantID)
}

// --- Topology ---

func (s *Service) GetTopology(ctx context.Context, ciType *string, depth *int, tenantID string) (*models.TopologyResult, error) {
	limit := 200
	if depth != nil && *depth > 0 {
		limit = *depth * 20
	}
	nodes, err := s.repo.GetTopologyNodes(ctx, ciType, tenantID, limit)
	if err != nil {
		return nil, err
	}
	edges, err := s.repo.GetTopologyEdges(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	return &models.TopologyResult{Nodes: nodes, Edges: edges}, nil
}

func (s *Service) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return s.repo.GetServiceDependencies(ctx, tenantID, ciID)
}

func (s *Service) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) {
	return s.repo.GetImpactAnalysis(ctx, tenantID, ciID)
}

// --- Health ---

func (s *Service) Health(ctx context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{Status: "ok"}, nil
}

// --- Integration (Hosts, K8s, CICD, Execute) ---

func (s *Service) ListHosts(ctx context.Context, status *string, tags *string, limit, offset int) ([]models.CI, int, error) {
	ciType := "Host"
	tenantID := "00000000-0000-0000-0000-000000000000"
	items, total, err := s.repo.ListCIs(ctx, &ciType, status, tenantID, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	if tags != nil && *tags != "" {
		filtered := items[:0]
		for _, ci := range items {
			if ci.Tags != nil && *ci.Tags == *tags {
				filtered = append(filtered, ci)
			}
		}
		items = filtered
		total = len(filtered)
	}
	if items == nil {
		items = []models.CI{}
	}
	return items, total, nil
}

func (s *Service) GetHost(ctx context.Context, ciID string) (*models.CI, error) {
	tenantID := "00000000-0000-0000-0000-000000000000"
	return s.repo.GetCIByCiId(ctx, ciID, &tenantID)
}

func (s *Service) ListK8sResources(ctx context.Context, kind *string, namespace *string, limit, offset int) ([]models.K8sResource, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	// Mock/scaffold data for K8s resources.
	resources := []models.K8sResource{
		{ID: "k8s-1", Kind: "Deployment", Name: "web-api", Namespace: "production", Status: "Running", Cluster: "prod-cluster", CIID: "ci-web-api", CreatedAt: "2026-07-01T00:00:00Z"},
		{ID: "k8s-2", Kind: "Service", Name: "web-api-svc", Namespace: "production", Status: "Running", Cluster: "prod-cluster", CIID: "ci-web-api-svc", CreatedAt: "2026-07-01T00:00:00Z"},
		{ID: "k8s-3", Kind: "ConfigMap", Name: "app-config", Namespace: "default", Status: "Active", Cluster: "dev-cluster", CIID: "ci-app-config", CreatedAt: "2026-07-02T00:00:00Z"},
	}
	filtered := resources[:0]
	for _, r := range resources {
		match := true
		if kind != nil && *kind != "" && r.Kind != *kind {
			match = false
		}
		if namespace != nil && *namespace != "" && r.Namespace != *namespace {
			match = false
		}
		if match {
			filtered = append(filtered, r)
		}
	}
	total := len(filtered)
	if offset > len(filtered) {
		filtered = filtered[:0]
	} else {
		filtered = filtered[offset:]
	}
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}
	if filtered == nil {
		filtered = []models.K8sResource{}
	}
	return filtered, total, nil
}

func (s *Service) StartK8sSync(ctx context.Context, config *models.StartK8sSyncRequest) error {
	// Scaffold: record sync start config.
	_ = config
	return nil
}

func (s *Service) StopK8sSync(ctx context.Context) error {
	// Scaffold: stop K8s sync.
	return nil
}

func (s *Service) ListCICDResources(ctx context.Context, status *string, limit, offset int) ([]models.CICDResource, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	resources := []models.CICDResource{
		{ID: "cicd-1", Name: "build-pipeline", Type: "Pipeline", Status: "success", Project: "orion-platform", LastRunAt: "2026-07-12T10:00:00Z", CreatedAt: "2026-06-01T00:00:00Z"},
		{ID: "cicd-2", Name: "deploy-runner", Type: "Runner", Status: "running", Project: "orion-platform", CreatedAt: "2026-06-15T00:00:00Z"},
		{ID: "cicd-3", Name: "test-pipeline", Type: "Pipeline", Status: "failed", Project: "orion-frontend", LastRunAt: "2026-07-12T09:00:00Z", CreatedAt: "2026-06-20T00:00:00Z"},
	}
	filtered := resources[:0]
	for _, r := range resources {
		if status != nil && *status != "" && r.Status != *status {
			continue
		}
		filtered = append(filtered, r)
	}
	total := len(filtered)
	if offset > len(filtered) {
		filtered = filtered[:0]
	} else {
		filtered = filtered[offset:]
	}
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}
	if filtered == nil {
		filtered = []models.CICDResource{}
	}
	return filtered, total, nil
}

func (s *Service) ExecuteScript(ctx context.Context, req *models.ScriptExecRequest) (*models.ScriptExecResult, error) {
	scriptType := req.ScriptType
	if scriptType == "" {
		scriptType = "bash"
	}
	results := []models.ScriptExecTargetResult{}
	for _, ciID := range req.TargetCiIds {
		results = append(results, models.ScriptExecTargetResult{
			CIID:   ciID,
			Status: "success",
			Output: fmt.Sprintf("[scaffold] executed %q script on %s", scriptType, ciID),
		})
	}
	return &models.ScriptExecResult{
		ExecutionID: "exec-0001",
		Status:      "completed",
		Results:     results,
	}, nil
}

// Search performs full-text search across CMDB CIs using the repository's FTS query.
func (s *Service) Search(ctx context.Context, tenantID, query, domain string) ([]models.CI, error) {
	// Tenant isolation: always filter by tenant
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return s.repo.SearchCIs(ctx, tenantID, query, domain, 20, 0)
}

// --- Errors ---

var (

	ErrVersionNotFound = errors.New("version not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundCI(id string) error {
	return fmt.Errorf("CI %q not found: %w", id, sentinel.NotFound)
}

// --- Helpers ---

func safeInt(v *int, defaultVal int) int {
	if v != nil && *v > 0 {
		return *v
	}
	return defaultVal
}

func parseIntPtr(s string) *int {
	if s == "" {
		return nil
	}
	i, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &i
}

func parseInt64Ptr(s string) *int64 {
	if s == "" {
		return nil
	}
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil
	}
	return &i
}
