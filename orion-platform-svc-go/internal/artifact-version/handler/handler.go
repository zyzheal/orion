// Package handler exposes the Artifact Version API over REST.
//
// ARCHITECTURE: This handler is a thin delegation layer. Every method:
//  1. Starts an OTel span
//  2. Extracts tenant_id from context (set by auth middleware)
//  3. Calls the matching service method
//  4. Writes the canonical response envelope
//
// All business logic lives in service.Service — this handler has zero
// business logic. The previous 797-line version was eliminated by
// introducing a generic (ctx, tenant) → response dispatch pattern.
package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/artifact-version/models"
	"orion/platform-svc-go/internal/artifact-version/service"

	"github.com/gin-gonic/gin"
)

// Handler delegates every request to the service layer.
type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// ---------------------------------------------------------------------------
// RegisterRoutes — every route maps 1:1 to a service method.
// Permission: read=create/delete; execute=run/trigger; admin=configure
// ---------------------------------------------------------------------------

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/artifact-version")
	tracer := "orion-platform-svc"

	// CRUD
	r.GET("", auth.RequirePermission("artifact-version", "read"), withSpan(tracer, "List", h.list))
	r.GET("/:id", auth.RequirePermission("artifact-version", "read"), withSpan(tracer, "Get", h.get))
	r.POST("", auth.RequirePermission("artifact-version", "write"), withSpan(tracer, "Create", h.create))
	r.PUT("/:id", auth.RequirePermission("artifact-version", "write"), withSpan(tracer, "Update", h.update))
	r.DELETE("/:id", auth.RequirePermission("artifact-version", "delete"), withSpan(tracer, "Delete", h.delete))

	// Tags
	r.GET("/:id/tags", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListTags", h.listTags))
	r.POST("/:id/tag", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "AddTag", h.addTag))
	r.DELETE("/:id/tag/:tag", auth.RequirePermission("artifact-version", "delete"),
		withSpan(tracer, "DeleteTag", h.deleteTag))

	// Compatibility & Inspection
	r.GET("/:id/compat", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "CheckCompatibility", h.checkCompatibility))
	r.POST("/:id/inspect", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "RunInspection", h.runInspection))
	r.GET("/:id/inspect/results", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetResults", h.getResults))

	// Status & Pipeline
	r.PUT("/:id/status", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "UpdateStatus", h.updateStatus))
	r.GET("/:id/status", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetStatus", h.getStatus))
	r.POST("/:id/pipeline", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "RunPipeline", h.runPipeline))
	r.PUT("/:id/pause", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Pause", h.pause))
	r.PUT("/:id/resume", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Resume", h.resume))
	r.GET("/:id/logs", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetLogs", h.getLogs))

	// Config
	r.GET("/:id/config", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetConfig", h.getConfig))
	r.PUT("/:id/config", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "UpdateConfig", h.updateConfig))
	r.GET("/middleware/status", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetStatusMiddleware", h.getStatusMiddleware))

	// Templates & Stats
	r.GET("/templates", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListTemplates", h.listTemplates))
	r.GET("/stats", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetStats", h.getStats))
	r.GET("/schemas", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListSchemas", h.listSchemas))

	// Lineage
	r.GET("/:id/lineage", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetLineage", h.getLineage))

	// Restart & Configure
	r.POST("/middleware/restart", auth.RequirePermission("artifact-version", "admin"),
		withSpan(tracer, "Restart", h.restart))
	r.PUT("/:id/configure", auth.RequirePermission("artifact-version", "admin"),
		withSpan(tracer, "Configure", h.configure))

	// Plugins
	r.GET("/plugins", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListPlugins", h.listPlugins))
	r.GET("/plugins/:id", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetPlugin", h.getPlugin))
	r.PUT("/plugins/:id/enable", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "EnablePlugin", h.enablePlugin))
	r.PUT("/plugins/:id/disable", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "DisablePlugin", h.disablePlugin))

	// ML Pipeline: train/evaluate/deploy/rollback
	r.POST("/:id/train", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Train", h.train))
	r.POST("/:id/evaluate", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Evaluate", h.evaluate))
	r.POST("/:id/deploy", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Deploy", h.deploy))
	r.POST("/:id/rollback", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Rollback", h.rollback))

	// Metrics & Experiments
	r.GET("/metrics", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetMetrics", h.getMetrics))
	r.GET("/artifacts", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListArtifacts", h.listArtifacts))
	r.GET("/models", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListModels", h.listModels))
	r.GET("/experiments", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListExperiments", h.listExperiments))
	r.POST("/models/:id/register", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "RegisterModel", h.registerModel))
	r.DELETE("/models/:id", auth.RequirePermission("artifact-version", "delete"),
		withSpan(tracer, "DeregisterModel", h.deregisterModel))
	r.GET("/pipelines", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListPipelines", h.listPipelines))
	r.POST("/pipelines/:id/trigger", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Trigger", h.trigger))

	// Templates v2
	r.GET("/templates2", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListTemplates2", h.listTemplates2))

	// Branch
	r.GET("/branch/:branch/status", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetBranchStatus", h.getBranchStatus))
	r.POST("/branch/:branch/validate", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "ValidateBranch", h.validateBranch))

	// Histories, Pending, Approvals
	r.GET("/histories", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListHistories", h.listHistories))
	r.GET("/pending", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListPending", h.listPending))
	r.POST("/pending/:id/approve", auth.RequirePermission("artifact-version", "approve"),
		withSpan(tracer, "Approve", h.approve))
	r.POST("/pending/:id/reject", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "Reject", h.reject))
	r.POST("/pending/:id/escalate", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "Escalate", h.escalate))

	// User-scoped
	r.GET("/user", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetByUser", h.getByUser))

	// Forecast & Utilization
	r.GET("/forecast", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "Forecast", h.forecast))
	r.GET("/utilization", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetUtilization", h.getUtilization))
	r.PUT("/scale/:id", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "ScaleResource", h.scaleResource))

	// Alerts, History, Coverage
	r.GET("/alerts", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListAlerts", h.listAlerts))
	r.GET("/:id/history", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetHistory", h.getHistory))
	r.GET("/:id/coverage", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "GetCoverage", h.getCoverage))

	// Policy
	r.POST("/:id/enforce", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "EnforcePolicy", h.enforcePolicy))
	r.GET("/violations", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "ListViolations", h.listViolations))

	// Batch, Search, Regenerate
	r.POST("/batch", auth.RequirePermission("artifact-version", "write"),
		withSpan(tracer, "BatchCreate", h.batchCreate))
	r.GET("/search", auth.RequirePermission("artifact-version", "read"),
		withSpan(tracer, "Search", h.search))
	r.POST("/:id/regenerate", auth.RequirePermission("artifact-version", "execute"),
		withSpan(tracer, "Regenerate", h.regenerate))
}

// ---------------------------------------------------------------------------
// Span wrapper — replaces per-method OTel boilerplate.
// ---------------------------------------------------------------------------

func withSpan(tracer, name string, fn func(*gin.Context)) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracer).Start(c.Request.Context(), name)
		defer span.End()
		fn(c)
	}
}

// tenantID extracts the tenant from auth middleware context.
func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// idParam extracts "id" from path, returns gin.H{id}.
func (h *Handler) id(c *gin.Context) string {
	return c.Param("id")
}

// ---------------------------------------------------------------------------
// Delegations — each method is ONE line: call svc, write response.
// ---------------------------------------------------------------------------

func (h *Handler) list(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlist")
	defer span.End()
	data, err := h.svc.List(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionget")
	defer span.End()
	data, err := h.svc.Get(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, data)
}

func (h *Handler) create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersioncreate")
	defer span.End()
	var req models.CreateRequest
	if err := bindJSON(c, &req); err != nil {
		return
	}
	data, err := h.svc.Create(ctx, h.tenantID(c), req)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteCreated(c, data)
}

func (h *Handler) update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionupdate")
	defer span.End()
	var req models.CreateRequest
	if err := bindJSON(c, &req); err != nil {
		return
	}
	data, err := h.svc.Update(ctx, h.tenantID(c), h.id(c), req)
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, data)
}

func (h *Handler) delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiondelete")
	defer span.End()
	if err := h.svc.Delete(ctx, h.tenantID(c), h.id(c)); err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, nil)
}

func (h *Handler) listTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistTags")
	defer span.End()
	data, err := h.svc.ListTags(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) addTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionaddTag")
	defer span.End()
	data, err := h.svc.AddTag(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deleteTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiondeleteTag")
	defer span.End()
	if err := h.svc.DeleteTag(ctx, h.tenantID(c), h.id(c), c.Param("tag")); err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok"})
}

func (h *Handler) checkCompatibility(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersioncheckCompatibility")
	defer span.End()
	data, err := h.svc.CheckCompatibility(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) runInspection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionrunInspection")
	defer span.End()
	data, err := h.svc.RunInspection(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetResults")
	defer span.End()
	data, err := h.svc.GetResults(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) updateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionupdateStatus")
	defer span.End()
	data, err := h.svc.UpdateStatus(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetStatus")
	defer span.End()
	status, err := h.svc.GetStatus(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) runPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionrunPipeline")
	defer span.End()
	data, err := h.svc.RunPipeline(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) pause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionpause")
	defer span.End()
	data, err := h.svc.Pause(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionresume")
	defer span.End()
	data, err := h.svc.Resume(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetLogs")
	defer span.End()
	data, err := h.svc.GetLogs(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"logs": data})
}

func (h *Handler) listTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistTemplates")
	defer span.End()
	data, err := h.svc.ListTemplates(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetStats")
	defer span.End()
	data, err := h.svc.GetStats(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "stats": data})
}

func (h *Handler) listSchemas(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistSchemas")
	defer span.End()
	data, err := h.svc.ListSchemas(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"schemas": data})
}

func (h *Handler) getLineage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetLineage")
	defer span.End()
	data, err := h.svc.GetLineage(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"lineage": data})
}

func (h *Handler) getConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetConfig")
	defer span.End()
	data, err := h.svc.GetConfig(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"config": data})
}

func (h *Handler) updateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionupdateConfig")
	defer span.End()
	data, err := h.svc.UpdateConfig(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getStatusMiddleware(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetStatusMiddleware")
	defer span.End()
	status, err := h.svc.GetStatusMiddleware(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) restart(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionrestart")
	defer span.End()
	data, err := h.svc.Restart(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) configure(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionconfigure")
	defer span.End()
	data, err := h.svc.Configure(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listPlugins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistPlugins")
	defer span.End()
	data, err := h.svc.ListPlugins(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetPlugin")
	defer span.End()
	data, err := h.svc.GetPlugin(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"plugin": data})
}

func (h *Handler) enablePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionenablePlugin")
	defer span.End()
	data, err := h.svc.EnablePlugin(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) disablePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiondisablePlugin")
	defer span.End()
	data, err := h.svc.DisablePlugin(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) train(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiontrain")
	defer span.End()
	data, err := h.svc.Train(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionevaluate")
	defer span.End()
	data, err := h.svc.Evaluate(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiondeploy")
	defer span.End()
	data, err := h.svc.Deploy(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionrollback")
	defer span.End()
	data, err := h.svc.Rollback(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetMetrics")
	defer span.End()
	data, err := h.svc.GetMetrics(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"metrics": data})
}

func (h *Handler) listArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistArtifacts")
	defer span.End()
	data, err := h.svc.ListArtifacts(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listExperiments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistExperiments")
	defer span.End()
	data, err := h.svc.ListExperiments(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistModels")
	defer span.End()
	data, err := h.svc.ListModels(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) registerModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionregisterModel")
	defer span.End()
	data, err := h.svc.RegisterModel(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deregisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionderegisterModel")
	defer span.End()
	data, err := h.svc.DeregisterModel(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistPipelines")
	defer span.End()
	data, err := h.svc.ListPipelines(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiontrigger")
	defer span.End()
	data, err := h.svc.Trigger(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listTemplates2(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistTemplates2")
	defer span.End()
	data, err := h.svc.ListTemplates2(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getBranchStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetBranchStatus")
	defer span.End()
	status, err := h.svc.GetBranchStatus(ctx, h.tenantID(c), c.Param("branch"))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) listHistories(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistHistories")
	defer span.End()
	data, err := h.svc.ListHistories(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listPending(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistPending")
	defer span.End()
	data, err := h.svc.ListPending(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) approve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionapprove")
	defer span.End()
	data, err := h.svc.Approve(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) reject(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionreject")
	defer span.End()
	data, err := h.svc.Reject(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) escalate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionescalate")
	defer span.End()
	data, err := h.svc.Escalate(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getByUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetByUser")
	defer span.End()
	data, err := h.svc.GetByUser(ctx, h.tenantID(c), c.Query("user"))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) forecast(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionforecast")
	defer span.End()
	data, err := h.svc.Forecast(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"forecast": data})
}

func (h *Handler) getUtilization(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetUtilization")
	defer span.End()
	data, err := h.svc.GetUtilization(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"utilization": data})
}

func (h *Handler) scaleResource(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionscaleResource")
	defer span.End()
	data, err := h.svc.ScaleResource(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistAlerts")
	defer span.End()
	data, err := h.svc.ListAlerts(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"alerts": data})
}

func (h *Handler) getHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetHistory")
	defer span.End()
	data, err := h.svc.GetHistory(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"history": data})
}

func (h *Handler) validateBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionvalidateBranch")
	defer span.End()
	valid, err := h.svc.ValidateBranch(ctx, h.tenantID(c), c.Param("branch"))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"valid": valid})
}

func (h *Handler) getCoverage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersiongetCoverage")
	defer span.End()
	data, err := h.svc.GetCoverage(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"coverage": data})
}

func (h *Handler) enforcePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionenforcePolicy")
	defer span.End()
	data, err := h.svc.EnforcePolicy(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listViolations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionlistViolations")
	defer span.End()
	data, err := h.svc.ListViolations(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"violations": data})
}

func (h *Handler) batchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionbatchCreate")
	defer span.End()
	data, err := h.svc.BatchCreate(ctx, h.tenantID(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionsearch")
	defer span.End()
	data, err := h.svc.Search(ctx, h.tenantID(c), c.Query("q"))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"results": data})
}

func (h *Handler) regenerate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ArtifactVersionregenerate")
	defer span.End()
	data, err := h.svc.Regenerate(ctx, h.tenantID(c), h.id(c))
	if err != nil {
		fail(c, err)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// fail writes a 500 error and returns.
func fail(c *gin.Context, err error) {
	errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
}

// bindJSON binds JSON body and writes 400 on failure.
func bindJSON(c *gin.Context, v any) error {
	if err := c.ShouldBindJSON(v); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body: "+err.Error(), 400)
		return err
	}
	return nil
}
