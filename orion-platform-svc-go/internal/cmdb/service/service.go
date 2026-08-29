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
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/cmdb/models"
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

// --- AI Recommendation Engine ---

// GenerateRecommendations analyzes CMDB topology and data quality to produce
// AI-powered recommendations: auto-link suggestions, attribute fill prompts,
// anomaly detection findings, and topology fix suggestions.
func (s *Service) GenerateRecommendations(ctx context.Context, tenantID string, reqType *models.RecommendationType, limit int) (*models.RecommendationResult, error) {
	if limit <= 0 {
		limit = 20
	}

	var recs []models.Recommendation
	var anomalies []models.AnomalyDetected

	switch {
	case reqType != nil && *reqType == models.RecTypeAutoLink:
		recs = s.suggestAutoLinks(ctx, tenantID, limit)
	case reqType != nil && *reqType == models.RecTypeAttributeFill:
		recs = s.suggestAttributeFills(ctx, tenantID, limit)
	case reqType != nil && *reqType == models.RecTypeAnomalyDetect:
		anomalies = s.detectAnomalies(ctx, tenantID, limit)
	case reqType != nil && *reqType == models.RecTypeTopologyFix:
		recs = s.suggestTopologyFixes(ctx, tenantID, limit)
	default:
		recs = append(recs, s.suggestAutoLinks(ctx, tenantID, limit/2)...)
		recs = append(recs, s.suggestAttributeFills(ctx, tenantID, limit/2)...)
		anomalies = s.detectAnomalies(ctx, tenantID, limit/2)
		recs = append(recs, s.suggestTopologyFixes(ctx, tenantID, limit/2)...)
	}

	total := len(recs) + len(anomalies)
	if recs == nil {
		recs = []models.Recommendation{}
	}
	if anomalies == nil {
		anomalies = []models.AnomalyDetected{}
	}

	return &models.RecommendationResult{
		Recommendations: recs,
		Anomalies:       anomalies,
		Total:           total,
	}, nil
}

// suggestAutoLinks analyzes CIs that share the same environment but lack a relation.
func (s *Service) suggestAutoLinks(ctx context.Context, tenantID string, limit int) []models.Recommendation {
	var recs []models.Recommendation
	now := time.Now()

	allCIs, _, err := s.repo.ListCIs(ctx, nil, nil, tenantID, 1, limit*3)
	if err != nil || len(allCIs) < 2 {
		return recs
	}

	envGroups := make(map[string][]models.CI)
	for _, ci := range allCIs {
		env := "default"
		if ci.Environment != nil {
			env = *ci.Environment
		}
		envGroups[env] = append(envGroups[env], ci)
	}

	for env, cis := range envGroups {
		if len(cis) < 2 {
			continue
		}
		for i := 0; i < len(cis) && len(recs) < limit; i++ {
			for j := i + 1; j < len(cis) && len(recs) < limit; j++ {
				a, b := cis[i], cis[j]
				if a.CIType == b.CIType {
					continue
				}
				relations, _ := s.repo.GetCIRelations(ctx, a.ID)
				alreadyLinked := false
				for _, rel := range relations {
					if (rel.FromCID == a.ID && rel.ToCIID == b.ID) || (rel.FromCID == b.ID && rel.ToCIID == a.ID) {
						alreadyLinked = true
						break
					}
				}
				if alreadyLinked {
					continue
				}

				confidence := 55.0
				if a.Environment != nil && b.Environment != nil && *a.Environment == *b.Environment {
					confidence += 20
				}

				recs = append(recs, models.Recommendation{
					ID:           fmt.Sprintf("REC-%d", len(recs)+1),
					Type:         models.RecTypeAutoLink,
					SourceCIID:   a.CIID,
					SourceCIName: a.Name,
					TargetCIID:   b.CIID,
					TargetCIName: b.Name,
					Confidence:   confidence,
					Status:       models.RecStatusPending,
					RecommendAt:  now,
					Suggestion:   fmt.Sprintf("建立 %s 与 %s 的关联关系", a.CIType, b.CIType),
					Reason:       fmt.Sprintf("同一环境(%s)的 %s 和 %s 未建立关联，建议补充拓扑关系", env, a.Name, b.Name),
				})
			}
		}
	}
	return recs
}

// suggestAttributeFills identifies CIs with missing critical attributes.
func (s *Service) suggestAttributeFills(ctx context.Context, tenantID string, limit int) []models.Recommendation {
	var recs []models.Recommendation
	now := time.Now()

	allCIs, _, err := s.repo.ListCIs(ctx, nil, nil, tenantID, 1, limit*3)
	if err != nil {
		return recs
	}

	for _, ci := range allCIs {
		if len(recs) >= limit {
			break
		}
		var missingFields []string
		if ci.Description == nil || *ci.Description == "" {
			missingFields = append(missingFields, "描述")
		}
		if ci.Environment == nil || *ci.Environment == "" {
			missingFields = append(missingFields, "运行环境")
		}
		if ci.Tags == nil || *ci.Tags == "" {
			missingFields = append(missingFields, "标签")
		}
		if len(missingFields) == 0 {
			continue
		}

		confidence := 65.0
		if ci.Environment == nil {
			confidence += 15
		}
		if ci.Description == nil {
			confidence += 10
		}

		recs = append(recs, models.Recommendation{
			ID:           fmt.Sprintf("REC-%d", len(recs)+1),
			Type:         models.RecTypeAttributeFill,
			SourceCIID:   ci.CIID,
			SourceCIName: ci.Name,
			TargetCIID:   "-",
			TargetCIName: "-",
			Confidence:   confidence,
			Status:       models.RecStatusPending,
			RecommendAt:  now,
			Suggestion:   fmt.Sprintf("补充 %s 的缺失字段: %s", ci.CIType, strings.Join(missingFields, "、")),
			Reason:       fmt.Sprintf("CI %s (%s) 缺少关键字段，影响 CMDB 数据完整性和可检索性", ci.Name, ci.CIID),
		})
	}
	return recs
}

