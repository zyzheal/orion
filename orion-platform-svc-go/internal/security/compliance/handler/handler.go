package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/security/compliance/models"
	"orion/platform-svc-go/internal/security/compliance/service"
	"orion/go-common/pkg/auth"
)

type ComplianceHandler struct{ svc *service.ComplianceService }

func NewComplianceHandler(svc *service.ComplianceService) *ComplianceHandler {
	return &ComplianceHandler{svc: svc}
}

func (h *ComplianceHandler) GetTenantID(c *gin.Context) string { return c.GetString("tenantId") }

func (h *ComplianceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/compliance")
	s.GET("/frameworks", auth.RequirePermission("compliance", "read"), h.ListFrameworks)
	s.POST("/frameworks", auth.RequirePermission("compliance", "write"), h.CreateFramework)
	s.GET("/requirements", auth.RequirePermission("compliance", "read"), h.ListRequirements)
	s.POST("/requirements", auth.RequirePermission("compliance", "write"), h.CreateRequirement)
	s.GET("/evidence", auth.RequirePermission("compliance", "read"), h.ListEvidence)
	s.POST("/evidence", auth.RequirePermission("compliance", "write"), h.CreateEvidence)
	s.GET("/gap-analyses", auth.RequirePermission("compliance", "read"), h.ListGapAnalyses)
	s.POST("/gap-analyses", auth.RequirePermission("compliance", "write"), h.CreateGapAnalysis)
	s.GET("/remediations", auth.RequirePermission("compliance", "read"), h.ListRemediations)
	s.POST("/remediations", auth.RequirePermission("compliance", "write"), h.CreateRemediation)
	s.PATCH("/remediations/:id/status", auth.RequirePermission("compliance", "write"), h.UpdateRemediationStatus)
}

func (h *ComplianceHandler) ListFrameworks(c *gin.Context) {
	list, err := h.svc.ListFrameworks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list})
}

func (h *ComplianceHandler) CreateFramework(c *gin.Context) {
	var req models.ComplianceFramework
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	fw, err := h.svc.CreateFramework(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": fw})
}

func (h *ComplianceHandler) ListRequirements(c *gin.Context) {
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListRequirements(c.Request.Context(), frameworkID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list})
}

func (h *ComplianceHandler) CreateRequirement(c *gin.Context) {
	var req models.ComplianceRequirement
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	r, err := h.svc.CreateRequirement(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": r})
}

func (h *ComplianceHandler) ListEvidence(c *gin.Context) {
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListEvidence(c.Request.Context(), h.GetTenantID(c), frameworkID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list})
}

func (h *ComplianceHandler) CreateEvidence(c *gin.Context) {
	var req models.CreateEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	ev, err := h.svc.CreateEvidence(c.Request.Context(), h.GetTenantID(c), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": ev})
}

func (h *ComplianceHandler) ListGapAnalyses(c *gin.Context) {
	list, err := h.svc.ListGapAnalyses(c.Request.Context(), h.GetTenantID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list})
}

func (h *ComplianceHandler) CreateGapAnalysis(c *gin.Context) {
	var req models.CreateGapAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	ga, err := h.svc.CreateGapAnalysis(c.Request.Context(), h.GetTenantID(c), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": ga})
}

func (h *ComplianceHandler) ListRemediations(c *gin.Context) {
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListRemediations(c.Request.Context(), h.GetTenantID(c), frameworkID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list})
}

func (h *ComplianceHandler) CreateRemediation(c *gin.Context) {
	var req models.CreateRemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	p, err := h.svc.CreateRemediation(c.Request.Context(), h.GetTenantID(c), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": p})
}

func (h *ComplianceHandler) UpdateRemediationStatus(c *gin.Context) {
	var req struct{ Status string `json:"status" binding:"required"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	p, err := h.svc.UpdateRemediationStatus(c.Request.Context(), h.GetTenantID(c), c.Param("id"), req.Status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": p})
}
