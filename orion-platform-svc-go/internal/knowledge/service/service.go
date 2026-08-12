package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/knowledge/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateDoc(ctx context.Context, doc *models.Document) error
	CreateSpace(ctx context.Context, space *models.Space) error
	CreateSyncLog(ctx context.Context, log *models.SyncLog) error
	DeleteDoc(ctx context.Context, id string, tenantID string) error
	DeleteDocsBySpace(ctx context.Context, spaceID string, tenantID string) error
	DeleteSpace(ctx context.Context, id string, tenantID string) error
	GetDocByID(ctx context.Context, id string, tenantID string) (*models.Document, error)
	GetDocTags(ctx context.Context, tenantID string) ([]string, error)
	GetDocVersions(ctx context.Context, docID string, tenantID string) ([]models.DocVersion, error)
	GetSpaceByID(ctx context.Context, id string, tenantID string) (*models.Space, error)
	GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error)
	ListDocs(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error)
	ListDocsByType(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error)
	ListSpaces(ctx context.Context, tenantID string, q models.SpaceListQuery) ([]models.Space, error)
	Retrieve(ctx context.Context, tenantID string, query string, spaceID string, topK *int) ([]models.RAGRetrieveResult, error)
	UpdateDoc(ctx context.Context, id string, tenantID string, updates map[string]interface{}) error
	UpdateSpace(ctx context.Context, id string, tenantID string, updates map[string]interface{}) error
}

// RAGRepositoryInterface defines RAG-specific repository methods.
type RAGRepositoryInterface interface {
	CreateConversation(ctx context.Context, conv *models.Conversation) error
	GetConversation(ctx context.Context, id, tenantID string) (*models.Conversation, error)
	ListConversations(ctx context.Context, tenantID, userID string, limit int) ([]models.Conversation, error)
	SaveMessage(ctx context.Context, msg *models.ChatMessage) error
	GetMessagesByConversation(ctx context.Context, convID string, limit int) ([]models.ChatMessage, error)
	SaveFeedback(ctx context.Context, fb *models.FeedbackEvent) error
	SaveUserCorrection(ctx context.Context, uc *models.UserCorrection) error
	GetUserCorrections(ctx context.Context, tenantID, userID, hash string) ([]models.UserCorrection, error)
	GetSemanticCache(ctx context.Context, tenantID, queryHash string) (*models.SemanticCache, error)
	SaveSemanticCache(ctx context.Context, sc *models.SemanticCache, ttlHours int) error
	SaveEvalMetric(ctx context.Context, m *models.EvalMetric) error
	GetEvalMetrics(ctx context.Context, tenantID string) (*models.EvalMetric, error)
	SaveEvalGroundTruth(ctx context.Context, gt *models.EvalGroundTruth) error
	ListEvalGroundTruth(ctx context.Context, tenantID string) ([]models.EvalGroundTruth, error)
	DeleteEvalGroundTruth(ctx context.Context, id string) error
	SavePromptTemplate(ctx context.Context, tmpl *models.PromptTemplate) error
	GetActivePromptTemplate(ctx context.Context, name string) (*models.PromptTemplate, error)
	ListPromptTemplates(ctx context.Context) ([]models.PromptTemplate, error)
	SaveQueryAuditLog(ctx context.Context, log *models.RAGQueryAuditLog) error
	ListQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error)
	ListFlaggedQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error)
	CountQueryAuditLogs(ctx context.Context, tenantID string) (int, error)
}

type Service struct {
	repo        RepositoryInterface
	ragRepo     RAGRepositoryInterface
	rag         *RAGPipelineService
	promptMgr   *PromptTemplateManager
	safety      *SafetyFilter
}

func NewService(repo RepositoryInterface) *Service {
	s := &Service{repo: repo, rag: NewRAGPipelineService(repo, DefaultPipelineConfig()), safety: NewSafetyFilter()}
	if r, ok := repo.(RAGRepositoryInterface); ok {
		s.ragRepo = r
		s.rag.SetRAGRepo(r)
		s.promptMgr = NewPromptTemplateManager(r)
	}
	return s
}

func NewServiceWithConfig(repo RepositoryInterface, config PipelineConfig) *Service {
	s := &Service{repo: repo, rag: NewRAGPipelineService(repo, config)}
	if r, ok := repo.(RAGRepositoryInterface); ok {
		s.ragRepo = r
		s.rag.SetRAGRepo(r)
		s.promptMgr = NewPromptTemplateManager(r)
	}
	return s
}

func (s *Service) GetRAGPipeline() *RAGPipelineService { return s.rag }
func (s *Service) GetRAGRepo() RAGRepositoryInterface   { return s.ragRepo }
func (s *Service) GetPromptMgr() *PromptTemplateManager { return s.promptMgr }

// RAG Service methods used by handlers

type RAGFeedbackResult struct {
	Status string `json:"status"`
}

