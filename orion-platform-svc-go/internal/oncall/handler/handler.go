package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/service"
)

type OnCallHandler struct {
	svc *service.OnCallService
}

func NewOnCallHandler(svc *service.OnCallService) *OnCallHandler {
	return &OnCallHandler{svc: svc}
}

func (h *OnCallHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

func (h *OnCallHandler) RegisterRoutes(rg *gin.RouterGroup) {
	schedules := rg.Group("/oncall/schedules")
	schedules.GET("", auth.RequirePermission("monitor", "read"), h.ListSchedules)
	schedules.POST("", auth.RequirePermission("monitor", "write"), h.CreateSchedule)
	schedules.GET("/:id", auth.RequirePermission("monitor", "read"), h.GetSchedule)
	schedules.DELETE("/:id", auth.RequirePermission("monitor", "delete"), h.DeleteSchedule)
	schedules.GET("/:id/current", auth.RequirePermission("monitor", "read"), h.GetCurrentOnCall)

	rotations := rg.Group("/oncall/schedules/:id/rotations")
	rotations.GET("", auth.RequirePermission("monitor", "read"), h.ListRotations)
	rotations.POST("", auth.RequirePermission("monitor", "write"), h.AddRotation)
}

func (h *OnCallHandler) ListSchedules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallListSchedules")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.QuerySchedules(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondPaginated(c, resp.Data, offset, limit, int(resp.Total))
}

func (h *OnCallHandler) CreateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallCreateSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	schedule, err := h.svc.CreateSchedule(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, schedule)
}

func (h *OnCallHandler) GetSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallGetSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	schedule, err := h.svc.GetSchedule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, schedule)
}

func (h *OnCallHandler) DeleteSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallDeleteSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	if err := h.svc.DeleteSchedule(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *OnCallHandler) GetCurrentOnCall(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallGetCurrentOnCall")
	defer span.End()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid id format")
		return
	}
	resp, err := h.svc.GetCurrentOnCall(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *OnCallHandler) ListRotations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallListRotations")
	defer span.End()
	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid schedule_id format")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	rotations, total, err := h.svc.QueryRotations(ctx, scheduleID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondPaginated(c, rotations, offset, limit, int(total))
}

func (h *OnCallHandler) AddRotation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OncallAddRotation")
	defer span.End()
	scheduleID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid schedule_id format")
		return
	}
	tenantID := h.GetTenantID(c)
	var req models.AddRotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rotation, err := h.svc.AddRotation(ctx, tenantID, scheduleID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rotation)
}
