package handler

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/branch-policy/models"
	"orion/platform-svc-go/internal/branch-policy/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/branch-policy")
	r.GET("", auth.RequirePermission("branch-policy", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("branch-policy", "read"), h.Get)
	r.POST("", auth.RequirePermission("branch-policy", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("branch-policy", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("branch-policy", "delete"), h.Delete)
	r.GET("/validate/:branch", auth.RequirePermission("branch-policy", "read"), h.ValidateBranch)
	r.GET("/coverage", auth.RequirePermission("branch-policy", "read"), h.GetCoverage)
	r.POST("/enforce", auth.RequirePermission("branch-policy", "write"), h.EnforcePolicy)
	r.GET("/violations", auth.RequirePermission("branch-policy", "read"), h.ListViolations)
	r.GET("/stats", auth.RequirePermission("branch-policy", "read"), h.GetStats)

	// P0-MB Phase 1 — L1 BranchProfile + L3 BuildArtifact
	r.GET("/branch-profiles", auth.RequirePermission("branch-policy", "read"), h.ListBranchProfiles)
	r.POST("/branch-profiles", auth.RequirePermission("branch-policy", "write"), h.CreateBranchProfile)
	r.GET("/branch-profiles/:id", auth.RequirePermission("branch-policy", "read"), h.GetBranchProfile)
	r.PUT("/branch-profiles/:id", auth.RequirePermission("branch-policy", "write"), h.UpdateBranchProfile)
	r.POST("/branch-profiles/:id/archive", auth.RequirePermission("branch-policy", "write"), h.ArchiveBranchProfile)
	r.POST("/branch-profiles/:id/activate", auth.RequirePermission("branch-policy", "write"), h.ActivateBranchProfile)
	r.GET("/build-artifacts", auth.RequirePermission("branch-policy", "read"), h.ListBuildArtifacts)
	r.POST("/build-artifacts", auth.RequirePermission("branch-policy", "write"), h.RegisterBuildArtifact)
	r.GET("/build-artifacts/:id", auth.RequirePermission("branch-policy", "read"), h.GetBuildArtifact)
	r.POST("/build-artifacts/:id/verify-signature", auth.RequirePermission("branch-policy", "write"), h.VerifyBuildArtifactSignature)
	r.POST("/build-artifacts/:id/deprecate", auth.RequirePermission("branch-policy", "write"), h.DeprecateBuildArtifact)

	// P0-MB Phase 2 — L2 NamespaceBinding
	r.GET("/namespace-bindings", auth.RequirePermission("branch-policy", "read"), h.ListNamespaceBindings)
	r.POST("/namespace-bindings", auth.RequirePermission("branch-policy", "write"), h.CreateNamespaceBinding)
	r.GET("/namespace-bindings/matrix", auth.RequirePermission("branch-policy", "read"), h.GetNamespaceMatrix)
	r.GET("/namespace-bindings/:id", auth.RequirePermission("branch-policy", "read"), h.GetNamespaceBinding)
	r.DELETE("/namespace-bindings/:id", auth.RequirePermission("branch-policy", "delete"), h.DeleteNamespaceBinding)
	r.POST("/namespace-bindings/:id/validate", auth.RequirePermission("branch-policy", "read"), h.ValidateNamespaceBinding)

	// P0-MB Phase 3 — L4 SyncPolicy + SyncRunLog
	// NOTE: /sync-policies/run-logs is registered BEFORE /sync-policies/:id
	// so Gin routes to the static path (not the :id parameter).
	r.GET("/sync-policies", auth.RequirePermission("branch-policy", "read"), h.ListSyncPolicies)
	r.POST("/sync-policies", auth.RequirePermission("branch-policy", "write"), h.CreateSyncPolicy)
	r.GET("/sync-policies/run-logs", auth.RequirePermission("branch-policy", "read"), h.ListSyncRunLogs)
	r.GET("/sync-policies/:id", auth.RequirePermission("branch-policy", "read"), h.GetSyncPolicy)
	r.PUT("/sync-policies/:id", auth.RequirePermission("branch-policy", "write"), h.UpdateSyncPolicy)
	r.DELETE("/sync-policies/:id", auth.RequirePermission("branch-policy", "delete"), h.DeleteSyncPolicy)
	r.POST("/sync-policies/:id/run-now", auth.RequirePermission("branch-policy", "write"), h.RunSyncNow)
	r.POST("/sync-policies/:id/enable", auth.RequirePermission("branch-policy", "write"), h.EnableSyncPolicy)
	r.POST("/sync-policies/:id/disable", auth.RequirePermission("branch-policy", "write"), h.DisableSyncPolicy)
	r.GET("/sync-policies/:id/run-logs", auth.RequirePermission("branch-policy", "read"), h.ListSyncRunLogs)

	// P0-MB Phase 4 — L5 DeployEvent (change audit + one-click rollback)
	// NOTE: static paths (audit-trail, by-branch/:branch, by-env/:env,
	// by-actor/:actor) are registered BEFORE /deploy-events/:id so Gin
	// routes them to the static handlers (not the :id parameter).
	r.GET("/deploy-events/audit-trail", auth.RequirePermission("branch-policy", "read"), h.GetAuditTrail)
	r.GET("/deploy-events/by-branch/:branch", auth.RequirePermission("branch-policy", "read"), h.ListDeployEventsByBranch)
	r.GET("/deploy-events/by-env/:env", auth.RequirePermission("branch-policy", "read"), h.ListDeployEventsByEnv)
	r.GET("/deploy-events/by-actor/:actor", auth.RequirePermission("branch-policy", "read"), h.ListDeployEventsByActor)
	r.GET("/deploy-events", auth.RequirePermission("branch-policy", "read"), h.ListDeployEvents)
	r.POST("/deploy-events", auth.RequirePermission("branch-policy", "write"), h.CreateDeployEvent)
	r.GET("/deploy-events/:id", auth.RequirePermission("branch-policy", "read"), h.GetDeployEvent)
	r.POST("/deploy-events/:id/rollback", auth.RequirePermission("branch-policy", "write"), h.RollbackDeployEvent)

	// P0-MB Phase 5 — PreDeployGate + MergePreview
	r.POST("/pre-deploy-gate/check", auth.RequirePermission("branch-policy", "read"), h.CheckPreDeployGate)
	r.POST("/merge-preview", auth.RequirePermission("branch-policy", "write"), h.CreateMergePreview)
	r.GET("/merge-preview/:id", auth.RequirePermission("branch-policy", "read"), h.GetMergePreview)
	r.GET("/merge-preview", auth.RequirePermission("branch-policy", "read"), h.ListMergePreviews)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ListQuery{}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	records, err := h.svc.List(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	record, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	record, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	record, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	err := h.svc.Delete(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, nil)
}

func (h *Handler) ValidateBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateBranch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	valid, err := h.svc.ValidateBranch(ctx, tenantID, c.Param("branch"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"valid": valid})
}

func (h *Handler) GetCoverage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCoverage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	coverage, err := h.svc.GetCoverage(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"coverage": coverage})
}

