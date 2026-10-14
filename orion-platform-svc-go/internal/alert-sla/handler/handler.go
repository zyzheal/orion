package handler

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-sla/models"
	"orion/platform-svc-go/internal/alert-sla/service"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/repository"
)

// Handler provides alert SLA policy endpoints.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("alert_sla", "read")
	write := auth.RequirePermission("alert_sla", "write")
	del := auth.RequirePermission("alert_sla", "delete")
	s := rg.Group("/alert-slas")
	s.POST("", write, h.Create)
	s.GET("", read, h.List)
	s.GET("/:id", read, h.Get)
	s.PUT("/:id", write, h.Update)
	s.DELETE("/:id", del, h.Delete)
	s.POST("/batch", write, h.BatchCreate)
	s.POST("/:id/evaluate", read, h.Evaluate)
	s.GET("/breaches", read, h.Breaches)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var req models.CreateSLARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, item)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlertSLAs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items, total, err := h.svc.List(ctx, tenantID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": items, "total": total, "page": page, "pageSize": pageSize})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req models.UpdateSLARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	expectedVersion := 0
	if ifMatch := c.GetHeader("If-Match"); ifMatch != "" {
		expectedVersion, _ = strconv.Atoi(ifMatch)
	}
	item, err := h.svc.Update(ctx, tenantID, id, &req, expectedVersion)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "not found")
		} else if errors.Is(err, repository.ErrVersionMismatch) {
			middleware.RespondConflict(c, "version mismatch: resource was modified by another request")
		} else if strings.Contains(err.Error(), "no fields to update") {
			middleware.RespondBadRequest(c, err.Error())
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	ok, err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !ok {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// Evaluate checks an alert against an SLA policy and returns breach details.
func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req struct {
		AlertID    string `json:"alertId"`
		Severity   string `json:"severity"`
		CreatedAt  string `json:"createdAt"`
		AckedAt    string `json:"ackedAt"`
		ResolvedAt string `json:"resolvedAt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	breaches, err := h.svc.Evaluate(ctx, tenantID, id, req.AlertID, req.Severity, req.CreatedAt, req.AckedAt, req.ResolvedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "sla not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"breaches": breaches})
}

// Breaches returns detected SLA breaches from the background monitor.
// If no monitor is running, returns an empty list.
func (h *Handler) Breaches(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSLABreaches")
	defer span.End()

	breaches := h.svc.Breaches()
	middleware.RespondSuccess(c, gin.H{"breaches": breaches})
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreateAlertSLA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var reqs []models.CreateSLARequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if len(reqs) == 0 {
		middleware.RespondBadRequest(c, "batch must not be empty")
		return
	}
	if len(reqs) > 100 {
		middleware.RespondBadRequest(c, "batch size must not exceed 100")
		return
	}

	results := make([]middleware.BatchItemResult, len(reqs))
	succeeded := 0
	for i, req := range reqs {
		item, err := h.svc.Create(ctx, tenantID, &req)
		if err != nil {
			results[i] = middleware.BatchItemResult{Index: i, OK: false, Error: err.Error()}
		} else {
			results[i] = middleware.BatchItemResult{Index: i, OK: true, ID: item.ID}
			succeeded++
		}
	}

	resp := &middleware.BatchResponse{
		Total:     len(reqs),
		Succeeded: succeeded,
		Failed:    len(reqs) - succeeded,
		Results:   results,
	}
	if succeeded == len(reqs) {
		middleware.RespondBatchAllOK(c, results)
	} else {
		middleware.RespondBatch(c, resp)
	}
}

