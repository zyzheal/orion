package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/knowledge/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateDoc(ctx context.Context, doc *models.Document) error
	CreateSpace(ctx context.Context, space *models.Space) error
	CreateSyncLog(ctx context.Context, log *models.SyncLog) error
	DeleteDoc(ctx context.Context, id string) error
	DeleteDocsBySpace(ctx context.Context, spaceID string) error
	DeleteSpace(ctx context.Context, id string) error
	GetDocByID(ctx context.Context, id string) (*models.Document, error)
	GetDocTags(ctx context.Context, tenantID string) ([]string, error)
	GetDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error)
	GetSpaceByID(ctx context.Context, id string) (*models.Space, error)
	GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error)
	ListDocs(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error)
	ListDocsByType(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error)
	ListSpaces(ctx context.Context, tenantID string, q models.SpaceListQuery) ([]models.Space, error)
	Retrieve(ctx context.Context, tenantID string, query string, spaceID string, topK *int) ([]models.RAGRetrieveResult, error)
	UpdateDoc(ctx context.Context, id string, updates map[string]interface{}) error
	UpdateSpace(ctx context.Context, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Space operations ---

func (s *Service) ListSpaces(ctx context.Context, tenantID string, q models.SpaceListQuery) ([]models.Space, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	return s.repo.ListSpaces(ctx, tenantID, q)
}

func (s *Service) CreateSpace(ctx context.Context, tenantID string, req models.CreateSpaceRequest) (*models.Space, error) {
	space := &models.Space{
		TenantID:    tenantID,
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
		TeamID:      req.TeamID,
		OwnerID:     req.OwnerID,
	}
	if space.Type == "" {
		space.Type = "public"
	}
	if space.OwnerID == "" {
		space.OwnerID = "system"
	}
	if err := s.repo.CreateSpace(ctx, space); err != nil {
		return nil, err
	}
	return space, nil
}

func (s *Service) GetSpace(ctx context.Context, id string) (*models.Space, error) {
	return s.repo.GetSpaceByID(ctx, id)
}

func (s *Service) UpdateSpace(ctx context.Context, id string, req models.UpdateSpaceRequest) (*models.Space, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.TeamID != nil {
		updates["team_id"] = *req.TeamID
	}
	if err := s.repo.UpdateSpace(ctx, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetSpaceByID(ctx, id)
}

func (s *Service) DeleteSpace(ctx context.Context, id string) error {
	// Cascade delete docs for this space.
	if err := s.repo.DeleteDocsBySpace(ctx, id); err != nil {
		return err
	}
	return s.repo.DeleteSpace(ctx, id)
}

// --- Document operations ---

func (s *Service) ListDocs(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	return s.repo.ListDocs(ctx, tenantID, q)
}

func (s *Service) ListDocsByType(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	return s.repo.ListDocsByType(ctx, tenantID, q)
}

func (s *Service) GetDoc(ctx context.Context, id string) (*models.Document, error) {
	return s.repo.GetDocByID(ctx, id)
}

func (s *Service) CreateDoc(ctx context.Context, tenantID string, req models.CreateDocumentRequest) (*models.Document, error) {
	// Verify space exists.
	if _, err := s.GetSpace(ctx, req.SpaceID); err != nil {
		return nil, fmt.Errorf("space not found: %w", err)
	}
	doc := &models.Document{
		TenantID: tenantID,
		Title:    req.Title,
		Content:  req.Content,
		SpaceID:  req.SpaceID,
		Tags:     req.Tags,
		Status:   req.Status,
		AuthorID: req.AuthorID,
	}
	if doc.Status == "" {
		doc.Status = "draft"
	}
	if err := s.repo.CreateDoc(ctx, doc); err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Service) UpdateDoc(ctx context.Context, id string, req models.UpdateDocumentRequest) (*models.Document, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Content != nil {
		updates["content"] = *req.Content
	}
	if req.Tags != nil {
		updates["tags"] = *req.Tags
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if err := s.repo.UpdateDoc(ctx, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetDocByID(ctx, id)
}

func (s *Service) DeleteDoc(ctx context.Context, id string) error {
	return s.repo.DeleteDoc(ctx, id)
}

func (s *Service) GetDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	return s.repo.GetDocVersions(ctx, docID)
}

// --- Doc center helpers ---

func (s *Service) GetDocTags(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetDocTags(ctx, tenantID)
}

func (s *Service) GetDocToc(ctx context.Context, tenantID string) ([]models.Document, error) {
	// Return published documents ordered by title for TOC.
	q := models.DocListQuery{Status: "published", Limit: 200}
	return s.repo.ListDocs(ctx, tenantID, q)
}

// --- Sync operations ---

func (s *Service) TriggerSync(ctx context.Context, tenantID string, source string) (*models.SyncLog, error) {
	log := &models.SyncLog{
		TenantID: tenantID,
		Source:   source,
		Status:   "running",
	}
	if err := s.repo.CreateSyncLog(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

func (s *Service) GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	return s.repo.GetSyncLogs(ctx, tenantID, limit)
}

// --- RAG operations ---

func (s *Service) Retrieve(ctx context.Context, tenantID string, query string, req models.RetrieveRequest) ([]models.RAGRetrieveResult, error) {
	var topK *int
	if req.TopK != nil {
		topK = req.TopK
	}
	return s.repo.Retrieve(ctx, tenantID, query, req.SpaceID, topK)
}

// --- Errors ---

var (

	ErrSpaceNotFound    = errors.New("space not found")
	ErrDocumentNotFound = errors.New("document not found")
)

func IsNotFound(err error) bool {
	return err == sql.ErrNoRows ||
		errors.Is(err, sentinel.NotFound) ||
		errors.Is(err, ErrSpaceNotFound) ||
		errors.Is(err, ErrDocumentNotFound)
}
