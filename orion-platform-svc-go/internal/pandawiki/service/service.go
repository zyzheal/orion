package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pandawiki/models"
	"orion/platform-svc-go/internal/pandawiki/repository"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrConflict     = errors.New("conflict")
)

// Service provides business logic for the PandaWiki domain.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service backed by the given Repository.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ====== Space ======

func (s *Service) CreateSpace(ctx context.Context, tenantID string, req *models.CreateSpaceRequest) (*models.Space, error) {
	if req.Name == "" {
		return nil, ErrInvalidInput
	}
	if len(req.Name) > 256 {
		return nil, ErrInvalidInput
	}
	if req.Type == "" {
		req.Type = models.SpaceTypePublic
	}
	if req.Source == "" {
		req.Source = models.SourceManual
	}

	space := &models.Space{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Type:      req.Type,
		Source:    req.Source,
		OwnerID:   req.OwnerID,
		TeamID:    req.TeamID,
		Description: req.Description,
	}
	if space.OwnerID == "" {
		space.OwnerID = "system"
	}

	err := s.repo.CreateSpace(ctx, space)
	return space, err
}

func (s *Service) GetSpace(ctx context.Context, tenantID, id string) (*models.Space, error) {
	space, err := s.repo.FindSpaceByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if space == nil {
		return nil, ErrNotFound
	}
	return space, nil
}

func (s *Service) ListSpaces(ctx context.Context, tenantID string, offset, limit int, opts *repository.ListSpacesOpts) ([]models.Space, int64, error) {
	if limit < 1 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListSpaces(ctx, tenantID, offset, limit, opts)
}

func (s *Service) UpdateSpace(ctx context.Context, tenantID, id string, input *models.UpdateSpaceInput) (*models.Space, error) {
	existing, err := s.repo.FindSpaceByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrNotFound
	}

	updated, err := s.repo.UpdateSpace(ctx, tenantID, id, input)
	if err != nil {
		return nil, err
	}
	if updated == nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteSpace(ctx context.Context, tenantID, id string) error {
	existing, err := s.repo.FindSpaceByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrNotFound
	}
	return s.repo.DeleteSpace(ctx, tenantID, id)
}

// ====== Document ======

func (s *Service) CreateDoc(ctx context.Context, tenantID string, input *models.CreateDocInput) (*models.Doc, error) {
	if input.Title == "" || input.Content == "" || input.SpaceID == "" {
		return nil, ErrInvalidInput
	}

	// verify space belongs to tenant
	space, err := s.repo.FindSpaceByID(ctx, tenantID, input.SpaceID)
	if err != nil {
		return nil, err
	}
	if space == nil {
		return nil, ErrNotFound
	}

	doc := &models.Doc{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		SpaceID:   input.SpaceID,
		Title:     input.Title,
		Content:   input.Content,
		Type:      "knowledge",
		Source:    models.SourceManual,
		Tags:      models.JSONArray(input.Tags),
		Status:    models.DocStatusDraft,
		Version:   1,
		AuthorID:  input.AuthorID,
	}
	if input.Type != nil {
		doc.Type = *input.Type
	}
	if input.Source != nil {
		doc.Source = *input.Source
	}
	if input.Status != nil {
		doc.Status = *input.Status
	}
	if doc.Tags == nil {
		doc.Tags = models.JSONArray{}
	}

	err = s.repo.CreateDoc(ctx, doc)
	if err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Service) GetDoc(ctx context.Context, tenantID, id string) (*models.Doc, error) {
	d, err := s.repo.FindDocByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, ErrNotFound
	}
	return d, nil
}

func (s *Service) ListDocs(ctx context.Context, tenantID string, offset, limit int, opts *repository.ListDocsOpts) ([]models.Doc, int64, error) {
	if limit < 1 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.ListDocs(ctx, tenantID, offset, limit, opts)
}

func (s *Service) UpdateDoc(ctx context.Context, tenantID, id string, input *models.UpdateDocInput) (*models.Doc, error) {
	existing, err := s.repo.FindDocByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrNotFound
	}

	updated, err := s.repo.UpdateDoc(ctx, tenantID, id, input)
	if err != nil {
		return nil, err
	}
	if updated == nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteDoc(ctx context.Context, tenantID, id string) error {
	existing, err := s.repo.FindDocByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrNotFound
	}
	return s.repo.DeleteDoc(ctx, tenantID, id)
}

