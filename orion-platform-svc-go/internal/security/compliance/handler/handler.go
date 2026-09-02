package handler

import (
	"go.opentelemetry.io/otel"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/security/compliance/models"
	"orion/platform-svc-go/internal/security/compliance/service"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceListFrameworks")
	defer span.End()
	list, err := h.svc.ListFrameworks(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *ComplianceHandler) CreateFramework(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceCreateFramework")
	defer span.End()
	var req models.ComplianceFramework
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	fw, err := h.svc.CreateFramework(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, fw)
}

func (h *ComplianceHandler) ListRequirements(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceListRequirements")
	defer span.End()
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListRequirements(ctx, frameworkID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *ComplianceHandler) CreateRequirement(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceCreateRequirement")
	defer span.End()
	var req models.ComplianceRequirement
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.CreateRequirement(ctx, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

func (h *ComplianceHandler) ListEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceListEvidence")
	defer span.End()
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListEvidence(ctx, h.GetTenantID(c), frameworkID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *ComplianceHandler) CreateEvidence(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceCreateEvidence")
	defer span.End()
	var req models.CreateEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ev, err := h.svc.CreateEvidence(ctx, h.GetTenantID(c), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ev)
}

func (h *ComplianceHandler) ListGapAnalyses(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceListGapAnalyses")
	defer span.End()
	list, err := h.svc.ListGapAnalyses(ctx, h.GetTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *ComplianceHandler) CreateGapAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceCreateGapAnalysis")
	defer span.End()
	var req models.CreateGapAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ga, err := h.svc.CreateGapAnalysis(ctx, h.GetTenantID(c), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ga)
}

func (h *ComplianceHandler) ListRemediations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceListRemediations")
	defer span.End()
	frameworkID := c.Query("framework_id")
	list, err := h.svc.ListRemediations(ctx, h.GetTenantID(c), frameworkID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *ComplianceHandler) CreateRemediation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceCreateRemediation")
	defer span.End()
	var req models.CreateRemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreateRemediation(ctx, h.GetTenantID(c), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

func (h *ComplianceHandler) UpdateRemediationStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SecurityComplianceUpdateRemediationStatus")
	defer span.End()
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdateRemediationStatus(ctx, h.GetTenantID(c), c.Param("id"), req.Status)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}
