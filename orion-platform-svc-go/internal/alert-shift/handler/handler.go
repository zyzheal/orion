package handler

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-shift/models"
	"orion/platform-svc-go/internal/alert-shift/service"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/repository"
)

// Handler provides alert shift scheduling endpoints.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("alert_shift", "read")
	write := auth.RequirePermission("alert_shift", "write")
	del := auth.RequirePermission("alert_shift", "delete")
	s := rg.Group("/alert-shifts")
	s.POST("", write, h.Create)
	s.GET("", read, h.List)
	s.GET("/:id", read, h.Get)
	s.PUT("/:id", write, h.Update)
	s.DELETE("/:id", del, h.Delete)
	s.POST("/batch", write, h.BatchCreate)
	s.GET("/:id/assignments", read, h.ListAssignments)
	s.POST("/:id/assignments", write, h.CreateAssignment)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var req models.CreateShiftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	shift, err := h.svc.CreateShift(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, shift)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListShifts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	q := repository.NewListQuery()
	q.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	q.PageSize, _ = strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	q.Search = c.Query("q")
	q.SortBy = c.DefaultQuery("sort", "created_at")
	q.SortDir = c.DefaultQuery("order", "desc")

	// Parse filter params from query string
	for _, field := range []string{"pattern", "enabled", "team"} {
		if val := c.Query(field); val != "" {
			q.Filters[field] = val
		}
	}

	shifts, total, err := h.svc.ListShifts(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": shifts, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	shift, err := h.svc.GetShift(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "shift not found")
		return
	}
	middleware.RespondSuccess(c, shift)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req models.UpdateShiftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	expectedVersion := 0
	if ifMatch := c.GetHeader("If-Match"); ifMatch != "" {
		expectedVersion, _ = strconv.Atoi(ifMatch)
	}
	shift, err := h.svc.UpdateShift(ctx, tenantID, id, &req, expectedVersion)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondNotFound(c, "shift not found")
		} else if errors.Is(err, repository.ErrVersionMismatch) {
			middleware.RespondConflict(c, "version mismatch: resource was modified by another request")
		} else if strings.Contains(err.Error(), "no fields to update") {
			middleware.RespondBadRequest(c, err.Error())
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, shift)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	ok, err := h.svc.DeleteShift(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !ok {
		middleware.RespondNotFound(c, "shift not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) ListAssignments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAssignments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	assignments, err := h.svc.ListAssignments(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, assignments)
}

func (h *Handler) CreateAssignment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAssignment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req models.CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.CreateAssignment(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, assignment)
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreateAlertShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var reqs []models.CreateShiftRequest
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
		item, err := h.svc.CreateShift(ctx, tenantID, &req)
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

