package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai-decisions/models"
	"orion/platform-svc-go/internal/ai-decisions/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Handler exposes AI decision endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ai-decisions endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/ai/decisions")

	// --- Stats (must come before :id to avoid route collision) ---
	// GET /ai/decisions/stats - Get decision statistics
	f.GET("/stats", auth.RequirePermission("ai_decisions", "read"), h.GetStats)

	// --- Batch analysis ---
	// POST /ai/decisions/analyze - Analyze decisions in batch
	f.POST("/analyze", auth.RequirePermission("ai_decisions", "read"), h.AnalyzeDecisions)

	// --- Collection CRUD ---
	// GET /ai/decisions - List decisions
	f.GET("", auth.RequirePermission("ai_decisions", "read"), h.List)
	// POST /ai/decisions - Create a new decision
	f.POST("", auth.RequirePermission("ai_decisions", "write"), h.Create)

	// --- Detail routes (use a group for :id) ---
	id := f.Group("/:id")
	{
		// GET /ai/decisions/:id - Get decision detail
		id.GET("", auth.RequirePermission("ai_decisions", "read"), h.Get)
		// DELETE /ai/decisions/:id - Delete decision
		id.DELETE("", auth.RequirePermission("ai_decisions", "delete"), h.Delete)
		// GET /ai/decisions/:id/explanation - Get decision explanation
		id.GET("/explanation", auth.RequirePermission("ai_decisions", "read"), h.GetExplanation)
		// POST /ai/decisions/:id/feedback - Submit feedback
		id.POST("/feedback", auth.RequirePermission("ai_decisions", "write"), h.SubmitFeedback)
		// GET /ai/decisions/:id/trace - Get decision traces
		id.GET("/trace", auth.RequirePermission("ai_decisions", "read"), h.GetTraces)
	}
}

// getTenantID extracts tenant_id from Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "system"
	}
	return userID
}

// List handler - GET /ai/decisions
func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)

	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")
	sortStr := c.Query("sort")
	orderStr := c.Query("order")

	q := &models.ListQuery{
		Type:    c.Query("type"),
		Status:  c.Query("status"),
		ModelID: c.Query("modelId"),
		Sort:    sortStr,
		Order:   orderStr,
	}
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err == nil && limit > 0 {
			q.Limit = &limit
		}
	}
	if offsetStr != "" {
		offset, err := strconv.Atoi(offsetStr)
		if err == nil && offset >= 0 {
			q.Offset = &offset
		}
	}
	// Date range from query params
	if startDateStr := c.Query("startDate"); startDateStr != "" {
		t, err := parseTimeQuery(startDateStr)
		if err == nil {
			q.StartDate = &t
		}
	}
	if endDateStr := c.Query("endDate"); endDateStr != "" {
		t, err := parseTimeQuery(endDateStr)
		if err == nil {
			q.EndDate = &t
		}
	}

	decisions, total, err := h.svc.ListDecisions(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:   decisions,
		Total:  total,
		Offset: derefInt(q.Offset),
		Limit:  derefInt(q.Limit),
	})
}

// Create handler - POST /ai/decisions
func (h *Handler) Create(c *gin.Context) {
	var req models.RecordDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)

	d, err := h.svc.RecordDecision(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, d)
}

// Get handler - GET /ai/decisions/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	d, err := h.svc.GetDecision(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Decision not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// Delete handler - DELETE /ai/decisions/:id
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	deleted, err := h.svc.DeleteDecision(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Decision not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "Decision not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// GetExplanation handler - GET /ai/decisions/:id/explanation
func (h *Handler) GetExplanation(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	result, err := h.svc.GetExplanation(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Decision not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// SubmitFeedback handler - POST /ai/decisions/:id/feedback
func (h *Handler) SubmitFeedback(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)

	var req models.SubmitFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	d, err := h.svc.SubmitFeedback(c.Request.Context(), tenantID, userID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Decision not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, d)
}

// GetTraces handler - GET /ai/decisions/:id/trace
func (h *Handler) GetTraces(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	traces, err := h.svc.GetTraces(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Decision not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": traces, "total": len(traces)})
}

// GetStats handler - GET /ai/decisions/stats
func (h *Handler) GetStats(c *gin.Context) {
	tenantID := h.getTenantID(c)

	var dateRange *models.DateRange
	if startStr := c.Query("start"); startStr != "" {
		dr := &models.DateRange{}
		t, err := parseTimeQuery(startStr)
		if err == nil {
			dr.Start = t
		}
		endStr := c.Query("end")
		if endStr != "" {
			t, err := parseTimeQuery(endStr)
			if err == nil {
				dr.End = t
			}
		}
		dateRange = dr
	}

	stats, err := h.svc.GetStats(c.Request.Context(), tenantID, dateRange)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// AnalyzeDecisions handler - POST /ai/decisions/analyze
func (h *Handler) AnalyzeDecisions(c *gin.Context) {
	tenantID := h.getTenantID(c)

	var req models.AnalyzeDecisionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.AnalysisType == "" {
		middleware.RespondBadRequest(c, "analysisType is required")
		return
	}

	result, err := h.svc.AnalyzeDecisions(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// parseTimeQuery parses an ISO-8601 string or unix seconds string into int64.
func parseTimeQuery(s string) (int64, error) {
	// Try unix seconds first
	t, err := strconv.ParseInt(s, 10, 64)
	if err == nil {
		return t, nil
	}
	// Try ISO-8601
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return 0, err
	}
	return parsed.Unix(), nil
}

func derefInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}
