package handler

import (
	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/data-classification/models"
	"orion/platform-svc-go/internal/data-classification/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/data-classification")
	r.Use(auth.RequirePermission("data", "read"))
	{
		r.POST("/rules", auth.RequirePermission("data", "write"), h.CreateRule)
		r.GET("/rules", h.ListRules)
		r.GET("/rules/:id", h.GetRule)
		r.DELETE("/rules/:id", auth.RequirePermission("data", "delete"), h.DeleteRule)
		r.POST("/classify", auth.RequirePermission("data", "write"), h.Classify)
		r.GET("/resources/:resourceId", h.GetClassification)
	}
}

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil { middleware.RespondBadRequest(c, err.Error()); return }
	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req)
	if err != nil { middleware.RespondInternalError(c, err.Error()); return }
	middleware.RespondCreated(c, rule)
}

func (h *Handler) ListRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListRules(c.Request.Context(), tenantID)
	if err != nil { middleware.RespondInternalError(c, err.Error()); return }
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { middleware.RespondNotFound(c, err.Error()); return }
	middleware.RespondSuccess(c, rule)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, c.Param("id")); err != nil { middleware.RespondInternalError(c, err.Error()); return }
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Classify(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.ClassifyRequest
	if err := c.ShouldBindJSON(&req); err != nil { middleware.RespondBadRequest(c, err.Error()); return }
	result, err := h.svc.Classify(c.Request.Context(), tenantID, &req)
	if err != nil { middleware.RespondInternalError(c, err.Error()); return }
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetClassification(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cr, err := h.svc.GetClassification(c.Request.Context(), tenantID, c.Param("resourceId"))
	if err != nil { middleware.RespondNotFound(c, err.Error()); return }
	middleware.RespondSuccess(c, cr)
}