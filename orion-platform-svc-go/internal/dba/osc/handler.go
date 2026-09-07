package osc

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
)

// Handler exposes OSC operations over HTTP. Routes are registered
// relative to the api/v1 RouterGroup so the actual paths are
// /api/v1/dba/osc/...
type Handler struct {
	svc ServiceInterface
}

// NewHandler wires the handler. svc must implement ServiceInterface.
func NewHandler(svc ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the OSC endpoints under /dba/osc on rg.
// The dba main handler already claims /dba, so we nest under /osc here
// to avoid Gin trie conflicts with existing dba sub-routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba/osc")
	f.GET("/jobs", auth.RequirePermission("dba", "read"), h.ListJobs)
	f.GET("/jobs/:id", auth.RequirePermission("dba", "read"), h.GetJob)
	f.POST("/jobs", auth.RequirePermission("dba", "write"), h.CreateJob)
	f.POST("/jobs/:id/start", auth.RequirePermission("dba", "execute"), h.StartJob)
	f.POST("/jobs/:id/stop", auth.RequirePermission("dba", "execute"), h.StopJob)
	f.POST("/dryrun", auth.RequirePermission("dba", "execute"), h.DryRun)
	f.GET("/jobs/:id/status", auth.RequirePermission("dba", "read"), h.Status)
}

// ---- handlers ----

func (h *Handler) ListJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.ListJobs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := OSCListQuery{
		Status: c.Query("status"),
		Page:   intDef(c.Query("page"), 1),
		Limit:  intDef(c.Query("limit"), 20),
	}
	result, err := h.svc.ListJobs(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.GetJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	job, err := h.svc.GetJob(ctx, tenantID, c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrInvalidTransition) || containsNotFound(err) {
			middleware.RespondNotFound(c, "osc job not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) CreateJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.CreateJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req CreateOSCJobInput
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.CreateJob(ctx, tenantID, userID, req)
	if err != nil {
		if containsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, job)
}

func (h *Handler) StartJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.StartJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	job, err := h.svc.StartJob(ctx, tenantID, userID, c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrInvalidTransition) || containsNotFound(err) {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) StopJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.StopJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	job, err := h.svc.StopJob(ctx, tenantID, c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrInvalidTransition) || containsNotFound(err) {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) DryRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.DryRun")
	defer span.End()
	var req DryRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.DryRun(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !result.Success {
		middleware.RespondBadRequest(c, result.Message)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Status(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OSC.Status")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	st, err := h.svc.Status(ctx, tenantID, c.Param("id"))
	if err != nil {
		if containsNotFound(err) {
			middleware.RespondNotFound(c, "osc job not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, st)
}

// ---- helpers ----

func intDef(val string, def int) int {
	if val == "" {
		return def
	}
	v, err := strconv.Atoi(val)
	if err != nil {
		return def
	}
	return v
}

func containsNotFound(err error) bool {
	return err != nil && strings.Contains(err.Error(), "not found")
}
