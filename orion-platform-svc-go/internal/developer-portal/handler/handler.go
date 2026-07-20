package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/developer-portal/models"
	"orion/platform-svc-go/internal/developer-portal/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	// --- DeveloperPortal CRUD ---
	Create(ctx context.Context, tenantID string, req models.CreateDeveloperPortalRequest) (*models.DeveloperPortal, error)
	Get(ctx context.Context, tenantID, id string) (*models.DeveloperPortal, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.DeveloperPortal, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateDeveloperPortalRequest) (*models.DeveloperPortal, error)
	Delete(ctx context.Context, tenantID, id string) error

	// --- Documents ---
	CreateDocument(ctx context.Context, tenantID, userID string, req models.CreateDocumentRequest) (*models.PortalDocument, error)
	ListDocuments(ctx context.Context, tenantID string, page, pageSize int) ([]models.PortalDocument, error)
	GetDocument(ctx context.Context, tenantID, id string) (*models.PortalDocument, error)
	UpdateDocument(ctx context.Context, tenantID, id string, req models.UpdateDocumentRequest) (*models.PortalDocument, error)
	DeleteDocument(ctx context.Context, tenantID, id string) error
	SearchDocuments(ctx context.Context, tenantID string, query string) ([]models.PortalDocument, error)
	PublishDocument(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	UnpublishDocument(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	GetPopular(ctx context.Context, tenantID string) ([]models.PortalDocument, error)
	RecordHelpful(ctx context.Context, tenantID, id string, helpful bool) (*models.PortalDocument, error)

	// --- Versions ---
	CreateNewVersion(ctx context.Context, tenantID, id, version, userID string) (*models.PortalDocument, error)
	GetDocumentVersions(ctx context.Context, tenantID, id string) ([]models.DocumentVersion, error)

	// --- Review ---
	SubmitForReview(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	ApproveReview(ctx context.Context, tenantID, id, userID string) (*models.PortalDocument, error)
	RejectReview(ctx context.Context, tenantID, id, userID string, reason string) (*models.PortalDocument, error)

	// --- Stats / Categories ---
	GetDocumentStats(ctx context.Context, tenantID string) (*models.DocumentStats, error)
	GetCategories(ctx context.Context, tenantID string) ([]models.CategoryInfo, error)

	// --- Mock Rules ---
	CreateMockRule(ctx context.Context, tenantID string, req models.CreateMockRuleRequest) (*models.MockRule, error)
	ListMockRules(ctx context.Context, tenantID string, filter models.MockRuleFilter) (*models.MockRuleListResult, error)
	GetMockRule(ctx context.Context, tenantID, id string) (*models.MockRule, error)
	UpdateMockRule(ctx context.Context, tenantID, id string, req models.UpdateMockRuleRequest) (*models.MockRule, error)
	DeleteMockRule(ctx context.Context, tenantID, id string) error
	GetMockRuleStats(ctx context.Context, tenantID string) (*models.MockRuleStats, error)
	MatchRequest(ctx context.Context, tenantID string, method, path string) (*models.MockSimulateResult, error)
	ToggleMockRule(ctx context.Context, tenantID, id string) (*models.MockRule, error)

	// --- SDK ---
	GetSupportedLanguages() []models.SDKLanguage
	CreateSDKTask(ctx context.Context, tenantID string, req models.CreateSDKTaskRequest) (*models.SDKTask, error)
	ListSDKTasks(ctx context.Context, tenantID string, filter models.SDKTaskFilter) (*models.SDKTaskListResult, error)
	GetSDKTaskStats(ctx context.Context, tenantID string) (*models.SDKTaskStats, error)
	GetSDKTask(ctx context.Context, tenantID, id string) (*models.SDKTask, error)
	DeleteSDKTask(ctx context.Context, tenantID, id string) error
	RegenerateTask(ctx context.Context, tenantID, id string) (*models.SDKTask, error)

	// --- Subscriptions ---
	CreateSubscription(ctx context.Context, tenantID, userID string, req models.CreateSubscriptionRequest) (*models.Subscription, error)
	ListSubscriptions(ctx context.Context, tenantID string, filter models.SubscriptionFilter) (*models.SubscriptionListResult, error)
	GetSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	ApproveSubscription(ctx context.Context, tenantID, id, approvedBy string) (*models.Subscription, error)
	RejectSubscription(ctx context.Context, tenantID, id, approvedBy string, reason string) (*models.Subscription, error)
	SuspendSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	CancelSubscription(ctx context.Context, tenantID, id string) (*models.Subscription, error)
	GetUsageStats(ctx context.Context, tenantID string) (*models.SubscriptionStats, error)
	GetUsageRecords(ctx context.Context, tenantID, subscriptionID string, filter models.UsageRecordFilter) (*models.UsageRecordListResult, error)

	// --- Playground ---
	QuickExecute(ctx context.Context, tenantID, userID string, req models.PlaygroundExecuteRequest) (*models.PlaygroundExecuteResult, error)
	SaveRequest(ctx context.Context, tenantID, userID string, req models.CreatePlaygroundRequestRequest) (*models.PlaygroundRequest, error)
	ListPlaygroundRequests(ctx context.Context, tenantID, userID string, filter models.PlaygroundRequestFilter) (*models.PlaygroundRequestListResult, error)
	GetPlaygroundStats(ctx context.Context, tenantID, userID string) (*models.PlaygroundStats, error)
	GetPlaygroundRequest(ctx context.Context, tenantID, id string) (*models.PlaygroundRequest, error)
	UpdatePlaygroundRequest(ctx context.Context, tenantID, id string, req models.UpdatePlaygroundRequestRequest) (*models.PlaygroundRequest, error)
	DeletePlaygroundRequest(ctx context.Context, tenantID, id string) error
	ExecuteRequest(ctx context.Context, tenantID, id string) (*models.PlaygroundExecuteResult, error)
	GetResponseHistory(ctx context.Context, tenantID, requestID string, filter models.UsageRecordFilter) (*models.ResponseHistoryListResult, error)
	ClearHistory(ctx context.Context, tenantID, requestID string) error
}

// Handler wires Gin routes to the developer-portal service.
type Handler struct {
	svc Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("developer_portal", "read")
	write := auth.RequirePermission("developer_portal", "write")
	delete := auth.RequirePermission("developer_portal", "delete")

	// ----- DeveloperPortal (legacy CRUD) -----
	rg.POST("", write, h.Create)
	rg.GET("", read, h.List)
	rg.GET(":id", read, h.Get)
	rg.PUT(":id", write, h.Update)
	rg.DELETE(":id", delete, h.Delete)

	// ----- Document CRUD -----
	rg.POST("/documents", write, h.CreateDocument)
	rg.GET("/documents", read, h.ListDocuments)
	rg.GET("/documents/search", read, h.SearchDocuments)
	rg.GET("/documents/stats", read, h.DocumentStats)
	rg.GET("/documents/:id", read, h.GetDocument)
	rg.PUT("/documents/:id", write, h.UpdateDocument)
	rg.DELETE("/documents/:id", delete, h.DeleteDocument)
	rg.POST("/documents/:id/helpful", write, h.RecordHelpful)

	// ----- Publishing -----
	rg.POST("/documents/:id/publish", write, h.PublishDocument)
	rg.POST("/documents/:id/unpublish", write, h.UnpublishDocument)

	// ----- Versions -----
	rg.POST("/documents/:id/versions", write, h.CreateVersion)
	rg.GET("/documents/:id/versions", read, h.GetVersions)

	// ----- Review -----
	rg.POST("/documents/:id/review/submit", write, h.SubmitForReview)
	rg.POST("/documents/:id/review/approve", write, h.ApproveReview)
	rg.POST("/documents/:id/review/reject", write, h.RejectReview)

	// ----- Categories -----
	rg.GET("/categories", read, h.GetCategories)

	// ----- Popular -----
	rg.GET("/popular", read, h.GetPopular)

	// ----- Mock Rules -----
	rg.POST("/mock-rules", write, h.CreateMockRule)
	rg.GET("/mock-rules", read, h.ListMockRules)
	rg.GET("/mock-rules/stats", read, h.MockRuleStats)
	rg.GET("/mock-rules/:id", read, h.GetMockRule)
	rg.PUT("/mock-rules/:id", write, h.UpdateMockRule)
	rg.DELETE("/mock-rules/:id", delete, h.DeleteMockRule)
	rg.POST("/mock-rules/:id/toggle", write, h.ToggleMockRule)
	rg.POST("/mock-simulate", read, h.MockSimulate)

	// ----- SDK -----
	rg.GET("/sdk/languages", read, h.SDKLanguages)
	rg.POST("/sdk/generate", write, h.CreateSDKTask)
	rg.GET("/sdk/tasks", read, h.ListSDKTasks)
	rg.GET("/sdk/tasks/stats", read, h.SDKTaskStats)
	rg.GET("/sdk/tasks/:id", read, h.GetSDKTask)
	rg.DELETE("/sdk/tasks/:id", delete, h.DeleteSDKTask)
	rg.POST("/sdk/tasks/:id/regenerate", write, h.SDKRegenerate)

	// ----- Subscriptions -----
	rg.POST("/subscriptions", write, h.CreateSubscription)
	rg.GET("/subscriptions", read, h.ListSubscriptions)
	rg.GET("/subscriptions/stats", read, h.SubscriptionStats)
	rg.GET("/subscriptions/:id", read, h.GetSubscription)
	rg.POST("/subscriptions/:id/approve", write, h.ApproveSubscription)
	rg.POST("/subscriptions/:id/reject", write, h.RejectSubscription)
	rg.POST("/subscriptions/:id/suspend", write, h.SuspendSubscription)
	rg.POST("/subscriptions/:id/cancel", write, h.CancelSubscription)
	rg.GET("/subscriptions/:id/usage", read, h.GetUsageRecords)

	// ----- Playground -----
	rg.POST("/playground/execute", write, h.PlaygroundExecute)
	rg.POST("/playground/requests", write, h.SavePlaygroundRequest)
	rg.GET("/playground/requests", read, h.ListPlaygroundRequests)
	rg.GET("/playground/stats", read, h.PlaygroundStats)
	rg.GET("/playground/requests/:id", read, h.GetPlaygroundRequest)
	rg.PUT("/playground/requests/:id", write, h.UpdatePlaygroundRequest)
	rg.DELETE("/playground/requests/:id", delete, h.DeletePlaygroundRequest)
	rg.POST("/playground/requests/:id/execute", write, h.ExecutePlaygroundRequest)
	rg.GET("/playground/requests/:id/history", read, h.GetResponseHistory)
	rg.DELETE("/playground/requests/:id/history", delete, h.ClearHistory)
}

// ----- DeveloperPortal (legacy CRUD) -----

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDeveloperPortalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	_ = userId
	id := c.Param("id")
	var req models.UpdateDeveloperPortalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// ----- Document CRUD -----

func (h *Handler) CreateDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.CreateDocument(ctx, tenantID, userId, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, doc)
}

func (h *Handler) ListDocuments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDocuments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	docs, err := h.svc.ListDocuments(ctx, tenantID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, docs)
}