func (s *Service) HandleFeedback(ctx context.Context, tenantID, userID string, req models.RAGFeedbackRequest) (*RAGFeedbackResult, error) {
	if s.ragRepo == nil {
		return &RAGFeedbackResult{Status: "ok"}, nil
	}

	fb := &models.FeedbackEvent{
		TenantID: tenantID,
		UserID:   userID,
		IsPositive: req.IsPositive,
	}
	if err := s.ragRepo.SaveFeedback(ctx, fb); err != nil {
		return nil, err
	}

	if !req.IsPositive && req.CorrectedAnswer != "" {
		uc := &models.UserCorrection{
			TenantID:        tenantID,
			UserID:          userID,
			Query:           req.Token,
			CorrectedAnswer: req.CorrectedAnswer,
		}
		if err := s.ragRepo.SaveUserCorrection(ctx, uc); err != nil {
			return nil, err
		}
	}

	return &RAGFeedbackResult{Status: "recorded"}, nil
}

func (s *Service) CreateConversation(ctx context.Context, tenantID, userID string, req models.RAGQueryRequest) (*models.Conversation, error) {
	if s.ragRepo == nil {
		return &models.Conversation{ID: "no-persist"}, nil
	}
	conv := &models.Conversation{
		TenantID: tenantID,
		UserID:   userID,
		Title:    req.Query[:minInt(len(req.Query), 100)],
		SpaceID:  req.SpaceID,
	}
	if err := s.ragRepo.CreateConversation(ctx, conv); err != nil {
		return nil, err
	}
	return conv, nil
}

func (s *Service) SaveRAGMessage(ctx context.Context, tenantID string, convID string, req models.RAGQueryRequest, resp models.RAGQueryResponse) error {
	if s.ragRepo == nil {
		return nil
	}
	userMsg := &models.ChatMessage{ConvID: convID, TenantID: tenantID, Role: "user", Content: req.Query}
	if err := s.ragRepo.SaveMessage(ctx, userMsg); err != nil {
		return err
	}
	assistantMsg := &models.ChatMessage{ConvID: convID, TenantID: tenantID, Role: "assistant", Content: resp.Answer, Sources: resp.Sources, Confidence: resp.Confidence}
	return s.ragRepo.SaveMessage(ctx, assistantMsg)
}

func (s *Service) GetEvalMetrics(ctx context.Context, tenantID string) (*models.EvalMetric, error) {
	if s.ragRepo == nil {
		return &models.EvalMetric{}, nil
	}
	return s.ragRepo.GetEvalMetrics(ctx, tenantID)
}

func (s *Service) GetEvalGroundTruth(ctx context.Context, tenantID string) ([]models.EvalGroundTruth, error) {
	if s.ragRepo == nil {
		return nil, nil
	}
	return s.ragRepo.ListEvalGroundTruth(ctx, tenantID)
}

func (s *Service) SaveEvalGroundTruth(ctx context.Context, tenantID string, query, goldAnswer string) (*models.EvalGroundTruth, error) {
	if s.ragRepo == nil {
		return nil, nil
	}
	gt := &models.EvalGroundTruth{TenantID: tenantID, Query: query, GoldAnswer: goldAnswer}
	if err := s.ragRepo.SaveEvalGroundTruth(ctx, gt); err != nil {
		return nil, err
	}
	return gt, nil
}

func (s *Service) DeleteEvalGroundTruth(ctx context.Context, id string) error {
	if s.ragRepo == nil {
		return nil
	}
	return s.ragRepo.DeleteEvalGroundTruth(ctx, id)
}

// --- RAG Security Audit ---

func (s *Service) GetSafetyFilter() *SafetyFilter { return s.safety }

func (s *Service) SaveQueryAuditLog(ctx context.Context, log *models.RAGQueryAuditLog) error {
	if s.ragRepo == nil {
		return nil
	}
	return s.ragRepo.SaveQueryAuditLog(ctx, log)
}

func (s *Service) ListQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error) {
	if s.ragRepo == nil {
		return nil, nil
	}
	return s.ragRepo.ListQueryAuditLogs(ctx, tenantID, limit, offset)
}

func (s *Service) ListFlaggedQueryAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.RAGQueryAuditLog, error) {
	if s.ragRepo == nil {
		return nil, nil
	}
	return s.ragRepo.ListFlaggedQueryAuditLogs(ctx, tenantID, limit, offset)
}

func (s *Service) CountQueryAuditLogs(ctx context.Context, tenantID string) (int, error) {
	if s.ragRepo == nil {
		return 0, nil
	}
	return s.ragRepo.CountQueryAuditLogs(ctx, tenantID)
}

// --- Space operations ---

func (s *Service) ListSpaces(ctx context.Context, tenantID string, q models.SpaceListQuery) ([]models.Space, error) {
	if q.Limit <= 0 { q.Limit = 50 }
	return s.repo.ListSpaces(ctx, tenantID, q)
}

