package handler

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/inspection/models"
	"orion/platform-svc-go/internal/inspection/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/inspection")
	r.GET("", auth.RequirePermission("inspection", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("inspection", "read"), h.Get)
	r.POST("", auth.RequirePermission("inspection", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("inspection", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("inspection", "delete"), h.Delete)
	r.POST("/:id/run", auth.RequirePermission("inspection", "write"), h.RunInspection)
	r.GET("/:id/results", auth.RequirePermission("inspection", "read"), h.GetResults)
	r.PUT("/:id/status", auth.RequirePermission("inspection", "write"), h.UpdateStatus)
	r.GET("/templates", auth.RequirePermission("inspection", "read"), h.ListTemplates)
	r.GET("/stats", auth.RequirePermission("inspection", "read"), h.GetStats)
	r.POST("/batch", auth.RequirePermission("inspection", "write"), h.BatchCreate)
	r.GET("/history", auth.RequirePermission("inspection", "read"), h.GetHistory)
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

func (h *Handler) RunInspection(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.RunInspection(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) GetResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.GetResults(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	status := c.Query("status")
	if status == "" {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err == nil {
			if v, ok := body["status"]; ok {
				status = v.(string)
			}
		}
	}
	res, err := h.svc.UpdateStatus(ctx, tenantID, c.Param("id"), status)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.ListTemplates(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"stats": res})
}

func (h *Handler) RunPipeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	name := c.Query("name")
	if name == "" {
		name = c.Param("name")
	}
		res, err := h.svc.RunPipeline(ctx, tenantID, name)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) GetStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.GetStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Pause(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Pause(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Resume(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Resume(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) GetLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetLogs(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"logs": res})
}

func (h *Handler) ListSchemas(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListSchemas(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"schemas": res})
}

func (h *Handler) GetLineage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.GetLineage(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"lineage": res})
}

func (h *Handler) GetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"config": res})
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var config map[string]interface{}
	if err := c.ShouldBindJSON(&config); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
		res, err := h.svc.UpdateConfig(ctx, tenantID, c.Param("id"), config)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) GetStatusMiddleware(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetStatusMiddleware(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Restart(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Restart(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Configure(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var config map[string]interface{}
	c.ShouldBindJSON(&config)
		res, err := h.svc.Configure(ctx, tenantID, c.Param("id"), config)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ListPlugins(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.ListPlugins(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) GetPlugin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetPlugin(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"plugin": res})
}

func (h *Handler) EnablePlugin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.EnablePlugin(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) DisablePlugin(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.DisablePlugin(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Train(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Train(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Evaluate(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) Deploy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Deploy(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Rollback(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetMetrics(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"metrics": res})
}

func (h *Handler) ListExperiments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListExperiments(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) ListArtifacts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListArtifacts(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) ListModels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListModels(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) RegisterModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
		res, err := h.svc.RegisterModel(ctx, tenantID, req.Name)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) DeregisterModel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.DeregisterModel(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) ListPipelines(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListPipelines(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) Trigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Trigger(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ListTemplates2(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.ListTemplates2(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) GetBranchStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetBranchStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ListHistories(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListHistories(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) ListPending(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListPending(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) Approve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Approve(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) Reject(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Reject(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) Escalate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.Escalate(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) GetByUser(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	userID := c.Query("userId")
	if userID == "" {
		userID = c.Param("userId")
	}
	res, err := h.svc.GetByUser(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": res, "total": len(res)})
}

func (h *Handler) Forecast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Forecast(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"forecast": res})
}

func (h *Handler) GetUtilization(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetUtilization(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"utilization": res})
}

func (h *Handler) ScaleResource(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req struct {
		Scale int `json:"scale" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
		res, err := h.svc.ScaleResource(ctx, tenantID, c.Param("id"), req.Scale)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListAlerts(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"alerts": res})
}

func (h *Handler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetHistory(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"history": res})
}

func (h *Handler) AddTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req struct {
		Tag string `json:"tag" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
		res, err := h.svc.AddTag(ctx, tenantID, c.Param("id"), req.Tag)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) DeleteTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	tag := c.Query("tag")
	if tag == "" {
		var req struct {
			Tag string `json:"tag"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			tag = req.Tag
		}
	}
		res, err := h.svc.DeleteTag(ctx, tenantID, c.Param("id"), tag)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) CheckCompatibility(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.CheckCompatibility(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ValidateBranch(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	res, err := h.svc.ValidateBranch(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) GetCoverage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.GetCoverage(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"coverage": res})
}

func (h *Handler) EnforcePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.EnforcePolicy(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}

func (h *Handler) ListViolations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.ListViolations(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, gin.H{"violations": res})
}

func (h *Handler) BatchCreate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req struct {
		Items []models.CreateRequest `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
		res, err := h.svc.BatchCreate(ctx, tenantID, req.Items)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
		errors.WriteSuccess(c, res)
}

func (h *Handler) Search(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	query := c.Query("q")
	if query == "" {
		query = c.Query("query")
	}
		res, err := h.svc.Search(ctx, tenantID, query)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"results": res})
}

func (h *Handler) Regenerate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
		res, err := h.svc.Regenerate(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, res)
}
