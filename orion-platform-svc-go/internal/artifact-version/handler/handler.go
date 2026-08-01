// Package handler exposes the Artifact Version API over REST.
//
// ARCHITECTURE: This handler is a thin delegation layer. Every method:
//   1. Starts an OTel span
//   2. Extracts tenant_id from context (set by auth middleware)
//   3. Calls the matching service method
//   4. Writes the canonical response envelope
//
// All business logic lives in service.Service — this handler has zero
// business logic. The previous 797-line version was eliminated by
// introducing a generic (ctx, tenant) → response dispatch pattern.
package handler

import (
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/artifact-version/models"
	"orion/platform-svc-go/internal/artifact-version/service"

	"github.com/gin-gonic/gin"
)

// Handler delegates every request to the service layer.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
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
	r.GET("",   auth.RequirePermission("artifact-version", "read"),   withSpan(tracer, "List", h.list))
	r.GET("/:id", auth.RequirePermission("artifact-version", "read"), withSpan(tracer, "Get", h.get))
	r.POST("",  auth.RequirePermission("artifact-version", "write"),  withSpan(tracer, "Create", h.create))
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
	data, err := h.svc.List(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) get(c *gin.Context) {
	data, err := h.svc.Get(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, data)
}

func (h *Handler) create(c *gin.Context) {
	var req models.CreateRequest
	if err := bindJSON(c, &req); err != nil { return }
	data, err := h.svc.Create(c.Request.Context(), h.tenantID(c), req)
	if err != nil { fail(c, err); return }
	errors.WriteCreated(c, data)
}

func (h *Handler) update(c *gin.Context) {
	var req models.CreateRequest
	if err := bindJSON(c, &req); err != nil { return }
	data, err := h.svc.Update(c.Request.Context(), h.tenantID(c), h.id(c), req)
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, data)
}

func (h *Handler) delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), h.tenantID(c), h.id(c)); err != nil {
		fail(c, err); return
	}
	errors.WriteSuccess(c, nil)
}

