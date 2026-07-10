package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/knowledge-svc-go/internal/models"
	"orion/knowledge-svc-go/internal/repository"
)

// KnowledgeService handles knowledge base business logic.
type KnowledgeService struct {
	repo *repository.KnowledgeRepository
}

func NewKnowledgeService(repo *repository.KnowledgeRepository) *KnowledgeService {
	return &KnowledgeService{repo: repo}
}

// ============================================================================
// Space operations
// ============================================================================

func (s *KnowledgeService) CreateSpace(ctx context.Context, tenantID string, req models.CreateSpaceRequest) (*models.KnowledgeSpace, error) {
	if tenantID == "" || req.Name == "" {
		return nil, ErrInvalidInput
	}

	source := req.Source
	if source == nil {
		src := string(models.ContentSourceManual)
		source = &src
	}

	ownerID := req.OwnerID
	if ownerID == "" {
		ownerID = "system"
	}

	if req.Type == "" {
		req.Type = models.SpaceTypePublic
	}

	space := &models.KnowledgeSpace{
		ID:          newID(),
		TenantID:    tenantID,
		Name:        req.Name,
		Type:        req.Type,
		Source:      source,
		OwnerID:     ownerID,
		TeamID:      req.TeamID,
		Description: req.Description,
		DocCount:    0,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := s.repo.CreateSpace(ctx, space); err != nil {
		return nil, fmt.Errorf("failed to create space: %w", err)
	}

	return space, nil
}

func (s *KnowledgeService) GetSpace(ctx context.Context, id string) (*models.KnowledgeSpace, error) {
	space, err := s.repo.FindSpaceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get space: %w", err)
	}
	if space == nil {
		return nil, ErrSpaceNotFound
	}
	return space, nil
}

func (s *KnowledgeService) ListSpaces(ctx context.Context, tenantID string, filters models.SpaceListFilters) ([]models.KnowledgeSpace, error) {
	if filters.Limit == 0 {
		filters.Limit = 50
	}
	return s.repo.ListSpaces(ctx, tenantID, filters)
}

func (s *KnowledgeService) UpdateSpace(ctx context.Context, id string, updates map[string]interface{}) (*models.KnowledgeSpace, error) {
	space, err := s.repo.FindSpaceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get space: %w", err)
	}
	if space == nil {
		return nil, ErrSpaceNotFound
	}

	if err := s.repo.UpdateSpace(ctx, id, updates); err != nil {
		return nil, fmt.Errorf("failed to update space: %w", err)
	}

	updated, err := s.repo.FindSpaceByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated space: %w", err)
	}
	return updated, nil
}

func (s *KnowledgeService) DeleteSpace(ctx context.Context, id string) error {
	space, err := s.repo.FindSpaceByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get space: %w", err)
	}
	if space == nil {
		return ErrSpaceNotFound
	}
	if err := s.repo.DeleteSpace(ctx, id); err != nil {
		return fmt.Errorf("failed to delete space: %w", err)
	}
	return nil
}

// ============================================================================
// Document operations
// ============================================================================

func (s *KnowledgeService) CreateDoc(ctx context.Context, tenantID string, req models.CreateDocRequest) (*models.KnowledgeDoc, error) {
	if tenantID == "" || req.Title == "" || req.Content == "" || req.SpaceID == "" {
		return nil, ErrInvalidInput
	}

	// Verify space exists and belongs to this tenant (mirrors TS service.createDoc)
	space, err := s.repo.FindSpaceByTenantID(ctx, tenantID, req.SpaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get space: %w", err)
	}
	if space == nil {
		return nil, ErrSpaceNotFound
	}

	source := req.Source
	if source == nil {
		src := string(models.ContentSourceManual)
		source = &src
	}

	docType := req.Type
	if docType == "" {
		docType = models.DocTypeKnowledge
	}

	docStatus := req.Status
	if docStatus == "" {
		docStatus = models.DocStatusDraft
	}

	tagsBytes, _ := json.Marshal(req.Tags)

	now := time.Now().UTC()
	doc := &models.KnowledgeDoc{
		ID:        newID(),
		TenantID:  tenantID,
		SpaceID:   req.SpaceID,
		Title:     req.Title,
		Content:   req.Content,
		Type:      docType,
		Source:    source,
		Tags:      tagsBytes,
		Status:    docStatus,
		Version:   1,
		AuthorID:  req.AuthorID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.CreateDoc(ctx, doc); err != nil {
		return nil, fmt.Errorf("failed to create doc: %w", err)
	}

	return doc, nil
}

func (s *KnowledgeService) GetDoc(ctx context.Context, id string) (*models.KnowledgeDoc, error) {
	doc, err := s.repo.FindDocByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get doc: %w", err)
	}
	if doc == nil {
		return nil, ErrDocNotFound
	}
	return doc, nil
}