func (s *Service) CreateSpace(ctx context.Context, tenantID string, req models.CreateSpaceRequest) (*models.Space, error) {
	space := &models.Space{TenantID: tenantID, Name: req.Name, Type: req.Type, Description: req.Description, TeamID: req.TeamID, OwnerID: req.OwnerID}
	if space.Type == "" { space.Type = "public" }
	if space.OwnerID == "" { space.OwnerID = "system" }
	if err := s.repo.CreateSpace(ctx, space); err != nil { return nil, err }
	return space, nil
}

func (s *Service) GetSpace(ctx context.Context, id string, tenantID string) (*models.Space, error) {
	return s.repo.GetSpaceByID(ctx, id, tenantID)
}

func (s *Service) UpdateSpace(ctx context.Context, id string, tenantID string, req models.UpdateSpaceRequest) (*models.Space, error) {
	updates := make(map[string]interface{})
	if req.Name != nil { updates["name"] = *req.Name }
	if req.Type != nil { updates["type"] = *req.Type }
	if req.Description != nil { updates["description"] = *req.Description }
	if req.TeamID != nil { updates["team_id"] = *req.TeamID }
	if err := s.repo.UpdateSpace(ctx, id, tenantID, updates); err != nil { return nil, err }
	return s.repo.GetSpaceByID(ctx, id, tenantID)
}

func (s *Service) DeleteSpace(ctx context.Context, id string, tenantID string) error {
	s.repo.DeleteDocsBySpace(ctx, id, tenantID)
	return s.repo.DeleteSpace(ctx, id, tenantID)
}

func (s *Service) ListDocs(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	if q.Limit <= 0 { q.Limit = 50 }
	return s.repo.ListDocs(ctx, tenantID, q)
}

func (s *Service) ListDocsByType(ctx context.Context, tenantID string, q models.DocListQuery) ([]models.Document, error) {
	if q.Limit <= 0 { q.Limit = 50 }
	return s.repo.ListDocsByType(ctx, tenantID, q)
}

func (s *Service) GetDoc(ctx context.Context, id string, tenantID string) (*models.Document, error) {
	return s.repo.GetDocByID(ctx, id, tenantID)
}

func (s *Service) CreateDoc(ctx context.Context, tenantID string, req models.CreateDocumentRequest) (*models.Document, error) {
	if _, err := s.GetSpace(ctx, req.SpaceID, tenantID); err != nil { return nil, fmt.Errorf("space not found: %w", err) }
	doc := &models.Document{TenantID: tenantID, Title: req.Title, Content: req.Content, SpaceID: req.SpaceID, Tags: req.Tags, Status: req.Status, AuthorID: req.AuthorID}
	if doc.Status == "" { doc.Status = "draft" }
	if err := s.repo.CreateDoc(ctx, doc); err != nil { return nil, err }
	return doc, nil
}

func (s *Service) UpdateDoc(ctx context.Context, id string, tenantID string, req models.UpdateDocumentRequest) (*models.Document, error) {
	updates := make(map[string]interface{})
	if req.Title != nil { updates["title"] = *req.Title }
	if req.Content != nil { updates["content"] = *req.Content }
	if req.Tags != nil { updates["tags"] = *req.Tags }
	if req.Status != nil { updates["status"] = *req.Status }
	if err := s.repo.UpdateDoc(ctx, id, tenantID, updates); err != nil { return nil, err }
	return s.repo.GetDocByID(ctx, id, tenantID)
}

func (s *Service) DeleteDoc(ctx context.Context, id string, tenantID string) error {
	return s.repo.DeleteDoc(ctx, id, tenantID)
}

func (s *Service) GetDocVersions(ctx context.Context, docID string, tenantID string) ([]models.DocVersion, error) {
	return s.repo.GetDocVersions(ctx, docID, tenantID)
}

func (s *Service) GetDocTags(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetDocTags(ctx, tenantID)
}

func (s *Service) GetDocToc(ctx context.Context, tenantID string) ([]models.Document, error) {
	q := models.DocListQuery{Status: "published", Limit: 200}
	return s.repo.ListDocs(ctx, tenantID, q)
}

func (s *Service) TriggerSync(ctx context.Context, tenantID string, source string) (*models.SyncLog, error) {
	log := &models.SyncLog{TenantID: tenantID, Source: source, Status: "running"}
	if err := s.repo.CreateSyncLog(ctx, log); err != nil { return nil, err }
	return log, nil
}

func (s *Service) GetSyncLogs(ctx context.Context, tenantID string, limit int) ([]models.SyncLog, error) {
	return s.repo.GetSyncLogs(ctx, tenantID, limit)
}

func (s *Service) Retrieve(ctx context.Context, tenantID string, query string, req models.RetrieveRequest) ([]models.RAGRetrieveResult, error) {
	var topK *int
	if req.TopK != nil { topK = req.TopK }
	return s.repo.Retrieve(ctx, tenantID, query, req.SpaceID, topK)
}

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