func (h *Handler) listTags(c *gin.Context) {
	data, err := h.svc.ListTags(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) addTag(c *gin.Context) {
	data, err := h.svc.AddTag(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deleteTag(c *gin.Context) {
	if err := h.svc.DeleteTag(c.Request.Context(), h.tenantID(c), h.id(c), c.Param("tag")); err != nil {
		fail(c, err); return
	}
	errors.WriteSuccess(c, gin.H{"status": "ok"})
}

func (h *Handler) checkCompatibility(c *gin.Context) {
	data, err := h.svc.CheckCompatibility(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) runInspection(c *gin.Context) {
	data, err := h.svc.RunInspection(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getResults(c *gin.Context) {
	data, err := h.svc.GetResults(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) updateStatus(c *gin.Context) {
	data, err := h.svc.UpdateStatus(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getStatus(c *gin.Context) {
	status, err := h.svc.GetStatus(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) runPipeline(c *gin.Context) {
	data, err := h.svc.RunPipeline(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) pause(c *gin.Context) {
	data, err := h.svc.Pause(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) resume(c *gin.Context) {
	data, err := h.svc.Resume(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getLogs(c *gin.Context) {
	data, err := h.svc.GetLogs(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"logs": data})
}

func (h *Handler) listTemplates(c *gin.Context) {
	data, err := h.svc.ListTemplates(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getStats(c *gin.Context) {
	data, err := h.svc.GetStats(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "stats": data})
}

func (h *Handler) listSchemas(c *gin.Context) {
	data, err := h.svc.ListSchemas(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"schemas": data})
}

func (h *Handler) getLineage(c *gin.Context) {
	data, err := h.svc.GetLineage(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"lineage": data})
}

func (h *Handler) getConfig(c *gin.Context) {
	data, err := h.svc.GetConfig(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"config": data})
}

func (h *Handler) updateConfig(c *gin.Context) {
	data, err := h.svc.UpdateConfig(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getStatusMiddleware(c *gin.Context) {
	status, err := h.svc.GetStatusMiddleware(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) restart(c *gin.Context) {
	data, err := h.svc.Restart(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) configure(c *gin.Context) {
	data, err := h.svc.Configure(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listPlugins(c *gin.Context) {
	data, err := h.svc.ListPlugins(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getPlugin(c *gin.Context) {
	data, err := h.svc.GetPlugin(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"plugin": data})
}

func (h *Handler) enablePlugin(c *gin.Context) {
	data, err := h.svc.EnablePlugin(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) disablePlugin(c *gin.Context) {
	data, err := h.svc.DisablePlugin(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) train(c *gin.Context) {
	data, err := h.svc.Train(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) evaluate(c *gin.Context) {
	data, err := h.svc.Evaluate(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deploy(c *gin.Context) {
	data, err := h.svc.Deploy(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) rollback(c *gin.Context) {
	data, err := h.svc.Rollback(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getMetrics(c *gin.Context) {
	data, err := h.svc.GetMetrics(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"metrics": data})
}

func (h *Handler) listArtifacts(c *gin.Context) {
	data, err := h.svc.ListArtifacts(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listExperiments(c *gin.Context) {
	data, err := h.svc.ListExperiments(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listModels(c *gin.Context) {
	data, err := h.svc.ListModels(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) registerModel(c *gin.Context) {
	data, err := h.svc.RegisterModel(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) deregisterModel(c *gin.Context) {
	data, err := h.svc.DeregisterModel(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listPipelines(c *gin.Context) {
	data, err := h.svc.ListPipelines(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) trigger(c *gin.Context) {
	data, err := h.svc.Trigger(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listTemplates2(c *gin.Context) {
	data, err := h.svc.ListTemplates2(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) getBranchStatus(c *gin.Context) {
	status, err := h.svc.GetBranchStatus(c.Request.Context(), h.tenantID(c), c.Param("branch"))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": gin.H{"status": status}})
}

func (h *Handler) listHistories(c *gin.Context) {
	data, err := h.svc.ListHistories(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) listPending(c *gin.Context) {
	data, err := h.svc.ListPending(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) approve(c *gin.Context) {
	data, err := h.svc.Approve(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) reject(c *gin.Context) {
	data, err := h.svc.Reject(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) escalate(c *gin.Context) {
	data, err := h.svc.Escalate(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) getByUser(c *gin.Context) {
	data, err := h.svc.GetByUser(c.Request.Context(), h.tenantID(c), c.Query("user"))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) forecast(c *gin.Context) {
	data, err := h.svc.Forecast(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"forecast": data})
}

func (h *Handler) getUtilization(c *gin.Context) {
	data, err := h.svc.GetUtilization(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"utilization": data})
}

func (h *Handler) scaleResource(c *gin.Context) {
	data, err := h.svc.ScaleResource(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listAlerts(c *gin.Context) {
	data, err := h.svc.ListAlerts(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"alerts": data})
}

func (h *Handler) getHistory(c *gin.Context) {
	data, err := h.svc.GetHistory(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"history": data})
}

func (h *Handler) validateBranch(c *gin.Context) {
	valid, err := h.svc.ValidateBranch(c.Request.Context(), h.tenantID(c), c.Param("branch"))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"valid": valid})
}

func (h *Handler) getCoverage(c *gin.Context) {
	data, err := h.svc.GetCoverage(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"coverage": data})
}

func (h *Handler) enforcePolicy(c *gin.Context) {
	data, err := h.svc.EnforcePolicy(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) listViolations(c *gin.Context) {
	data, err := h.svc.ListViolations(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"violations": data})
}

func (h *Handler) batchCreate(c *gin.Context) {
	data, err := h.svc.BatchCreate(c.Request.Context(), h.tenantID(c))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"status": "ok", "data": data})
}

func (h *Handler) search(c *gin.Context) {
	data, err := h.svc.Search(c.Request.Context(), h.tenantID(c), c.Query("q"))
	if err != nil { fail(c, err); return }
	errors.WriteSuccess(c, gin.H{"results": data})
}

func (h *Handler) regenerate(c *gin.Context) {
	data, err := h.svc.Regenerate(c.Request.Context(), h.tenantID(c), h.id(c))
	if err != nil { fail(c, err); return }
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
