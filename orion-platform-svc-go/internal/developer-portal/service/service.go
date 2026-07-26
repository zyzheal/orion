package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"orion/platform-svc-go/internal/developer-portal/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	ClearHistory(ctx context.Context, tenantID, requestID string) error
	Create(ctx context.Context, m *models.DeveloperPortal) error
	CreateDocument(ctx context.Context, doc *models.PortalDocument) error
	CreateDocumentVersion(ctx context.Context, v *models.DocumentVersion) error
	CreateMockRule(ctx context.Context, rule *models.MockRule) error
	CreatePlaygroundRequest(ctx context.Context, preq *models.PlaygroundRequest) error
	CreateSDKTask(ctx context.Context, task *models.SDKTask) error
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	Delete(ctx context.Context, tenantID, id string) error
	DeleteDocument(ctx context.Context, tenantID, id string) error
	DeleteMockRule(ctx context.Context, tenantID, id string) error
	DeletePlaygroundRequest(ctx context.Context, tenantID, id string) error
	DeleteSDKTask(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error)
	GetCategories(ctx context.Context, tenantID string) ([]models.CategoryInfo, error)
	GetDocumentByID(ctx context.Context, tenantID, id string) (*models.PortalDocument, error)
	GetDocumentStats(ctx context.Context, tenantID string) (*models.DocumentStats, error)
	GetDocumentVersions(ctx context.Context, tenantID, documentID string) ([]models.DocumentVersion, error)
	GetMockRuleByID(ctx context.Context, tenantID, id string) (*models.MockRule, error)
	GetMockRuleStats(ctx context.Context, tenantID string) (*models.MockRuleStats, error)
	GetPlaygroundRequestByID(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error)
	GetPlaygroundStats(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error)
	GetPopularDocuments(ctx context.Context, tenantID string) ([]models.PortalDocument, error)
	GetResponseHistory(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) ([]models.ResponseHistoryEntry, int, error)
	GetSDKTaskByID(ctx context.Context, tenantID, id string) (*models.SDKTask, error)
	GetSDKTaskStats(ctx context.Context, tenantID string) (*models.SDKTaskStats, error)
	GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	GetSubscriptionByUserAndAPI(ctx context.Context, tenantID, userID, apiName string) (*models.Subscription, error)
	GetSubscriptionStats(ctx context.Context, tenantID string) (*models.SubscriptionStats, error)
	GetUsageRecords(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) ([]models.UsageRecord, int, error)
	IncrementViews(ctx context.Context, tenantID, id string) error
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error)
	ListDocuments(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error)
	ListMockRules(ctx context.Context, tenantID string, filter models.MockRuleFilter) ([]models.MockRule, int, error)
	ListPlaygroundRequests(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) ([]models.PlaygroundRequest, int, error)
	ListSDKTasks(ctx context.Context, tenantID string, filter models.SDKTaskFilter) ([]models.SDKTask, int, error)
	ListSubscriptions(ctx context.Context, tenantID string, filter models.SubscriptionFilter) ([]models.Subscription, int, error)
	RecordHelpful(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error)
	SearchDocuments(ctx context.Context, tenantID, query string) ([]models.PortalDocument, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]any) error
	UpdateDocument(ctx context.Context, tenantID string, doc *models.PortalDocument) error
	UpdateMockRule(ctx context.Context, tenantID string, rule *models.MockRule) error
	UpdatePlaygroundRequest(ctx context.Context, tenantID string, preq *models.PlaygroundRequest) error
	UpdateSDKTask(ctx context.Context, tenantID string, task *models.SDKTask) error
	UpdateSubscription(ctx context.Context, tenantID string, sub *models.Subscription) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------- DeveloperPortal (legacy CRUD) ----------

