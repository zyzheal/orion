package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"github.com/gin-gonic/gin"
)

type DriftHandler struct {
	svc *service.DriftService
}

func NewDriftHandler(svc *service.DriftService) *DriftHandler {
	return &DriftHandler{svc: svc}
}

func (h *DriftHandler) Scan(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigScan")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	if env == "" {
		env = "production"
	}
	result, err := h.svc.ScanForDrift(ctx, tenantID, env)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *DriftHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	unresolved := c.Query("unresolved") == "true"
	drifts, err := h.svc.ListDrifts(ctx, tenantID, env, unresolved)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": drifts, "count": len(drifts)})
}

func (h *DriftHandler) Resolve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigResolve")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Resolution string `json:"resolution" binding:"required"`
		ResolvedBy string `json:"resolved_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ResolveDrift(ctx, tenantID, c.Param("id"), req.ResolvedBy, req.Resolution); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "resolved"})
}

func (h *DriftHandler) RegisterRoutes(rg *gin.RouterGroup) {
	d := rg.Group("/drifts")
	{
		d.POST("/scan", h.Scan)
		d.GET("", h.List)
		d.POST("/:id/resolve", h.Resolve)
	}
}
