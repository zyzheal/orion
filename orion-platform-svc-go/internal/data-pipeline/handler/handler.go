package handler

import (
    "fmt"
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/data-pipeline/models"
    "orion/platform-svc-go/internal/data-pipeline/service"

    "github.com/gin-gonic/gin"
)

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/data-pipeline")
    r.GET("", auth.RequirePermission("data-pipeline", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("data-pipeline", "read"), h.Get)
	r.POST("", auth.RequirePermission("data-pipeline", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("data-pipeline", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("data-pipeline", "delete"), h.Delete)
	r.POST("/:id/run", auth.RequirePermission("data-pipeline", "write"), h.RunPipeline)
	r.GET("/:id/status", auth.RequirePermission("data-pipeline", "read"), h.GetStatus)
	r.PUT("/:id/pause", auth.RequirePermission("data-pipeline", "write"), h.Pause)
	r.PUT("/:id/resume", auth.RequirePermission("data-pipeline", "write"), h.Resume)
	r.GET("/:id/logs", auth.RequirePermission("data-pipeline", "read"), h.GetLogs)
	r.GET("/schemas", auth.RequirePermission("data-pipeline", "read"), h.ListSchemas)
	r.GET("/lineage/:id", auth.RequirePermission("data-pipeline", "read"), h.GetLineage)
}

func (h *Handler) List(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
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
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    record, err := h.svc.Get(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
        return
    }
    errors.WriteSuccess(c, record)
}

func (h *Handler) Create(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
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
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
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
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    err := h.svc.Delete(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}

// Additional handler methods for extra endpoints
func (h *Handler) RunInspection(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.RunInspection(ctx, tenantID); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "run triggered"})
}
func (h *Handler) GetResults(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.GetResults(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) UpdateStatus(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    status := c.PostForm("status")
    if err := h.svc.UpdateStatus(ctx, tenantID, c.Param("id"), status); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}
func (h *Handler) ListTemplates(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListTemplates(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) GetStats(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    stats, err := h.svc.GetStats(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"stats": stats})
}
func (h *Handler) RunPipeline(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.RunPipeline(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "pipeline run triggered"})
}
func (h *Handler) GetStatus(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    status, err := h.svc.GetStatus(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"status": status})
}
func (h *Handler) Pause(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Pause(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "paused"})
}
func (h *Handler) Resume(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Resume(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "resumed"})
}
func (h *Handler) GetLogs(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    logs, err := h.svc.GetLogs(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"logs": logs})
}
func (h *Handler) ListSchemas(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    schemas, err := h.svc.ListSchemas(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"schemas": schemas})
}
func (h *Handler) GetLineage(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    lineage, err := h.svc.GetLineage(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"lineage": lineage})
}
func (h *Handler) GetConfig(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    config, err := h.svc.GetConfig(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"config": config})
}
func (h *Handler) UpdateConfig(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    var config map[string]interface{}
    if err := c.ShouldBindJSON(&config); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    if err := h.svc.UpdateConfig(ctx, tenantID, config); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "config updated"})
}
func (h *Handler) GetStatusMiddleware(c *gin.Context) {
    ctx := c.Request.Context()
    status, err := h.svc.GetStatusMiddleware(ctx)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"status": status})
}
func (h *Handler) Restart(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Restart(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "restart triggered"})
}
func (h *Handler) Configure(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    var config map[string]interface{}
    if err := c.ShouldBindJSON(&config); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    if err := h.svc.Configure(ctx, tenantID, config); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "configured"})
}
func (h *Handler) ListPlugins(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListPlugins(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) GetPlugin(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    plugin, err := h.svc.GetPlugin(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"plugin": plugin})
}
func (h *Handler) EnablePlugin(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.EnablePlugin(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "enabled"})
}
func (h *Handler) DisablePlugin(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.DisablePlugin(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "disabled"})
}
func (h *Handler) Train(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Train(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "training started"})
}
func (h *Handler) Evaluate(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Evaluate(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "evaluation started"})
}
func (h *Handler) Deploy(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Deploy(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "deployed"})
}
func (h *Handler) Rollback(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Rollback(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "rolled back"})
}
func (h *Handler) GetMetrics(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    metrics, err := h.svc.GetMetrics(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"metrics": metrics})
}
func (h *Handler) ListExperiments(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListExperiments(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) ListArtifacts(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListArtifacts(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) ListModels(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListModels(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) RegisterModel(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.RegisterModel(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "model registered"})
}
func (h *Handler) DeregisterModel(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.DeregisterModel(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "model deregistered"})
}
func (h *Handler) ListPipelines(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListPipelines(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) Trigger(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Trigger(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "triggered"})
}
func (h *Handler) ListTemplates2(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListTemplates2(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) GetBranchStatus(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    status, err := h.svc.GetBranchStatus(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"status": status})
}
func (h *Handler) ListHistories(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListHistories(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) ListPending(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.ListPending(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) Approve(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Approve(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "approved"})
}
func (h *Handler) Reject(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Reject(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "rejected"})
}
func (h *Handler) Escalate(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Escalate(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "escalated"})
}
func (h *Handler) GetByUser(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    data, err := h.svc.GetByUser(ctx, tenantID, c.Param("user"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
}
func (h *Handler) Forecast(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    forecast, err := h.svc.Forecast(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"forecast": forecast})
}
func (h *Handler) GetUtilization(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    utilization, err := h.svc.GetUtilization(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"utilization": utilization})
}
func (h *Handler) ScaleResource(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.ScaleResource(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "scaled"})
}
func (h *Handler) ListAlerts(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    alerts, err := h.svc.ListAlerts(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"alerts": alerts})
}
func (h *Handler) GetHistory(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    history, err := h.svc.GetHistory(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"history": history})
}
func (h *Handler) AddTag(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    tag := c.Param("tag")
    if err := h.svc.AddTag(ctx, tenantID, c.Param("id"), tag); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "tag added"})
}
func (h *Handler) DeleteTag(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    tag := c.Param("tag")
    if err := h.svc.DeleteTag(ctx, tenantID, c.Param("id"), tag); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "tag deleted"})
}
func (h *Handler) CheckCompatibility(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    compatible, err := h.svc.CheckCompatibility(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"compatible": compatible})
}
func (h *Handler) ValidateBranch(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    valid, err := h.svc.ValidateBranch(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"valid": valid})
}
func (h *Handler) GetCoverage(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    coverage, err := h.svc.GetCoverage(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"coverage": coverage})
}
func (h *Handler) EnforcePolicy(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.EnforcePolicy(ctx, tenantID); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "enforced"})
}
func (h *Handler) ListViolations(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    violations, err := h.svc.ListViolations(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"violations": violations})
}
func (h *Handler) BatchCreate(c *gin.Context) {
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    var reqs []models.CreateRequest
    if err := c.ShouldBindJSON(&reqs); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    if err := h.svc.BatchCreate(ctx, tenantID, reqs); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "batch created"})
}
func (h *Handler) Search(c *gin.Context) {
    ctx := c.Request.Context()
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
    ctx := c.Request.Context()
    tenantID := c.GetString("tenant_id")
    if err := h.svc.Regenerate(ctx, tenantID, c.Param("id")); err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "regenerated"})
}
