package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/alert-shift/models"
	"orion/platform-svc-go/internal/alert-shift/service"
	"orion/platform-svc-go/internal/middleware"
)

// Handler provides alert shift scheduling endpoints.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/alert-shifts")
	s.POST("", h.Create)
	s.GET("", h.List)
	s.GET("/:id", h.Get)
	s.PUT("/:id", h.Update)
	s.DELETE("/:id", h.Delete)
	s.GET("/:id/assignments", h.ListAssignments)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
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
	shifts, err := h.svc.ListShifts(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, shifts)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
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
	id := c.Param("id")
	var req models.CreateShiftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	shift, err := h.svc.GetShift(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "shift not found")
		return
	}
	updates := map[string]interface{}{
		"name":      shift.Name,
		"team":      shift.Team,
		"pattern":   shift.Pattern,
		"start_time": shift.StartTime,
		"end_time":  shift.EndTime,
		"weekdays":  shift.Weekdays,
		"enabled":   shift.Enabled,
	}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Team != nil {
		updates["team"] = *req.Team
	}
	if req.Pattern != "" {
		updates["pattern"] = req.Pattern
	}
	if req.Enabled != shift.Enabled {
		updates["enabled"] = req.Enabled
	}
	if err := h.svc.UpdateShift(ctx, tenantID, id, updates); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	updated, err := h.svc.GetShift(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, updated)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteShift")
	defer span.End()
	tenantID := c.GetString("tenant_id")
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
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAssignments")
	defer span.End()
	middleware.RespondSuccess(c, []models.Assignment{})
}