func (h *Handler) EnforcePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnforcePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.EnforcePolicy(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "enforced"})
}

func (h *Handler) ListViolations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListViolations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	violations, err := h.svc.ListViolations(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"violations": violations, "total": len(violations)})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) RunInspection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunInspection")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RunInspection(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "run triggered"})
}

func (h *Handler) GetResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResults")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.GetResults(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": results, "total": len(results)})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.UpdateStatus(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "status updated"})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	templates, err := h.svc.ListTemplates(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": templates, "total": len(templates)})
}

func (h *Handler) RunPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunPipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RunPipeline(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "pipeline run triggered"})
}

func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetStatus(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": status})
}

func (h *Handler) Pause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Pause")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Pause(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "paused"})
}

func (h *Handler) Resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resume")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Resume(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "resumed"})
}

func (h *Handler) GetLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	logs, err := h.svc.GetLogs(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"logs": logs})
}

func (h *Handler) ListSchemas(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchemas")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	schemas, err := h.svc.ListSchemas(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"schemas": schemas})
}

func (h *Handler) GetLineage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLineage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	lineage, err := h.svc.GetLineage(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"lineage": lineage})
}

func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	config, err := h.svc.GetConfig(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"config": config})
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var cfg map[string]interface{}
	if err := c.ShouldBindJSON(&cfg); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.svc.UpdateConfig(ctx, tenantID, cfg); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "config updated"})
}

func (h *Handler) GetStatusMiddleware(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatusMiddleware")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetStatusMiddleware(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": status})
}

func (h *Handler) Restart(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Restart")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Restart(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "restart triggered"})
}

func (h *Handler) Configure(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Configure")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var cfg map[string]interface{}
	if err := c.ShouldBindJSON(&cfg); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.svc.Configure(ctx, tenantID, cfg); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "configured"})
}

func (h *Handler) ListPlugins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPlugins")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	plugins, err := h.svc.ListPlugins(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": plugins, "total": len(plugins)})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlugin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	plugin, err := h.svc.GetPlugin(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"plugin": plugin})
}

func (h *Handler) EnablePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnablePlugin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.EnablePlugin(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "enabled"})
}