// ====== Versions ======

func (s *Service) GetDocVersions(ctx context.Context, tenantID, docID string) ([]models.DocVersion, error) {
	// verify doc exists
	_, err := s.repo.FindDocByID(ctx, tenantID, docID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetDocVersions(ctx, docID)
}

// ====== Search / RAG ======

func (s *Service) Search(ctx context.Context, tenantID, query string, spaceID *string, limit int) ([]models.SearchResult, error) {
	if query == "" {
		return nil, ErrInvalidInput
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}
	return s.repo.Search(ctx, tenantID, query, spaceID, limit)
}

func (s *Service) Retrieve(ctx context.Context, tenantID, query string, spaceID *string, topK int) ([]models.SearchResult, error) {
	if topK < 1 || topK > 20 {
		topK = 5
	}
	return s.repo.Search(ctx, tenantID, query, spaceID, topK)
}

// ====== Document Center ======

func (s *Service) ListDocsByType(ctx context.Context, tenantID string, offset, limit int, tag *string, search *string) ([]models.Doc, int64, error) {
	opts := &repository.ListDocsOpts{
		Type:   stringPtr("docs"),
		Tag:    tag,
		Search: search,
	}
	return s.repo.ListDocs(ctx, tenantID, offset, limit, opts)
}

func (s *Service) GetDocTags(ctx context.Context, tenantID string) ([]models.DocTag, error) {
	return s.repo.GetDocTags(ctx, tenantID)
}

func (s *Service) GetDocToc(ctx context.Context, tenantID string) ([]models.DocTocItem, error) {
	return s.repo.GetDocToc(ctx, tenantID)
}

// ====== Sync ======

func (s *Service) TriggerSync(ctx context.Context, tenantID string, source *string) (*models.SyncLog, error) {
	sl := &models.SyncLog{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Status:    models.SyncStatusSuccess,
		Source:    source,
		TotalDocs: 0,
		StartedAt: time.Now(),
	}
	now := time.Now()
	sl.CompletedAt = &now

	err := s.repo.CreateSyncLog(ctx, sl)
	return sl, err
}

func (s *Service) GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	if limit < 1 || limit > 50 {
		limit = 10
	}
	return s.repo.ListSyncLogs(ctx, tenantID, limit)
}

// ====== Graph ======

func (s *Service) GetGraph(ctx context.Context, tenantID, spaceID *string) (*models.KnowledgeGraph, error) {
	nodes := make([]models.GraphNode, 0)
	edges := make([]models.GraphEdge, 0)

	var spaces []models.Space
	var err error
	if spaceID != nil && *spaceID != "" {
		space, e := s.repo.FindSpaceByID(ctx, *tenantID, *spaceID)
		if e != nil {
			return nil, e
		}
		if space == nil {
			return nil, ErrNotFound
		}
		spaces = []models.Space{*space}
	} else {
		spaces, _, err = s.repo.ListSpaces(ctx, *tenantID, 0, 20, nil)
		if err != nil {
			return nil, err
		}
	}

	for _, space := range spaces {
		nodes = append(nodes, models.GraphNode{ID: space.ID, Type: "space", Label: space.Name})

		docs, _, err := s.repo.ListDocs(ctx, *tenantID, 0, 50, &repository.ListDocsOpts{SpaceID: &space.ID})
		if err != nil {
			continue
		}
		for _, doc := range docs {
			nodes = append(nodes, models.GraphNode{ID: doc.ID, Type: "doc", Label: doc.Title})
			edges = append(edges, models.GraphEdge{Source: space.ID, Target: doc.ID, Relation: "contains"})

			for _, tag := range doc.Tags {
				tagID := "tag-" + tag
				if !nodeExists(nodes, tagID) {
					nodes = append(nodes, models.GraphNode{ID: tagID, Type: "tag", Label: tag})
				}
				edges = append(edges, models.GraphEdge{Source: doc.ID, Target: tagID, Relation: "tagged"})
			}
		}
	}

	return &models.KnowledgeGraph{Nodes: nodes, Edges: edges}, nil
}

func nodeExists(nodes []models.GraphNode, id string) bool {
	for _, n := range nodes {
		if n.ID == id {
			return true
		}
	}
	return false
}

func stringPtr(s string) *string {
	return &s
}