func (s *KnowledgeService) ListDocs(ctx context.Context, tenantID string, filters models.DocListFilters) ([]models.KnowledgeDoc, error) {
	if filters.Limit == 0 {
		filters.Limit = 50
	}
	return s.repo.ListDocs(ctx, tenantID, filters)
}

// ListDocsByType lists documents of a specific type (e.g. "docs" for the document center).
// This mirrors TS KnowledgeService.listDocsByType() which passes type=docs to the repository.
func (s *KnowledgeService) ListDocsByType(ctx context.Context, tenantID string, filters models.DocListFilters) ([]models.KnowledgeDoc, error) {
	filters.Type = strPtr(string(models.DocTypeDocs))
	return s.ListDocs(ctx, tenantID, filters)
}

func (s *KnowledgeService) UpdateDoc(ctx context.Context, id string, updates map[string]interface{}) (*models.KnowledgeDoc, error) {
	doc, err := s.repo.FindDocByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get doc: %w", err)
	}
	if doc == nil {
		return nil, ErrDocNotFound
	}

	// If content changed, bump version and create a snapshot
	if _, hasContent := updates["content"]; hasContent {
		newVersion, err := s.repo.GetNextDocVersion(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to get next version: %w", err)
		}
		updates["version"] = newVersion

		// Create version snapshot before updating doc
		title := doc.Title
		if t, ok := updates["title"].(string); ok && t != "" {
			title = t
		}
		content, _ := updates["content"].(string)
		tags := doc.Tags
		if t, ok := updates["tags"].([]byte); ok {
			tags = t
		}

		version := &models.DocVersion{
			ID:        newID(),
			DocID:     id,
			Version:   newVersion,
			Title:     title,
			Content:   content,
			Tags:      tags,
			CreatedAt: time.Now().UTC(),
		}
		if err := s.repo.CreateDocVersion(ctx, version); err != nil {
			return nil, fmt.Errorf("failed to create doc version snapshot: %w", err)
		}
	}

	if err := s.repo.UpdateDoc(ctx, id, updates); err != nil {
		return nil, fmt.Errorf("failed to update doc: %w", err)
	}

	updated, err := s.repo.FindDocByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get updated doc: %w", err)
	}
	return updated, nil
}

func (s *KnowledgeService) DeleteDoc(ctx context.Context, id string) error {
	doc, err := s.repo.FindDocByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get doc: %w", err)
	}
	if doc == nil {
		return ErrDocNotFound
	}
	if err := s.repo.DeleteDoc(ctx, id); err != nil {
		return fmt.Errorf("failed to delete doc: %w", err)
	}
	return nil
}

func (s *KnowledgeService) GetDocVersions(ctx context.Context, docID string) ([]models.DocVersion, error) {
	doc, err := s.repo.FindDocByID(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("failed to get doc: %w", err)
	}
	if doc == nil {
		return nil, ErrDocNotFound
	}
	return s.repo.ListDocVersions(ctx, docID)
}

// ============================================================================
// RAG operations
// ============================================================================

func (s *KnowledgeService) Search(ctx context.Context, tenantID, query string, spaceID *string, limit int) ([]models.KnowledgeSearchResult, error) {
	if query == "" {
		return nil, ErrInvalidInput
	}
	if limit == 0 {
		limit = 10
	}
	return s.repo.SearchDocs(ctx, tenantID, query, spaceID, limit)
}

func (s *KnowledgeService) Retrieve(ctx context.Context, tenantID, query string, spaceID *string, topK int) ([]models.KnowledgeSearchResult, error) {
	// RAG retrieve: semantic or text search for retrieval purposes
	return s.Search(ctx, tenantID, query, spaceID, topK)
}

// ============================================================================
// Document center operations
// ============================================================================

func (s *KnowledgeService) GetDocTags(ctx context.Context, tenantID string) ([]models.DocTag, error) {
	return s.repo.GetDocTags(ctx, tenantID)
}