func (h *Handler) DisablePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisablePlugin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DisablePlugin(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "disabled"})
}

func (h *Handler) Train(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Train")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Train(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "training started"})
}

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Evaluate(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "evaluation started"})
}

func (h *Handler) Deploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deploy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Deploy(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deployed"})
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Rollback(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "rolled back"})
}

func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetMetrics(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"metrics": metrics})
}

func (h *Handler) ListExperiments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExperiments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	experiments, err := h.svc.ListExperiments(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": experiments, "total": len(experiments)})
}

func (h *Handler) ListArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListArtifacts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	artifacts, err := h.svc.ListArtifacts(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": artifacts, "total": len(artifacts)})
}

func (h *Handler) ListModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListModels")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	models_, err := h.svc.ListModels(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": models_, "total": len(models_)})
}

func (h *Handler) RegisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RegisterModel(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "model registered"})
}

func (h *Handler) DeregisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeregisterModel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeregisterModel(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "model deregistered"})
}

func (h *Handler) ListPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelines")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelines, err := h.svc.ListPipelines(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": pipelines, "total": len(pipelines)})
}

func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Trigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Trigger(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "triggered"})
}

func (h *Handler) ListTemplates2(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates2")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	templates, err := h.svc.ListTemplates2(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": templates, "total": len(templates)})
}

func (h *Handler) GetBranchStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBranchStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetBranchStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": status})
}

func (h *Handler) ListHistories(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListHistories")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	histories, err := h.svc.ListHistories(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": histories, "total": len(histories)})
}

func (h *Handler) ListPending(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPending")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pending, err := h.svc.ListPending(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": pending, "total": len(pending)})
}

func (h *Handler) Approve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Approve")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Approve(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "approved"})
}

func (h *Handler) Reject(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Reject")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Reject(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "rejected"})
}

func (h *Handler) Escalate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Escalate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Escalate(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "escalated"})
}

func (h *Handler) GetByUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByUser")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	user := c.Query("user")
	results, err := h.svc.GetByUser(ctx, tenantID, user)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": results, "total": len(results)})
}

func (h *Handler) Forecast(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Forecast")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	forecast, err := h.svc.Forecast(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"forecast": forecast})
}

func (h *Handler) GetUtilization(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetUtilization")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	utilization, err := h.svc.GetUtilization(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"utilization": utilization})
}

func (h *Handler) ScaleResource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ScaleResource")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.ScaleResource(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "scaled"})
}

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.ListAlerts(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"alerts": alerts})
}

func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	history, err := h.svc.GetHistory(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"history": history})
}

func (h *Handler) AddTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddTag")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tag := c.Query("tag")
	if err := h.svc.AddTag(ctx, tenantID, tag); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "tag added"})
}

func (h *Handler) DeleteTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTag")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tag := c.Query("tag")
	if err := h.svc.DeleteTag(ctx, tenantID, tag); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "tag deleted"})
}

func (h *Handler) CheckCompatibility(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckCompatibility")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	compatible, err := h.svc.CheckCompatibility(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"compatible": compatible})
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var reqs []models.CreateRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	records, err := h.svc.BatchCreate(ctx, tenantID, reqs)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Search")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := c.Query("q")
	results, err := h.svc.Search(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"results": results})
}

func (h *Handler) Regenerate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Regenerate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Regenerate(ctx, tenantID); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "regenerated"})
}

// --- P0-MB Phase 1 — L1 BranchProfile handlers ---

func (h *Handler) ListBranchProfiles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBranchProfiles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.BranchProfileQuery{}
	if v := c.Query("status"); v != "" {
		s := models.BranchStatus(v)
		q.Status = &s
	}
	if v := c.Query("semantic"); v != "" {
		s := models.BranchSemantic(v)
		q.Semantic = &s
	}
	if v := c.Query("repoId"); v != "" {
		q.RepoID = &v
	}
	if v := c.Query("ownerId"); v != "" {
		q.OwnerID = &v
	}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	out, err := h.svc.ListBranchProfiles(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) CreateBranchProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBranchProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBranchProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.CreateBranchProfile(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) GetBranchProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBranchProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.GetBranchProfile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "branch profile not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) UpdateBranchProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateBranchProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateBranchProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.UpdateBranchProfile(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) ArchiveBranchProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArchiveBranchProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.ArchiveBranchProfile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) ActivateBranchProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ActivateBranchProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.ActivateBranchProfile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

// --- P0-MB Phase 1 — L3 BuildArtifact handlers ---

