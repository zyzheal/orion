package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/oncall/models"
	"orion/platform-svc-go/internal/oncall/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	List(ctx context.Context, tenantID string, status *string) ([]models.Schedule, int, error)
	Get(ctx context.Context, id string) (*models.Schedule, error)
	Create(ctx context.Context, tenantID string, req *models.CreateScheduleRequest) (*models.Schedule, error)
	Update(ctx context.Context, id string, req *models.UpdateScheduleRequest) (*models.Schedule, error)
	Delete(ctx context.Context, id string) (bool, error)
	ListAssignments(ctx context.Context, scheduleID *string) ([]models.Assignment, int, error)
	GetAssignment(ctx context.Context, id string) (*models.Assignment, error)
	CreateAssignment(ctx context.Context, req *models.CreateAssignmentRequest) (*models.Assignment, error)
	UpdateAssignment(ctx context.Context, id string, req *models.UpdateAssignmentRequest) (*models.Assignment, error)
	DeleteAssignment(ctx context.Context, id string) (bool, error)
	ListOverrides(ctx context.Context, scheduleID *string) ([]models.Override, int, error)
	GetOverride(ctx context.Context, id string) (*models.Override, error)
	CreateOverride(ctx context.Context, req *models.CreateOverrideRequest) (*models.Override, error)
	UpdateOverride(ctx context.Context, id string, req *models.UpdateOverrideRequest) (*models.Override, error)
	DeleteOverride(ctx context.Context, id string) (bool, error)
	GetOnCallNow(ctx context.Context, scheduleID string) (*models.CurrentOnCallResult, error)
}

// Handler handles on-call API routes.
type Handler struct {
	svc Service
}

// NewHandler creates a new oncall handler.
func NewHandler(svc Service) *Handler {
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchedules")
	defer span.End()
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	status := ptrIf(c.Query("status"))
	schedules, total, err := h.svc.List(ctx, tenantID, status)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSchedule")
	defer span.End()
	id := c.Param("id")
	schedule, err := h.svc.Get(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSchedule")
	defer span.End()
	var req models.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getDefaultTenantID(c.GetString("tenant_id"))
	schedule, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, schedule)
}

func (h *Handler) UpdateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSchedule")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	schedule, err := h.svc.Update(ctx, id, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSchedule")
	defer span.End()
	id := c.Param("id")
	deleted, err := h.svc.Delete(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAssignments")
	defer span.End()
	scheduleID := ptrIf(c.Query("scheduleId"))
	assignments, total, err := h.svc.ListAssignments(ctx, scheduleID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAssignment")
	defer span.End()
	id := c.Param("id")
	assignment, err := h.svc.GetAssignment(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAssignment")
	defer span.End()
	var req models.CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.CreateAssignment(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, assignment)
}

func (h *Handler) UpdateAssignment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAssignment")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	assignment, err := h.svc.UpdateAssignment(ctx, id, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAssignment")
	defer span.End()
	id := c.Param("id")
	deleted, err := h.svc.DeleteAssignment(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOverrides")
	defer span.End()
	scheduleID := ptrIf(c.Query("scheduleId"))
	overrides, total, err := h.svc.ListOverrides(ctx, scheduleID)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOverride")
	defer span.End()
	id := c.Param("id")
	override, err := h.svc.GetOverride(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOverride")
	defer span.End()
	var req models.CreateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	override, err := h.svc.CreateOverride(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, override)
}

func (h *Handler) UpdateOverride(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateOverride")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	override, err := h.svc.UpdateOverride(ctx, id, &req)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteOverride")
	defer span.End()
	id := c.Param("id")
	deleted, err := h.svc.DeleteOverride(ctx, id)
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOnCallNow")
	defer span.End()
	scheduleID := c.Query("scheduleId")
	if scheduleID == "" {
		middleware.RespondBadRequest(c, "scheduleId is required")
		return
	}
	result, err := h.svc.GetOnCallNow(ctx, scheduleID)
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