// detectAnomalies identifies CIs with potential data quality issues.
func (s *Service) detectAnomalies(ctx context.Context, tenantID string, limit int) []models.AnomalyDetected {
	var anomalies []models.AnomalyDetected
	now := time.Now()

	allCIs, _, err := s.repo.ListCIs(ctx, nil, nil, tenantID, 1, limit*3)
	if err != nil {
		return anomalies
	}

	typeNameMap := make(map[string][]models.CI)
	for _, ci := range allCIs {
		key := ci.CIType + ":" + ci.Name
		typeNameMap[key] = append(typeNameMap[key], ci)
	}
	for key, duplicates := range typeNameMap {
		if len(duplicates) > 1 && len(anomalies) < limit {
			parts := strings.SplitN(key, ":", 2)
			anomalies = append(anomalies, models.AnomalyDetected{
				ID:          fmt.Sprintf("AN-%d", len(anomalies)+1),
				CIID:        duplicates[0].CIID,
				CIName:      duplicates[0].Name,
				AnomalyType: "数据重复",
				Severity:    "high",
				DetectedAt:  now,
				Detail:      fmt.Sprintf("发现 %d 个同类型(%s)同名(%s)的 CI，可能存在重复录入", len(duplicates), parts[0], parts[1]),
			})
		}
	}

	for _, ci := range allCIs {
		if len(anomalies) >= limit {
			break
		}
		relations, _ := s.repo.GetCIRelations(ctx, ci.ID)
		if len(relations) == 0 && ci.Status == "active" {
			anomalies = append(anomalies, models.AnomalyDetected{
				ID:          fmt.Sprintf("AN-%d", len(anomalies)+1),
				CIID:        ci.CIID,
				CIName:      ci.Name,
				AnomalyType: "孤立节点",
				Severity:    "medium",
				DetectedAt:  now,
				Detail:      fmt.Sprintf("CI %s (%s) 在拓扑中无任何关联关系，可能是孤立节点或遗漏关联", ci.Name, ci.CIID),
			})
		}
	}

	return anomalies
}

// suggestTopologyFixes identifies broken or inconsistent topology edges.
func (s *Service) suggestTopologyFixes(ctx context.Context, tenantID string, limit int) []models.Recommendation {
	var recs []models.Recommendation
	now := time.Now()

	edges, err := s.repo.GetTopologyEdges(ctx, tenantID, 100)
	if err != nil {
		return recs
	}

	allCIs, _, err := s.repo.ListCIs(ctx, nil, nil, tenantID, 1, 500)
	if err != nil {
		return recs
	}
	validIDs := make(map[string]bool)
	idToName := make(map[string]string)
	for _, ci := range allCIs {
		validIDs[ci.ID] = true
		idToName[ci.ID] = ci.Name
	}

	for _, edge := range edges {
		if len(recs) >= limit {
			break
		}
		srcValid := validIDs[edge.Source]
		tgtValid := validIDs[edge.Target]
		if !srcValid || !tgtValid {
			missingSide := edge.Source
			missingName := idToName[edge.Source]
			if !tgtValid {
				missingSide = edge.Target
				missingName = idToName[edge.Target]
			}
			recs = append(recs, models.Recommendation{
				ID:           fmt.Sprintf("REC-%d", len(recs)+1),
				Type:         models.RecTypeTopologyFix,
				SourceCIID:   edge.Source,
				SourceCIName: idToName[edge.Source],
				TargetCIID:   edge.Target,
				TargetCIName: idToName[edge.Target],
				Confidence:   90.0,
				Status:       models.RecStatusPending,
				RecommendAt:  now,
				Suggestion:   fmt.Sprintf("修复拓扑中引用已不存在 CI(%s) 的边", missingSide),
				Reason:       fmt.Sprintf("拓扑边 %s → %s 引用了不存在的 CI(%s)，建议删除或重新建立关联", edge.Source, edge.Target, missingName),
			})
		}
	}

	edgePairs := make(map[string][]models.TopologyEdge)
	for _, edge := range edges {
		pair := edge.Source + "->" + edge.Target
		edgePairs[pair] = append(edgePairs[pair], edge)
	}
	for pair, dupes := range edgePairs {
		if len(dupes) > 1 && len(recs) < limit {
			parts := strings.Split(pair, "->")
			recs = append(recs, models.Recommendation{
				ID:           fmt.Sprintf("REC-%d", len(recs)+1),
				Type:         models.RecTypeTopologyFix,
				SourceCIID:   parts[0],
				SourceCIName: idToName[parts[0]],
				TargetCIID:   parts[1],
				TargetCIName: idToName[parts[1]],
				Confidence:   85.0,
				Status:       models.RecStatusPending,
				RecommendAt:  now,
				Suggestion:   "合并重复的拓扑关系边",
				Reason:       fmt.Sprintf("CI %s 与 %s 之间存在 %d 条重复关系边，建议合并为一条", parts[0], parts[1], len(dupes)),
			})
		}
	}
	return recs
}
