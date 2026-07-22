package handler

import (
	"net/http"
	"orion/platform-svc-go/internal/middleware"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/eventbus/models"
	"orion/platform-svc-go/internal/eventbus/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler provides HTTP route handlers for the event bus.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new event bus handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all event bus endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("eventbus", "read")
	write := auth.RequirePermission("eventbus", "write")

	rg.POST("/events", write, h.Publish)
	rg.GET("/events", read, h.List)
	rg.GET("/events/count", read, h.Count)

	rg.POST("/connect", write, h.Connect)
	rg.GET("/status", read, h.GetStatus)
	rg.GET("/subscriptions", read, h.ListSubscriptions)
	rg.GET("/dlq", read, h.GetDLQ)
	rg.GET("/stats", read, h.GetStats)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

// parsePagination reads page and page_size query params with sensible defaults.
// Default: page=1, page_size=20, capped at 100.
func parsePagination(c *gin.Context) (page, pageSize int) {
	page = 1
	pageSize = 20

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v >= 1 {
			page = v
		}
	}
	if s := c.Query("page_size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 1 {
			pageSize = v
			if pageSize > 100 {
				pageSize = 100
			}
		}
	}
	return page, pageSize
}

// Publish handles POST /events — publish a new event.
func (h *Handler) Publish(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Publish")
	defer span.End()
	var req models.PublishRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	event, err := h.svc.Publish(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteCreated(c, event)
}

// List handles GET /events — paginated event listing with optional type filter.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)

	page, pageSize := parsePagination(c)
	offset := (page - 1) * pageSize

	filter := &models.ListFilter{}
	if t := c.Query("type"); t != "" {
		filter.Type = &t
	}

	events, err := h.svc.List(ctx, tenantID, filter, offset, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	total, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	errors.WriteSuccess(c, models.PaginatedResponse{
		Data:     events,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Count handles GET /events/count — total event count for a tenant.
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteSuccess(c, gin.H{"count": count})
}

// Connect handles POST /connect — connect to NATS cluster.
func (h *Handler) Connect(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Connect")
	defer span.End()
	var req models.ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.Connect(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteCreated(c, result)
}

// GetStatus handles GET /status — event bus connection health check.
func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
	tenantID := h.getTenantID(c)
	status, err := h.svc.GetStatus(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteSuccess(c, status)
}

// ListSubscriptions handles GET /subscriptions — active subscriptions.
func (h *Handler) ListSubscriptions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSubscriptions")
	defer span.End()
	tenantID := h.getTenantID(c)
	subs, err := h.svc.ListSubscriptions(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteSuccess(c, gin.H{"subscriptions": subs})
}

// GetDLQ handles GET /dlq — dead letter queue messages.
func (h *Handler) GetDLQ(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDLQ")
	defer span.End()
	tenantID := h.getTenantID(c)
	limit := 20
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
			if limit > 100 {
				limit = 100
			}
		}
	}
	resp, err := h.svc.GetDLQ(ctx, tenantID, &models.DLQQuery{Limit: limit})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteSuccess(c, resp)
}

// GetStats handles GET /stats — event bus statistics.
func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := h.getTenantID(c)
	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteSuccess(c, stats)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