func (h *Handler) SearchDocuments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchDocuments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	query := c.Query("query")
	docs, err := h.svc.SearchDocuments(ctx, tenantID, query)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, docs)
}

func (h *Handler) GetDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	doc, err := h.svc.GetDocument(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

func (h *Handler) UpdateDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.UpdateDocument(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

func (h *Handler) DeleteDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteDocument(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "document deleted"})
}

// ----- Publishing -----

func (h *Handler) PublishDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PublishDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.PublishDocument(ctx, tenantID, id, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

func (h *Handler) UnpublishDocument(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UnpublishDocument")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.UnpublishDocument(ctx, tenantID, id, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

// ----- Versions -----

func (h *Handler) CreateVersion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateVersion")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.CreateNewVersion(ctx, tenantID, id, req.Version, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, doc)
}

func (h *Handler) GetVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	versions, err := h.svc.GetDocumentVersions(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

// ----- Review -----

func (h *Handler) SubmitForReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SubmitForReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.SubmitForReview(ctx, tenantID, id, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": doc, "message": "Document submitted for review"})
}

func (h *Handler) ApproveReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.ApproveReview(ctx, tenantID, id, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": doc, "message": "Review approved"})
}

func (h *Handler) RejectReview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectReview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)
	_ = req
	doc, err := h.svc.RejectReview(ctx, tenantID, id, userId, req.Reason)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": doc, "message": "Review rejected"})
}