func (h *Handler) ListBuildArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuildArtifacts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.ArtifactQuery{}
	if v := c.Query("branchProfileId"); v != "" {
		q.BranchProfileID = &v
	}
	if v := c.Query("branch"); v != "" {
		q.Branch = &v
	}
	if v := c.Query("commitSha"); v != "" {
		q.CommitSHA = &v
	}
	if v := c.Query("status"); v != "" {
		s := models.BuildArtifactStatus(v)
		q.Status = &s
	}
	if v := c.Query("signatureValid"); v == "true" || v == "false" {
		b := v == "true"
		q.SignatureValid = &b
	}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	out, err := h.svc.ListBuildArtifacts(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) RegisterBuildArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterBuildArtifact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RegisterArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	a, err := h.svc.RegisterBuildArtifact(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, a)
}

func (h *Handler) GetBuildArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildArtifact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	a, err := h.svc.GetBuildArtifact(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "artifact not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, a)
}

func (h *Handler) VerifyBuildArtifactSignature(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VerifyBuildArtifactSignature")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.VerifyBuildArtifactSignature(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, result)
}

type deprecateArtifactBody struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *Handler) DeprecateBuildArtifact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeprecateBuildArtifact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body deprecateArtifactBody
	if err := c.ShouldBindJSON(&body); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	a, err := h.svc.DeprecateBuildArtifact(ctx, tenantID, c.Param("id"), body.Reason)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, a)
}

// ============================================================================
// P0-MB Phase 2 — L2 NamespaceBinding
// ============================================================================

func (h *Handler) ListNamespaceBindings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListNamespaceBindings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.NamespaceBindingQuery{}
	if v := c.Query("branchProfileId"); v != "" {
		q.BranchProfileID = &v
	}
	if v := c.Query("envName"); v != "" {
		q.EnvName = &v
	}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	out, err := h.svc.ListNamespaceBindings(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) CreateNamespaceBinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateNamespaceBinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateNamespaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	b, err := h.svc.CreateNamespaceBinding(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, b)
}

func (h *Handler) GetNamespaceMatrix(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNamespaceMatrix")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	matrix, err := h.svc.GetNamespaceMatrix(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, matrix)
}

func (h *Handler) GetNamespaceBinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetNamespaceBinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	b, err := h.svc.GetNamespaceBinding(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "namespace binding not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, b)
}

func (h *Handler) DeleteNamespaceBinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteNamespaceBinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteNamespaceBinding(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"deleted": true})
}

type validateNamespaceBody struct {
	EnvName string `json:"envName" binding:"required"`
}

func (h *Handler) ValidateNamespaceBinding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateNamespaceBinding")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body validateNamespaceBody
	if err := c.ShouldBindJSON(&body); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.ValidateNamespaceBinding(ctx, tenantID, c.Param("id"), body.EnvName)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, result)
}

// ============================================================================
// P0-MB Phase 3 — L4 SyncPolicy + SyncRunLog
// ============================================================================

func (h *Handler) ListSyncPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSyncPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.SyncPolicyQuery{}
	if v := c.Query("enabled"); v != "" {
		b := v == "true"
		q.Enabled = &b
	}
	if v := c.Query("frequency"); v != "" {
		f := models.SyncFrequency(v)
		q.Frequency = &f
	}
	if v := c.Query("strategy"); v != "" {
		s := models.SyncStrategy(v)
		q.Strategy = &s
	}
	if v := c.Query("sourceBranch"); v != "" {
		q.SourceBranch = &v
	}
	if v := c.Query("autoResolve"); v != "" {
		r := models.SyncResolve(v)
		q.AutoResolve = &r
	}
	out, err := h.svc.ListSyncPolicies(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) CreateSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSyncPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.CreateSyncPolicy(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) GetSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.GetSyncPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "sync policy not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) UpdateSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateSyncPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.UpdateSyncPolicy(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) DeleteSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteSyncPolicy(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) EnableSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnableSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.EnableSyncPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) DisableSyncPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisableSyncPolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	p, err := h.svc.DisableSyncPolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

// runSyncNowBody is the optional POST body for /sync-policies/:id/run-now.
// All fields are optional; empty sourceCommit falls back to "HEAD".
type runSyncNowBody struct {
	SourceCommit string `json:"sourceCommit"`
}

func (h *Handler) RunSyncNow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunSyncNow")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body runSyncNowBody
	_ = c.ShouldBindJSON(&body) // body is optional; ignore bind errors
	actor := c.GetString("user_id")
	if actor == "" {
		actor = c.GetString("actor")
	}
	log, err := h.svc.RunNow(ctx, tenantID, c.Param("id"), actor, body.SourceCommit)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, log)
}

