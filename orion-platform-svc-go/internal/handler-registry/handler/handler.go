package handler

import (
	"orion/platform-svc-go/internal/handler-registry/models"
	"orion/platform-svc-go/internal/handler-registry/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all handler registry routes under /handlers prefix.
// NOTE: static routes (/health, /domains) must be registered BEFORE parameterized routes
// (/:domain/:name) to avoid Gin parameter collision.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/handlers")

	// GET /handlers - list all handler entries
	f.GET("", auth.RequirePermission("handler_registry", "read"), h.List)

	// GET /handlers/health - health check
	f.GET("/health", auth.RequirePermission("handler_registry", "read"), h.HealthCheck)

	// GET /handlers/domains - list distinct domains
	f.GET("/domains", auth.RequirePermission("handler_registry", "read"), h.GetDomains)

	// GET /handlers/:domain/:name - get single handler entry
	f.GET("/:domain/:name", auth.RequirePermission("handler_registry", "read"), h.GetEntry)

	// POST /handlers/register - register a new handler
	f.POST("/register", auth.RequirePermission("handler_registry", "write"), h.RegisterHandler)

	// POST /handlers/:domain/:name/enable - enable a handler
	f.POST("/:domain/:name/enable", auth.RequirePermission("handler_registry", "write"), h.Enable)

	// POST /handlers/:domain/:name/disable - disable a handler
	f.POST("/:domain/:name/disable", auth.RequirePermission("handler_registry", "write"), h.Disable)

	// DELETE /handlers/:domain/:name - unregister a handler
	f.DELETE("/:domain/:name", auth.RequirePermission("handler_registry", "delete"), h.Unregister)

	// POST /handlers/:domain/:name/invoke - invoke a handler
	f.POST("/:domain/:name/invoke", auth.RequirePermission("handler_registry", "write"), h.Invoke)
}

// ====== Legacy CRUD handlers (backward compatibility) ======

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateHandlerRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Query("domain")
	status := c.Query("status")
	opts := models.ListHandlerRegistryOptions{
		Domain: domain,
		Status: status,
	}
	items, err := h.svc.ListEntries(ctx, tenantID, opts)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateHandlerRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// ====== Handler SPI Registry handlers ======

// HealthCheck returns the health status of the handler registry service.
func (h *Handler) HealthCheck(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HealthCheck")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	health, err := h.svc.HealthCheck(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	health["tenant_id"] = tenantID
	middleware.RespondSuccess(c, health)
}

// GetDomains returns the list of distinct domains.
func (h *Handler) GetDomains(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDomains")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domains, err := h.svc.GetDomains(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"domains": domains, "total": len(domains)})
}

// GetEntry returns a single handler entry by domain and name.
func (h *Handler) GetEntry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEntry")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Param("domain")
	name := c.Param("name")
	entry, err := h.svc.GetEntry(ctx, tenantID, domain, name)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, entry)
}

// RegisterHandler registers a new handler entry.
func (h *Handler) RegisterHandler(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterHandler")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")

	var req models.RegisterHandlerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if req.RegisteredBy == "" {
		req.RegisteredBy = createdBy
	}

	entry, err := h.svc.RegisterHandler(ctx, tenantID, req)
	if err != nil {
		middleware.RespondConflict(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"domain": entry.Domain, "name": entry.Name, "status": entry.Status})
}

// Enable enables a handler entry.
func (h *Handler) Enable(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Enable")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Param("domain")
	name := c.Param("name")
	if err := h.svc.Enable(ctx, tenantID, domain, name); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"domain": domain, "name": name, "status": "active"})
}

// Disable disables a handler entry.
func (h *Handler) Disable(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Disable")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Param("domain")
	name := c.Param("name")
	if err := h.svc.Disable(ctx, tenantID, domain, name); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"domain": domain, "name": name, "status": "disabled"})
}

// Unregister removes a handler entry.
func (h *Handler) Unregister(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Unregister")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Param("domain")
	name := c.Param("name")
	if err := h.svc.Unregister(ctx, tenantID, domain, name); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"domain": domain, "name": name, "status": "removed"})
}

// Invoke invokes a handler entry with the given payload.
func (h *Handler) Invoke(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Invoke")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	domain := c.Param("domain")
	name := c.Param("name")

	var req models.InvokeHandlerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	if req.Payload == nil {
		req.Payload = make(map[string]interface{})
	}

	result, err := h.svc.Invoke(ctx, tenantID, domain, name, req.Payload)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"domain": domain, "name": name, "result": result})
}
