package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/service"

	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	svc *service.AuditService
}

func NewAuditHandler(svc *service.AuditService) *AuditHandler {
	return &AuditHandler{svc: svc}
}

func (h *AuditHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	log, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, log)
}

func (h *AuditHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	logs, err := h.svc.List(c.Request.Context(), tenantID, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *AuditHandler) ListByTraceID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	logs, err := h.svc.ListByTraceID(c.Request.Context(), tenantID, c.Param("traceId"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *AuditHandler) RegisterRoutes(rg *gin.RouterGroup) {
	audit := rg.Group("/audit")
	{
		audit.POST("", h.Create)
		audit.GET("", h.List)
		audit.GET("/trace/:traceId", h.ListByTraceID)
	}
}
