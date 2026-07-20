package handler

import (
    "fmt"
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/middleware-ops/models"
    "orion/platform-svc-go/internal/middleware-ops/service"

    "github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/middleware-ops")
    r.GET("", auth.RequirePermission("middleware-ops", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("middleware-ops", "read"), h.Get)
	r.POST("", auth.RequirePermission("middleware-ops", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("middleware-ops", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("middleware-ops", "delete"), h.Delete)
	r.GET("/config", auth.RequirePermission("middleware-ops", "read"), h.GetConfig)
	r.PUT("/config", auth.RequirePermission("middleware-ops", "write"), h.UpdateConfig)
	r.GET("/status", auth.RequirePermission("middleware-ops", "read"), h.GetStatus)
	r.POST("/:id/restart", auth.RequirePermission("middleware-ops", "write"), h.Restart)
	r.POST("/:id/configure", auth.RequirePermission("middleware-ops", "write"), h.Configure)
	r.GET("/plugins", auth.RequirePermission("middleware-ops", "read"), h.ListPlugins)
	r.GET("/plugins/:name", auth.RequirePermission("middleware-ops", "read"), h.GetPlugin)
	r.POST("/plugins/:name/enable", auth.RequirePermission("middleware-ops", "write"), h.EnablePlugin)
	r.POST("/plugins/:name/disable", auth.RequirePermission("middleware-ops", "write"), h.DisablePlugin)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    q := models.ListQuery{}
    if p := c.Query("page"); p != "" { fmt.Sscanf(p, "%d", &q.Page) }
    if l := c.Query("limit"); l != "" { fmt.Sscanf(l, "%d", &q.Limit) }
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
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
    err := h.svc.Delete(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}

// Additional handler methods for extra endpoints

func (h *Handler) RunInspection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunInspection")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.RunInspection(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResults")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.GetResults(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    err := h.svc.UpdateStatus(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListTemplates(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    stats, err := h.svc.GetStats(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"stats": stats})
}

func (h *Handler) RunPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunPipeline")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.RunPipeline(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
    msg, err := h.svc.Pause(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resume")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Resume(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLogs")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
    var cfg map[string]interface{}
    if err := c.ShouldBindJSON(&cfg); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    msg, err := h.svc.UpdateConfig(ctx, tenantID, cfg)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetStatusMiddleware(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatusMiddleware")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
    msg, err := h.svc.Restart(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Configure(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Configure")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Configure(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) ListPlugins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPlugins")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListPlugins(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPlugin")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    plugin, err := h.svc.GetPlugin(ctx, tenantID, c.Param("name"))
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
    ctx := ctx
    msg, err := h.svc.EnablePlugin(ctx, tenantID, c.Param("name"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) DisablePlugin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisablePlugin")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.DisablePlugin(ctx, tenantID, c.Param("name"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Train(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Train")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Train(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Evaluate(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Deploy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Deploy")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Deploy(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Rollback")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Rollback(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMetrics")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
    data, err := h.svc.ListExperiments(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) ListArtifacts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListArtifacts")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListArtifacts(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) ListModels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListModels")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListModels(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) RegisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterModel")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.RegisterModel(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) DeregisterModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeregisterModel")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.DeregisterModel(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) ListPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelines")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListPipelines(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Trigger")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Trigger(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) ListTemplates2(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTemplates2")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListTemplates(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) GetBranchStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBranchStatus")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    status, err := h.svc.GetBranchStatus(ctx, tenantID)
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
    ctx := ctx
    data, err := h.svc.ListHistories(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) ListPending(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPending")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.ListPending(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) Approve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Approve")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Approve(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Reject(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Reject")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Reject(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Escalate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Escalate")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.Escalate(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) GetByUser(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByUser")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    data, err := h.svc.GetByUser(ctx, tenantID, c.Query("user"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}

func (h *Handler) Forecast(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Forecast")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
    msg, err := h.svc.ScaleResource(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
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
    ctx := ctx
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
    ctx := ctx
    msg, err := h.svc.AddTag(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) DeleteTag(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTag")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.DeleteTag(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) CheckCompatibility(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckCompatibility")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    compatible, err := h.svc.CheckCompatibility(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"compatible": compatible})
}

func (h *Handler) ValidateBranch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateBranch")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    valid, err := h.svc.ValidateBranch(ctx, tenantID)
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
    ctx := ctx
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
    ctx := ctx
    msg, err := h.svc.EnforcePolicy(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) ListViolations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListViolations")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    violations, err := h.svc.ListViolations(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"violations": violations})
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreate")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    msg, err := h.svc.BatchCreate(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}

func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Search")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    results, err := h.svc.Search(ctx, tenantID)
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
    ctx := ctx
    msg, err := h.svc.Regenerate(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": msg})
}
