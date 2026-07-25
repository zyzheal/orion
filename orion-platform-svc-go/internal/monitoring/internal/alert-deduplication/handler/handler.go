package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/monitoring/internal/alert-deduplication/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
	"orion/go-common/pkg/auth"
	"github.com/google/uuid"
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

// RegisterRoutes registers alert-deduplication routes.
func (h *AlertDeduplicationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	dedup := rg.Group("/alert-deduplication")
	dedup.GET("/stats", auth.RequirePermission("monitor", "read"), h.Stats)
	dedup.PATCH("/config", auth.RequirePermission("monitor", "write"), h.Configure)
	dedup.POST("/check", auth.RequirePermission("monitor", "read"), h.Check)
}

// Stats returns deduplication statistics.
func (h *AlertDeduplicationHandler) Stats(c *gin.Context) {
	stats := h.svc.Stats()
	response_writer.Respond(c, http.StatusOK, stats)
}

// Configure updates deduplication configuration.
func (h *AlertDeduplicationHandler) Configure(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req struct {
		IsEnabled *bool  `json:"is_enabled"`
		WindowSec int    `json:"window_sec"`
		FieldMask string `json:"field_mask"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
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
	response_writer.Respond(c, http.StatusOK, gin.H{"message": "configuration updated"})
}

// Check checks if an alert is a duplicate.
func (h *AlertDeduplicationHandler) Check(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	record, isDuplicate := h.svc.CheckDuplicate(c.Request.Context(), req)
	if isDuplicate {
		response_writer.Respond(c, http.StatusOK, gin.H{
			"is_duplicate": true,
			"record":       record,
		})
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"is_duplicate": false,
		"record":       record,
	})
}
