package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"orion/platform-svc-go/internal/cmdb/models"
	"orion/platform-svc-go/internal/cmdb/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- CI CRUD ---

func (s *Service) Create(ctx context.Context, req *models.CreateCIRequest) (*models.CI, error) {
	tenantID := int64(1)
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

func (s *Service) GetByCiId(ctx context.Context, ciID string, tenantID *int64) (*models.CI, error) {
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

func (s *Service) List(ctx context.Context, ciType *string, status *string, tenantID int64, page, limit int) ([]models.CI, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	return s.repo.ListCIs(ctx, ciType, status, tenantID, page, limit)
}

// --- Batch operations ---

func (s *Service) BatchCreate(ctx context.Context, items []models.BatchCreateItem, tenantID int64, createdBy string) (*models.BatchResult, error) {
	if createdBy == "" {
		createdBy = "system"
	}
	return s.repo.BatchCreateCIs(ctx, items, tenantID, createdBy)
}

func (s *Service) BatchUpdate(ctx context.Context, items []models.BatchUpdateItem, tenantID int64) (*models.BatchResult, error) {
	return s.repo.BatchUpdateCIs(ctx, items, tenantID)
}

func (s *Service) BatchDelete(ctx context.Context, ids []string, tenantID int64) (*models.BatchResult, error) {
	return s.repo.BatchDeleteCIs(ctx, ids, tenantID)
}

func (s *Service) BatchQuery(ctx context.Context, q *models.BatchQueryRequest, tenantID int64) ([]models.CI, int, error) {
	return s.repo.BatchQueryCIs(ctx, q, tenantID)
}

// --- Export / Import ---

func (s *Service) ExportCI(ctx context.Context, id string, tenantID int64) (*models.CI, error) {
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

func (s *Service) ImportCIs(ctx context.Context, cis []any, tenantID int64, skipDuplicates bool, createdBy string) (*models.ExportResult, error) {
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

func (s *Service) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID int64, includeArchived bool) (*models.ExportResult, error) {
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
	tenantID := int64(1)
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

func (s *Service) DeleteRelation(ctx context.Context, relationID string, tenantID int64) (bool, error) {
	return s.repo.DeleteRelation(ctx, relationID, tenantID)
}

// --- Versions ---

func (s *Service) GetVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) {
	return s.repo.GetCIVersions(ctx, ciID)
}

func (s *Service) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) {
	return s.repo.GetCurrentVersion(ctx, ciID)
}

func (s *Service) RestoreToVersion(ctx context.Context, ciID string, version int, user string, tenantID int64) (*models.CI, error) {
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

func (s *Service) GetTopology(ctx context.Context, ciType *string, depth *int, tenantID int64) (*models.TopologyResult, error) {
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

func (s *Service) GetServiceDependencies(ctx context.Context, tenantID int64, ciID string) ([]models.CIRelation, error) {
	return s.repo.GetServiceDependencies(ctx, tenantID, ciID)
}

func (s *Service) GetImpactAnalysis(ctx context.Context, tenantID int64, ciID string) ([]models.CIRelation, error) {
	return s.repo.GetImpactAnalysis(ctx, tenantID, ciID)
}

// --- Health ---

func (s *Service) Health(ctx context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{Status: "ok"}, nil
}

// --- Errors ---

var (
	ErrNotFound        = errors.New("CI not found")
	ErrVersionNotFound = errors.New("version not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func ErrNotFoundCI(id string) error {
	return fmt.Errorf("CI %q not found: %w", id, ErrNotFound)
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