// ----- Stats -----

func (h *Handler) DocumentStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DocumentStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetDocumentStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ----- Categories -----

func (h *Handler) GetCategories(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCategories")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cats, err := h.svc.GetCategories(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cats)
}

// ----- Popular -----

func (h *Handler) GetPopular(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPopular")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	docs, err := h.svc.GetPopular(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, docs)
}

// ----- Helpful -----

func (h *Handler) RecordHelpful(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordHelpful")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	helpful := true
	if v := c.Query("helpful"); v == "false" {
		helpful = false
	}
	doc, err := h.svc.RecordHelpful(ctx, tenantID, id, helpful)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

// ----- Mock Rules -----

func (h *Handler) CreateMockRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateMockRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateMockRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateMockRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rule)
}

func (h *Handler) ListMockRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListMockRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := models.MockRuleFilter{
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
		Method:   c.Query("method"),
	}
	if v := c.Query("enabled"); v == "true" {
		filter.Enabled = boolPtr(true)
	} else if v == "false" {
		filter.Enabled = boolPtr(false)
	}
	result, err := h.svc.ListMockRules(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) MockRuleStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MockRuleStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetMockRuleStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetMockRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMockRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.GetMockRule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) UpdateMockRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateMockRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateMockRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateMockRule(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) DeleteMockRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteMockRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteMockRule(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "Mock rule deleted"})
}

