package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/gateway-dynamic/models"
	"orion/platform-svc-go/internal/gateway-dynamic/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Handler exposes HTTP endpoints for gateway dynamic route management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all gateway dynamic routes onto the given router group.
// Mirrors the TS endpoints at /api/v1/gateway/routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/routes")
	r.GET("", auth.RequirePermission("gateway_dynamic", "read"), h.List)
	r.GET("/stats", auth.RequirePermission("gateway_dynamic", "read"), h.Stats)
	r.POST("", auth.RequirePermission("gateway_dynamic", "write"), h.Create)
	r.GET("/:id", auth.RequirePermission("gateway_dynamic", "read"), h.Get)
	r.PUT("/:id", auth.RequirePermission("gateway_dynamic", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("gateway_dynamic", "delete"), h.Delete)
	r.PATCH("/:id/toggle", auth.RequirePermission("gateway_dynamic", "write"), h.Toggle)
}

// List retrieves paginated gateway routes with optional enabled/q filters.
// TS: GET /api/v1/gateway/routes
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	enabled := c.Query("enabled")
	var enabledFlag *bool
	if enabled != "" {
		v := enabled == "true"
		enabledFlag = &v
	}
	q := c.Query("q")

	items, total, err := h.svc.ListWithFilter(ctx, tenantID, enabledFlag, q, pageSize, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	// Map each row to the frontend response shape.
	routes := make([]map[string]interface{}, 0, len(items))
	for i := range items {
		routes = append(routes, service.ToRouteResponse(&items[i]))
	}

	middleware.RespondSuccess(c, gin.H{
		"data":     routes,
		"total":    total,
		"page":     page,
		"page_size": pageSize,
	})
}

// Get retrieves a single gateway route by id.
// TS: GET /api/v1/gateway/routes/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, service.ToRouteResponse(m))
}

// Create creates a new gateway route.
// TS: POST /api/v1/gateway/routes
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreateGatewayRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Path == "" || req.TargetService == "" {
		middleware.RespondBadRequest(c, "path and target_service are required")
		return
	}

	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Attach user identity for response.
	m.CreatedBy = userID
	middleware.RespondCreated(c, service.ToRouteResponse(m))
}

// Update modifies an existing gateway route.
// TS: PUT /api/v1/gateway/routes/:id
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("id")

	var req models.UpdateGatewayRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	m.UpdatedBy = userID
	middleware.RespondSuccess(c, service.ToRouteResponse(m))
}

// Delete removes a gateway route.
// TS: DELETE /api/v1/gateway/routes/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	c.Status(204) // TS sends 204 No Content on delete
}

// Toggle enables or disables a gateway route.
// TS: PATCH /api/v1/gateway/routes/:id/toggle
func (h *Handler) Toggle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Toggle")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	id := c.Param("id")

	var req models.ToggleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	m, err := h.svc.Toggle(ctx, tenantID, id, req.Enabled)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	m.UpdatedBy = userID
	middleware.RespondSuccess(c, service.ToRouteResponse(m))
}

// Stats returns aggregate statistics across gateway routes for the tenant.
// TS: GET /api/v1/gateway/routes/stats
func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Stats")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	stats, err := h.svc.Stats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}
