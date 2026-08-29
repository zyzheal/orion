package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/monitoring/internal/oncall/models"
	"orion/platform-svc-go/internal/monitoring/internal/oncall/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
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

// RegisterRoutes registers on-call routes.
func (h *OnCallHandler) RegisterRoutes(rg *gin.RouterGroup) {
	schedules := rg.Group("/oncall/schedules")

	schedules.GET("", auth.RequirePermission("monitor", "read"), h.ListSchedules)
	schedules.POST("", auth.RequirePermission("monitor", "write"), h.CreateSchedule)
	schedules.GET("/:id", auth.RequirePermission("monitor", "read"), h.GetSchedule)
	schedules.DELETE("/:id", auth.RequirePermission("monitor", "delete"), h.DeleteSchedule)
	schedules.GET("/:id/current", auth.RequirePermission("monitor", "read"), h.GetCurrentOnCall)

	rotations := rg.Group("/oncall/schedules/:schedule_id/rotations")
	rotations.GET("", auth.RequirePermission("monitor", "read"), h.ListRotations)
	rotations.POST("", auth.RequirePermission("monitor", "write"), h.AddRotation)
}

func (h *OnCallHandler) ListSchedules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallListSchedules")
	defer span.End()
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QuerySchedules(ctx, tenantID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}

func (h *OnCallHandler) CreateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallCreateSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	schedule, err := h.svc.CreateSchedule(ctx, tenantID, &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, schedule)
}

func (h *OnCallHandler) GetSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallGetSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	schedule, err := h.svc.GetSchedule(ctx, tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, schedule)
}

func (h *OnCallHandler) DeleteSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallDeleteSchedule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	if err := h.svc.DeleteSchedule(ctx, tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *OnCallHandler) GetCurrentOnCall(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallGetCurrentOnCall")
	defer span.End()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	resp, err := h.svc.GetCurrentOnCall(ctx, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, resp)
}

func (h *OnCallHandler) ListRotations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallListRotations")
	defer span.End()
	scheduleID, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid schedule_id format")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	rotations, total, err := h.svc.QueryRotations(ctx, scheduleID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": total,
		"data":  rotations,
	})
}

func (h *OnCallHandler) AddRotation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorOncallAddRotation")
	defer span.End()
	scheduleID, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid schedule_id format")
		return
	}
	tenantID := h.GetTenantID(c)

	var req models.AddRotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	rotation, err := h.svc.AddRotation(ctx, tenantID, scheduleID, &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, rotation)
}