func (h *Handler) ToggleMockRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleMockRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.ToggleMockRule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) MockSimulate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MockSimulate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.MockSimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.MatchRequest(ctx, tenantID, req.Method, req.Path)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ----- SDK -----

func (h *Handler) SDKLanguages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SDKLanguages")
	defer span.End()
	languages := h.svc.GetSupportedLanguages()
	middleware.RespondSuccess(c, languages)
}

func (h *Handler) CreateSDKTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSDKTask")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSDKTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	task, err := h.svc.CreateSDKTask(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, task)
}

func (h *Handler) ListSDKTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSDKTasks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := models.SDKTaskFilter{
		Language: c.Query("language"),
		Status:   c.Query("status"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListSDKTasks(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) SDKTaskStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SDKTaskStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetSDKTaskStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetSDKTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSDKTask")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	task, err := h.svc.GetSDKTask(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}

func (h *Handler) DeleteSDKTask(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSDKTask")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSDKTask(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "SDK task deleted"})
}

func (h *Handler) SDKRegenerate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SDKRegenerate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	task, err := h.svc.RegenerateTask(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, task)
}

// ----- Subscriptions -----

func (h *Handler) CreateSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sub, err := h.svc.CreateSubscription(ctx, tenantID, userId, req)
	if err != nil {
		// Check for duplicate
		if err.Error() == "duplicate subscription" {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, sub)
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSubscriptions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := models.SubscriptionFilter{
		UserID:   c.Query("userId"),
		APIName:  c.Query("apiName"),
		Status:   c.Query("status"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListSubscriptions(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) SubscriptionStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SubscriptionStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetUsageStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.GetSubscription(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, sub)
}

func (h *Handler) ApproveSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	sub, err := h.svc.ApproveSubscription(ctx, tenantID, id, userId)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sub, "message": "Subscription approved"})
}

func (h *Handler) RejectSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req models.RejectSubscriptionRequest
	c.ShouldBindJSON(&req)
	sub, err := h.svc.RejectSubscription(ctx, tenantID, id, userId, req.Reason)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sub, "message": "Subscription rejected"})
}

func (h *Handler) SuspendSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SuspendSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.SuspendSubscription(ctx, tenantID, id)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sub, "message": "Subscription suspended"})
}

func (h *Handler) CancelSubscription(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelSubscription")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	_ = userId
	id := c.Param("id")
	sub, err := h.svc.CancelSubscription(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": sub, "message": "Subscription cancelled"})
}

func (h *Handler) GetUsageRecords(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetUsageRecords")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	filter := models.UsageRecordFilter{
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.GetUsageRecords(ctx, tenantID, id, filter)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

// ----- Playground -----

func (h *Handler) PlaygroundExecute(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PlaygroundExecute")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.PlaygroundExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.QuickExecute(ctx, tenantID, userId, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) SavePlaygroundRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SavePlaygroundRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreatePlaygroundRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	preq, err := h.svc.SaveRequest(ctx, tenantID, userId, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, preq)
}

func (h *Handler) ListPlaygroundRequests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPlaygroundRequests")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	filter := models.PlaygroundRequestFilter{
		Method:   c.Query("method"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListPlaygroundRequests(ctx, tenantID, userId, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) PlaygroundStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PlaygroundStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	stats, err := h.svc.GetPlaygroundStats(ctx, tenantID, userId)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetPlaygroundRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlaygroundRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	preq, err := h.svc.GetPlaygroundRequest(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, preq)
}

func (h *Handler) UpdatePlaygroundRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePlaygroundRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePlaygroundRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	preq, err := h.svc.UpdatePlaygroundRequest(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, preq)
}

func (h *Handler) DeletePlaygroundRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePlaygroundRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeletePlaygroundRequest(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "Request deleted"})
}

func (h *Handler) ExecutePlaygroundRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecutePlaygroundRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.ExecuteRequest(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetResponseHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResponseHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	filter := models.UsageRecordFilter{
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.GetResponseHistory(ctx, tenantID, id, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) ClearHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ClearHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.ClearHistory(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "History cleared"})
}

// ----- Helpers -----

func boolPtr(v bool) *bool {
	return &v
}

func toInt(v string) int {
	i, _ := strconv.Atoi(v)
	return i
}
