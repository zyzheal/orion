package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/developer-portal/models"

	"github.com/gin-gonic/gin"
)

type mockSvc struct {
	// --- DeveloperPortal CRUD ---
	createFn            func(ctx context.Context, tenantID string, req models.CreateDeveloperPortalRequest) (*models.DeveloperPortal, error)
	getFn               func(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error)
	listFn              func(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error)
	updateFn            func(ctx context.Context, tenantID, id string, req models.UpdateDeveloperPortalRequest) (*models.DeveloperPortal, error)
	deleteFn            func(ctx context.Context, tenantID, id string) error

	// --- Documents ---
	createDocumentFn    func(ctx context.Context, tenantID, userID string, req models.CreateDocumentRequest) (*models.PortalDocument, error)
	listDocumentsFn     func(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error)
	getDocumentFn       func(ctx context.Context, tenantID, id string) (*models.PortalDocument, error)
	updateDocumentFn    func(ctx context.Context, tenantID, id string, req models.UpdateDocumentRequest) (*models.PortalDocument, error)
	deleteDocumentFn    func(ctx context.Context, tenantID, id string) error
	searchDocumentsFn   func(ctx context.Context, tenantID string, query string) ([]models.PortalDocument, error)
	publishDocumentFn   func(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	unpublishDocumentFn func(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	getPopularFn        func(ctx context.Context, tenantID string) ([]models.PortalDocument, error)
	recordHelpfulFn     func(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error)

	// --- Versions ---
	createNewVersionFn      func(ctx context.Context, tenantID, id, version, userID string) (*models.PortalDocument, error)
	getDocumentVersionsFn   func(ctx context.Context, tenantID, id string) ([]models.DocumentVersion, error)

	// --- Review ---
	submitForReviewFn func(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	approveReviewFn   func(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	rejectReviewFn    func(ctx context.Context, tenantID, id, userID string, reason string) (*models.PortalDocument, error)

	// --- Stats / Categories ---
	getDocumentStatsFn func(ctx context.Context, tenantID string) (*models.DocumentStats, error)
	getCategoriesFn    func(ctx context.Context, tenantID string) ([]models.CategoryInfo, error)

	// --- Mock Rules ---
	createMockRuleFn   func(ctx context.Context, tenantID string, req models.CreateMockRuleRequest) (*models.MockRule, error)
	listMockRulesFn    func(ctx context.Context, tenantID string, filter models.MockRuleFilter) (*models.MockRuleListResult, error)
	getMockRuleFn      func(ctx context.Context, tenantID, id string) (*models.MockRule, error)
	updateMockRuleFn   func(ctx context.Context, tenantID, id string, req models.UpdateMockRuleRequest) (*models.MockRule, error)
	deleteMockRuleFn   func(ctx context.Context, tenantID, id string) error
	getMockRuleStatsFn func(ctx context.Context, tenantID string) (*models.MockRuleStats, error)
	matchRequestFn     func(ctx context.Context, tenantID string, method, path string) (*models.MockSimulateResult, error)
	toggleMockRuleFn   func(ctx context.Context, tenantID, id string) (*models.MockRule, error)

	// --- SDK ---
	getSupportedLanguagesFn func() []models.SDKLanguage
	createSDKTaskFn         func(ctx context.Context, tenantID string, req models.CreateSDKTaskRequest) (*models.SDKTask, error)
	listSDKTasksFn          func(ctx context.Context, tenantID string, filter models.SDKTaskFilter) (*models.SDKTaskListResult, error)
	getSDKTaskStatsFn       func(ctx context.Context, tenantID string) (*models.SDKTaskStats, error)
	getSDKTaskFn            func(ctx context.Context, tenantID, id string) (*models.SDKTask, error)
	deleteSDKTaskFn         func(ctx context.Context, tenantID, id string) error
	regenerateTaskFn        func(ctx context.Context, tenantID, id string) (*models.SDKTask, error)

	// --- Subscriptions ---
	createSubFn          func(ctx context.Context, tenantID, userID string, req models.CreateSubscriptionRequest) (*models.Subscription, error)
	listSubFn            func(ctx context.Context, tenantID string, filter models.SubscriptionFilter) (*models.SubscriptionListResult, error)
	getSubFn             func(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	approveSubFn         func(ctx context.Context, tenantID, id, approvedBy string) (*models.Subscription, error)
	rejectSubFn          func(ctx context.Context, tenantID, id, approvedBy string, reason string) (*models.Subscription, error)
	suspendSubFn         func(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	cancelSubFn          func(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	getUsageStatsFn      func(ctx context.Context, tenantID string) (*models.SubscriptionStats, error)
	getUsageRecordsFn    func(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) (*models.UsageRecordListResult, error)

	// --- Playground ---
	quickExecuteFn           func(ctx context.Context, tenantID, userID string, req models.PlaygroundExecuteRequest) (*models.PlaygroundExecuteResult, error)
	saveRequestFn            func(ctx context.Context, tenantID, userID string, req models.CreatePlaygroundRequestRequest) (*models.PlaygroundRequest, error)
	listPlaygroundRequestsFn func(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) (*models.PlaygroundRequestListResult, error)
	getPlaygroundStatsFn     func(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error)
	getPlaygroundRequestFn   func(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error)
	updatePlaygroundRequestFn func(ctx context.Context, tenantID, id string, req models.UpdatePlaygroundRequestRequest) (*models.PlaygroundRequest, error)
	deletePlaygroundRequestFn func(ctx context.Context, tenantID, id string) error
	executeRequestFn         func(ctx context.Context, tenantID, id string) (*models.PlaygroundExecuteResult, error)
	getResponseHistoryFn     func(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) (*models.ResponseHistoryListResult, error)
	clearHistoryFn           func(ctx context.Context, tenantID, requestID string) error
}

func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.CreateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error) {
	if m.getFn != nil { return m.getFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) List(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, limit, offset) }
	return nil, nil
}
func (m *mockSvc) Update(ctx context.Context, tenantID, id string, req models.UpdateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
	if m.updateFn != nil { return m.updateFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil { return m.deleteFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) CreateDocument(ctx context.Context, tenantID, userID string, req models.CreateDocumentRequest) (*models.PortalDocument, error) {
	if m.createDocumentFn != nil { return m.createDocumentFn(ctx, tenantID, userID, req) }
	return nil, nil
}
func (m *mockSvc) ListDocuments(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error) {
	if m.listDocumentsFn != nil { return m.listDocumentsFn(ctx, tenantID, page, pageSize) }
	return nil, nil
}
func (m *mockSvc) GetDocument(ctx context.Context, tenantID, id string) (*models.PortalDocument, error) {
	if m.getDocumentFn != nil { return m.getDocumentFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) UpdateDocument(ctx context.Context, tenantID, id string, req models.UpdateDocumentRequest) (*models.PortalDocument, error) {
	if m.updateDocumentFn != nil { return m.updateDocumentFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) DeleteDocument(ctx context.Context, tenantID, id string) error {
	if m.deleteDocumentFn != nil { return m.deleteDocumentFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) CreateMockRule(ctx context.Context, tenantID string, req models.CreateMockRuleRequest) (*models.MockRule, error) {
	if m.createMockRuleFn != nil { return m.createMockRuleFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) ListMockRules(ctx context.Context, tenantID string, filter models.MockRuleFilter) (*models.MockRuleListResult, error) {
	if m.listMockRulesFn != nil { return m.listMockRulesFn(ctx, tenantID, filter) }
	return nil, nil
}
func (m *mockSvc) GetMockRule(ctx context.Context, tenantID, id string) (*models.MockRule, error) {
	if m.getMockRuleFn != nil { return m.getMockRuleFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) UpdateMockRule(ctx context.Context, tenantID, id string, req models.UpdateMockRuleRequest) (*models.MockRule, error) {
	if m.updateMockRuleFn != nil { return m.updateMockRuleFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) DeleteMockRule(ctx context.Context, tenantID, id string) error {
	if m.deleteMockRuleFn != nil { return m.deleteMockRuleFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) GetMockRuleStats(ctx context.Context, tenantID string) (*models.MockRuleStats, error) {
	if m.getMockRuleStatsFn != nil { return m.getMockRuleStatsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) MatchRequest(ctx context.Context, tenantID string, method, path string) (*models.MockSimulateResult, error) {
	if m.matchRequestFn != nil { return m.matchRequestFn(ctx, tenantID, method, path) }
	return nil, nil
}
func (m *mockSvc) ToggleMockRule(ctx context.Context, tenantID, id string) (*models.MockRule, error) {
	if m.toggleMockRuleFn != nil { return m.toggleMockRuleFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) CreateSubscription(ctx context.Context, tenantID, userID string, req models.CreateSubscriptionRequest) (*models.Subscription, error) {
	if m.createSubFn != nil { return m.createSubFn(ctx, tenantID, userID, req) }
	return nil, nil
}
func (m *mockSvc) ListSubscriptions(ctx context.Context, tenantID string, filter models.SubscriptionFilter) (*models.SubscriptionListResult, error) {
	if m.listSubFn != nil { return m.listSubFn(ctx, tenantID, filter) }
	return nil, nil
}
func (m *mockSvc) GetSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	if m.getSubFn != nil { return m.getSubFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) ApproveSubscription(ctx context.Context, tenantID, id, approvedBy string) (*models.Subscription, error) {
	if m.approveSubFn != nil { return m.approveSubFn(ctx, tenantID, id, approvedBy) }
	return nil, nil
}
func (m *mockSvc) GetUsageStats(ctx context.Context, tenantID string) (*models.SubscriptionStats, error) {
	if m.getUsageStatsFn != nil { return m.getUsageStatsFn(ctx, tenantID) }
	return nil, nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		c.Params = gin.Params{}
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}

	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// --- DeveloperPortal CRUD ---

func TestHandler_Create_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.CreateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
			return &models.DeveloperPortal{ID: "portal-1", Name: req.Name}, nil
		},
	})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{"name": "test-portal"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Create_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_List_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error) {
			return []models.DeveloperPortal{{ID: "portal-1"}}, nil
		},
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error) {
			return &models.DeveloperPortal{ID: id}, nil
		},
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "portal-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, _, _ string) (*models.DeveloperPortal, error) {
			return nil, errors.New("not found")
		},
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Update_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(ctx context.Context, tenantID, id string, req models.UpdateDeveloperPortalRequest) (*models.DeveloperPortal, error) {
			return &models.DeveloperPortal{ID: id, Name: "updated"}, nil
		},
	})
	w := performRequest(h, h.Update, "PUT", map[string]interface{}{"name": "updated"}, map[string]string{"id": "portal-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Delete_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, tenantID, id string) error {
			called = true
			return nil
		},
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "portal-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

// --- Documents ---

func TestHandler_CreateDocument_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{"title": "My Doc", "content": "hello"}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h := newHandlerWithSvc(&mockSvc{
		createDocumentFn: func(ctx context.Context, tenantID, userID string, req models.CreateDocumentRequest) (*models.PortalDocument, error) {
			return &models.PortalDocument{ID: "doc-1", Title: req.Title}, nil
		},
	})
	h.CreateDocument(c)
	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

func TestHandler_CreateDocument_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CreateDocument, "POST", map[string]interface{}{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_GetDocument_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getDocumentFn: func(ctx context.Context, tenantID, id string) (*models.PortalDocument, error) {
			return &models.PortalDocument{ID: id}, nil
		},
	})
	w := performRequest(h, h.GetDocument, "GET", nil, map[string]string{"id": "doc-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- Mock Rules ---

func TestHandler_CreateMockRule_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createMockRuleFn: func(ctx context.Context, tenantID string, req models.CreateMockRuleRequest) (*models.MockRule, error) {
			return &models.MockRule{ID: "rule-1", Name: req.Name}, nil
		},
	})
	w := performRequest(h, h.CreateMockRule, "POST", map[string]interface{}{
		"name": "test-rule", "method": "GET", "path": "/api/test"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_GetMockRule_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getMockRuleFn: func(ctx context.Context, tenantID, id string) (*models.MockRule, error) {
			return &models.MockRule{ID: id}, nil
		},
	})
	w := performRequest(h, h.GetMockRule, "GET", nil, map[string]string{"id": "rule-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteMockRule_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteMockRuleFn: func(ctx context.Context, tenantID, id string) error {
			called = true
			return nil
		},
	})
	w := performRequest(h, h.DeleteMockRule, "DELETE", nil, map[string]string{"id": "rule-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

// --- Subscriptions ---

func TestHandler_GetSubscription_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getSubFn: func(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
			return &models.Subscription{ID: id}, nil
		},
	})
	w := performRequest(h, h.GetSubscription, "GET", nil, map[string]string{"id": "sub-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- additional service methods needed by interface ---

func (m *mockSvc) SearchDocuments(ctx context.Context, tenantID string, query string) ([]models.PortalDocument, error) {
	if m.searchDocumentsFn != nil {
		return m.searchDocumentsFn(ctx, tenantID, query)
	}
	return nil, nil
}
func (m *mockSvc) PublishDocument(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	if m.publishDocumentFn != nil {
		return m.publishDocumentFn(ctx, tenantID, id, userID)
	}
	return nil, nil
}
func (m *mockSvc) UnpublishDocument(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return nil, nil
}
func (m *mockSvc) GetPopular(ctx context.Context, tenantID string) ([]models.PortalDocument, error) {
	if m.getPopularFn != nil {
		return m.getPopularFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) RecordHelpful(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error) {
	if m.recordHelpfulFn != nil {
		return m.recordHelpfulFn(ctx, tenantID, id, helpful)
	}
	return nil, nil
}
func (m *mockSvc) CreateNewVersion(ctx context.Context, tenantID, id, version, userID string) (*models.PortalDocument, error) {
	return nil, nil
}
func (m *mockSvc) GetDocumentVersions(ctx context.Context, tenantID, id string) ([]models.DocumentVersion, error) {
	return nil, nil
}
func (m *mockSvc) SubmitForReview(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return nil, nil
}
func (m *mockSvc) ApproveReview(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error) {
	return nil, nil
}
func (m *mockSvc) RejectReview(ctx context.Context, tenantID, id, userID string, reason string) (*models.PortalDocument, error) {
	return nil, nil
}
func (m *mockSvc) GetDocumentStats(ctx context.Context, tenantID string) (*models.DocumentStats, error) {
	return nil, nil
}
func (m *mockSvc) GetCategories(ctx context.Context, tenantID string) ([]models.CategoryInfo, error) {
	return nil, nil
}
func (m *mockSvc) GetSupportedLanguages() []models.SDKLanguage {
	if m.getSupportedLanguagesFn != nil {
		return m.getSupportedLanguagesFn()
	}
	return nil
}
func (m *mockSvc) CreateSDKTask(ctx context.Context, tenantID string, req models.CreateSDKTaskRequest) (*models.SDKTask, error) {
	return nil, nil
}
func (m *mockSvc) ListSDKTasks(ctx context.Context, tenantID string, filter models.SDKTaskFilter) (*models.SDKTaskListResult, error) {
	return nil, nil
}
func (m *mockSvc) GetSDKTaskStats(ctx context.Context, tenantID string) (*models.SDKTaskStats, error) {
	return nil, nil
}
func (m *mockSvc) GetSDKTask(ctx context.Context, tenantID, id string) (*models.SDKTask, error) {
	return nil, nil
}
func (m *mockSvc) DeleteSDKTask(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) RegenerateTask(ctx context.Context, tenantID, id string) (*models.SDKTask, error) {
	return nil, nil
}
func (m *mockSvc) RejectSubscription(ctx context.Context, tenantID, id, approvedBy string, reason string) (*models.Subscription, error) {
	return nil, nil
}
func (m *mockSvc) SuspendSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	return nil, nil
}
func (m *mockSvc) CancelSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error) {
	return nil, nil
}
func (m *mockSvc) GetUsageRecords(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) (*models.UsageRecordListResult, error) {
	return nil, nil
}
func (m *mockSvc) QuickExecute(ctx context.Context, tenantID, userID string, req models.PlaygroundExecuteRequest) (*models.PlaygroundExecuteResult, error) {
	return nil, nil
}
func (m *mockSvc) SaveRequest(ctx context.Context, tenantID, userID string, req models.CreatePlaygroundRequestRequest) (*models.PlaygroundRequest, error) {
	return nil, nil
}
func (m *mockSvc) ListPlaygroundRequests(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) (*models.PlaygroundRequestListResult, error) {
	return nil, nil
}
func (m *mockSvc) GetPlaygroundStats(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error) {
	return nil, nil
}
func (m *mockSvc) GetPlaygroundRequest(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error) {
	return nil, nil
}
func (m *mockSvc) UpdatePlaygroundRequest(ctx context.Context, tenantID, id string, req models.UpdatePlaygroundRequestRequest) (*models.PlaygroundRequest, error) {
	return nil, nil
}
func (m *mockSvc) DeletePlaygroundRequest(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) ExecuteRequest(ctx context.Context, tenantID, id string) (*models.PlaygroundExecuteResult, error) {
	return nil, nil
}
func (m *mockSvc) GetResponseHistory(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) (*models.ResponseHistoryListResult, error) {
	return nil, nil
}
func (m *mockSvc) ClearHistory(ctx context.Context, tenantID, requestID string) error {
	return nil
}
