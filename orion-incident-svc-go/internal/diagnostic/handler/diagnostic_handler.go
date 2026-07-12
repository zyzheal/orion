package handler

import (
	"net/http"
	"strconv"
	"orion/incident-svc-go/internal/diagnostic/models"
	"orion/incident-svc-go/internal/diagnostic/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc   *service.Service
	agent *service.AgentService
}

func NewHandler(svc *service.Service, agent *service.AgentService) *Handler {
	return &Handler{svc: svc, agent: agent}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	dg := rg.Group("/diagnostic")
	dg.POST("/sessions", auth.RequirePermission("diagnostic", "write"), h.CreateDiagnostic)
	dg.GET("/sessions", h.ListDiagnostics)
	dg.GET("/sessions/:id", h.GetDiagnostic)
	dg.POST("/sessions/:id/steps", auth.RequirePermission("diagnostic", "write"), h.RunDiagnosticStep)
	dg.POST("/reports", auth.RequirePermission("diagnostic", "write"), h.GenerateReport)
	dg.GET("/reports/:id", h.GetDiagnosticReport)
	dg.GET("/reports", h.ListReports)
	dg.POST("/knowledge", auth.RequirePermission("diagnostic", "write"), h.AddKnowledge)
	dg.GET("/knowledge", h.ListKnowledge)
	dg.DELETE("/knowledge/:id", auth.RequirePermission("diagnostic", "delete"), h.DeleteKnowledge)
	dg.GET("/knowledge/search", h.SearchKnowledge)
}

func (h *Handler) CreateDiagnostic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDiagnosticRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	report, err := h.agent.TriggerDiagnostic(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, report)
}

func (h *Handler) ListDiagnostics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	req := &models.PaginatedRequest{}
	c.ShouldBindQuery(req)
	status := c.Query("status")
	triggerType := c.Query("trigger_type")
	items, err := h.svc.ListSessions(c.Request.Context(), tenantID, status, triggerType, req.Offset(), req.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetDiagnostic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	session, err := h.svc.GetSession(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, session)
}

func (h *Handler) RunDiagnosticStep(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sessionID := c.Param("id")
	var req models.RunDiagnosticStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.agent.RunDiagnosticStep(c.Request.Context(), tenantID, sessionID, req.StepType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"result": result})
}

func (h *Handler) GenerateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDiagnosticRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	report, err := h.agent.TriggerDiagnostic(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, report)
}

func (h *Handler) GetDiagnosticReport(c *gin.Context) {
	report, err := h.agent.GetReport(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, report)
}

func (h *Handler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	req := &models.PaginatedRequest{}
	c.ShouldBindQuery(req)
	items, err := h.agent.ListReports(c.Request.Context(), tenantID, req.Offset(), req.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) AddKnowledge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateKnowledgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	entry, err := h.agent.KB().CreatePattern(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, entry)
}

func (h *Handler) ListKnowledge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	req := &models.PaginatedRequest{}
	c.ShouldBindQuery(req)
	category := c.Query("category")
	keyword := c.Query("keyword")
	minFreq, _ := strconv.Atoi(c.DefaultQuery("min_frequency", "0"))
	items, err := h.agent.KB().ListPatterns(c.Request.Context(), tenantID, category, keyword, minFreq, req.Offset(), req.Limit())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) SearchKnowledge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	keyword := c.Query("keyword")
	if keyword == "" {
		respondBadRequest(c, "keyword is required")
		return
	}
	items, err := h.agent.KB().SearchKnowledge(c.Request.Context(), tenantID, keyword)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) DeleteKnowledge(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.agent.KB().DeletePattern(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}
