package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/sla-engine/models"
	"orion/platform-svc-go/internal/sla-engine/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	calc *service.SLACalculator
}

func NewHandler(calc *service.SLACalculator) *Handler {
	return &Handler{calc: calc}
}

// RegisterRoutes registers all SLA engine endpoints under /api/sla.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/sla")

	// Profiles
	f.POST("/profiles", auth.RequirePermission("sla-engine", "write"), h.CreateProfile)
	f.GET("/profiles", auth.RequirePermission("sla-engine", "read"), h.ListProfiles)
	f.GET("/profiles/:id", auth.RequirePermission("sla-engine", "read"), h.GetProfile)
	f.PATCH("/profiles/:id", auth.RequirePermission("sla-engine", "write"), h.UpdateProfile)
	f.DELETE("/profiles/:id", auth.RequirePermission("sla-engine", "delete"), h.DeleteProfile)
	f.POST("/profiles/:id/calculate", auth.RequirePermission("sla-engine", "read"), h.CalculateDeadlines)

	// Trackers
	f.POST("/trackers", auth.RequirePermission("sla-engine", "write"), h.CreateTracker)
	f.GET("/trackers", auth.RequirePermission("sla-engine", "read"), h.ListTrackers)
	f.GET("/trackers/:id", auth.RequirePermission("sla-engine", "read"), h.GetTracker)
	f.POST("/trackers/:id/pause", auth.RequirePermission("sla-engine", "manage"), h.PauseTracker)
	f.POST("/trackers/:id/resume", auth.RequirePermission("sla-engine", "manage"), h.ResumeTracker)
	f.POST("/trackers/:id/respond", auth.RequirePermission("sla-engine", "manage"), h.RecordResponse)
	f.POST("/trackers/:id/resolve", auth.RequirePermission("sla-engine", "manage"), h.RecordResolution)
	f.GET("/trackers/:id/breaches", auth.RequirePermission("sla-engine", "read"), h.CheckBreaches)

	// Holidays
	f.POST("/holidays", auth.RequirePermission("sla-engine", "write"), h.CreateHoliday)

	// Statistics
	f.GET("/statistics", auth.RequirePermission("sla-engine", "read"), h.GetTrackerStatistics)
}

// --- Profile handlers ---

func (h *Handler) CreateProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	profile, err := h.calc.CreateProfile(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, profile)
}

func (h *Handler) ListProfiles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListProfiles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ProfileListQuery{Limit: 50}
	if l := c.DefaultQuery("limit", "50"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		q.Offset, _ = strconv.Atoi(o)
	}
	if p := c.Query("priority"); p != "" {
		q.Priority = p
	}
	if t := c.Query("type"); t != "" {
		q.Type = t
	}
	if s := c.Query("status"); s != "" {
		q.Status = s
	}
	profiles, err := h.calc.ListProfiles(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, profiles)
}

func (h *Handler) GetProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	profile, err := h.calc.GetProfile(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, profile)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	profile, err := h.calc.UpdateProfile(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, profile)
}

func (h *Handler) DeleteProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.calc.DeleteProfile(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondNoContent(c)
}

func (h *Handler) CalculateDeadlines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CalculateDeadlines")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	profileID := c.Param("id")
	var req models.CalculateRequest
	// body is optional
	c.ShouldBindJSON(&req)

	profile, err := h.calc.GetProfile(ctx, tenantID, profileID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}

	var openedAt time.Time
	if req.OpenedAt != "" {
		openedAt, err = time.Parse(time.RFC3339, req.OpenedAt)
		if err != nil {
			errors.WriteError(c, errors.ErrBadRequest, "invalid opened_at timestamp: "+err.Error(), 400)
			return
		}
	} else {
		openedAt = time.Now().UTC()
	}

	respDeadline, resDeadline := h.calc.CalculateDeadlines(ctx, profile, openedAt)
	errors.WriteSuccess(c, models.DeadlinesResult{
		ResponseDeadline:   respDeadline,
		ResolutionDeadline: resDeadline,
	})
}

// --- Tracker handlers ---

func (h *Handler) CreateTracker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTracker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTrackerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	var openedAt time.Time
	if req.OpenedAt != "" {
		var err error
		openedAt, err = time.Parse(time.RFC3339, req.OpenedAt)
		if err != nil {
			errors.WriteError(c, errors.ErrBadRequest, "invalid opened_at timestamp: "+err.Error(), 400)
			return
		}
	} else {
		openedAt = time.Now().UTC()
	}

	tracker, err := h.calc.CreateTracker(ctx, tenantID, req.SLAProfileID, req.TargetID, req.TargetType, openedAt)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, tracker)
}

func (h *Handler) ListTrackers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTrackers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	targetType := c.Query("target_type")
	status := c.Query("status")
	limit := 50
	offset := 0
	if l := c.DefaultQuery("limit", "50"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		offset, _ = strconv.Atoi(o)
	}
	trackers, err := h.calc.ListTrackers(ctx, tenantID, targetType, status, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, trackers)
}

func (h *Handler) GetTracker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTracker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	tracker, err := h.calc.GetTracker(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, tracker)
}

func (h *Handler) PauseTracker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PauseTracker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	trackerID := c.Param("id")
	var req models.PauseTrackerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if err := h.calc.PauseTracker(ctx, tenantID, trackerID, req.Reason); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "tracker paused"})
}

func (h *Handler) ResumeTracker(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResumeTracker")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	trackerID := c.Param("id")
	if err := h.calc.ResumeTracker(ctx, tenantID, trackerID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "tracker resumed"})
}

func (h *Handler) RecordResponse(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordResponse")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	trackerID := c.Param("id")
	if err := h.calc.RecordResponse(ctx, tenantID, trackerID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "response recorded"})
}

func (h *Handler) RecordResolution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordResolution")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	trackerID := c.Param("id")
	if err := h.calc.RecordResolution(ctx, tenantID, trackerID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "resolution recorded"})
}

func (h *Handler) CheckBreaches(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckBreaches")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	breaches := h.calc.CheckBreaches(ctx, tenantID)
	errors.WriteSuccess(c, gin.H{"breaches": breaches})
}

// --- Holiday handlers ---

func (h *Handler) CreateHoliday(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateHoliday")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Name string `json:"name" binding:"required"`
		Date string `json:"date" binding:"required"` // RFC3339 or YYYY-MM-DD
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	date, err := parseHolidayDate(req.Date)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	holiday, err := h.calc.CreateHoliday(ctx, tenantID, req.Name, date)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, holiday)
}

// --- Statistics ---

func (h *Handler) GetTrackerStatistics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrackerStatistics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.calc.GetTrackerStatistics(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, stats)
}

// parseHolidayDate parses a date in RFC3339 or YYYY-MM-DD format.
func parseHolidayDate(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02", s)
		if err != nil {
			return time.Time{}, err
		}
	}
	return t, nil
}
