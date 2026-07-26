package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/oncall/models"
	"orion/monitor-svc-go/internal/oncall/service"
	"orion/monitor-svc-go/internal/response_writer"
	"orion/go-common/pkg/auth"
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

// ListSchedules returns paginated schedules.
func (h *OnCallHandler) ListSchedules(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QuerySchedules(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}

// CreateSchedule creates a new schedule.
func (h *OnCallHandler) CreateSchedule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	schedule, err := h.svc.CreateSchedule(c.Request.Context(), tenantID, &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, schedule)
}

// GetSchedule returns a single schedule.
func (h *OnCallHandler) GetSchedule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	schedule, err := h.svc.GetSchedule(c.Request.Context(), tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, schedule)
}

// DeleteSchedule removes a schedule.
func (h *OnCallHandler) DeleteSchedule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	if err := h.svc.DeleteSchedule(c.Request.Context(), tenantID, id); err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// GetCurrentOnCall returns who is currently on-call.
func (h *OnCallHandler) GetCurrentOnCall(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid id format")
		return
	}

	resp, err := h.svc.GetCurrentOnCall(c.Request.Context(), id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, resp)
}

// ListRotations returns rotations for a schedule.
func (h *OnCallHandler) ListRotations(c *gin.Context) {
	scheduleID, err := uuid.Parse(c.Param("schedule_id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid schedule_id format")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	rotations, total, err := h.svc.QueryRotations(c.Request.Context(), scheduleID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": total,
		"data":  rotations,
	})
}

// AddRotation adds a rotation to a schedule.
func (h *OnCallHandler) AddRotation(c *gin.Context) {
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

	rotation, err := h.svc.AddRotation(c.Request.Context(), tenantID, scheduleID, &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.RespondCreated(c, rotation)
}
