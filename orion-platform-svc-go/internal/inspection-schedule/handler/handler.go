package handler

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/inspection-schedule/models"
	"orion/platform-svc-go/internal/inspection-schedule/service"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/repository"
)

// Handler provides inspection schedule endpoints.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("inspection_schedule", "read")
	write := auth.RequirePermission("inspection_schedule", "write")
	del := auth.RequirePermission("inspection_schedule", "delete")
	s := rg.Group("/inspection-schedules")
	s.POST("", write, h.Create)
	s.GET("", read, h.List)
	s.GET("/:id", read, h.Get)
	s.PUT("/:id", write, h.Update)
	s.DELETE("/:id", del, h.Delete)
	s.GET("/:id/next-run", read, h.NextRun)
	s.POST("/batch", write, h.BatchCreate)
	s.POST("/:id/trigger", write, h.Trigger)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var req models.CreateScheduleRequest
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchedules")
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSchedule")
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req models.UpdateScheduleRequest
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSchedule")
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

// NextRun computes the next scheduled run time for a schedule.
func (h *Handler) NextRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "NextRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	nextRun, cronExpr, err := h.svc.NextRun(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "not found")
		} else {
			middleware.RespondBadRequest(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"nextRunAt": nextRun, "cronExpr": cronExpr})
}

// Trigger manually triggers a scheduled inspection immediately.
func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TriggerSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	result, err := h.svc.Trigger(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreateInspectionSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var reqs []models.CreateScheduleRequest
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