// GetDocToc returns published docs of type 'docs' as a flat table of contents.
// Mirrors TS KnowledgeService.getDocToc().
func (s *KnowledgeService) GetDocToc(ctx context.Context, tenantID string) ([]models.DocTocItem, error) {
	docs, err := s.repo.ListDocs(ctx, tenantID, models.DocListFilters{
		Status: strPtr(string(models.DocStatusPublished)),
		Type:   strPtr(string(models.DocTypeDocs)),
		Limit:  200,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get toc: %w", err)
	}

	items := make([]models.DocTocItem, 0, len(docs))
	for i, doc := range docs {
		items = append(items, models.DocTocItem{
			ID:       doc.ID,
			Title:    doc.Title,
			ParentID: nil,
			Order:    i,
		})
	}
	return items, nil
}

func (s *KnowledgeService) TriggerSync(ctx context.Context, tenantID string, source *string) (*models.SyncLog, error) {
	now := time.Now().UTC()
	syncID := newID()
	log := &models.SyncLog{
		ID:          syncID,
		Status:      "success",
		StartedAt:   now,
		CompletedAt: &now,
		TotalDocs:   0,
		SuccessDocs: 0,
		FailedDocs:  0,
	}

	// In production: trigger async document sync from external source
	return log, nil
}

func (s *KnowledgeService) GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	if limit == 0 {
		limit = 10
	}
	// In production, store sync logs in database
	return []models.SyncLog{}, nil
}

// ============================================================================
// Knowledge Graph
// ============================================================================

func (s *KnowledgeService) GetGraph(ctx context.Context, tenantID string, spaceID *string) (*models.KnowledgeGraph, error) {
	var spaces []models.KnowledgeSpace
	var err error

	if spaceID != nil && *spaceID != "" {
		space, e := s.repo.FindSpaceByTenantID(ctx, tenantID, *spaceID)
		if e != nil {
			return nil, e
		}
		if space != nil {
			spaces = []models.KnowledgeSpace{*space}
		}
	} else {
		spaces, err = s.repo.ListSpaces(ctx, tenantID, models.SpaceListFilters{Limit: 20})
		if err != nil {
			return nil, fmt.Errorf("failed to list spaces for graph: %w", err)
		}
	}

	graph := &models.KnowledgeGraph{
		Nodes: make([]models.GraphNode, 0),
		Edges: make([]models.GraphEdge, 0),
	}

	for _, space := range spaces {
		graph.Nodes = append(graph.Nodes, models.GraphNode{
			ID:    space.ID,
			Type:  "space",
			Label: space.Name,
		})

		docs, err := s.repo.ListDocs(ctx, tenantID, models.DocListFilters{SpaceID: &space.ID, Limit: 50})
		if err != nil {
			continue
		}

		for _, doc := range docs {
			graph.Nodes = append(graph.Nodes, models.GraphNode{
				ID:    doc.ID,
				Type:  "doc",
				Label: doc.Title,
			})
			// Attach spaceId as label
			graph.Nodes[len(graph.Nodes)-1].Label = fmt.Sprintf("%s (%s)", doc.Title, doc.SpaceID)
			graph.Edges = append(graph.Edges, models.GraphEdge{
				Source:   space.ID,
				Target:   doc.ID,
				Relation: "contains",
			})

			var tags []string
			_ = json.Unmarshal(doc.Tags, &tags)
			for _, tag := range tags {
				tagID := "tag-" + tag
				if !graphHasNode(graph, tagID) {
					graph.Nodes = append(graph.Nodes, models.GraphNode{
						ID:    tagID,
						Type:  "tag",
						Label: tag,
					})
				}
				graph.Edges = append(graph.Edges, models.GraphEdge{
					Source:   doc.ID,
					Target:   tagID,
					Relation: "tagged",
				})
			}
		}
	}

	return graph, nil
}

func graphHasNode(g *models.KnowledgeGraph, id string) bool {
	for _, n := range g.Nodes {
		if n.ID == id {
			return true
		}
	}
	return false
}

// ============================================================================
// Errors
// ============================================================================

var (
	ErrInvalidInput  = errors.New("invalid input")
	ErrSpaceNotFound = errors.New("space not found")
	ErrDocNotFound   = errors.New("doc not found")
)

// ============================================================================
// Helpers
// ============================================================================

func strPtr(s string) *string {
	return &s
}