func (s *Service) Create(c context.Context, tenantID string, req models.CreateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
	m := &models.DeveloperPortal{TenantID: tenantID, Name: req.Name}
	if err := s.repo.Create(c, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(c context.Context, tenantID, id string) (*models.DeveloperPortal, error) {
	return s.repo.GetByID(c, tenantID, id)
}

func (s *Service) List(c context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error) {
	return s.repo.List(c, tenantID, limit, offset)
}

func (s *Service) Update(c context.Context, tenantID, id string, req models.UpdateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(c, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(c, tenantID, id)
}

func (s *Service) Delete(c context.Context, tenantID, id string) error {
	return s.repo.Delete(c, tenantID, id)
}

// ---------- Document CRUD ----------

func (s *Service) CreateDocument(c context.Context, tenantID, userID string, req models.CreateDocumentRequest) (*models.PortalDocument, error) {
	doc := &models.PortalDocument{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Title:     req.Title,
		Category:  req.Category,
		Content:   req.Content,
		Status:    "draft",
		Version:   "1.0",
		CreatedBy: userID,
	}
	if err := s.repo.CreateDocument(c, doc); err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Service) ListDocuments(c context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error) {
	return s.repo.ListDocuments(c, tenantID, page, pageSize)
}

func (s *Service) SearchDocuments(c context.Context, tenantID string, query string) ([]models.PortalDocument, error) {
	return s.repo.SearchDocuments(c, tenantID, query)
}

func (s *Service) GetDocument(c context.Context, tenantID, id string) (*models.PortalDocument, error) {
	doc, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	// Increment view count
	s.repo.IncrementViews(c, tenantID, id)
	return doc, nil
}

func (s *Service) UpdateDocument(c context.Context, tenantID, id string, req models.UpdateDocumentRequest) (*models.PortalDocument, error) {
	existing, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	if req.Title != nil {
		existing.Title = *req.Title
	}
	if req.Category != nil {
		existing.Category = *req.Category
	}
	if req.Content != nil {
		existing.Content = *req.Content
	}
	if err := s.repo.UpdateDocument(c, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteDocument(c context.Context, tenantID, id string) error {
	return s.repo.DeleteDocument(c, tenantID, id)
}

// ---------- Publishing ----------

func (s *Service) PublishDocument(c context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	doc, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	doc.Status = "published"
	if err := s.repo.UpdateDocument(c, tenantID, doc); err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Service) UnpublishDocument(c context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return s.publishWithStatus(c, tenantID, id, "draft")
}

func (s *Service) publishWithStatus(c context.Context, tenantID, id, status string) (*models.PortalDocument, error) {
	doc, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	doc.Status = status
	if err := s.repo.UpdateDocument(c, tenantID, doc); err != nil {
		return nil, err
	}
	return doc, nil
}

// ---------- Version Management ----------

func (s *Service) CreateNewVersion(c context.Context, tenantID, id, version, userID string) (*models.PortalDocument, error) {
	doc, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	// Save old version as a version record
	ver := &models.DocumentVersion{
		ID:         uuid.New().String(),
		DocumentID: id,
		Version:    doc.Version,
		Content:    doc.Content,
		CreatedBy:  userID,
	}
	if err := s.repo.CreateDocumentVersion(c, ver); err != nil {
		return nil, err
	}
	// Update the document to the new version
	doc.Version = version
	if err := s.repo.UpdateDocument(c, tenantID, doc); err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Service) GetDocumentVersions(c context.Context, tenantID, id string) ([]models.DocumentVersion, error) {
	_, err := s.repo.GetDocumentByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("document not found")
	}
	return s.repo.GetDocumentVersions(c, tenantID, id)
}

// ---------- Review Workflow ----------

func (s *Service) SubmitForReview(c context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return s.publishWithStatus(c, tenantID, id, "review")
}

func (s *Service) ApproveReview(c context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return s.PublishDocument(c, tenantID, id, userID)
}

func (s *Service) RejectReview(c context.Context, tenantID, id, userID, reason string) (*models.PortalDocument, error) {
	return s.publishWithStatus(c, tenantID, id, "draft")
}

// ---------- Document Stats ----------

func (s *Service) GetDocumentStats(c context.Context, tenantID string) (*models.DocumentStats, error) {
	return s.repo.GetDocumentStats(c, tenantID)
}

// ---------- Categories ----------

func (s *Service) GetCategories(c context.Context, tenantID string) ([]models.CategoryInfo, error) {
	return s.repo.GetCategories(c, tenantID)
}

// ---------- Popular Documents ----------

func (s *Service) GetPopular(c context.Context, tenantID string) ([]models.PortalDocument, error) {
	return s.repo.GetPopularDocuments(c, tenantID)
}

// ---------- Helpful Feedback ----------

func (s *Service) RecordHelpful(c context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error) {
	return s.repo.RecordHelpful(c, tenantID, id, helpful)
}

// ---------- Mock Rules ----------

func (s *Service) CreateMockRule(c context.Context, tenantID string, req models.CreateMockRuleRequest) (*models.MockRule, error) {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rule := &models.MockRule{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Method:    strings.ToUpper(req.Method),
		Path:      req.Path,
		Responses: req.Responses,
		Enabled:   enabled,
	}
	if err := s.repo.CreateMockRule(c, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) ListMockRules(c context.Context, tenantID string, filter models.MockRuleFilter) (*models.MockRuleListResult, error) {
	items, total, err := s.repo.ListMockRules(c, tenantID, filter)
	if err != nil {
		return nil, err
	}
	return &models.MockRuleListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) GetMockRuleStats(c context.Context, tenantID string) (*models.MockRuleStats, error) {
	return s.repo.GetMockRuleStats(c, tenantID)
}

func (s *Service) GetMockRule(c context.Context, tenantID, id string) (*models.MockRule, error) {
	rule, err := s.repo.GetMockRuleByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("mock rule not found")
	}
	return rule, nil
}

func (s *Service) UpdateMockRule(c context.Context, tenantID, id string, req models.UpdateMockRuleRequest) (*models.MockRule, error) {
	existing, err := s.repo.GetMockRuleByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("mock rule not found")
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Method != nil {
		existing.Method = strings.ToUpper(*req.Method)
	}
	if req.Path != nil {
		existing.Path = *req.Path
	}
	if req.Responses != nil {
		existing.Responses = req.Responses
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if err := s.repo.UpdateMockRule(c, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteMockRule(c context.Context, tenantID, id string) error {
	err := s.repo.DeleteMockRule(c, tenantID, id)
	if err != nil && !isNotFoundError(err) {
		return errors.New("mock rule not found")
	}
	return nil
}

func (s *Service) ToggleMockRule(c context.Context, tenantID, id string) (*models.MockRule, error) {
	existing, err := s.repo.GetMockRuleByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("mock rule not found")
	}
	existing.Enabled = !existing.Enabled
	if err := s.repo.UpdateMockRule(c, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) MatchRequest(c context.Context, tenantID string, method, path string) (*models.MockSimulateResult, error) {
	rules, _, err := s.repo.ListMockRules(c, tenantID, models.MockRuleFilter{Enabled: boolPtr(true)})
	if err != nil {
		return nil, err
	}
	method = strings.ToUpper(method)
	for _, r := range rules {
		if r.Method == method && r.Path == path {
			return &models.MockSimulateResult{Matched: true, Rule: &r, Response: r.Responses}, nil
		}
	}
	return &models.MockSimulateResult{Matched: false}, nil
}

// ---------- SDK Tasks ----------

func (s *Service) GetSupportedLanguages() []models.SDKLanguage {
	return []models.SDKLanguage{
		{Name: "Go", Alias: "go", Version: "1.22"},
		{Name: "Python", Alias: "python", Version: "3.11"},
		{Name: "TypeScript", Alias: "typescript", Version: "5.3"},
		{Name: "Java", Alias: "java", Version: "21"},
		{Name: "C#", Alias: "csharp", Version: "8.0"},
		{Name: "Ruby", Alias: "ruby", Version: "3.2"},
		{Name: "Rust", Alias: "rust", Version: "1.75"},
	}
}

func (s *Service) CreateSDKTask(c context.Context, tenantID string, req models.CreateSDKTaskRequest) (*models.SDKTask, error) {
	task := &models.SDKTask{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		Language: req.Language,
		Status:   "pending",
	}
	if err := s.repo.CreateSDKTask(c, task); err != nil {
		return nil, err
	}
	return task, nil
}

func (s *Service) ListSDKTasks(c context.Context, tenantID string, filter models.SDKTaskFilter) (*models.SDKTaskListResult, error) {
	items, total, err := s.repo.ListSDKTasks(c, tenantID, filter)
	if err != nil {
		return nil, err
	}
	return &models.SDKTaskListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) GetSDKTaskStats(c context.Context, tenantID string) (*models.SDKTaskStats, error) {
	return s.repo.GetSDKTaskStats(c, tenantID)
}

func (s *Service) GetSDKTask(c context.Context, tenantID, id string) (*models.SDKTask, error) {
	task, err := s.repo.GetSDKTaskByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("SDK task not found")
	}
	return task, nil
}

func (s *Service) DeleteSDKTask(c context.Context, tenantID, id string) error {
	err := s.repo.DeleteSDKTask(c, tenantID, id)
	if err != nil && !isNotFoundError(err) {
		return errors.New("SDK task not found")
	}
	return nil
}

func (s *Service) RegenerateTask(c context.Context, tenantID, id string) (*models.SDKTask, error) {
	task, err := s.repo.GetSDKTaskByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("SDK task not found")
	}
	task.Status = "generating"
	task.Error = ""
	task.OutputURL = ""
	if err := s.repo.UpdateSDKTask(c, tenantID, task); err != nil {
		return nil, err
	}
	return task, nil
}

// ---------- Subscriptions ----------

func (s *Service) CreateSubscription(c context.Context, tenantID, userID string, req models.CreateSubscriptionRequest) (*models.Subscription, error) {
	// Check for duplicate
	existing, err := s.repo.GetSubscriptionByUserAndAPI(c, tenantID, userID, req.APIName)
	if err == nil {
		if existing.Status == "approved" || existing.Status == "pending" {
			return nil, errors.New("duplicate subscription")
		}
		// Re-activate old cancelled/rejected subscription
		existing.Status = "pending"
		if req.Reason != "" {
			existing.Reason = req.Reason
		}
		if err := s.repo.UpdateSubscription(c, tenantID, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}
	sub := &models.Subscription{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		UserID:        userID,
		APIName:       req.APIName,
		PlanName:      req.PlanName,
		QuotaPerDay:   safeDeref(req.QuotaPerDay),
		QuotaPerMonth: safeDeref(req.QuotaPerMonth),
		Reason:        req.Reason,
		Status:        "pending",
	}
	if err := s.repo.CreateSubscription(c, sub); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *Service) ListSubscriptions(c context.Context, tenantID string, filter models.SubscriptionFilter) (*models.SubscriptionListResult, error) {
	items, total, err := s.repo.ListSubscriptions(c, tenantID, filter)
	if err != nil {
		return nil, err
	}
	return &models.SubscriptionListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) GetUsageStats(c context.Context, tenantID string) (*models.SubscriptionStats, error) {
	return s.repo.GetSubscriptionStats(c, tenantID)
}

func (s *Service) GetSubscription(c context.Context, tenantID, id string) (*models.Subscription, error) {
	sub, err := s.repo.GetSubscriptionByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("subscription not found")
	}
	return sub, nil
}

func (s *Service) ApproveSubscription(c context.Context, tenantID, id, approvedBy string) (*models.Subscription, error) {
	return s.setSubscriptionStatus(c, tenantID, id, "approved", approvedBy, "")
}

func (s *Service) RejectSubscription(c context.Context, tenantID, id, approvedBy, reason string) (*models.Subscription, error) {
	return s.setSubscriptionStatus(c, tenantID, id, "rejected", approvedBy, reason)
}

func (s *Service) SuspendSubscription(c context.Context, tenantID, id string) (*models.Subscription, error) {
	return s.setSubscriptionStatus(c, tenantID, id, "suspended", "", "")
}

func (s *Service) CancelSubscription(c context.Context, tenantID, id string) (*models.Subscription, error) {
	return s.setSubscriptionStatus(c, tenantID, id, "cancelled", "", "")
}

func (s *Service) setSubscriptionStatus(c context.Context, tenantID, id, status, approvedBy, reason string) (*models.Subscription, error) {
	sub, err := s.repo.GetSubscriptionByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("subscription not found")
	}
	sub.Status = status
	if approvedBy != "" {
		sub.ApprovedBy = approvedBy
	}
	if reason != "" {
		sub.RejectReason = reason
	}
	if err := s.repo.UpdateSubscription(c, tenantID, sub); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *Service) GetUsageRecords(c context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) (*models.UsageRecordListResult, error) {
	items, total, err := s.repo.GetUsageRecords(c, tenantID, subscriptionID, filter)
	if err != nil {
		return nil, errors.New("subscription not found")
	}
	return &models.UsageRecordListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

// ---------- Playground ----------

func (s *Service) QuickExecute(c context.Context, tenantID, userID string, req models.PlaygroundExecuteRequest) (*models.PlaygroundExecuteResult, error) {
	// Simulate an HTTP call — in production this would proxy to a target API
	client := &http.Client{Timeout: 10 * time.Second}
	// Build request
	var body any
	method := strings.ToUpper(req.Method)
	httpReq, err := http.NewRequest(method, req.Path, http.NoBody)
	if err != nil {
		return &models.PlaygroundExecuteResult{Error: err.Error()}, nil
	}
	if headers, ok := req.Headers.(map[string]any); ok {
		for k, v := range headers {
			if s, ok := v.(string); ok {
				httpReq.Header.Set(k, s)
			}
		}
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return &models.PlaygroundExecuteResult{Error: err.Error()}, nil
	}
	defer resp.Body.Close()
	return &models.PlaygroundExecuteResult{
		Status:  resp.StatusCode,
		Headers: resp.Header,
		Body:    body,
	}, nil
}

func (s *Service) SaveRequest(c context.Context, tenantID, userID string, req models.CreatePlaygroundRequestRequest) (*models.PlaygroundRequest, error) {
	preq := &models.PlaygroundRequest{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		UserID:   userID,
		Name:     req.Name,
		Method:   strings.ToUpper(req.Method),
		Path:     req.Path,
		Headers:  req.Headers,
		Body:     req.Body,
	}
	if err := s.repo.CreatePlaygroundRequest(c, preq); err != nil {
		return nil, err
	}
	return preq, nil
}

func (s *Service) ListPlaygroundRequests(c context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) (*models.PlaygroundRequestListResult, error) {
	items, total, err := s.repo.ListPlaygroundRequests(c, tenantID, userID, filter)
	if err != nil {
		return nil, err
	}
	return &models.PlaygroundRequestListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) GetPlaygroundStats(c context.Context, tenantID, userID string) (*models.PlaygroundStats, error) {
	return s.repo.GetPlaygroundStats(c, tenantID, userID)
}

func (s *Service) GetPlaygroundRequest(c context.Context, tenantID, id string) (*models.PlaygroundRequest, error) {
	preq, err := s.repo.GetPlaygroundRequestByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("playground request not found")
	}
	return preq, nil
}

func (s *Service) UpdatePlaygroundRequest(c context.Context, tenantID, id string, req models.UpdatePlaygroundRequestRequest) (*models.PlaygroundRequest, error) {
	existing, err := s.repo.GetPlaygroundRequestByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("playground request not found")
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Method != nil {
		existing.Method = strings.ToUpper(*req.Method)
	}
	if req.Path != nil {
		existing.Path = *req.Path
	}
	if req.Headers != nil {
		existing.Headers = req.Headers
	}
	if req.Body != nil {
		existing.Body = req.Body
	}
	if err := s.repo.UpdatePlaygroundRequest(c, tenantID, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeletePlaygroundRequest(c context.Context, tenantID, id string) error {
	err := s.repo.DeletePlaygroundRequest(c, tenantID, id)
	if err != nil && !isNotFoundError(err) {
		return errors.New("playground request not found")
	}
	return nil
}

func (s *Service) ExecuteRequest(c context.Context, tenantID, id string) (*models.PlaygroundExecuteResult, error) {
	preq, err := s.repo.GetPlaygroundRequestByID(c, tenantID, id)
	if err != nil {
		return nil, errors.New("playground request not found")
	}
	return s.QuickExecute(c, tenantID, preq.UserID, models.PlaygroundExecuteRequest{
		Method:  preq.Method,
		Path:    preq.Path,
		Headers: preq.Headers,
		Body:    preq.Body,
	})
}

func (s *Service) GetResponseHistory(c context.Context, tenantID, requestID string, filter models.UsageRecordFilter) (*models.ResponseHistoryListResult, error) {
	items, total, err := s.repo.GetResponseHistory(c, tenantID, requestID, filter)
	if err != nil {
		return nil, errors.New("request not found")
	}
	return &models.ResponseHistoryListResult{
		Data:     items,
		Total:    total,
		Page:     filter.Page,
		PageSize: filter.PageSize,
	}, nil
}

func (s *Service) ClearHistory(c context.Context, tenantID, requestID string) error {
	return s.repo.ClearHistory(c, tenantID, requestID)
}

// ---------- Helpers ----------

func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "no rows in result set") || strings.Contains(err.Error(), "not found")
}

func safeDeref(v *int) int {
	if v != nil {
		return *v
	}
	return 0
}

func boolPtr(v bool) *bool {
	return &v
}