func (h *Handler) ListSyncRunLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSyncRunLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.SyncRunLogQuery{}
	// Support both /sync-policies/run-logs (no :id) and /sync-policies/:id/run-logs.
	if id := c.Param("id"); id != "" {
		q.PolicyID = &id
	} else if v := c.Query("policyId"); v != "" {
		q.PolicyID = &v
	}
	if v := c.Query("status"); v != "" {
		s := models.SyncRunStatus(v)
		q.Status = &s
	}
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &q.Limit)
	}
	out, err := h.svc.ListSyncRunLogs(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

// ============================================================================
// P0-MB Phase 4 — L5 DeployEvent (change audit + one-click rollback)
// ============================================================================

func (h *Handler) CreateDeployEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDeployEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDeployEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	evt, err := h.svc.CreateDeployEvent(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, evt)
}

func (h *Handler) GetDeployEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDeployEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	evt, err := h.svc.GetDeployEvent(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "deploy event not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, evt)
}

func (h *Handler) ListDeployEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeployEvents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.DeployEventQuery{}
	if v := c.Query("branch"); v != "" {
		q.Branch = &v
	}
	if v := c.Query("env"); v != "" {
		q.Env = &v
	}
	if v := c.Query("actorId"); v != "" {
		q.ActorID = &v
	}
	if v := c.Query("approvalId"); v != "" {
		q.ApprovalID = &v
	}
	if v := c.Query("outcome"); v != "" {
		o := models.DeployOutcome(v)
		q.Outcome = &o
	}
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &q.Limit)
	}
	out, err := h.svc.ListDeployEvents(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) ListDeployEventsByBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeployEventsByBranch")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 100
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	out, err := h.svc.ListDeployEventsByBranch(ctx, tenantID, c.Param("branch"), limit)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) ListDeployEventsByEnv(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeployEventsByEnv")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 100
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	out, err := h.svc.ListDeployEventsByEnv(ctx, tenantID, c.Param("env"), limit)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

func (h *Handler) ListDeployEventsByActor(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDeployEventsByActor")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 100
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	out, err := h.svc.ListDeployEventsByActor(ctx, tenantID, c.Param("actor"), limit)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": out, "total": len(out)})
}

// rollbackDeployEventBody is the optional POST body for
// /deploy-events/:id/rollback. The actor is derived from the auth context;
// this body is reserved for future overrides (e.g. emergency-rollback flag).
type rollbackDeployEventBody struct{}

func (h *Handler) RollbackDeployEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackDeployEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body rollbackDeployEventBody
	_ = c.ShouldBindJSON(&body) // body is optional; ignore bind errors
	actor := c.GetString("user_id")
	if actor == "" {
		actor = c.GetString("actor")
	}
	if actor == "" {
		errors.WriteError(c, errors.ErrBadRequest, "actor is required (X-User-Id header or actor query)", http.StatusBadRequest)
		return
	}
	evt, err := h.svc.RollbackDeployEvent(ctx, tenantID, c.Param("id"), actor)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, evt)
}

func (h *Handler) GetAuditTrail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAuditTrail")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	params := models.AuditTrailParams{}
	if v := c.Query("branch"); v != "" {
		params.Branch = v
	}
	if v := c.Query("env"); v != "" {
		params.Env = v
	}
	if v := c.Query("artifactId"); v != "" {
		params.ArtifactID = v
	}
	if v := c.Query("approvalId"); v != "" {
		params.ApprovalID = v
	}
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &params.Limit)
	}
	out, err := h.svc.GetAuditTrail(ctx, tenantID, params)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, out)
}

// CheckPreDeployGate is the POST handler for /pre-deploy-gate/check. It
// receives a DeployRequest body, runs the R1-R6 rule suite, and returns the
// aggregated PreDeployGateResult. The response is NOT persisted.
func (h *Handler) CheckPreDeployGate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckPreDeployGate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	res, err := h.svc.CheckPreDeployGate(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, res)
}

// CreateMergePreview is the POST handler for /merge-preview.
func (h *Handler) CreateMergePreview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateMergePreview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.MergePreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.CreateMergePreview(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

// GetMergePreview is the GET handler for /merge-preview/:id.
func (h *Handler) GetMergePreview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMergePreview")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	p, err := h.svc.GetMergePreview(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, p)
}

// ListMergePreviews is the GET handler for /merge-preview. Accepts an
// optional ?limit= query parameter.
func (h *Handler) ListMergePreviews(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListMergePreviews")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	out, err := h.svc.ListMergePreviews(ctx, tenantID, limit)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, out)
}
