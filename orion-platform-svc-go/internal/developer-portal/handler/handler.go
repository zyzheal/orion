package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/developer-portal/models"
	"orion/platform-svc-go/internal/developer-portal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateDeveloperPortalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	_ = userId
	id := c.Param("id")
	var req models.UpdateDeveloperPortalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ----- Document CRUD -----

func (h *Handler) CreateDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.CreateDocument(c.Request.Context(), tenantID, userId, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, doc)
}

func (h *Handler) ListDocuments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	docs, err := h.svc.ListDocuments(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, docs)
}

func (h *Handler) SearchDocuments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	query := c.Query("query")
	docs, err := h.svc.SearchDocuments(c.Request.Context(), tenantID, query)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, docs)
}

func (h *Handler) GetDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	doc, err := h.svc.GetDocument(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

func (h *Handler) UpdateDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.UpdateDocument(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

func (h *Handler) DeleteDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteDocument(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "document deleted"})
}

// ----- Publishing -----

func (h *Handler) PublishDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.PublishDocument(c.Request.Context(), tenantID, id, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

func (h *Handler) UnpublishDocument(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.UnpublishDocument(c.Request.Context(), tenantID, id, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

// ----- Versions -----

func (h *Handler) CreateVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.CreateNewVersion(c.Request.Context(), tenantID, id, req.Version, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, doc)
}

func (h *Handler) GetVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	versions, err := h.svc.GetDocumentVersions(c.Request.Context(), tenantID, id)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": versions, "total": len(versions)})
}

// ----- Review -----

func (h *Handler) SubmitForReview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.SubmitForReview(c.Request.Context(), tenantID, id, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": doc, "message": "Document submitted for review"})
}

func (h *Handler) ApproveReview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	doc, err := h.svc.ApproveReview(c.Request.Context(), tenantID, id, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": doc, "message": "Review approved"})
}

func (h *Handler) RejectReview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)
	_ = req
	doc, err := h.svc.RejectReview(c.Request.Context(), tenantID, id, userId, req.Reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": doc, "message": "Review rejected"})
}

// ----- Stats -----

func (h *Handler) DocumentStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetDocumentStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// ----- Categories -----

func (h *Handler) GetCategories(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cats, err := h.svc.GetCategories(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cats)
}

// ----- Popular -----

func (h *Handler) GetPopular(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	docs, err := h.svc.GetPopular(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, docs)
}

// ----- Helpful -----

func (h *Handler) RecordHelpful(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	helpful := true
	if v := c.Query("helpful"); v == "false" {
		helpful = false
	}
	doc, err := h.svc.RecordHelpful(c.Request.Context(), tenantID, id, helpful)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

// ----- Mock Rules -----

func (h *Handler) CreateMockRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateMockRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateMockRule(c.Request.Context(), tenantID, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) ListMockRules(c *gin.Context) {
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
	result, err := h.svc.ListMockRules(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) MockRuleStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetMockRuleStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) GetMockRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.GetMockRule(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) UpdateMockRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateMockRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateMockRule(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) DeleteMockRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteMockRule(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "Mock rule deleted"})
}

func (h *Handler) ToggleMockRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.ToggleMockRule(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) MockSimulate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.MockSimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.MatchRequest(c.Request.Context(), tenantID, req.Method, req.Path)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ----- SDK -----

func (h *Handler) SDKLanguages(c *gin.Context) {
	languages := h.svc.GetSupportedLanguages()
	respondSuccess(c, languages)
}

func (h *Handler) CreateSDKTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSDKTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	task, err := h.svc.CreateSDKTask(c.Request.Context(), tenantID, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, task)
}

func (h *Handler) ListSDKTasks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := models.SDKTaskFilter{
		Language: c.Query("language"),
		Status:   c.Query("status"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListSDKTasks(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) SDKTaskStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetSDKTaskStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) GetSDKTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	task, err := h.svc.GetSDKTask(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

func (h *Handler) DeleteSDKTask(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSDKTask(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "SDK task deleted"})
}

func (h *Handler) SDKRegenerate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	task, err := h.svc.RegenerateTask(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, task)
}

// ----- Subscriptions -----

func (h *Handler) CreateSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sub, err := h.svc.CreateSubscription(c.Request.Context(), tenantID, userId, req)
	if err != nil {
		// Check for duplicate
		if err.Error() == "duplicate subscription" {
			respondConflict(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, sub)
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := models.SubscriptionFilter{
		UserID:   c.Query("userId"),
		APIName:  c.Query("apiName"),
		Status:   c.Query("status"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListSubscriptions(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) SubscriptionStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetUsageStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) GetSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.GetSubscription(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, sub)
}

func (h *Handler) ApproveSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	sub, err := h.svc.ApproveSubscription(c.Request.Context(), tenantID, id, userId)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": sub, "message": "Subscription approved"})
}

func (h *Handler) RejectSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	id := c.Param("id")
	var req models.RejectSubscriptionRequest
	c.ShouldBindJSON(&req)
	sub, err := h.svc.RejectSubscription(c.Request.Context(), tenantID, id, userId, req.Reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": sub, "message": "Subscription rejected"})
}

func (h *Handler) SuspendSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sub, err := h.svc.SuspendSubscription(c.Request.Context(), tenantID, id)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": sub, "message": "Subscription suspended"})
}

func (h *Handler) CancelSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	_ = userId
	id := c.Param("id")
	sub, err := h.svc.CancelSubscription(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": sub, "message": "Subscription cancelled"})
}

func (h *Handler) GetUsageRecords(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	filter := models.UsageRecordFilter{
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.GetUsageRecords(c.Request.Context(), tenantID, id, filter)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

// ----- Playground -----

func (h *Handler) PlaygroundExecute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.PlaygroundExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.QuickExecute(c.Request.Context(), tenantID, userId, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) SavePlaygroundRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	var req models.CreatePlaygroundRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	preq, err := h.svc.SaveRequest(c.Request.Context(), tenantID, userId, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, preq)
}

func (h *Handler) ListPlaygroundRequests(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	filter := models.PlaygroundRequestFilter{
		Method:   c.Query("method"),
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.ListPlaygroundRequests(c.Request.Context(), tenantID, userId, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) PlaygroundStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userId := c.GetString("user_id")
	stats, err := h.svc.GetPlaygroundStats(c.Request.Context(), tenantID, userId)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

func (h *Handler) GetPlaygroundRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	preq, err := h.svc.GetPlaygroundRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, preq)
}

func (h *Handler) UpdatePlaygroundRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdatePlaygroundRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	preq, err := h.svc.UpdatePlaygroundRequest(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, preq)
}

func (h *Handler) DeletePlaygroundRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeletePlaygroundRequest(c.Request.Context(), tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "Request deleted"})
}

func (h *Handler) ExecutePlaygroundRequest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.ExecuteRequest(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetResponseHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	filter := models.UsageRecordFilter{
		Page:     toInt(c.DefaultQuery("page", "0")),
		PageSize: toInt(c.DefaultQuery("pageSize", "20")),
	}
	result, err := h.svc.GetResponseHistory(c.Request.Context(), tenantID, id, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result.Data, "total": result.Total})
}

func (h *Handler) ClearHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.ClearHistory(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "History cleared"})
}

// ----- Helpers -----

func boolPtr(v bool) *bool {
	return &v
}

func toInt(v string) int {
	i, _ := strconv.Atoi(v)
	return i
}
