// Package handler provides HTTP handlers for the Alert Adapter SPI service.
// All endpoints are mounted under /api prefix via RegisterRoutes.
//
// API contract:
//   POST   /api/alert-adapters              - Create a new adapter
//   GET    /api/alert-adapters              - List adapters (paginated)
//   GET    /api/alert-adapters/:id          - Get adapter
//   PUT    /api/alert-adapters/:id          - Update adapter
//   DELETE /api/alert-adapters/:id          - Delete adapter
//   POST   /api/alert-adapters/:id/send     - Send an alert through the adapter
//   POST   /api/alert-adapters/:id/receive  - Receive alerts from the adapter
//   GET    /api/alert-adapters/:id/events   - List events for the adapter
//   GET    /api/alert-adapters/health       - Health check (no auth)
package handler

import (
	"context"
	"encoding/json"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-adapter/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service/factory layer.
type Service interface {
	CreateAdapter(ctx context.Context, tenantID, name, atype, category string, config map[string]string) (*models.AlertAdapter, error)
	ListAdapters(ctx context.Context, tenantID string) ([]models.AlertAdapter, error)
	GetAdapter(ctx context.Context, tenantID, id string) (*models.AlertAdapter, error)
	UpdateAdapter(ctx context.Context, tenantID, id string, req *models.UpdateAdapterRequest) (*models.AlertAdapter, error)
	DeleteAdapter(ctx context.Context, tenantID, id string) error
	SendToAdapter(ctx context.Context, adapterID string, alert map[string]interface{}) (*models.AlertEvent, error)
	ReceiveFromAdapter(ctx context.Context, adapterID string) ([]models.AlertEvent, error)
	ListEvents(ctx context.Context, tenantID, adapterID, status string, offset, limit int) ([]models.AlertEvent, error)
	AdapterHealth(ctx context.Context) (string, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all alert-adapter endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Health (no auth)
	rg.GET("/alert-adapters/health", h.Health)

	// Adapter CRUD — require write for mutations, read for queries
	rg.POST("/alert-adapters", auth.RequirePermission("alert-adapter", "write"), h.CreateAdapter)
	rg.GET("/alert-adapters", auth.RequirePermission("alert-adapter", "read"), h.ListAdapters)
	rg.GET("/alert-adapters/:id", auth.RequirePermission("alert-adapter", "read"), h.GetAdapter)
	rg.PUT("/alert-adapters/:id", auth.RequirePermission("alert-adapter", "write"), h.UpdateAdapter)
	rg.DELETE("/alert-adapters/:id", auth.RequirePermission("alert-adapter", "write"), h.DeleteAdapter)

	// Adapter operations
	rg.POST("/alert-adapters/:id/send", auth.RequirePermission("alert-adapter", "write"), h.Send)
	rg.POST("/alert-adapters/:id/receive", auth.RequirePermission("alert-adapter", "read"), h.Receive)
	rg.GET("/alert-adapters/:id/events", auth.RequirePermission("alert-adapter", "read"), h.ListEvents)
}

// ===========================================================================
// Health
// ===========================================================================

func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertAdapterHealth")
	defer span.End()
	status, err := h.svc.AdapterHealth(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": status})
}

// ===========================================================================
// Adapter CRUD
// ===========================================================================

func (h *Handler) CreateAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlertAdapter")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	var req models.CreateAdapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	// Convert JSONB config to string map (handler expects string keys)
	cfgMap := make(map[string]string)
	for k, v := range req.Config {
		switch vv := v.(type) {
		case string:
			cfgMap[k] = vv
		case nil:
			cfgMap[k] = ""
		default:
			if b, err := json.Marshal(vv); err == nil {
				cfgMap[k] = string(b)
			}
		}
	}

	adapter, err := h.svc.CreateAdapter(ctx, tenantID, req.Name, req.Type, req.Category, cfgMap)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, gin.H{
		"id":       adapter.ID,
		"name":     adapter.Name,
		"type":     adapter.Type,
		"category": adapter.Category,
		"status":   adapter.Status,
		"enabled":  adapter.Enabled,
	})
}

func (h *Handler) ListAdapters(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlertAdapters")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, err := h.svc.ListAdapters(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.AlertAdapter{}
	}

	middleware.RespondPaginated(c, items, (page-1)*ps, ps, len(items))
}

func (h *Handler) GetAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAlertAdapter")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	adapter, err := h.svc.GetAdapter(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, adapter)
}

func (h *Handler) UpdateAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlertAdapter")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAdapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	adapter, err := h.svc.UpdateAdapter(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, adapter)
}

func (h *Handler) DeleteAdapter(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlertAdapter")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteAdapter(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondNoContent(c)
}

// ===========================================================================
// Adapter operations
// ===========================================================================

func (h *Handler) Send(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SendAlert")
	defer span.End()

	adapterID := c.Param("id")
	var req models.SendAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	alert := map[string]interface{}{
		"title":    req.Title,
		"message":  req.Message,
		"severity": req.Severity,
		"source":   req.Source,
	}
	if req.Labels != nil && len(req.Labels) > 0 {
		alert["labels"] = req.Labels
	}
	if req.Payload != nil && len(req.Payload) > 0 {
		alert["payload"] = req.Payload
	}

	event, err := h.svc.SendToAdapter(ctx, adapterID, alert)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, gin.H{
		"event_id":  event.ID,
		"status":    event.Status,
		"severity":  event.Severity,
		"processed": event.ProcessedAt != nil,
	})
}

func (h *Handler) Receive(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReceiveAlert")
	defer span.End()

	adapterID := c.Param("id")
	events, err := h.svc.ReceiveFromAdapter(ctx, adapterID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if events == nil {
		events = []models.AlertEvent{}
	}

	middleware.RespondSuccess(c, gin.H{
		"count": len(events),
		"events": events,
	})
}

func (h *Handler) ListEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlertEvents")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	adapterID := c.Param("id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	items, err := h.svc.ListEvents(ctx, tenantID, adapterID, status, (page-1)*ps, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.AlertEvent{}
	}

	middleware.RespondPaginated(c, items, (page-1)*ps, ps, len(items))
}
