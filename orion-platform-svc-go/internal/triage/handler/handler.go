// Package handler 暴露 Triage 域 HTTP 端点。
//
// 7 个端点（参见 triage-api-contract-design §1.1）：
//   1. GET  /triage/overview          → 我的总览
//   2. GET  /triage/alerts            → 告警子集
//   3. GET  /triage/alerts/:id        → 单条告警详情
//   4. GET  /triage/tickets           → 工单子集
//   5. GET  /triage/tickets/:id       → 单条工单详情
//   6. POST /triage/acknowledge       → 确认
//   7. POST /triage/assign            → 分配
//   8. POST /triage/handoff           → 值班交接（附加端点，见 WS 事件）
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/triage/models"
	"orion/platform-svc-go/internal/triage/service"
)

// Handler 暴露 Triage 相关端点。
type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := auth.RequirePermission("triage", "read")
	w := auth.RequirePermission("triage", "write")

	rg.GET("/triage/overview", r, h.Overview)
	rg.GET("/triage/alerts", r, h.ListAlerts)
	rg.GET("/triage/tickets", r, h.ListTickets)
	rg.POST("/triage/acknowledge", w, h.Acknowledge)
	rg.POST("/triage/assign", w, h.Assign)
	rg.POST("/triage/handoff", w, h.Handoff)
}

// Overview GET /api/v1/triage/overview
func (h *Handler) Overview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.Overview")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	req := &models.OverviewRequest{
		IncludeActivity: c.Query("include_activity") == "true",
		LimitActivity:   atoiDefault(c.Query("limit_activity"), 20),
	}

	result, err := h.svc.Overview(ctx, tenantID, userID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ListAlerts GET /api/v1/triage/alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.ListAlerts")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	req := buildSubsetRequest(c)
	result, err := h.svc.ListAlerts(ctx, tenantID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// ListTickets GET /api/v1/triage/tickets
func (h *Handler) ListTickets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.ListTickets")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	req := buildSubsetRequest(c)
	result, err := h.svc.ListTickets(ctx, tenantID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// Acknowledge POST /api/v1/triage/acknowledge
func (h *Handler) Acknowledge(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.Acknowledge")
	defer span.End()

	var req models.AcknowledgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	if err := h.svc.Acknowledge(ctx, &req); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"item_id": req.ItemID, "status": models.StatusAcknowledged}})
}

// Assign POST /api/v1/triage/assign
func (h *Handler) Assign(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.Assign")
	defer span.End()

	var req models.AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	if err := h.svc.Assign(ctx, &req); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"item_id": req.ItemID, "assigned_to": req.ToUserID}})
}

// Handoff POST /api/v1/triage/handoff
func (h *Handler) Handoff(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Triage.Handoff")
	defer span.End()

	var req models.HandoffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = c.GetString("tenant_id")
	}

	result, err := h.svc.Handoff(ctx, &req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// buildSubsetRequest 从 query 参数构造 SubsetRequest。
func buildSubsetRequest(c *gin.Context) *models.SubsetRequest {
	filter := &models.Filter{}
	if v := c.Query("severity"); v != "" {
		s := models.Severity(v)
		filter.Severity = &s
	}
	if v := c.Query("source_type"); v != "" {
		filter.SourceType = &v
	}
	if v := c.Query("status"); v != "" {
		st := models.Status(v)
		filter.Status = &st
	}
	if v := c.Query("assigned_scope"); v != "" {
		sc := models.AssignedScope(v)
		filter.AssignedScope = &sc
	}
	if v := c.Query("time_range"); v != "" {
		tr := models.TimeRange(v)
		filter.TimeRange = &tr
	}
	if v := c.Query("search"); v != "" {
		filter.Search = &v
	}

	return &models.SubsetRequest{
		Filter:   filter,
		Page:     atoiDefault(c.DefaultQuery("page", "1"), 1),
		PageSize: atoiDefault(c.DefaultQuery("page_size", "50"), 50),
	}
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

// writeServiceError 把 service 层错误映射到 HTTP 状态码。
func writeServiceError(c *gin.Context, err error) {
	switch err {
	case service.ErrTriageInvalidParam:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusBadRequest)
	case service.ErrTriageNotFound:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusNotFound)
	case service.ErrTriageDuplicate:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusConflict)
	case service.ErrTriageConflict:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusConflict)
	case service.ErrTriageNoPermission:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusForbidden)
	case service.ErrTriageEmptyOnCall:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusServiceUnavailable)
	case service.ErrTriageAlertMissing, service.ErrTriageTicketMissing:
		errors.WriteError(c, err.Error(), err.Error(), http.StatusServiceUnavailable)
	default:
		errors.WriteError(c, "E_TRIAGE_INTERNAL", err.Error(), http.StatusInternalServerError)
	}
}
