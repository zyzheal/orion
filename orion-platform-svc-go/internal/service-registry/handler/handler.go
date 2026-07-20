package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/service-registry/models"
	"orion/platform-svc-go/internal/service-registry/repository"
	"orion/platform-svc-go/internal/service-registry/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

const resource = "service-registry"

// Handler provides HTTP handlers for the service registry.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler backed by the given Service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all service-registry routes under the given router group
// (expected base: /api/v1/service-registry).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET /services — list all registered services (tenant-scoped, paginated)
	rg.GET("/services",
		auth.RequirePermission(resource, "read"),
		h.List)

	// POST /register — register a new service
	rg.POST("/register",
		auth.RequirePermission(resource, "write"),
		h.Register)

	// DELETE /services/:id — deregister a service by internal id
	rg.DELETE("/services/:id",
		auth.RequirePermission(resource, "write"),
		h.Deregister)

	// GET /services/:id/health — get service health status
	rg.GET("/services/:id/health",
		auth.RequirePermission(resource, "read"),
		h.Health)

	// POST /services/:id/heartbeat — record service heartbeat
	rg.POST("/services/:id/heartbeat",
		auth.RequirePermission(resource, "write"),
		h.Heartbeat)
}

// List handles GET /services.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	f := &repository.ListFilters{
		ServiceName: c.Query("serviceName"),
		Health:      c.Query("health"),
		Limit:       limit,
		Offset:      offset,
	}

	items, err := h.svc.List(ctx, tenantID, f)
	if err != nil {
		middleware.RespondInternalError(c, "failed to list services: "+err.Error())
		return
	}
	middleware.RespondSuccess(c, models.ListResponse{
		Data:  items,
		Total: len(items),
		Page:  page,
		Limit: limit,
	})
}

// Register handles POST /register.
func (h *Handler) Register(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Register")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.ServiceID == "" || req.ServiceName == "" || req.ServiceURL == "" {
		middleware.RespondBadRequest(c, "serviceId, serviceName, and serviceUrl are required")
		return
	}

	// Check for duplicate serviceId within tenant
	existing, err := h.svc.GetByServiceID(ctx, tenantID, req.ServiceID)
	if err != nil {
		middleware.RespondInternalError(c, "failed to check existing service: "+err.Error())
		return
	}
	if existing != nil {
		errors.WriteErrorWithDetails(c, errors.ErrConflict,
			"Service already registered: "+req.ServiceID, http.StatusConflict,
			map[string]any{"serviceId": req.ServiceID})
		return
	}

	m, err := h.svc.Register(ctx, tenantID, req)
	if err != nil {
		errors.WriteErrorWithDetails(c, errors.ErrConflict,
			"Failed to register service: "+err.Error(), http.StatusConflict,
			map[string]any{"serviceId": req.ServiceID})
		return
	}
	middleware.RespondCreated(c, m)
}

// Deregister handles DELETE /services/:id.
func (h *Handler) Deregister(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deregister")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	entity, err := h.svc.GetByInternalID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "Service not found: "+id)
		return
	}

	if err := h.svc.Deregister(ctx, tenantID, entity.ServiceID); err != nil {
		middleware.RespondInternalError(c, "failed to deregister service: "+err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "Service " + entity.ServiceID + " deregistered"})
}

// Health handles GET /services/:id/health.
func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Health")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	entity, err := h.svc.GetByInternalID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "Service not found: "+id)
		return
	}

	now := time.Now().UTC()
	lastHeartbeat := ""
	if entity.LastHeartbeatAt != nil {
		lastHeartbeat = entity.LastHeartbeatAt.Format("2006-01-02T15:04:05Z")
	}

	middleware.RespondSuccess(c, models.HealthResponse{
		ServiceID:     entity.ServiceID,
		Status:        entity.HealthStatus,
		LatencyMs:     0,
		LastChecked:   now.Format("2006-01-02T15:04:05Z"),
		ErrorRate:     0,
		LastHeartbeat: &lastHeartbeat,
	})
}

// Heartbeat handles POST /services/:id/heartbeat.
func (h *Handler) Heartbeat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Heartbeat")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	entity, err := h.svc.GetByInternalID(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "Service not found: "+id)
		return
	}

	if err := h.svc.RecordHeartbeat(ctx, tenantID, entity.ServiceID); err != nil {
		middleware.RespondInternalError(c, "failed to record heartbeat: "+err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "Heartbeat recorded"})
}
