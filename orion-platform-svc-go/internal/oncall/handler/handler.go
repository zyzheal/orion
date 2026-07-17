package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Handler handles on-call API routes.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new oncall handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all oncall endpoints under the given group.
// Mirrors /api/v1/oncall routes from the TS source (16 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/oncall")

	// --- Schedules ---
	// GET /oncall/schedules - List schedules
	f.GET("/schedules", auth.RequirePermission("oncall", "read"), h.ListSchedules)
	// GET /oncall/schedules/:id - Get schedule by ID
	f.GET("/schedules/:id", auth.RequirePermission("oncall", "read"), h.GetSchedule)
	// POST /oncall/schedules - Create schedule
	f.POST("/schedules", auth.RequirePermission("oncall", "write"), h.CreateSchedule)
	// PUT /oncall/schedules/:id - Update schedule
	f.PUT("/schedules/:id", auth.RequirePermission("oncall", "write"), h.UpdateSchedule)
	// DELETE /oncall/schedules/:id - Delete schedule
	f.DELETE("/schedules/:id", auth.RequirePermission("oncall", "delete"), h.DeleteSchedule)

	// --- Assignments ---
	// GET /oncall/assignments - List assignments
	f.GET("/assignments", auth.RequirePermission("oncall", "read"), h.ListAssignments)
	// GET /oncall/assignments/:id - Get assignment by ID
	f.GET("/assignments/:id", auth.RequirePermission("oncall", "read"), h.GetAssignment)
	// POST /oncall/assignments - Create assignment
	f.POST("/assignments", auth.RequirePermission("oncall", "write"), h.CreateAssignment)
	// PUT /oncall/assignments/:id - Update assignment
	f.PUT("/assignments/:id", auth.RequirePermission("oncall", "write"), h.UpdateAssignment)
	// DELETE /oncall/assignments/:id - Delete assignment
	f.DELETE("/assignments/:id", auth.RequirePermission("oncall", "delete"), h.DeleteAssignment)

	// --- Overrides ---
	// GET /oncall/overrides - List overrides
	f.GET("/overrides", auth.RequirePermission("oncall", "read"), h.ListOverrides)
	// GET /oncall/overrides/:id - Get override by ID
	f.GET("/overrides/:id", auth.RequirePermission("oncall", "read"), h.GetOverride)
	// POST /oncall/overrides - Create override
	f.POST("/overrides", auth.RequirePermission("oncall", "write"), h.CreateOverride)
	// PUT /oncall/overrides/:id - Update override
	f.PUT("/overrides/:id", auth.RequirePermission("oncall", "write"), h.UpdateOverride)
	// DELETE /oncall/overrides/:id - Delete override
	f.DELETE("/overrides/:id", auth.RequirePermission("oncall", "delete"), h.DeleteOverride)

	// --- On-Call Now ---
	// GET /oncall/on-call-now - Get current on-call person
	f.GET("/on-call-now", auth.RequirePermission("oncall", "read"), h.GetOnCallNow)
}

// --- Schedules ---

func (h *Handler) ListSchedules(c *gin.Context) {
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	status := ptrIf(c.Query("status"))
	schedules, total, err := h.svc.List(c.Request.Context(), tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if schedules == nil {
		schedules = []models.Schedule{}
	}
	middleware.RespondSuccess(c, models.ListSchedulesResponse{
		Schedules: schedules,
		Total:     total,
	})
}

func (h *Handler) GetSchedule(c *gin.Context) {
	id := c.Param("id")
	schedule, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "schedule not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, schedule)
}

func (h *Handler) CreateSchedule(c *gin.Context) {
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	schedule, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, schedule)
}

func (h *Handler) UpdateSchedule(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	schedule, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "schedule not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, schedule)
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	id := c.Param("id")
	deleted, err := h.svc.Delete(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "schedule not found")
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Assignments ---

func (h *Handler) ListAssignments(c *gin.Context) {
	scheduleID := ptrIf(c.Query("scheduleId"))
	assignments, total, err := h.svc.ListAssignments(c.Request.Context(), scheduleID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if assignments == nil {
		assignments = []models.Assignment{}
	}
	middleware.RespondSuccess(c, models.ListAssignmentsResponse{
		Assignments: assignments,
		Total:       total,
		ScheduleID:  func() string { if scheduleID != nil { return *scheduleID }; return "" }(),
	})
}

func (h *Handler) GetAssignment(c *gin.Context) {
	id := c.Param("id")
	assignment, err := h.svc.GetAssignment(c.Request.Context(), id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "assignment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, assignment)
}

func (h *Handler) CreateAssignment(c *gin.Context) {
	var req models.CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.CreateAssignment(c.Request.Context(), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, assignment)
}

func (h *Handler) UpdateAssignment(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.UpdateAssignment(c.Request.Context(), id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "assignment not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, assignment)
}

func (h *Handler) DeleteAssignment(c *gin.Context) {
	id := c.Param("id")
	deleted, err := h.svc.DeleteAssignment(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "assignment not found")
		return
	}
	c.Status(http.StatusNoContent)
}

// --- Overrides ---

func (h *Handler) ListOverrides(c *gin.Context) {
	scheduleID := ptrIf(c.Query("scheduleId"))
	overrides, total, err := h.svc.ListOverrides(c.Request.Context(), scheduleID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if overrides == nil {
		overrides = []models.Override{}
	}
	middleware.RespondSuccess(c, models.ListOverridesResponse{
		Overrides: overrides,
		Total:     total,
	})
}

func (h *Handler) GetOverride(c *gin.Context) {
	id := c.Param("id")
	override, err := h.svc.GetOverride(c.Request.Context(), id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "override not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, override)
}

func (h *Handler) CreateOverride(c *gin.Context) {
	var req models.CreateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	override, err := h.svc.CreateOverride(c.Request.Context(), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, override)
}

func (h *Handler) UpdateOverride(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	override, err := h.svc.UpdateOverride(c.Request.Context(), id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "override not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, override)
}

func (h *Handler) DeleteOverride(c *gin.Context) {
	id := c.Param("id")
	deleted, err := h.svc.DeleteOverride(c.Request.Context(), id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "override not found")
		return
	}
	c.Status(http.StatusNoContent)
}

// --- On-Call Now ---

func (h *Handler) GetOnCallNow(c *gin.Context) {
	scheduleID := c.Query("scheduleId")
	if scheduleID == "" {
		middleware.RespondBadRequest(c, "scheduleId is required")
		return
	}
	result, err := h.svc.GetOnCallNow(c.Request.Context(), scheduleID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "no active on-call found for this schedule")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// --- Helpers ---

// getDefaultTenantID returns the tenant ID from the context or defaults to a zero UUID.
func (h *Handler) getDefaultTenantID(tenantID string) string {
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getQueryInt parses a query parameter as int with a default.
func (h *Handler) getQueryInt(value string, defaultVal int) int {
	if value == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		return defaultVal
	}
	return i
}

// ptrIf returns a string pointer if non-empty, nil otherwise.
func ptrIf(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
