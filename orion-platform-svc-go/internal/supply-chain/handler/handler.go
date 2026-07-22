package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/supply-chain/models"
	"orion/platform-svc-go/internal/supply-chain/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/supply-chain")

	f.POST("/sbom", auth.RequirePermission("supply_chain", "write"), h.GenerateSBOM)
	f.GET("/sbom", auth.RequirePermission("supply_chain", "read"), h.ListSBOMs)
	f.GET("/sbom/:id", auth.RequirePermission("supply_chain", "read"), h.GetSBOM)
	f.POST("/dependencies/analyze", auth.RequirePermission("supply_chain", "write"), h.AnalyzeDependencies)
	f.GET("/dependencies/:packageName/:version", auth.RequirePermission("supply_chain", "read"), h.GetDependencyGraph)
	f.POST("/artifacts/:artifactId/sign", auth.RequirePermission("supply_chain", "write"), h.SignArtifact)
	f.POST("/artifacts/:artifactId/verify", auth.RequirePermission("supply_chain", "read"), h.VerifySignature)
	f.POST("/report", auth.RequirePermission("supply_chain", "write"), h.GenerateReport)
	f.GET("/report/:pipelineId", auth.RequirePermission("supply_chain", "read"), h.GetReport)
	f.GET("/vulnerabilities", auth.RequirePermission("supply_chain", "read"), h.GetVulnerabilities)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) GenerateSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateSBOM")
	defer span.End()
	var req models.GenerateSBOMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	sbom, err := h.svc.GenerateSBOM(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"sbom": sbom})
}

func (h *Handler) GetSBOM(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSBOM")
	defer span.End()
	tenantID := h.getTenantID(c)
	sbom, err := h.svc.GetSBOM(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "sbom not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"sbom": sbom})
}

func (h *Handler) ListSBOMs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSBOMs")
	defer span.End()
	tenantID := h.getTenantID(c)
	var q models.ListSBOMsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sboms, err := h.svc.ListSBOMs(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"sboms": sboms, "count": len(sboms)})
}

func (h *Handler) AnalyzeDependencies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AnalyzeDependencies")
	defer span.End()
	var req struct {
		PackageName string `json:"package_name" binding:"required"`
		Version     string `json:"version" binding:"required"`
		Depth       int    `json:"depth"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Depth == 0 {
		req.Depth = 3
	}
	tenantID := h.getTenantID(c)
	err := h.svc.AnalyzeDependencies(ctx, tenantID, req.PackageName, req.Version, req.Depth)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "dependency analysis completed"})
}

func (h *Handler) GetDependencyGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDependencyGraph")
	defer span.End()
	tenantID := h.getTenantID(c)
	graph, err := h.svc.GetDependencyGraph(ctx, tenantID, c.Param("packageName"), c.Param("version"))
	if err != nil {
		middleware.RespondNotFound(c, "dependency graph not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"graph": graph})
}

func (h *Handler) SignArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SignArtifact")
	defer span.End()
	var req models.SignArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	sig, err := h.svc.SignArtifact(ctx, tenantID, c.Param("artifactId"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"signature": sig})
}

func (h *Handler) VerifySignature(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VerifySignature")
	defer span.End()
	var req models.VerifySignatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sig, err := h.svc.VerifyArtifactSignature(ctx, c.Param("artifactId"), req.Signature, &req)
	if err != nil {
		middleware.RespondNotFound(c, "signature not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"verified": sig.Verified})
}

func (h *Handler) GenerateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GenerateReport")
	defer span.End()
	var req struct {
		PipelineID string `json:"pipeline_id" binding:"required"`
		ArtifactID string `json:"artifact_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	report, err := h.svc.GenerateSupplyChainReport(ctx, tenantID, req.PipelineID, req.ArtifactID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"report": report})
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	tenantID := h.getTenantID(c)
	report, err := h.svc.GetSupplyChainReport(ctx, tenantID, c.Param("pipelineId"))
	if err != nil {
		middleware.RespondNotFound(c, "report not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"report": report})
}

func (h *Handler) GetVulnerabilities(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVulnerabilities")
	defer span.End()
	name := c.Query("name")
	version := c.Query("version")
	if name == "" || version == "" {
		middleware.RespondBadRequest(c, "name and version are required")
		return
	}
	tenantID := h.getTenantID(c)
		vulns, err := h.svc.GetVulnerabilitiesForComponent(ctx, tenantID, name, version)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"vulnerabilities": vulns, "count": len(vulns)})
}
