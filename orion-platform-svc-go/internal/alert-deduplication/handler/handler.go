package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/alert-deduplication/service"
)

type AlertDeduplicationHandler struct {
	svc *service.AlertDeduplicationService
}

func NewAlertDeduplicationHandler(svc *service.AlertDeduplicationService) *AlertDeduplicationHandler {
	return &AlertDeduplicationHandler{svc: svc}
}

func (h *AlertDeduplicationHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

func (h *AlertDeduplicationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	dedup := rg.Group("/alert-deduplication")
	dedup.GET("/stats", auth.RequirePermission("monitor", "read"), h.Stats)
	dedup.PATCH("/config", auth.RequirePermission("monitor", "write"), h.Configure)
	dedup.POST("/check", auth.RequirePermission("monitor", "read"), h.Check)
}

func (h *AlertDeduplicationHandler) Stats(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertDedupStats")
	defer span.End()
	stats := h.svc.Stats()
	errors.WriteSuccess(c, stats)
}

func (h *AlertDeduplicationHandler) Configure(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertDedupConfigure")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req struct {
		IsEnabled *bool  `json:"is_enabled"`
		WindowSec int    `json:"window_sec"`
		FieldMask string `json:"field_mask"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	windowSec := req.WindowSec
	if windowSec <= 0 {
		windowSec = 300
	}
	isEnabled := req.IsEnabled
	if isEnabled == nil {
		isEnabled = new(bool)
		*isEnabled = true
	}

	h.svc.Configure(tenantID, *isEnabled, windowSec, req.FieldMask)
	errors.WriteSuccess(c, gin.H{"message": "configuration updated"})
}

func (h *AlertDeduplicationHandler) Check(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertDedupCheck")
	defer span.End()
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	record, isDuplicate := h.svc.CheckDuplicate(ctx, req)
	if isDuplicate {
		errors.WriteSuccess(c, gin.H{"is_duplicate": true, "record": record})
		return
	}
	errors.WriteSuccess(c, gin.H{"is_duplicate": false, "record": record})
}
